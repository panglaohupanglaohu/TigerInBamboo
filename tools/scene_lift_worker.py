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
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cache_utils import cache_get, cache_key, cache_put, cache_stats  # noqa: E402
from metrics import metrics  # noqa: E402

GEOMETRY_MODEL = os.environ.get("MAPANYTHING_MODEL", "facebook/map-anything-apache")
GROUNDING_MODEL = os.environ.get("GROUNDING_MODEL", "IDEA-Research/grounding-dino-base")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "facebook/dino-vitb16")
GROUNDING_ROOT = os.environ.get("GROUNDED_SAM2_ROOT", "").strip()
SAM2_CHECKPOINT = os.environ.get("SAM2_CHECKPOINT", "").strip()
SAM2_CONFIG = os.environ.get("SAM2_CONFIG", "configs/sam2.1/sam2.1_hiera_l.yaml")
REQUEST_LIMIT = 10 * 1024 * 1024
MODEL_VERSION = os.environ.get("SCENE_LIFT_CACHE_VERSION", "v1")

app = FastAPI(title="TigerInBamboo Scene Lift Worker", version="1.0")
_geometry_model = None
_fallback_depth_model = None
_segmenter = None
_dino_segmenter = None
_embedder = None
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
    refresh: bool = False


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
        max_layers = max(1, int(os.environ.get("GROUNDING_MAX_LAYERS", "12")))
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


def _load_segmenter(mode: str):
    global _segmenter, _dino_segmenter
    with _model_lock:
        if mode == "dino":
            if _dino_segmenter is None:
                _dino_segmenter = _GroundingDinoOnly()
            return _dino_segmenter
        if _segmenter is None:
            _segmenter = _GroundedSam2()
        return _segmenter


def _segmentation_mode() -> str | None:
    """可用的语义分割后端：优先 Grounded SAM 2（精确掩码），
    否则退回 Grounding DINO 文本框选 + GrabCut 框内取掩码（无需 SAM2 checkpoint）。"""
    requested = os.environ.get("SCENE_LIFT_SEGMENTER", "auto").strip().lower()
    if requested in {"sam2", "grounded-sam2"}:
        return "sam2" if _segmentation_configured() else None
    if requested in {"dino", "grounding-dino"}:
        return "dino" if importlib.util.find_spec("transformers") is not None else None
    if _segmentation_configured():
        return "sam2"
    if importlib.util.find_spec("transformers") is not None:
        return "dino"
    return None


_SEGMENTATION_LABELS = {
    "sam2": "Grounding DINO + SAM 2.1",
    "dino": "Grounding DINO 框选 + GrabCut",
}


def _grounding_boxes(image: Image.Image, subject: Subject, processor, grounder, device, torch) -> list[dict[str, Any]]:
    """Grounding DINO 文本框选（两个分割后端共用）。
    prompt 第一个短语是规范物名（如 bamboo./bird.），实现竹与鹤这类语义区分。"""
    import math

    # 使用完整短语库（grounding dino 以句点分隔短语），提升水墨画召回；
    # 例如 avian: "bird. goose. crane. swan."
    prompt = subject.prompt.strip().lower()
    if not prompt.endswith("."):
        prompt += "."
    inputs = processor(images=image, text=prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = grounder(**inputs)
    box_threshold = float(os.environ.get("GROUNDING_BOX_THRESHOLD", "0.18"))
    text_threshold = float(os.environ.get("GROUNDING_TEXT_THRESHOLD", "0.16"))
    post_process = processor.post_process_grounded_object_detection
    try:
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
            "label": raw_labels[index] if index < len(raw_labels) else subject.label,
            "score": float(score),
            "quality": float(score) * (0.35 + math.sqrt(area)),
        })
    candidates.sort(key=lambda item: item["quality"], reverse=True)
    if not candidates:
        return []
    best_quality = candidates[0]["quality"]
    selected = []
    max_layers = max(1, int(os.environ.get("GROUNDING_MAX_LAYERS", "12")))
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
    return selected


