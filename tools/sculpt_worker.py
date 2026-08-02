"""Sculpt worker: confirmed crop + morphology plan → SculptSpec + builder plan.

Port 7864. Does not run neural mesh; static-builder mode returns a validated
spec for frontend procedural builders (img2threejs-aligned contract).
"""
from __future__ import annotations

import base64
import hashlib
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cache_utils import cache_get, cache_key, cache_put, cache_stats  # noqa: E402
from metrics import metrics  # noqa: E402
from sculpt.gates import structural_gate  # noqa: E402
from sculpt.spec_map import morphology_plan_to_sculpt_spec, resolve_builder_key  # noqa: E402
from sculpt.validate_sculpt_spec import validate_sculpt_spec  # noqa: E402

SPEC_VERSION = "tib-sculpt-1"
app = FastAPI(title="TigerInBamboo Sculpt Worker", version="0.1.0")


class SculptRequest(BaseModel):
    image: str | None = Field(None, description="data:image/... confirmed crop (optional for cache key)")
    subject: dict[str, Any] = Field(default_factory=dict)
    layerId: str | None = None
    bbox: list[float] | None = None
    coverage: float | None = None
    objectReference: dict[str, Any] | None = None
    morphologyPlan: dict[str, Any] | None = None
    sculptTemplate: dict[str, Any] | None = None
    refresh: bool = False
    strict: bool = True


class GateRequest(BaseModel):
    spec: dict[str, Any]
    builtTypes: list[str] = Field(default_factory=list)


def _crop_bytes(data_url: str | None) -> bytes:
    if not data_url or "," not in data_url:
        return b""
    try:
        return base64.b64decode(data_url.split(",", 1)[1], validate=False)
    except Exception:
        return hashlib.sha1((data_url or "").encode("utf-8")).digest()


def _build_response(req: SculptRequest) -> dict[str, Any]:
    ref = req.objectReference or {}
    plan = req.morphologyPlan or ref.get("morphologyPlan") or {}
    template = req.sculptTemplate or ref.get("sculptTemplate") or {}
    subject = dict(req.subject or {})
    # Prefer catalog key from objectReference
    if ref.get("key") and not subject.get("key"):
        subject["key"] = ref["key"]
    if ref.get("key") and subject.get("id") and subject["id"] not in (
        "lotus", "bamboo", "pine", "bird", "water", "terrain", "fish", "insect",
        "quadruped", "ungulate", "rabbit", "plum", "reed", "flower", "vine",
    ):
        # biology-goose etc. → use catalog key for subjectKey
        subject = {**subject, "key": ref["key"]}

    layer = {
        "id": req.layerId or "layer-0",
        "bbox": req.bbox or (ref.get("bbox") if isinstance(ref.get("bbox"), list) else None),
        "coverage": req.coverage,
    }
    # Ensure plan key for mapping
    if isinstance(plan, dict) and ref.get("key") and not plan.get("key"):
        plan = {**plan, "key": ref["key"]}

    subject_for_map = {
        **subject,
        "id": subject.get("id") or ref.get("subjectId") or ref.get("key") or "object",
        "domain": subject.get("domain") or ref.get("domain"),
        "kind": subject.get("kind") or ref.get("profileKind"),
        "key": subject.get("key") or ref.get("key"),
    }

    # Force subjectKey from catalog key when available
    if ref.get("key"):
        template = {**template, "subjectKey": ref["key"]}

    spec = morphology_plan_to_sculpt_spec(plan, subject_for_map, layer, template)
    if ref.get("key"):
        spec["subjectKey"] = ref["key"]
        if not spec["build"].get("builderKey"):
            spec["build"]["builderKey"] = resolve_builder_key(ref["key"], template, plan)

    errors = validate_sculpt_spec(spec, strict=req.strict)
    builder_key = (spec.get("build") or {}).get("builderKey")
    ok = not errors and bool(builder_key or (spec.get("components")))

    # Soft: if strict fails but we still have components, return ok=False with spec for fallback
    return {
        "ok": ok and not errors,
        "errors": errors,
        "spec": spec,
        "builderKey": builder_key,
        "runtime": spec.get("runtime"),
        "warnings": [] if not errors else [f"strict: {e}" for e in errors],
        "specVersion": SPEC_VERSION,
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "available": True,
        "engine": "tib-sculpt",
        "specVersion": SPEC_VERSION,
        "cache": cache_stats("sculpt"),
    }


@app.get("/metrics")
def metrics_endpoint() -> dict[str, Any]:
    snap = metrics.snapshot()
    snap["cache"] = cache_stats("sculpt")
    return snap


@app.post("/sculpt/from-crop")
def sculpt_from_crop(req: SculptRequest) -> dict[str, Any]:
    t0 = time.perf_counter()
    try:
        crop = _crop_bytes(req.image)
        ref = req.objectReference or {}
        subject_id = str((req.subject or {}).get("id") or ref.get("key") or "object")
        template_id = str((req.sculptTemplate or ref.get("sculptTemplate") or {}).get("builderKey") or "")
        key = cache_key(crop or subject_id.encode(), subject_id, template_id, SPEC_VERSION,
                        str(req.layerId or ""), str((req.morphologyPlan or ref.get("morphologyPlan") or {}).get("archetype") or "")[:80])

        if not req.refresh:
            hit = cache_get("sculpt", key)
            if isinstance(hit, dict) and hit.get("spec"):
                metrics.count("cache.hit")
                metrics.count("sculpt.ok" if hit.get("ok") else "sculpt.strict_fail")
                return {**hit, "cached": True}

        metrics.count("cache.miss")
        result = _build_response(req)
        elapsed = time.perf_counter() - t0
        cache_put("sculpt", key, result, elapsed)
        metrics.observe("sculpt.from_crop", elapsed)
        metrics.count("sculpt.from_crop")
        if result.get("ok"):
            metrics.count("sculpt.ok")
        else:
            metrics.count("sculpt.strict_fail")
        return {**result, "cached": False, "elapsed": round(elapsed, 4)}
    except Exception as exc:
        metrics.count("sculpt.error")
        raise HTTPException(status_code=500, detail=f"sculpt failed: {exc}") from exc


@app.post("/sculpt/gate")
def sculpt_gate(req: GateRequest) -> dict[str, Any]:
    result = structural_gate(req.spec, req.builtTypes)
    metrics.count("gate.component_coverage.pass" if result.get("ok") else "gate.component_coverage.fail")
    return result
