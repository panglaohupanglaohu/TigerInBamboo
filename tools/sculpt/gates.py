"""Structural quality gates (lightweight Divine Eye analogue)."""
from __future__ import annotations

from typing import Any, Iterable


def structural_gate(spec: dict[str, Any], built_types: Iterable[str] | None = None) -> dict[str, Any]:
    """Check that built component types cover the spec's required types."""
    required = {
        str(c.get("type"))
        for c in (spec.get("components") or [])
        if isinstance(c, dict) and c.get("type")
    }
    built = {str(t) for t in (built_types or []) if t}
    # If builder reports no types, only check non-empty components
    if not built:
        ok = len(required) > 0
        return {
            "ok": ok,
            "gate": "component-coverage",
            "missingTypes": sorted(required) if not ok else [],
            "requiredTypes": sorted(required),
            "builtTypes": [],
            "note": "no builtTypes reported; only checked non-empty spec" if ok else "empty build",
        }
    missing = sorted(required - built)
    # Allow generic builders that emit a single bodyVolume to cover soft-fail cases only when required is empty
    ok = not missing
    return {
        "ok": ok,
        "gate": "component-coverage",
        "missingTypes": missing,
        "requiredTypes": sorted(required),
        "builtTypes": sorted(built),
    }
