"""Map morphologyPlan / catalog templates → tib-sculpt-1 SculptSpec."""
from __future__ import annotations

from typing import Any

SPEC_VERSION = "tib-sculpt-1"

# subjectKey / morphology key → frontend builder key
BUILDER_KEY_BY_SUBJECT: dict[str, str] = {
    "lotus": "lotus",
    "bamboo": "bamboo",
    "pine": "pine",
    "bird": "avian",
    "water": "water",
    "reed": "reed",
    "vine": "vine",
    "plum": "plum",
    "fish": "fish",
    "insect": "insect",
    "quadruped": "quadruped",
    "ungulate": "quadruped",
    "rabbit": "quadruped",
    "terrain": "terrain",
    "flower": "generic-plant",
}

DEFAULT_SOCKETS: dict[str, list[dict[str, Any]]] = {
    "lotus": [
        {"id": "waterline", "position": [0, 0, 0], "purpose": "env-water"},
        {"id": "sway-root", "position": [0, 0.1, 0], "purpose": "wind"},
    ],
    "bamboo": [
        {"id": "ground", "position": [0, 0, 0], "purpose": "ground"},
        {"id": "sway-root", "position": [0, 0.15, 0], "purpose": "wind"},
    ],
    "pine": [
        {"id": "ground", "position": [0, 0, 0], "purpose": "ground"},
        {"id": "sway-root", "position": [0, 0.2, 0], "purpose": "wind"},
    ],
    "plum": [
        {"id": "ground", "position": [0, 0, 0], "purpose": "ground"},
        {"id": "sway-root", "position": [0, 0.12, 0], "purpose": "wind"},
    ],
    "reed": [
        {"id": "ground", "position": [0, 0, 0], "purpose": "ground"},
        {"id": "sway-root", "position": [0, 0.1, 0], "purpose": "wind"},
    ],
    "vine": [
        {"id": "anchor", "position": [0, 0.5, 0], "purpose": "attach"},
        {"id": "sway-root", "position": [0, 0.3, 0], "purpose": "wind"},
    ],
    "flower": [
        {"id": "ground", "position": [0, 0, 0], "purpose": "ground"},
        {"id": "sway-root", "position": [0, 0.08, 0], "purpose": "wind"},
    ],
    "water": [
        {"id": "waterline", "position": [0, 0, 0], "purpose": "env-water"},
    ],
    "terrain": [
        {"id": "ground", "position": [0, 0, 0], "purpose": "ground"},
    ],
    "bird": [
        {"id": "root", "position": [0, 0, 0], "purpose": "locomotion"},
        {"id": "beak", "position": [0.12, 0.06, 0], "purpose": "interact"},
        {"id": "wing-L", "position": [0, 0.05, 0.08], "purpose": "wing"},
        {"id": "wing-R", "position": [0, 0.05, -0.08], "purpose": "wing"},
    ],
    "fish": [
        {"id": "root", "position": [0, 0, 0], "purpose": "locomotion"},
        {"id": "tail", "position": [-0.15, 0, 0], "purpose": "swim"},
    ],
    "insect": [
        {"id": "root", "position": [0, 0, 0], "purpose": "locomotion"},
        {"id": "wing-L", "position": [0, 0.02, 0.06], "purpose": "wing"},
        {"id": "wing-R", "position": [0, 0.02, -0.06], "purpose": "wing"},
    ],
    "quadruped": [
        {"id": "root", "position": [0, 0, 0], "purpose": "locomotion"},
        {"id": "head", "position": [0.18, 0.1, 0], "purpose": "interact"},
        {"id": "tail", "position": [-0.2, 0.05, 0], "purpose": "balance"},
    ],
    "ungulate": [
        {"id": "root", "position": [0, 0, 0], "purpose": "locomotion"},
        {"id": "head", "position": [0.2, 0.14, 0], "purpose": "interact"},
    ],
    "rabbit": [
        {"id": "root", "position": [0, 0, 0], "purpose": "locomotion"},
        {"id": "head", "position": [0.1, 0.08, 0], "purpose": "interact"},
    ],
}

PLANT_KEYS = {"lotus", "bamboo", "pine", "plum", "reed", "vine", "flower"}
PREY_KEYS = {"bird", "fish", "rabbit", "insect"}
PREDATOR_KEYS = {"quadruped"}  # tiger-class digitigrade in our catalog


def resolve_builder_key(
    subject_key: str,
    template: dict[str, Any] | None = None,
    plan: dict[str, Any] | None = None,
) -> str | None:
    if template and template.get("builderKey"):
        return str(template["builderKey"])
    if plan and plan.get("builderKey"):
        return str(plan["builderKey"])
    return BUILDER_KEY_BY_SUBJECT.get(subject_key)


