"""Image-to-3D worker for the environment workspace.

Run this inside a working clone/environment of microsoft/TRELLIS.2:

    uvicorn /path/to/TigerInBamboo/tools/trellis2_worker.py:app \
      --host 127.0.0.1 --port 7862

Then start TigerInBamboo with TRELLIS2_SERVER_URL=http://127.0.0.1:7862.
The worker accepts the exact artwork selected in home.html and returns a PBR GLB.

When CUDA/TRELLIS.2 is unavailable, the same API falls back to the bundled
TripoSR checkout. That keeps the browser workflow honest: confirmed crops still
go through a real single-image-to-mesh model instead of a flat mask extrusion.

Enhancements (optimization plan):
- disk cache (sha1 of crop + engine + params)
- in-flight dedup for identical keys
- pipeline lock only around model inference
- optional task mode with SSE progress (async=true or Accept prefers JSON)
- rembg foreground, higher MC resolution, mesh repair
"""
from __future__ import annotations

import base64
import inspect
import io
import json
import os
import sys
import tempfile
import threading
import time
import traceback
import urllib.parse
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from PIL import Image

# Local shared helpers (same package dir)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cache_utils import cache_get, cache_key, cache_put, cache_stats  # noqa: E402
from metrics import metrics  # noqa: E402

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

MODEL_ID = os.environ.get("TRELLIS2_MODEL", "microsoft/TRELLIS.2-4B")
DECIMATION_TARGET = int(os.environ.get("TRELLIS2_DECIMATION_TARGET", "350000"))
ENGINE = os.environ.get("IMAGE_TO_3D_ENGINE", "auto").strip().lower()
TRIPOSR_ROOT = Path(os.environ.get("TRIPOSR_ROOT", Path(__file__).resolve().parent / "TripoSR"))
TRIPOSR_MODEL = os.environ.get("TRIPOSR_MODEL", "stabilityai/TripoSR")
TRIPOSR_DEVICE = os.environ.get("TRIPOSR_DEVICE", "auto").strip().lower()
TRIPOSR_CHUNK_SIZE = int(os.environ.get("TRIPOSR_CHUNK_SIZE", "4096"))
# Default 192 (was 96); override with TRIPOSR_MC_RES or TRIPOSR_MC_RESOLUTION
TRIPOSR_MC_RESOLUTION = int(
    os.environ.get("TRIPOSR_MC_RES")
    or os.environ.get("TRIPOSR_MC_RESOLUTION", "192")
)
TRIPOSR_FOREGROUND_RATIO = float(os.environ.get("TRIPOSR_FOREGROUND_RATIO", "0.85"))
TRIPOSR_TARGET_FACES = int(os.environ.get("TRIPOSR_TARGET_FACES", "200000"))
TRIPOSR_USE_REMBG = os.environ.get("TRIPOSR_USE_REMBG", "1").strip().lower() not in {"0", "false", "no"}
MODEL_VERSION = os.environ.get("TRELLIS2_CACHE_VERSION", "v2")
GLB_CACHE_DIR = Path(os.environ.get(
    "TRELLIS2_GLB_CACHE",
    os.path.expanduser("~/.cache/tigerinbamboo/trellis2_glb"),
)).expanduser()
GLB_CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TigerInBamboo Image-to-3D Worker", version="1.2")
_pipeline = None
_triposr_model = None
_pipeline_lock = threading.Lock()
_rembg_session = None
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="img2mesh")

# In-flight dedup: key -> Future[str] (glb path)
_inflight: dict[str, Future] = {}
_inflight_mu = threading.Lock()

# Task registry for SSE progress
_tasks: dict[str, dict[str, Any]] = {}
_tasks_mu = threading.Lock()


class GenerationRequest(BaseModel):
    image: str = Field(..., description="data:image/... URL from the home-page artwork frame")
    name: str = "artwork"
    domain: str = "terrain"
    subject: str = "mountain"
    layerId: str | None = None
    reconstructionProfile: dict[str, Any] | None = None
    objectReference: dict[str, Any] | None = None
    seed: int = Field(2026, ge=0, le=2**32 - 1)
    refresh: bool = False
    asyncMode: bool = Field(False, alias="async", description="Return task_id + SSE progress instead of GLB body")

    model_config = {"populate_by_name": True}


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    with _pipeline_lock:
        if _pipeline is None:
            try:
                from trellis2.pipelines import Trellis2ImageTo3DPipeline
            except ImportError as exc:
                raise RuntimeError(
                    "trellis2 cannot be imported; run this worker inside the official TRELLIS.2 environment"
                ) from exc
            _pipeline = Trellis2ImageTo3DPipeline.from_pretrained(MODEL_ID)
            _pipeline.cuda()
    return _pipeline


