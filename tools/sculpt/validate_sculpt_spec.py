"""Hand-written SculptSpec validator (no jsonschema dependency)."""
from __future__ import annotations

from typing import Any

REQUIRED = ("version", "subjectKey", "components", "qualityContract")


def validate_sculpt_spec(spec: dict[str, Any] | None, strict: bool = True) -> list[str]:
    errors: list[str] = []
    if not isinstance(spec, dict):
        return ["spec must be an object"]

    for key in REQUIRED:
        if key not in spec:
            errors.append(f"missing {key}")

    components = spec.get("components")
    if components is not None and not isinstance(components, list):
        errors.append("components must be a list")
        components = []
    components = components or []

    contract = spec.get("qualityContract") if isinstance(spec.get("qualityContract"), dict) else {}
    min_components = int(contract.get("minComponents") or 1)

    if strict and len(components) < min_components:
        errors.append(f"too few components for qualityContract (have {len(components)}, need {min_components})")

    if strict and components:
        if not any(isinstance(c, dict) and c.get("attachment") for c in components):
            errors.append("components lack attachment")
        for i, c in enumerate(components):
            if not isinstance(c, dict):
                errors.append(f"component[{i}] not an object")
                continue
            if not c.get("type"):
                errors.append(f"component[{i}] missing type")

    if strict and contract.get("requireAttachments"):
        missing_attach = [
            c.get("id") or c.get("type") or str(i)
            for i, c in enumerate(components)
            if isinstance(c, dict) and not c.get("attachment")
        ]
        if missing_attach:
            errors.append(f"requireAttachments: missing on {missing_attach[:5]}")

    build = spec.get("build") if isinstance(spec.get("build"), dict) else {}
    if strict and build.get("mode") == "static-builder" and not build.get("builderKey"):
        # soft: allow missing builderKey but warn as error in strict for empty builder
        if not components:
            errors.append("static-builder without builderKey and empty components")

    return errors