def default_sockets_for(subject_key: str, subject: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    if subject_key in DEFAULT_SOCKETS:
        return [dict(s) for s in DEFAULT_SOCKETS[subject_key]]
    domain = str((subject or {}).get("domain") or "")
    if domain == "plants":
        return [dict(s) for s in DEFAULT_SOCKETS["flower"]]
    if domain == "biology":
        return [dict(s) for s in DEFAULT_SOCKETS["quadruped"]]
    return [{"id": "origin", "position": [0, 0, 0], "purpose": "origin"}]


def _ecology_tags(subject_key: str, subject: dict[str, Any], template: dict[str, Any] | None) -> list[str]:
    if template and template.get("ecologyTags"):
        return list(template["ecologyTags"])
    tags: list[str] = []
    domain = str(subject.get("domain") or "")
    if domain:
        tags.append(domain)
    if subject_key in PLANT_KEYS or domain == "plants":
        tags.extend(["plant"])
    if subject_key == "lotus":
        tags.append("aquatic")
    if subject_key in PREY_KEYS:
        tags.append("prey")
    if subject_key in PREDATOR_KEYS:
        tags.append("predator")
    if subject_key == "water" or domain == "water":
        tags.append("water")
    if subject_key == "terrain" or domain == "terrain":
        tags.append("terrain")
    # dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out or ["object"]


def _runtime_tick(subject_key: str, subject: dict[str, Any], template: dict[str, Any] | None) -> str | None:
    if template and template.get("runtimeTick") is not None:
        return template.get("runtimeTick")
    domain = str(subject.get("domain") or "")
    if subject_key in PLANT_KEYS or domain == "plants":
        return "sway"
    if subject_key == "water":
        return "flow"
    return None


def morphology_plan_to_sculpt_spec(
    plan: dict[str, Any] | None,
    subject: dict[str, Any],
    layer: dict[str, Any] | None = None,
    template: dict[str, Any] | None = None,
) -> dict[str, Any]:
    plan = plan or {}
    layer = layer or {}
    template = template or {}
    subject = subject or {}

    subject_key = (
        str(template.get("subjectKey") or "")
        or str(plan.get("key") or "")
        or str(subject.get("key") or "")
        or str(subject.get("id") or "object")
    )
    # Normalize biology subject ids like biology-goose → bird when plan key present
    if plan.get("subjectId") and not plan.get("key"):
        pass

    components: list[dict[str, Any]] = []
    raw_components = plan.get("components") or []
    for i, c in enumerate(raw_components):
        if not isinstance(c, dict):
            continue
        params = {k: v for k, v in c.items() if k not in ("type", "role", "count")}
        parent_socket = "origin"
        if subject_key in PLANT_KEYS:
            parent_socket = "ground" if subject_key != "lotus" else "waterline"
        components.append(
            {
                "id": f"{c.get('type') or 'part'}-{i}",
                "type": c.get("type"),
                "role": c.get("role"),
                "count": c.get("count", 1),
                "params": params,
                "attachment": {
                    "parentId": "root",
                    "parentSocket": parent_socket,
                    "contactType": "join",
                    "embedDepth": 0.0,
                },
            }
        )

    n = len(components)
    domain = str(subject.get("domain") or "")
    primary = "hybrid" if domain == "biology" or subject.get("kind") else "object"
    if domain == "biology":
        primary = "hybrid"

    builder_key = resolve_builder_key(subject_key, template, plan)
    sockets = template.get("sockets") or default_sockets_for(subject_key, subject)
    anatomy = template.get("anatomyProfile") or subject.get("kind")
    if subject_key == "bird":
        anatomy = anatomy or "avian"
    elif subject_key in ("quadruped", "ungulate", "rabbit"):
        anatomy = anatomy or subject_key

    return {
        "version": 1,
        "specVersion": SPEC_VERSION,
        "name": f"{subject.get('id') or subject_key}-{layer.get('id') or 'layer'}",
        "primaryDomain": primary,
        "subjectKey": subject_key,
        "qualityContract": {
            "complexity": "moderate" if n >= 4 else "simple",
            "style": "ink-painting-stylized",
            "minComponents": max(1, n // 2) if n else 1,
            "requireAttachments": True,
            "constraints": list(plan.get("constraints") or []),
        },
        "reference": {
            "bbox": layer.get("bbox"),
            "maskCoverage": layer.get("coverage"),
        },
        "components": components,
        "materials": list(template.get("defaultMaterials") or []),
        "sockets": [dict(s) for s in sockets],
        "detailInventory": list(template.get("detailInventory") or []),
        "runtime": {
            "tick": _runtime_tick(subject_key, subject, template),
            "ecologyTags": _ecology_tags(subject_key, subject, template),
            "anatomyProfile": anatomy,
        },
        "build": {
            "mode": "static-builder",
            "builderKey": builder_key,
            "passesRequired": ["blockout", "form-refinement"] if n >= 3 else ["blockout"],
        },
        "archetype": plan.get("archetype"),
    }
