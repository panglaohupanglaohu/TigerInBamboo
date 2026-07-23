"""Pixel-locked artwork-to-scene worker.

This worker deliberately separates scene understanding from object generation:

1. MapAnything reconstructs per-pixel metric geometry and camera intrinsics.
2. Grounding DINO + SAM 2.1 optionally isolate the selected environment subject.
3. The browser back-projects the original artwork texture with these maps, so
   visible positions and silhouettes remain tied to the source pixels.

Install this file in a MapAnything environment and run:

    uvicorn /path/to/TigerInBamboo/tools/scene_lift_worker.py:app \
      --host 127.0.0.1 --port 7863

Then start the main app with:

    SCENE_LIFT_SERVER_URL=http://127.0.0.1:7863 uvicorn backend.main:app --port 8931

For semantic masks, also clone Grounded-SAM-2 and configure:

    GROUNDED_SAM2_ROOT=/path/to/Grounded-SAM-2
    SAM2_CHECKPOINT=/path/to/sam2.1_hiera_large.pt
    SAM2_CONFIG=configs/sam2.1/sam2.1_hiera_l.yaml

The geometry service remains usable when the segmentation stack is absent. If
MapAnything is not installed, it can use a cached Depth Anything V2 model as an
explicitly reported relative-depth fallback; it never presents that fallback as
metric geometry or as semantic segmentation.
"""
from __future__ import annotations

import base64
import importlib.util
import io
import os
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

GEOMETRY_MODEL = os.environ.get("MAPANYTHING_MODEL", "facebook/map-anything-apache")
GROUNDING_MODEL = os.environ.get("GROUNDING_MODEL", "IDEA-Research/grounding-dino-base")
GROUNDING_ROOT = os.environ.get("GROUNDED_SAM2_ROOT", "").strip()
SAM2_CHECKPOINT = os.environ.get("SAM2_CHECKPOINT", "").strip()
SAM2_CONFIG = os.environ.get("SAM2_CONFIG", "configs/sam2.1/sam2.1_hiera_l.yaml")
REQUEST_LIMIT = 10 * 1024 * 1024

app = FastAPI(title="TigerInBamboo Scene Lift Worker", version="1.0")
_geometry_model = None
_fallback_depth_model = None
_segmenter = None
_model_lock = threading.RLock()


class Subject(BaseModel):
    id: str
    label: str
    prompt: str


class AnalyzeRequest(BaseModel):
    image: str = Field(..., description="data:image/... URL from the home-page artwork frame")
    name: str = "artwork"
    domain: str = "terrain"
    subject: Subject
    gridMaxSide: int = Field(192, ge=64, le=320)


def _device() -> str:
    import torch

    requested = os.environ.get("SCENE_LIFT_DEVICE", "auto").lower()
    if requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _segmentation_configured() -> bool:
    return bool(GROUNDING_ROOT and SAM2_CHECKPOINT and Path(GROUNDING_ROOT).exists() and Path(SAM2_CHECKPOINT).exists())


def _decode_image(data_url: str) -> Image.Image:
    if not data_url.startswith("data:image/") or "," not in data_url:
        raise ValueError("image must be a data:image/... URL")
    raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    if len(raw) > REQUEST_LIMIT:
        raise ValueError("decoded artwork exceeds 10 MB")
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _load_geometry_model():
    global _geometry_model
    if _geometry_model is not None:
        return _geometry_model
    with _model_lock:
        if _geometry_model is None:
            try:
                from mapanything.models import MapAnything
            except ImportError as exc:
                raise RuntimeError("mapanything is not installed in this worker environment") from exc
            _geometry_model = MapAnything.from_pretrained(GEOMETRY_MODEL).to(_device()).eval()
    return _geometry_model


