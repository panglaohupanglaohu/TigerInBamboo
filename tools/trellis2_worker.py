"""Minimal TRELLIS.2 GPU worker for the environment workspace.

Run this inside a working clone/environment of microsoft/TRELLIS.2:

    uvicorn /path/to/TigerInBamboo/tools/trellis2_worker.py:app \
      --host 127.0.0.1 --port 7862

Then start TigerInBamboo with TRELLIS2_SERVER_URL=http://127.0.0.1:7862.
The worker accepts the exact artwork selected in home.html and returns a PBR GLB.
"""
from __future__ import annotations

import base64
import io
import os
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

MODEL_ID = os.environ.get("TRELLIS2_MODEL", "microsoft/TRELLIS.2-4B")
DECIMATION_TARGET = int(os.environ.get("TRELLIS2_DECIMATION_TARGET", "350000"))

app = FastAPI(title="TigerInBamboo TRELLIS.2 Worker", version="1.0")
_pipeline = None
_pipeline_lock = threading.Lock()


class GenerationRequest(BaseModel):
    image: str = Field(..., description="data:image/... URL from the home-page artwork frame")
    name: str = "artwork"
    domain: str = "terrain"
    subject: str = "mountain"
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


def _decode_image(data_url: str) -> Image.Image:
    if not data_url.startswith("data:image/") or "," not in data_url:
        raise ValueError("image must be a data:image/... URL")
    raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    if len(raw) > 10 * 1024 * 1024:
        raise ValueError("decoded artwork exceeds 10 MB")
    return Image.open(io.BytesIO(raw)).convert("RGBA")


@app.get("/health")
def health() -> dict:
    try:
        import torch

        cuda = torch.cuda.is_available()
        device = torch.cuda.get_device_name(0) if cuda else None
    except ImportError:
        cuda = False
        device = None
    return {"status": "ok" if cuda else "unavailable", "model": MODEL_ID, "cuda": cuda, "device": device}


@app.post("/generate")
def generate(request: GenerationRequest) -> Response:
    try:
        image = _decode_image(request.image)
        pipeline = _load_pipeline()
        with _pipeline_lock:
            mesh = pipeline.run(image, seed=request.seed)[0]
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
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TRELLIS.2 generation failed: {exc}") from exc
    return Response(content=data, media_type="model/gltf-binary")
