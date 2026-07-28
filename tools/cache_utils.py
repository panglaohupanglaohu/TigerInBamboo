"""Disk cache shared by scene_lift_worker and trellis2_worker.

Keys are content-addressed (sha1 of parts). Entries live under
~/.cache/tigerinbamboo/<namespace>/<key>.json and survive process restarts.
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any

CACHE_ROOT = Path(os.environ.get(
    "TIGERINBAMBOO_CACHE",
    os.path.expanduser("~/.cache/tigerinbamboo"),
)).expanduser()


def cache_key(*parts: object) -> str:
    h = hashlib.sha1()
    for part in parts:
        if isinstance(part, bytes):
            h.update(part)
        elif part is None:
            h.update(b"")
        else:
            h.update(str(part).encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def _entry_path(namespace: str, key: str) -> Path:
    return CACHE_ROOT / namespace / f"{key}.json"


def _atomic_write(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def cache_get(namespace: str, key: str) -> dict[str, Any] | None:
    """Return payload on hit (and bump hit counter); None on miss."""
    path = _entry_path(namespace, key)
    if not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            entry = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    meta = entry.setdefault("meta", {})
    meta["hits"] = int(meta.get("hits") or 0) + 1
    meta["lastHit"] = time.time()
    try:
        _atomic_write(path, entry)
    except OSError:
        pass
    payload = entry.get("payload")
    return payload if isinstance(payload, dict) else None


def cache_put(namespace: str, key: str, payload: dict[str, Any], elapsed: float) -> None:
    path = _entry_path(namespace, key)
    entry = {
        "meta": {
            "elapsed": float(elapsed),
            "hits": 0,
            "created": time.time(),
        },
        "payload": payload,
    }
    _atomic_write(path, entry)


def cache_stats(namespace: str) -> dict[str, Any]:
    """Aggregate hit/miss style stats from entry meta (best-effort)."""
    root = CACHE_ROOT / namespace
    if not root.exists():
        return {"entries": 0, "totalHits": 0}
    entries = 0
    total_hits = 0
    for path in root.glob("*.json"):
        try:
            with path.open(encoding="utf-8") as handle:
                entry = json.load(handle)
            entries += 1
            total_hits += int((entry.get("meta") or {}).get("hits") or 0)
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            continue
    return {"entries": entries, "totalHits": total_hits}