def _torch_info() -> tuple[bool, bool, str | None]:
    try:
        import torch

        cuda = torch.cuda.is_available()
        mps = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        device = torch.cuda.get_device_name(0) if cuda else "mps" if mps else None
        return cuda, mps, device
    except Exception:
        return False, False, None


def _select_engine() -> str:
    if ENGINE in {"trellis2", "trellis"}:
        return "trellis2"
    if ENGINE in {"triposr", "tripo"}:
        return "triposr"
    cuda, _, _ = _torch_info()
    return "trellis2" if cuda else "triposr"


def _triposr_device() -> str:
    if TRIPOSR_DEVICE in {"cuda", "cuda:0"}:
        cuda, _, _ = _torch_info()
        return "cuda:0" if cuda else "cpu"
    if TRIPOSR_DEVICE == "mps":
        _, mps, _ = _torch_info()
        return "mps" if mps else "cpu"
    if TRIPOSR_DEVICE in {"auto", ""}:
        cuda, mps, _ = _torch_info()
        if cuda:
            return "cuda:0"
        # Prefer MPS when available (measured for compatibility in TODO-6)
        if mps:
            return "mps"
        return "cpu"
    return "cpu"


def _load_triposr():
    global _triposr_model
    if _triposr_model is not None:
        return _triposr_model
    with _pipeline_lock:
        if _triposr_model is None:
            if not TRIPOSR_ROOT.exists():
                raise RuntimeError(f"TripoSR checkout not found: {TRIPOSR_ROOT}")
            root = str(TRIPOSR_ROOT)
            if root not in sys.path:
                sys.path.insert(0, root)
            try:
                from tsr.system import TSR
            except ImportError as exc:
                raise RuntimeError("TripoSR cannot be imported from tools/TripoSR") from exc
            model = TSR.from_pretrained(TRIPOSR_MODEL, config_name="config.yaml", weight_name="model.ckpt")
            model.renderer.set_chunk_size(TRIPOSR_CHUNK_SIZE)
            model.to(_triposr_device())
            model.eval()
            _triposr_model = model
    return _triposr_model


def _decode_image_bytes(data_url: str) -> tuple[Image.Image, bytes]:
    if not data_url.startswith("data:image/") or "," not in data_url:
        raise ValueError("image must be a data:image/... URL")
    raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    if len(raw) > 10 * 1024 * 1024:
        raise ValueError("decoded artwork exceeds 10 MB")
    return Image.open(io.BytesIO(raw)).convert("RGBA"), raw


def _remove_background(image: Image.Image) -> Image.Image:
    """Optional rembg pass; falls back to original if rembg missing or fails."""
    global _rembg_session
    if not TRIPOSR_USE_REMBG:
        return image
    try:
        from rembg import new_session, remove
    except ImportError:
        return image
    try:
        if _rembg_session is None:
            _rembg_session = new_session("u2net")
        return remove(image.convert("RGBA"), session=_rembg_session)
    except Exception:
        return image


def _prepare_triposr_image(image: Image.Image) -> Image.Image:
    root = str(TRIPOSR_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    import numpy as np

    from tsr.utils import resize_foreground

    rgba = _remove_background(image.convert("RGBA"))
    alpha = np.asarray(rgba.getchannel("A"))
    if alpha.max(initial=0) == 0:
        raise ValueError("confirmed crop has no visible pixels")
    try:
        rgba = resize_foreground(rgba, TRIPOSR_FOREGROUND_RATIO)
    except Exception:
        pass
    arr = np.asarray(rgba).astype(np.float32) / 255.0
    rgb = arr[:, :, :3] * arr[:, :, 3:4] + (1.0 - arr[:, :, 3:4]) * 0.5
    return Image.fromarray((rgb * 255.0).clip(0, 255).astype(np.uint8)).convert("RGB")


def _repair_and_simplify(mesh, target_faces: int = TRIPOSR_TARGET_FACES):
    """trimesh post-process: normals + optional decimation (lock-free)."""
    try:
        import trimesh

        if not isinstance(mesh, trimesh.Trimesh):
            mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=False)
        mesh.remove_unreferenced_vertices()
        try:
            trimesh.repair.fix_normals(mesh)
        except Exception:
            pass
        if target_faces > 0 and len(mesh.faces) > target_faces:
            try:
                mesh = mesh.simplify_quadric_decimation(target_faces)
            except Exception:
                pass
        return mesh
    except Exception:
        return mesh