def _load_fallback_depth_model():
    global _fallback_depth_model
    if _fallback_depth_model is not None:
        return _fallback_depth_model
    with _model_lock:
        if _fallback_depth_model is None:
            try:
                from transformers import pipeline
            except ImportError as exc:
                raise RuntimeError("neither mapanything nor transformers is installed") from exc
            model_id = os.environ.get("DEPTH_ANYTHING_MODEL", "depth-anything/Depth-Anything-V2-Small-hf")
            device = int(os.environ.get("DEPTH_ANYTHING_DEVICE", "-1"))
            _fallback_depth_model = pipeline("depth-estimation", model=model_id, device=device)
    return _fallback_depth_model


class _GroundedSam2:
    def __init__(self) -> None:
        if not _segmentation_configured():
            raise RuntimeError("Grounded SAM 2 paths are not configured")
        root = str(Path(GROUNDING_ROOT).resolve())
        if root not in sys.path:
            sys.path.insert(0, root)
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

        self.torch = torch
        self.device = _device()
        self.processor = AutoProcessor.from_pretrained(GROUNDING_MODEL)
        self.grounder = AutoModelForZeroShotObjectDetection.from_pretrained(GROUNDING_MODEL).to(self.device).eval()
        sam = build_sam2(SAM2_CONFIG, SAM2_CHECKPOINT, device=self.device)
        self.predictor = SAM2ImagePredictor(sam)

    def segment(self, image: Image.Image, subject: Subject, target_size: tuple[int, int]) -> list[dict[str, Any]]:
        import math
        import numpy as np

        # Grounding DINO treats a period-delimited prompt as a phrase bank.  Long
        # descriptive prompts made it bind every token to the same box (and, on
        # paintings, produced dozens of duplicate boxes).  The first phrase is
        # the canonical object name; SAM receives only the selected instances.
        prompt = subject.prompt.split(".", 1)[0].strip().lower()
        if not prompt.endswith("."):
            prompt += "."
        self.predictor.set_image(np.asarray(image))
        inputs = self.processor(images=image, text=prompt, return_tensors="pt").to(self.device)
        with self.torch.no_grad():
            outputs = self.grounder(**inputs)
        box_threshold = float(os.environ.get("GROUNDING_BOX_THRESHOLD", "0.28"))
        text_threshold = float(os.environ.get("GROUNDING_TEXT_THRESHOLD", "0.22"))
        post_process = self.processor.post_process_grounded_object_detection
        try:
            # transformers >= 5 names this argument ``box_threshold``.
            detected = post_process(
                outputs,
                inputs.input_ids,
                box_threshold=box_threshold,
                text_threshold=text_threshold,
                target_sizes=[image.size[::-1]],
            )[0]
        except TypeError as exc:
            if "box_threshold" not in str(exc):
                raise
            # Keep compatibility with older Grounding DINO processors.
            detected = post_process(
                outputs,
                inputs.input_ids,
                threshold=box_threshold,
                text_threshold=text_threshold,
                target_sizes=[image.size[::-1]],
            )[0]
        raw_boxes = detected["boxes"].detach().cpu().numpy()
        if raw_boxes.size == 0:
            return []
        raw_confidence = detected["scores"].detach().cpu().numpy().tolist()
        raw_labels = list(detected.get("labels", []))

        def overlap(a, b) -> tuple[float, float]:
            left, top = max(a[0], b[0]), max(a[1], b[1])
            right, bottom = min(a[2], b[2]), min(a[3], b[3])
            intersection = max(0.0, right - left) * max(0.0, bottom - top)
            area_a = max(1e-6, (a[2] - a[0]) * (a[3] - a[1]))
            area_b = max(1e-6, (b[2] - b[0]) * (b[3] - b[1]))
            return intersection / max(1e-6, area_a + area_b - intersection), intersection / min(area_a, area_b)

        image_w, image_h = image.size
        candidates = []
        for index, (box, score) in enumerate(zip(raw_boxes, raw_confidence)):
            normalized = [float(box[0] / image_w), float(box[1] / image_h), float(box[2] / image_w), float(box[3] / image_h)]
            area = max(0.0, normalized[2] - normalized[0]) * max(0.0, normalized[3] - normalized[1])
            if area < 0.0005 or area > 0.88:
                continue
            candidates.append({
                "index": index,
                "box": normalized,
                "quality": float(score) * (0.35 + math.sqrt(area)),
            })
        candidates.sort(key=lambda item: item["quality"], reverse=True)
        if not candidates:
            return []

        best_quality = candidates[0]["quality"]
        selected = []
        max_layers = max(1, int(os.environ.get("GROUNDING_MAX_LAYERS", "8")))
        for candidate in candidates:
            if candidate["quality"] < best_quality * 0.32:
                continue
            if any(
                (lambda measures: measures[0] > 0.55 or measures[1] > 0.90)(overlap(candidate["box"], kept["box"]))
                for kept in selected
            ):
                continue
            selected.append(candidate)
            if len(selected) >= max_layers:
                break

        indices = [candidate["index"] for candidate in selected]
        boxes = raw_boxes[indices]
        confidence = [raw_confidence[index] for index in indices]
        labels = [raw_labels[index] if index < len(raw_labels) else subject.label for index in indices]
        masks, _, _ = self.predictor.predict(
            point_coords=None,
            point_labels=None,
            box=boxes,
            multimask_output=False,
        )
        if masks.ndim == 4:
            masks = masks.squeeze(1)
        target_w, target_h = target_size
        layers: list[dict[str, Any]] = []
        for index, (mask, score, detected_label) in enumerate(zip(masks, confidence, labels)):
            reduced = Image.fromarray(mask.astype("uint8") * 255).resize((target_w, target_h), Image.Resampling.NEAREST)
            reduced_mask = np.asarray(reduced) > 127
            if not reduced_mask.any():
                continue
            ys, xs = np.nonzero(reduced_mask)
            layers.append(
                {
                    "id": f"{subject.id}-{index + 1}",
                    "subjectId": subject.id,
                    "label": subject.label,
                    "detectedLabel": detected_label,
                    "score": round(float(score), 5),
                    "bbox": [
                        round(float(xs.min() / target_w), 6),
                        round(float(ys.min() / target_h), 6),
                        round(float((xs.max() + 1) / target_w), 6),
                        round(float((ys.max() + 1) / target_h), 6),
                    ],
                    "coverage": round(float(reduced_mask.mean()), 6),
                    "maskRle": _encode_mask(reduced_mask),
                }
            )
        return layers


