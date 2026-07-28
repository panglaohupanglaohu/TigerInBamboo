"""Persistent runtime settings (worker URLs, etc.).

Priority (highest first):
1. Explicit process environment variable
2. backend/runtime.json
3. caller-supplied default
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

_RUNTIME_PATH = Path(__file__).resolve().parent / "runtime.json"


def _read_file() -> dict[str, Any]:
    if not _RUNTIME_PATH.exists():
        return {}
    try:
        data = json.loads(_RUNTIME_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def get_runtime(key: str, default: Any = None) -> Any:
    env = os.environ.get(key)
    if env is not None and str(env).strip() != "":
        return env
    return _read_file().get(key, default)


def set_runtime(key: str, value: str | None) -> dict[str, Any]:
    data = _read_file()
    if value is None or str(value).strip() == "":
        data.pop(key, None)
    else:
        data[key] = str(value).strip()
    _RUNTIME_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(_RUNTIME_PATH.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(tmp, _RUNTIME_PATH)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return data


def runtime_path() -> Path:
    return _RUNTIME_PATH