def _export_glb(mesh) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as handle:
        output = Path(handle.name)
    try:
        mesh.export(str(output), file_type="glb")
        data = output.read_bytes()
    finally:
        output.unlink(missing_ok=True)
    if len(data) < 20:
        raise RuntimeError("empty GLB export")
    return data


def _generate_triposr(image: Image.Image, progress=None) -> bytes:
    import torch

    model = _load_triposr()
    if progress:
        progress("remove-bg", 10)
    prepared = _prepare_triposr_image(image)
    device = _triposr_device()
    if progress:
        progress("inference", 30)
    # Lock only around model inference / extract_mesh (GPU/CPU heavy shared state)
    with _pipeline_lock:
        with torch.no_grad():
            scene_codes = model([prepared], device=device)
            if progress:
                progress("mesh", 70)
            meshes = model.extract_mesh(scene_codes, True, resolution=TRIPOSR_MC_RESOLUTION)
    if not meshes:
        raise RuntimeError("TripoSR returned no mesh")
    mesh = meshes[0]
    # TripoSR axis remap → artwork anchor convention
    mesh.vertices = mesh.vertices[:, [1, 2, 0]]
    if progress:
        progress("export", 90)
    mesh = _repair_and_simplify(mesh)
    return _export_glb(mesh)


def _reference_text(value: Any, max_items: int = 8) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return ", ".join(str(item) for item in value[:max_items] if item)
    if isinstance(value, dict):
        return ", ".join(f"{key}: {val}" for key, val in value.items() if val)
    return ""


def _build_generation_prompts(request: GenerationRequest) -> tuple[str, str]:
    reference = request.objectReference or {}
    profile = request.reconstructionProfile or {}
    label = reference.get("label") or request.subject
    archetype = reference.get("archetype") or ""
    parts = _reference_text(reference.get("parts"))
    traits = _reference_text(reference.get("physicalTraits"))
    geometry = _reference_text(reference.get("geometryHints"))
    profile_kind = profile.get("label") or profile.get("kind") or ""
    prompt = (
        f"single real-world 3D object from a transparent artwork crop; subject {label}; "
        f"structure {profile_kind}; morphology {archetype}; parts {parts}; physical traits {traits}; geometry {geometry}; "
        "faithful to the crop silhouette, volumetric, coherent parts, not a flat cutout"
    )
    negatives = _reference_text(reference.get("negativeHints"))
    negative_prompt = (
        f"{negatives}; flat paper board, cardboard cutout, random proxy geometry, floating pieces, wrong orientation, "
        "missing limbs, missing branches, melted blob"
    )
    return prompt[:1800], negative_prompt[:1200]


def _generate_trellis2(image: Image.Image, seed: int, prompt: str = "", negative_prompt: str = "", progress=None) -> bytes:
    pipeline = _load_pipeline()
    if progress:
        progress("inference", 30)
    with _pipeline_lock:
        run_kwargs: dict[str, Any] = {"seed": seed}
        try:
            parameters = inspect.signature(pipeline.run).parameters
            if prompt and "prompt" in parameters:
                run_kwargs["prompt"] = prompt
            if negative_prompt and "negative_prompt" in parameters:
                run_kwargs["negative_prompt"] = negative_prompt
        except (TypeError, ValueError):
            pass
        mesh = pipeline.run(image, **run_kwargs)[0]
        mesh.simplify(16_777_216)

        import o_voxel

        if progress:
            progress("mesh", 70)
        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=DECIMATION_TARGET,
            texture_size=2048,
            remesh=True,
            remesh_band=1,
            remesh_project=True,
            verbose=False,
        )
        if progress:
            progress("export", 90)
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as handle:
            output = Path(handle.name)
        try:
            glb.export(str(output), extension_webp=True)
            data = output.read_bytes()
        finally:
            output.unlink(missing_ok=True)
    return data


def _make_cache_key(crop_bytes: bytes, engine: str) -> str:
    return cache_key(
        crop_bytes,
        engine,
        TRIPOSR_MC_RESOLUTION if engine == "triposr" else DECIMATION_TARGET,
        MODEL_VERSION,
        TRIPOSR_TARGET_FACES if engine == "triposr" else 0,
    )