def _load_segmenter() -> _GroundedSam2:
    global _segmenter
    if _segmenter is not None:
        return _segmenter
    with _model_lock:
        if _segmenter is None:
            _segmenter = _GroundedSam2()
    return _segmenter


def _as_hw(tensor):
    value = tensor.detach().float().cpu()
    while value.ndim > 2 and value.shape[0] == 1:
        value = value[0]
    if value.ndim == 3 and value.shape[-1] == 1:
        value = value[..., 0]
    if value.ndim != 2:
        raise RuntimeError(f"unexpected geometry map shape: {tuple(value.shape)}")
    return value


def _encode_mask(mask) -> dict[str, Any]:
    flat = mask.astype("uint8").reshape(-1).tolist()
    if not flat:
        return {"startsWith": 0, "counts": []}
    counts: list[int] = []
    current = 0
    run = 0
    for pixel in flat:
        bit = 1 if pixel else 0
        if bit == current:
            run += 1
        else:
            counts.append(run)
            current = bit
            run = 1
    counts.append(run)
    return {"startsWith": 0, "counts": counts}


def _decode_mask(rle: dict[str, Any], width: int, height: int):
    import numpy as np

    total = width * height
    flat = np.zeros(total, dtype=bool)
    offset = 0
    value = bool(rle.get("startsWith", 0))
    for raw_count in rle.get("counts", []):
        count = max(0, int(raw_count))
        if value:
            flat[offset:min(total, offset + count)] = True
        offset += count
        value = not value
        if offset >= total:
            break
    return flat.reshape(height, width)