def _layer_from_mask(full_mask, score: float, detected_label: str, subject: Subject, target_size: tuple[int, int], index: int) -> dict[str, Any] | None:
    """全分辨率布尔掩码 → 目标网格上的候选层（bbox/coverage/maskRle）。"""
    import numpy as np

    target_w, target_h = target_size
    reduced = Image.fromarray(full_mask.astype("uint8") * 255).resize((target_w, target_h), Image.Resampling.NEAREST)
    reduced_mask = np.asarray(reduced) > 127
    if not reduced_mask.any():
        return None
    ys, xs = np.nonzero(reduced_mask)
    return {
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


def _suppress_frame_lines(mask):
    """抑制屏风折线/装裱缝：贯穿整幅且邻列（行）为空的孤立直线不是物象。"""
    import numpy as np

    col_density = mask.mean(axis=0)
    for x in range(1, mask.shape[1] - 1):
        if col_density[x] > 0.85 and col_density[x - 1] < 0.35 and col_density[x + 1] < 0.35:
            mask[:, x] = False
    row_density = mask.mean(axis=1)
    for y in range(1, mask.shape[0] - 1):
        if row_density[y] > 0.85 and row_density[y - 1] < 0.35 and row_density[y + 1] < 0.35:
            mask[y, :] = False
    return mask


def _refine_grabcut(rgb, box: list[float], csep) -> "object":
    """种子 GrabCut：框缘环 = 确定背景，色差核心 = 确定前景。
    适合「紧致墨主体 + 平缓雾面背景」的国画场景，比矩形初始化收敛得多。"""
    import cv2
    import numpy as np

    image_h, image_w = rgb.shape[:2]
    x0 = max(0, int(box[0] * image_w))
    y0 = max(0, int(box[1] * image_h))
    x1 = min(image_w, int(np.ceil(box[2] * image_w)))
    y1 = min(image_h, int(np.ceil(box[3] * image_h)))
    if x1 - x0 < 6 or y1 - y0 < 6:
        return np.zeros((image_h, image_w), dtype=bool)
    gc = np.full((image_h, image_w), cv2.GC_PR_BGD, dtype=np.uint8)
    # 框缘环 = 确定背景
    ring = max(2, int(min(x1 - x0, y1 - y0) * 0.04))
    gc[: y0 + ring, :] = cv2.GC_BGD
    gc[y1 - ring :, :] = cv2.GC_BGD
    gc[:, : x0 + ring] = cv2.GC_BGD
    gc[:, x1 - ring :] = cv2.GC_BGD
    # 色差核心 = 确定前景（腐蚀两档求稳）
    sure_fg = (csep > 0.55).astype(np.uint8)
    sure_fg = cv2.erode(sure_fg, np.ones((3, 3), np.uint8), iterations=2) > 0
    if sure_fg.sum() < 8:
        sure_fg = (csep > 0.45).astype(np.uint8)
        sure_fg = cv2.erode(sure_fg, np.ones((3, 3), np.uint8), iterations=1) > 0
    full_fg = np.zeros((image_h, image_w), dtype=bool)
    full_fg[y0:y1, x0:x1] = sure_fg
    gc[full_fg] = cv2.GC_FGD
    if (gc == cv2.GC_FGD).sum() < 8:
        return np.zeros((image_h, image_w), dtype=bool)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(bgr, gc, None, bgd, fgd, 5, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return np.zeros((image_h, image_w), dtype=bool)
    mask = np.isin(gc, [cv2.GC_FGD, cv2.GC_PR_FGD])
    count, cc = cv2.connectedComponents(mask.astype(np.uint8))
    if count > 2:
        largest = 1 + int(np.argmax([np.sum(cc == lab) for lab in range(1, count)]))
        mask = cc == largest
    return cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0


def _tone_flood(rgb, box: list[float], core_mask, edge) -> "object":
    """墨色连通：以 GrabCut 核心的均色为种子，在框内按色调连通生长（遇强边停止）。
    雁体墨色匀一、雾面偏亮时能把翅膀等弱对比部位一并收进。"""
    import cv2
    import numpy as np

    image_h, image_w = rgb.shape[:2]
    x0 = max(0, int(box[0] * image_w))
    y0 = max(0, int(box[1] * image_h))
    x1 = min(image_w, int(np.ceil(box[2] * image_w)))
    y1 = min(image_h, int(np.ceil(box[3] * image_h)))
    core = core_mask[y0:y1, x0:x1]
    if core.sum() < 8:
        return core_mask
    crop = rgb[y0:y1, x0:x1].astype(np.float32) / 255.0
    ring = np.ones(core.shape, dtype=bool)
    rr = max(2, int(min(core.shape) * 0.06))
    ring[rr:-rr, rr:-rr] = False
    core_mean = crop[core].mean(axis=0)
    ring_mean = crop[ring].mean(axis=0) if ring.any() else crop.reshape(-1, 3).mean(axis=0)
    tone_gap = float(np.linalg.norm(core_mean - ring_mean))
    if tone_gap < 0.03:
        return core_mask
    threshold = min(0.5, max(0.08, tone_gap * 0.55))
    dist = np.linalg.norm(crop - core_mean, axis=2)
    edge_crop = edge if edge.shape == core.shape else None
    passable = dist < threshold
    if edge_crop is not None:
        passable &= edge_crop < 0.5
    passable[:rr, :] = False
    passable[-rr:, :] = False
    passable[:, :rr] = False
    passable[:, -rr:] = False
    # 从核心做连通生长
    out = np.zeros(core.shape, dtype=np.uint8)
    out[core] = 1
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(max(core.shape)):
        grown = cv2.dilate(out, kernel) > 0
        new = grown & passable & (out == 0)
        if not new.any():
            break
        out[new] = 1
    count, cc = cv2.connectedComponents(out)
    if count > 2:
        largest = 1 + int(np.argmax([np.sum(cc == lab) for lab in range(1, count)]))
        out = (cc == largest).astype(np.uint8)
    out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    full = np.zeros((image_h, image_w), dtype=bool)
    full[y0:y1, x0:x1] = out > 0
    return full


def _dino_patch_mask(image: Image.Image, box: list[float]) -> "object":
    """DINO-ViT patch 语义分割：框内 patch token 聚类，取含框心 patch 的簇为物体。
    DINO 特征对「墨主体 vs 雾面背景」的区分远强于色调统计（自监督分割的成熟用法）。"""
    import cv2
    import numpy as np

    model, torch = _load_embedder()
    image_w, image_h = image.size
    x0 = max(0, int(box[0] * image_w))
    y0 = max(0, int(box[1] * image_h))
    x1 = min(image_w, int(np.ceil(box[2] * image_w)))
    y1 = min(image_h, int(np.ceil(box[3] * image_h)))
    if x1 - x0 < 8 or y1 - y0 < 8:
        return np.zeros((image_h, image_w), dtype=bool)
    crop = image.crop((x0, y0, x1, y1)).resize((224, 224), Image.Resampling.BILINEAR)
    arr = np.asarray(crop, dtype=np.float32) / 255.0
    arr = (arr - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
    tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0).to(_device())
    with torch.no_grad():
        outputs = model(pixel_values=tensor, interpolate_pos_encoding=True)
    tokens = outputs.last_hidden_state[0, 1:].float().cpu().numpy()  # [196, 768]
    grid = int(tokens.shape[0] ** 0.5)  # 14
    tokens = tokens / np.maximum(np.linalg.norm(tokens, axis=1, keepdims=True), 1e-6)
    center_idx = (grid // 2) * grid + grid // 2

    def cluster_mask(k: int):
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
        _, labels, _ = cv2.kmeans(tokens.astype(np.float32), k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
        return (labels.reshape(grid, grid) == labels.reshape(grid, grid).flat[center_idx])

    best = None
    for k in (2, 3):
        m = cluster_mask(k)
        frac = float(m.mean())
        if 0.08 < frac < 0.75:
            best = m
            break
        if best is None or abs(frac - 0.4) < abs(float(best.mean()) - 0.4):
            best = m
    if best is None:
        return np.zeros((image_h, image_w), dtype=bool)
    mask = best.astype(np.uint8)
    mask = cv2.resize(mask, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    count, cc = cv2.connectedComponents(mask)
    if count > 2:
        cx, cy = (x1 - x0) // 2, (y1 - y0) // 2
        center_label = int(cc[cy, cx]) or (1 + int(np.argmax([np.sum(cc == lab) for lab in range(1, count)])))
        mask = (cc == center_label).astype(np.uint8)
    full = np.zeros((image_h, image_w), dtype=bool)
    full[y0:y1, x0:x1] = mask > 0
    return full


def _saliency_mask(rgb, box: list[float], image: Image.Image | None = None) -> "object":
    """框内显著性掩码（与前端 localCandidate 同源：亮度边缘 + 彩色边缘 + 色差）。
    边缘与色差在框内归一化——水墨淡墨区域的全局弱边缘在框内被正确放大。"""
    import cv2
    import numpy as np

    image_h, image_w = rgb.shape[:2]
    x0 = max(0, int(box[0] * image_w))
    y0 = max(0, int(box[1] * image_h))
    x1 = min(image_w, int(np.ceil(box[2] * image_w)))
    y1 = min(image_h, int(np.ceil(box[3] * image_h)))
    if x1 - x0 < 4 or y1 - y0 < 4:
        return np.zeros((image_h, image_w), dtype=bool)
    crop = rgb[y0:y1, x0:x1].astype(np.float32) / 255.0
    r, g, b = crop[:, :, 0], crop[:, :, 1], crop[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    gx = cv2.Sobel(lum, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(lum, cv2.CV_32F, 0, 1, ksize=3)
    edge_lum = np.hypot(gx, gy)
    # 彩色边缘（三通道梯度），捕捉亮度相近但色相不同的画色边界
    crx = cv2.Sobel(r, cv2.CV_32F, 1, 0, ksize=3)
    cgx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    cbx = cv2.Sobel(b, cv2.CV_32F, 1, 0, ksize=3)
    cry = cv2.Sobel(r, cv2.CV_32F, 0, 1, ksize=3)
    cgy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    cby = cv2.Sobel(b, cv2.CV_32F, 0, 1, ksize=3)
    edge_clr = np.hypot(
        np.hypot(crx, cgx, cbx),
        np.hypot(cry, cgy, cby),
    )
    edge = np.maximum(edge_lum, edge_clr)
    mean_color = crop.reshape(-1, 3).mean(axis=0)
    csep = np.linalg.norm(crop - mean_color, axis=2)
    # 框内 98 分位归一化（抗折线等少量强边），放大淡墨主体
    edge = edge / max(float(np.percentile(edge, 98)), 1e-4)
    csep = csep / max(float(np.percentile(csep, 98)), 1e-4)
    # 首选 DINO patch 语义分割（对墨主体/雾背景区分最强）；亮度门削掉带入的亮雾
    box_area = max(1e-6, (box[2] - box[0]) * (box[3] - box[1]))
    if image is not None:
        try:
            dino_mask = _dino_patch_mask(image, box)
            if dino_mask.any():
                dino_crop = dino_mask[y0:y1, x0:x1]
                lum_crop = 0.299 * crop[:, :, 0] + 0.587 * crop[:, :, 1] + 0.114 * crop[:, :, 2]
                masked_lum = lum_crop[dino_crop]
                if masked_lum.size:
                    gate = float(np.percentile(masked_lum, 65))
                    gated = dino_crop & (lum_crop <= gate)
                    if gated.mean() > float(dino_crop.mean()) * 0.4:
                        dino_crop = gated
                dino_crop = cv2.morphologyEx(dino_crop.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
                count, cc = cv2.connectedComponents(dino_crop.astype(np.uint8))
                if count > 2:
                    cx2, cy2 = (x1 - x0) // 2, (y1 - y0) // 2
                    center_label = int(cc[cy2, cx2]) or (1 + int(np.argmax([np.sum(cc == lab) for lab in range(1, count)])))
                    dino_crop = cc == center_label
                fill = float(dino_crop.mean())
                if 0.02 < fill < 0.85:
                    out = np.zeros((image_h, image_w), dtype=bool)
                    out[y0:y1, x0:x1] = dino_crop
                    return out
        except Exception:
            pass
    # 次选种子 GrabCut（框缘为背景、色差核心为前景），再用墨色连通把翅膀等部位扩进
    gc_mask = _refine_grabcut(rgb, box, csep)
    if gc_mask.any():
        gc_mask = _tone_flood(rgb, box, gc_mask, edge)
        gc_crop = gc_mask[y0:y1, x0:x1]
        fill = float(gc_crop.mean())
        if 0.02 < fill < 0.85:
            return gc_mask
    fg = ((edge > 0.15) | (csep > 0.30)).astype(np.uint8)
    fg = _suppress_frame_lines(fg)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # 只保留与框心相连的连通域，丢掉框内边缘的无关碎块
    count, cc = cv2.connectedComponents(fg)
    cx, cy = (x1 - x0) // 2, (y1 - y0) // 2
    center_label = int(cc[cy, cx])
    if center_label == 0:
        # 框心落在背景：取面积最大的连通域
        if count <= 1:
            return np.zeros((image_h, image_w), dtype=bool)
        center_label = 1 + int(np.argmax([np.sum(cc == lab) for lab in range(1, count)]))
    mask = cc == center_label
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    full = np.zeros((image_h, image_w), dtype=bool)
    full[y0:y1, x0:x1] = mask
    return full


class _GroundingDinoOnly:
    """无 SAM2 时的语义分割：Grounding DINO 按物名框选，GrabCut 在框内抠掩码。
    关键词（bamboo./bird./goose.）来自画中要素 subject，实现竹与鹤的语义区分。"""

    def __init__(self) -> None:
        import torch
        from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

        self.torch = torch
        self.device = _device()
        self.processor = AutoProcessor.from_pretrained(GROUNDING_MODEL)
        self.grounder = AutoModelForZeroShotObjectDetection.from_pretrained(GROUNDING_MODEL).to(self.device).eval()

    def segment(self, image: Image.Image, subject: Subject, target_size: tuple[int, int]) -> list[dict[str, Any]]:
        import cv2
        import numpy as np

        # 水墨画对比度低，检测前做 CLAHE 增强（仅用于框选，掩码仍用原图）
        rgb = np.asarray(image)
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        lab[:, :, 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lab[:, :, 0])
        enhanced = Image.fromarray(cv2.cvtColor(lab, cv2.COLOR_LAB2RGB))

        selected = _grounding_boxes(enhanced, subject, self.processor, self.grounder, self.device, self.torch)
        if not selected:
            return []
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        image_w, image_h = image.size
        layers: list[dict[str, Any]] = []
        max_coverage = float(os.environ.get("SEGMENT_MAX_COVERAGE", "0.5"))
        for candidate in selected:
            # 首选框内显著性掩码（贴主体轮廓）；失败或过满时退回 GrabCut
            mask = _saliency_mask(rgb, candidate["box"], image)
            box_area = max(1e-6, (candidate["box"][2] - candidate["box"][0]) * (candidate["box"][3] - candidate["box"][1]))
            if not mask.any() or mask.mean() > box_area * 0.9:
                x0, y0, x1, y1 = candidate["box"]
                rect = (
                    max(0, int(x0 * image_w)),
                    max(0, int(y0 * image_h)),
                    max(2, int((x1 - x0) * image_w)),
                    max(2, int((y1 - y0) * image_h)),
                )
                gc_mask = np.zeros((image_h, image_w), dtype=np.uint8)
                bgd = np.zeros((1, 65), np.float64)
                fgd = np.zeros((1, 65), np.float64)
                try:
                    cv2.grabCut(bgr, gc_mask, rect, bgd, fgd, 4, cv2.GC_INIT_WITH_RECT)
                except cv2.error:
                    continue
                mask = np.isin(gc_mask, [cv2.GC_FGD, cv2.GC_PR_FGD])
                if not mask.any():
                    continue
                count, cc = cv2.connectedComponents(mask.astype("uint8"))
                if count > 2:
                    largest = 1 + int(np.argmax([np.sum(cc == lab) for lab in range(1, count)]))
                    mask = cc == largest
                mask = cv2.morphologyEx(mask.astype("uint8"), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
            if mask.mean() > max_coverage:
                continue  # 超过半幅画面的「候选」不可信，丢弃而不是给用户一大块
            if mask.mean() < float(os.environ.get("SEGMENT_MIN_COVERAGE", "0.002")):
                continue  # 碎屑连通域（<0.2% 画面）不是有效候选
            layer = _layer_from_mask(mask, candidate["score"], candidate["label"], subject, target_size, len(layers))
            if layer:
                layers.append(layer)
        return layers


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


class EmbedRequest(BaseModel):
    image: str = Field(..., description="data:image/... 候选裁剪")


def resolve_embedder_checkpoint() -> Path | None:
    """EMBEDDER_CHECKPOINT env, else HuggingFace cache API for TripoSR weights."""
    env = os.environ.get("EMBEDDER_CHECKPOINT", "").strip()
    if env:
        p = Path(env).expanduser()
        return p if p.exists() else None
    try:
        from huggingface_hub import try_to_load_from_cache

        hit = try_to_load_from_cache("stabilityai/TripoSR", "model.ckpt")
        if hit and hit != "_no_exist":
            p = Path(hit)
            return p if p.exists() else None
    except Exception:
        pass
    # Last-resort glob (legacy machines)
    import glob

    checkpoints = sorted(
        glob.glob(os.path.expanduser("~/.cache/huggingface/hub/models--stabilityai--TripoSR/snapshots/*/model.ckpt"))
    )
    return Path(checkpoints[0]) if checkpoints else None


def _load_embedder():
    """DINO-ViT 视觉特征提取器：ViT 结构按缓存的 dino-vitb16 配置构建，
    权重离线取自 TripoSR 检查点内嵌的 image_tokenizer。
    找不到权重时返回 None（调用方返回 503，不崩溃）。"""
    global _embedder
    if _embedder is not None:
        return _embedder
    with _model_lock:
        if _embedder is None:
            import torch
            from huggingface_hub import hf_hub_download
            from transformers.models.vit.modeling_vit import ViTModel

            ckpt = resolve_embedder_checkpoint()
            if ckpt is None:
                return None
            config_path = hf_hub_download(repo_id=EMBED_MODEL, filename="config.json")
            model = ViTModel(ViTModel.config_class.from_pretrained(config_path))
            state = torch.load(str(ckpt), map_location="cpu")
            prefix = "image_tokenizer.model."
            vit_state = {key[len(prefix):]: value for key, value in state.items() if key.startswith(prefix)}
            if not vit_state:
                return None
            model.load_state_dict(vit_state, strict=False)
            model.to(_device()).eval()
            _embedder = (model, torch)
    return _embedder


def _active_segmenter_name() -> str | None:
    mode = _segmentation_mode()
    if mode == "sam2":
        return "grounded-sam2"
    if mode == "dino":
        return "dino+grabcut"
    return None


@app.post("/embed")
def embed(request: EmbedRequest) -> dict[str, Any]:
    try:
        import numpy as np

        loaded = _load_embedder()
        if loaded is None:
            raise HTTPException(
                status_code=503,
                detail="embedder 不可用：请设置 EMBEDDER_CHECKPOINT 或缓存 stabilityai/TripoSR",
            )
        model, torch = loaded
        image = _decode_image(request.image).resize((224, 224), Image.Resampling.BILINEAR)
        arr = np.asarray(image, dtype=np.float32) / 255.0
        arr = (arr - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
        tensor = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0).to(_device())
        with torch.no_grad():
            outputs = model(pixel_values=tensor, interpolate_pos_encoding=True)
        vector = outputs.last_hidden_state[:, 0]
        vector = torch.nn.functional.normalize(vector, dim=-1)[0]
        return {"embedding": [round(float(v), 6) for v in vector.cpu().tolist()], "model": f"{EMBED_MODEL} (TripoSR checkpoint)"}
    except HTTPException:
        raise
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"embed failed: {exc}") from exc


@app.get("/health")
def health() -> dict[str, Any]:
    geometry_name, depth_available, camera_available = _geometry_capabilities()
    mode = _segmentation_mode()
    segmenter = _active_segmenter_name()
    metrics.set_gauge("geometry", geometry_name)
    metrics.set_gauge("segmentation", segmenter)
    return {
        "status": "ok" if depth_available else "unavailable",
        "geometry": geometry_name if mode is None or True else geometry_name,
        "geometryEngine": "map-anything" if geometry_name and "map-anything" in str(geometry_name) else (
            "depth-anything-v2-small" if geometry_name else None
        ),
        "segmentation": _SEGMENTATION_LABELS.get(mode) if mode else None,
        "segmentationTier": segmenter,
        "groundingModel": GROUNDING_MODEL,
        "device": _device() if depth_available else None,
        "capabilities": {
            "depth": depth_available,
            "camera": camera_available,
            "segmentation": mode is not None,
            "embedder": resolve_embedder_checkpoint() is not None,
        },
        "cache": cache_stats("scene_lift"),
        "reason": None if depth_available else "neither MapAnything nor Depth Anything is installed",
    }


@app.get("/metrics")
def metrics_endpoint() -> dict[str, Any]:
    snap = metrics.snapshot()
    snap["cache"] = cache_stats("scene_lift")
    snap["segmentationTier"] = _active_segmenter_name()
    return snap


@app.get("/status")
def status() -> dict[str, Any]:
    """Active geometry/segmentation tiers for frontend review UI."""
    geometry_name, depth_available, camera_available = _geometry_capabilities()
    return {
        "geometry": "map-anything" if geometry_name and "map-anything" in str(geometry_name) else (
            "depth-anything-v2-small" if geometry_name else None
        ),
        "geometryModel": geometry_name,
        "segmentation": _active_segmenter_name(),
        "segmentationLabel": _SEGMENTATION_LABELS.get(_segmentation_mode()) if _segmentation_mode() else None,
        "grounding_model": GROUNDING_MODEL,
        "capabilities": {
            "depth": depth_available,
            "camera": camera_available,
            "segmentation": _segmentation_mode() is not None,
        },
    }


def _image_raw_bytes(data_url: str) -> bytes:
    if not data_url.startswith("data:image/") or "," not in data_url:
        raise ValueError("image must be a data:image/... URL")
    return base64.b64decode(data_url.split(",", 1)[1], validate=True)


def _run_analyze_pipeline(request: AnalyzeRequest) -> dict[str, Any]:
    warnings: list[str] = []
    image = _decode_image(request.image)
    with _model_lock:
        depth = _geometry(image, request.gridMaxSide)
    layers: list[dict[str, Any]] = []
    mode = _segmentation_mode()
    if mode:
        try:
            with _model_lock:
                layers = _load_segmenter(mode).segment(image, request.subject, (depth["width"], depth["height"]))
                _attach_layer_anchors(layers, depth)
        except Exception as exc:  # Geometry must remain useful if the optional segmenter fails.
            warnings.append(f"semantic segmentation unavailable: {exc}")
    else:
        warnings.append("no semantic segmenter is available; returning geometry without a semantic mask")
    segmenter = _active_segmenter_name()
    if segmenter:
        metrics.count(f"segmenter.{segmenter}")
    return {
        "version": 1,
        "engine": {
            "geometry": depth.pop("engine"),
            "segmentation": _SEGMENTATION_LABELS.get(mode) if mode else None,
            "segmentationTier": segmenter,
            "layoutPolicy": "pixel-locked",
        },
        "image": {"width": image.width, "height": image.height, "name": request.name},
        "subject": request.subject.model_dump(),
        "depth": depth,
        "layers": layers,
        "warnings": warnings,
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    try:
        raw = _image_raw_bytes(request.image)
        key = cache_key(raw, request.subject.id, request.subject.prompt, request.gridMaxSide, MODEL_VERSION, GROUNDING_MODEL)
        if not request.refresh:
            hit = cache_get("scene_lift", key)
            if hit is not None:
                metrics.count("cache.hit")
                metrics.count("analyze")
                return {**hit, "cached": True}
        metrics.count("cache.miss")
        t0 = time.perf_counter()
        result = _run_analyze_pipeline(request)
        elapsed = time.perf_counter() - t0
        cache_put("scene_lift", key, result, elapsed)
        metrics.observe("analyze", elapsed)
        metrics.count("analyze")
        return {**result, "cached": False}
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"scene lift failed: {exc}") from exc