def _run_generate_to_path(request: GenerationRequest, crop_bytes: bytes, engine: str, progress=None) -> str:
    """Run generation and write GLB to disk cache path; return path string."""
    t0 = time.perf_counter()
    image = Image.open(io.BytesIO(crop_bytes)).convert("RGBA")
    prompt, negative_prompt = _build_generation_prompts(request)
    if engine == "trellis2":
        data = _generate_trellis2(image, request.seed, prompt, negative_prompt, progress=progress)
    else:
        data = _generate_triposr(image, progress=progress)
    key = _make_cache_key(crop_bytes, engine)
    glb_path = GLB_CACHE_DIR / f"{key}.glb"
    glb_path.write_bytes(data)
    elapsed = time.perf_counter() - t0
    cache_put(
        "trellis2",
        key,
        {"glb_path": str(glb_path), "engine": engine, "bytes": len(data)},
        elapsed,
    )
    metrics.observe("generate", elapsed)
    metrics.count(f"engine.{engine}")
    if progress:
        progress("done", 100)
    return str(glb_path)


def generate_dedup(key: str, request: GenerationRequest, crop_bytes: bytes, engine: str, progress=None) -> str:
    """In-flight dedup: concurrent identical keys share one Future."""
    with _inflight_mu:
        existing = _inflight.get(key)
        if existing is not None:
            metrics.count("generate.dedup_wait")
            owner = False
            future = existing
        else:
            owner = True
            future = Future()
            _inflight[key] = future

    if owner:
        try:
            path = _run_generate_to_path(request, crop_bytes, engine, progress=progress)
            future.set_result(path)
            return path
        except Exception as exc:
            future.set_exception(exc)
            raise
        finally:
            with _inflight_mu:
                _inflight.pop(key, None)
    return future.result()


def _task_progress(task_id: str, stage: str, pct: float) -> None:
    with _tasks_mu:
        task = _tasks.get(task_id)
        if not task:
            return
        if task.get("cancel"):
            raise RuntimeError("cancelled")
        task.update(stage=stage, pct=pct)


def _run_task(task_id: str, request: GenerationRequest, crop_bytes: bytes, engine: str, key: str) -> None:
    def progress(stage: str, pct: float) -> None:
        _task_progress(task_id, stage, pct)

    try:
        with _tasks_mu:
            if _tasks.get(task_id, {}).get("cancel"):
                raise RuntimeError("cancelled")
            _tasks[task_id].update(stage="queued", pct=0)
        path = generate_dedup(key, request, crop_bytes, engine, progress=progress)
        with _tasks_mu:
            _tasks[task_id].update(glb_path=path, stage="done", pct=100, done=True, error=None)
    except Exception as exc:
        with _tasks_mu:
            _tasks[task_id].update(error=str(exc), done=True, stage="error")
        traceback.print_exc()


@app.get("/health")
def health() -> dict:
    cuda, mps, device = _torch_info()
    engine = _select_engine()
    if engine == "trellis2" and not cuda:
        return {
            "status": "unavailable",
            "available": False,
            "engine": "trellis2",
            "model": MODEL_ID,
            "cuda": cuda,
            "mps": mps,
            "device": device,
            "reason": "TRELLIS.2 requires a CUDA GPU; set IMAGE_TO_3D_ENGINE=triposr for local fallback",
        }
    if engine == "triposr" and not TRIPOSR_ROOT.exists():
        return {
            "status": "unavailable",
            "available": False,
            "engine": "triposr",
            "model": TRIPOSR_MODEL,
            "cuda": cuda,
            "mps": mps,
            "device": None,
            "reason": f"TripoSR checkout not found: {TRIPOSR_ROOT}",
        }
    selected_device = device if engine == "trellis2" else _triposr_device()
    metrics.set_gauge("engine", engine)
    metrics.set_gauge("device", selected_device)
    metrics.set_gauge("mc_resolution", TRIPOSR_MC_RESOLUTION if engine == "triposr" else None)
    return {
        "status": "ok",
        "available": True,
        "engine": engine,
        "model": MODEL_ID if engine == "trellis2" else f"{TRIPOSR_MODEL} fallback",
        "cuda": cuda,
        "mps": mps,
        "device": selected_device,
        "requiresCuda": engine == "trellis2",
        "resolution": TRIPOSR_MC_RESOLUTION if engine == "triposr" else None,
        "rembg": TRIPOSR_USE_REMBG,
        "cache": cache_stats("trellis2"),
    }