def _attach_layer_anchors(layers: list[dict[str, Any]], depth: dict[str, Any]) -> None:
    """Add normalized screen anchors and relief depth for deterministic Three.js placement."""
    import numpy as np

    width = int(depth["width"])
    height = int(depth["height"])
    relief = np.asarray(depth["values"], dtype=np.float32).reshape(height, width)
    for layer in layers:
        mask = _decode_mask(layer["maskRle"], width, height)
        ys, xs = np.nonzero(mask)
        if xs.size == 0:
            continue
        bottom_threshold = np.quantile(ys, 0.9)
        bottom_xs = xs[ys >= bottom_threshold]
        foot_x = float(np.median(bottom_xs)) if bottom_xs.size else float(np.mean(xs))
        layer["anchor"] = {
            "centroid": [round(float(np.mean(xs) / max(1, width - 1)), 6), round(float(np.mean(ys) / max(1, height - 1)), 6)],
            "foot": [round(float(foot_x / max(1, width - 1)), 6), round(float(np.max(ys) / max(1, height - 1)), 6)],
            "reliefMedian": round(float(np.median(relief[mask])), 6),
        }


def _geometry_mapanything(image: Image.Image, max_side: int) -> dict[str, Any]:
    import torch
    import torch.nn.functional as functional
    from mapanything.utils.image import load_images

    model = _load_geometry_model()
    with tempfile.TemporaryDirectory(prefix="tiger-scene-lift-") as temp_dir:
        image_path = Path(temp_dir) / "artwork.png"
        image.save(image_path)
        views = load_images([str(image_path)])
        with torch.inference_mode():
            predictions = model.infer(
                views,
                memory_efficient_inference=True,
                minibatch_size=1,
                use_amp=_device() == "cuda",
                amp_dtype="bf16",
                apply_mask=True,
                mask_edges=True,
                apply_confidence_mask=False,
            )
    prediction = predictions[0]
    depth = _as_hw(prediction["depth_z"])
    valid = _as_hw(prediction["mask"]) > 0.5
    source_h, source_w = depth.shape
    scale = max_side / max(source_w, source_h)
    target_w = max(32, round(source_w * scale))
    target_h = max(32, round(source_h * scale))
    depth = functional.interpolate(depth[None, None], size=(target_h, target_w), mode="bilinear", align_corners=False)[0, 0]
    valid = functional.interpolate(valid.float()[None, None], size=(target_h, target_w), mode="nearest")[0, 0] > 0.5
    finite = valid & torch.isfinite(depth)
    samples = depth[finite]
    if samples.numel() < 16:
        raise RuntimeError("MapAnything returned too few valid depth pixels")
    near = torch.quantile(samples, 0.03)
    median = torch.quantile(samples, 0.5)
    far = torch.quantile(samples, 0.97)
    span = torch.clamp(far - near, min=1e-6)
    relief = torch.clamp((median - depth) / span * 1.45, -0.72, 0.82)
    relief[~finite] = 0

    intrinsics = prediction.get("intrinsics")
    if intrinsics is not None:
        intrinsics = intrinsics.detach().float().cpu()
        while intrinsics.ndim > 2 and intrinsics.shape[0] == 1:
            intrinsics = intrinsics[0]
        intrinsics_json = [[round(float(value), 8) for value in row] for row in intrinsics.tolist()]
    else:
        intrinsics_json = None
    return {
        "engine": GEOMETRY_MODEL,
        "width": target_w,
        "height": target_h,
        "values": [round(float(value), 6) for value in relief.reshape(-1).tolist()],
        "validRle": _encode_mask(finite.numpy()),
        "metric": {
            "near": round(float(near), 6),
            "median": round(float(median), 6),
            "far": round(float(far), 6),
            "unit": "meter",
        },
        "intrinsics": intrinsics_json,
    }


