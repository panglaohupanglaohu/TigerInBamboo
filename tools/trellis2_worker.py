"""Image-to-3D worker for the environment workspace.

Run this inside a working clone/environment of microsoft/TRELLIS.2:

    uvicorn /path/to/TigerInBamboo/tools/trellis2_worker.py:app \
      --host 127.0.0.1 --port 7862

Then start TigerInBamboo with TRELLIS2_SERVER_URL=http://127.0.0.1:7862.
The worker accepts the exact artwork selected in home.html and returns a PBR GLB.

When CUDA/TRELLIS.2 is unavailable, the same API falls back to the bundled
TripoSR checkout. That keeps the browser workflow honest: confirmed crops still
go through a real single-image-to-mesh model instead of a flat mask extrusion.
"""
from __future__ import annotations

import base64
import inspect
import io
import os
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

MODEL_ID = os.environ.get("TRELLIS2_MODEL", "microsoft/TRELLIS.2-4B")
DECIMATION_TARGET = int(os.environ.get("TRELLIS2_DECIMATION_TARGET", "350000"))
ENGINE = os.environ.get("IMAGE_TO_3D_ENGINE", "auto").strip().lower()
TRIPOSR_ROOT = Path(os.environ.get("TRIPOSR_ROOT", Path(__file__).resolve().parent / "TripoSR"))
TRIPOSR_MODEL = os.environ.get("TRIPOSR_MODEL", "stabilityai/TripoSR")
TRIPOSR_DEVICE = os.environ.get("TRIPOSR_DEVICE", "cpu").strip().lower()
TRIPOSR_CHUNK_SIZE = int(os.environ.get("TRIPOSR_CHUNK_SIZE", "4096"))
TRIPOSR_MC_RESOLUTION = int(os.environ.get("TRIPOSR_MC_RESOLUTION", "96"))
TRIPOSR_FOREGROUND_RATIO = float(os.environ.get("TRIPOSR_FOREGROUND_RATIO", "0.85"))

app = FastAPI(title="TigerInBamboo Image-to-3D Worker", version="1.1")
_pipeline = None
_triposr_model = None
_active_engine = None
_pipeline_lock = threading.Lock()


class GenerationRequest(BaseModel):
    image: str = Field(..., description="data:image/... URL from the home-page artwork frame")
    name: str = "artwork"
    domain: str = "terrain"
    subject: str = "mountain"
    layerId: str | None = None
    reconstructionProfile: dict[str, Any] | None = None
    objectReference: dict[str, Any] | None = None
    seed: int = Field(2026, ge=0, le=2**32 - 1)


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


def _decode_image(data_url: str) -> Image.Image:
    if not data_url.startswith("data:image/") or "," not in data_url:
        raise ValueError("image must be a data:image/... URL")
    raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    if len(raw) > 10 * 1024 * 1024:
        raise ValueError("decoded artwork exceeds 10 MB")
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def _prepare_triposr_image(image: Image.Image) -> Image.Image:
    root = str(TRIPOSR_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    import numpy as np

    from tsr.utils import resize_foreground

    rgba = image.convert("RGBA")
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


def _generate_triposr(image: Image.Image) -> bytes:
    import torch

    model = _load_triposr()
    prepared = _prepare_triposr_image(image)
    device = _triposr_device()
    with _pipeline_lock:
        with torch.no_grad():
            scene_codes = model([prepared], device=device)
            meshes = model.extract_mesh(scene_codes, True, resolution=TRIPOSR_MC_RESOLUTION)
        if not meshes:
            raise RuntimeError("TripoSR returned no mesh")
        mesh = meshes[0]
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as handle:
            output = Path(handle.name)
        try:
            mesh.export(str(output), file_type="glb")
            data = output.read_bytes()
        finally:
            output.unlink(missing_ok=True)
    if len(data) < 20:
        raise RuntimeError("TripoSR returned an empty GLB")
    return data


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


def _generate_trellis2(image: Image.Image, seed: int, prompt: str = "", negative_prompt: str = "") -> bytes:
    pipeline = _load_pipeline()
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
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as handle:
            output = Path(handle.name)
        try:
            glb.export(str(output), extension_webp=True)
            data = output.read_bytes()
        finally:
            output.unlink(missing_ok=True)
    return data


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
    }


@app.post("/generate")
def generate(request: GenerationRequest) -> Response:
    try:
        image = _decode_image(request.image)
        engine = _select_engine()
        prompt, negative_prompt = _build_generation_prompts(request)
        data = _generate_trellis2(image, request.seed, prompt, negative_prompt) if engine == "trellis2" else _generate_triposr(image)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"image-to-3D generation failed: {exc}") from exc
    reference = request.objectReference or {}
    headers = {
        "X-Image-To-3D-Engine": engine,
        "X-Object-Reference": str(reference.get("label") or reference.get("key") or request.subject)[:120],
    }
    return Response(content=data, media_type="model/gltf-binary", headers=headers)