@app.get("/metrics")
def metrics_endpoint() -> dict:
    snap = metrics.snapshot()
    snap["cache"] = cache_stats("trellis2")
    return snap


@app.post("/generate")
def generate(
    request: GenerationRequest,
    async_query: bool = Query(False, alias="async"),
) -> Response:
    try:
        image, crop_bytes = _decode_image_bytes(request.image)
        engine = _select_engine()
        key = _make_cache_key(crop_bytes, engine)
        want_async = bool(request.asyncMode or async_query)

        if not request.refresh:
            hit = cache_get("trellis2", key)
            if hit and isinstance(hit.get("glb_path"), str) and Path(hit["glb_path"]).exists():
                metrics.count("cache.hit")
                if want_async:
                    task_id = uuid.uuid4().hex[:12]
                    with _tasks_mu:
                        _tasks[task_id] = {
                            "stage": "done",
                            "pct": 100,
                            "done": True,
                            "glb_path": hit["glb_path"],
                            "error": None,
                            "cancel": False,
                            "cached": True,
                            "engine": engine,
                        }
                    return JSONResponse({"task_id": task_id, "cached": True, "engine": engine})
                return FileResponse(
                    hit["glb_path"],
                    media_type="model/gltf-binary",
                    headers={
                        "X-Image-To-3D-Engine": engine,
                        "X-Cache": "HIT",
                        "X-Object-Reference": urllib.parse.quote(
                            str((request.objectReference or {}).get("label") or request.subject)[:120],
                            safe="",
                        ),
                    },
                )
        metrics.count("cache.miss")

        if want_async:
            task_id = uuid.uuid4().hex[:12]
            with _tasks_mu:
                _tasks[task_id] = {
                    "stage": "queued",
                    "pct": 0,
                    "done": False,
                    "glb_path": None,
                    "error": None,
                    "cancel": False,
                    "cached": False,
                    "engine": engine,
                }
            _executor.submit(_run_task, task_id, request, crop_bytes, engine, key)
            return JSONResponse({"task_id": task_id, "cached": False, "engine": engine})

        path = generate_dedup(key, request, crop_bytes, engine)
        reference = request.objectReference or {}
        reference_label = str(reference.get("label") or reference.get("key") or request.subject)[:120]
        return FileResponse(
            path,
            media_type="model/gltf-binary",
            headers={
                "X-Image-To-3D-Engine": engine,
                "X-Cache": "MISS",
                "X-Object-Reference": urllib.parse.quote(reference_label, safe=""),
            },
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"image-to-3D generation failed: {exc}") from exc


@app.get("/generate/stream/{task_id}")
async def generate_stream(task_id: str):
    import asyncio

    async def events():
        while True:
            with _tasks_mu:
                task = _tasks.get(task_id)
                payload = dict(task) if task else None
            if payload is None:
                yield f"data: {json.dumps({'error': 'unknown task'})}\n\n"
                return
            # Do not stream absolute glb_path to clients
            safe = {
                "stage": payload.get("stage"),
                "pct": payload.get("pct"),
                "done": payload.get("done"),
                "error": payload.get("error"),
                "cached": payload.get("cached"),
                "engine": payload.get("engine"),
            }
            yield f"data: {json.dumps(safe)}\n\n"
            if payload.get("done"):
                return
            await asyncio.sleep(0.8)

    return StreamingResponse(events(), media_type="text/event-stream")


@app.get("/generate/result/{task_id}")
def generate_result(task_id: str) -> Response:
    with _tasks_mu:
        task = _tasks.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="unknown task")
        if not task.get("done"):
            raise HTTPException(status_code=409, detail="task not finished")
        if task.get("error"):
            raise HTTPException(status_code=500, detail=str(task["error"]))
        path = task.get("glb_path")
        engine = str(task.get("engine") or _select_engine())
    if not path or not Path(path).exists():
        raise HTTPException(status_code=404, detail="GLB missing")
    return FileResponse(
        path,
        media_type="model/gltf-binary",
        headers={"X-Image-To-3D-Engine": engine, "X-Cache": "HIT" if task.get("cached") else "MISS"},
    )


@app.post("/generate/cancel/{task_id}")
def generate_cancel(task_id: str) -> dict:
    with _tasks_mu:
        task = _tasks.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="unknown task")
        task["cancel"] = True
        if not task.get("done"):
            task.update(done=True, error="cancelled", stage="cancelled")
    return {"ok": True, "task_id": task_id}