def _geometry_depth_anything(image: Image.Image, max_side: int) -> dict[str, Any]:
    import numpy as np

    model = _load_fallback_depth_model()
    prediction = model(image)["depth"]
    scale = max_side / max(image.width, image.height)
    target_w = max(32, round(image.width * scale))
    target_h = max(32, round(image.height * scale))
    depth = np.asarray(prediction.resize((target_w, target_h), Image.Resampling.BILINEAR), dtype=np.float32)
    finite = np.isfinite(depth)
    samples = depth[finite]
    if samples.size < 16:
        raise RuntimeError("Depth Anything returned too few valid depth pixels")
    near, median, far = np.percentile(samples, [3, 50, 97])
    span = max(float(far - near), 1e-6)
    relief = np.clip((depth - median) / span * 1.2, -0.62, 0.72)
    relief[~finite] = 0
    model_id = os.environ.get("DEPTH_ANYTHING_MODEL", "depth-anything/Depth-Anything-V2-Small-hf")
    return {
        "engine": model_id,
        "width": target_w,
        "height": target_h,
        "values": [round(float(value), 6) for value in relief.reshape(-1).tolist()],
        "validRle": _encode_mask(finite),
        "metric": {
            "near": round(float(near), 6),
            "median": round(float(median), 6),
            "far": round(float(far), 6),
            "unit": "relative",
        },
        "intrinsics": None,
    }


def _geometry(image: Image.Image, max_side: int) -> dict[str, Any]:
    if importlib.util.find_spec("mapanything") is not None:
        return _geometry_mapanything(image, max_side)
    if importlib.util.find_spec("transformers") is not None:
        return _geometry_depth_anything(image, max_side)
    raise RuntimeError("no geometry engine is installed; install mapanything or transformers")


def _geometry_capabilities() -> tuple[str | None, bool, bool]:
    if importlib.util.find_spec("mapanything") is not None:
        return GEOMETRY_MODEL, True, True
    if importlib.util.find_spec("transformers") is not None:
        model_id = os.environ.get("DEPTH_ANYTHING_MODEL", "depth-anything/Depth-Anything-V2-Small-hf")
        return model_id, True, False
    return None, False, False


@app.get("/health")
def health() -> dict[str, Any]:
    geometry_name, depth_available, camera_available = _geometry_capabilities()
    segmentation_available = _segmentation_configured()
    return {
        "status": "ok" if depth_available else "unavailable",
        "geometry": geometry_name,
        "segmentation": "Grounding DINO + SAM 2.1" if segmentation_available else None,
        "device": _device() if depth_available else None,
        "capabilities": {
            "depth": depth_available,
            "camera": camera_available,
            "segmentation": segmentation_available,
        },
        "reason": None if depth_available else "neither MapAnything nor Depth Anything is installed",
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    warnings: list[str] = []
    try:
        image = _decode_image(request.image)
        with _model_lock:
            depth = _geometry(image, request.gridMaxSide)
        layers: list[dict[str, Any]] = []
        if _segmentation_configured():
            try:
                with _model_lock:
                    layers = _load_segmenter().segment(image, request.subject, (depth["width"], depth["height"]))
                    _attach_layer_anchors(layers, depth)
            except Exception as exc:  # Geometry must remain useful if the optional segmenter fails.
                warnings.append(f"semantic segmentation unavailable: {exc}")
        else:
            warnings.append("Grounded SAM 2 is not configured; returning geometry without a semantic mask")
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"scene lift failed: {exc}") from exc
    return {
        "version": 1,
        "engine": {
            "geometry": depth.pop("engine"),
            "segmentation": "Grounding DINO + SAM 2.1" if _segmentation_configured() else None,
            "layoutPolicy": "pixel-locked",
        },
        "image": {"width": image.width, "height": image.height, "name": request.name},
        "subject": request.subject.model_dump(),
        "depth": depth,
        "layers": layers,
        "warnings": warnings,
    }
