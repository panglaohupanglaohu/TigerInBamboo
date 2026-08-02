#!/usr/bin/env python3
"""Bamboo / lotus / bird sculpt path e2e (backend proxy + gate + frontend builders).

Requires: backend :8931, sculpt_worker :7864.

Usage:
  python3 tools/sculpt/e2e_subjects.py
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BACKEND = "http://127.0.0.1:8931"
WORKER = "http://127.0.0.1:7864"


def post(url: str, body: dict) -> dict:
  req = urllib.request.Request(
    url,
    data=json.dumps(body).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
  )
  with urllib.request.urlopen(req, timeout=45) as r:
    return json.loads(r.read().decode("utf-8"))


def main() -> int:
  store = json.loads((REPO / "backend" / "object_reference.json").read_text(encoding="utf-8"))
  templates = store["sculptTemplates"]
  plans = store["morphologyPlans"]

  for key in ("bamboo", "lotus", "bird"):
    plan = plans[key]
    template = templates[key]
    out = post(
      f"{BACKEND}/api/sculpt/from-crop",
      {
        "subject": {"id": key, "key": key, "label": key},
        "layerId": f"e2e-{key}",
        "bbox": [0.2, 0.2, 0.5, 0.55],
        "coverage": 0.1,
        "objectReference": {
          "key": key,
          "morphologyPlan": plan,
          "sculptTemplate": template,
        },
        "morphologyPlan": plan,
        "sculptTemplate": template,
        "refresh": True,
        "strict": True,
      },
    )
    if not out.get("ok"):
      print("FAIL sculpt", key, out)
      return 1
    spec = out["spec"]
    types = [c.get("type") for c in (spec.get("components") or []) if c.get("type")]
    if not types:
      print("FAIL empty components", key)
      return 1
    gate = post(f"{WORKER}/sculpt/gate", {"spec": spec, "builtTypes": types})
    if not gate.get("ok"):
      print("FAIL gate", key, gate)
      return 1
    builder = out.get("builderKey") or (spec.get("build") or {}).get("builderKey")
    print(f"PASS {key} builder={builder} comps={len(types)} gate=ok")

  ww = (REPO / "frontend/js/wall-workspace.js").read_text(encoding="utf-8")
  for name in (
    "createLotusMorphologyModel",
    "createBambooMorphologyModel",
    "createAvianMorphologyModel",
  ):
    if name not in ww:
      print("FAIL missing builder", name)
      return 1
    print("PASS frontend", name)

  if "attachSculptRuntime" not in (REPO / "frontend/js/sculpt/runtime.js").read_text(
    encoding="utf-8"
  ):
    print("FAIL runtime")
    return 1
  print("PASS attachSculptRuntime")
  print("ALL THREE SUBJECTS SCULPT E2E PASS")
  return 0


if __name__ == "__main__":
  sys.exit(main())
