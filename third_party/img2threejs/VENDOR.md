# Vendor note: img2threejs

Upstream: https://github.com/img2threejs/img2threejs  
License: Apache-2.0  
Survey date: 2026-07-28  
Referenced version: v1.4.1

## What we take

TigerInBamboo does **not** vendor the full Agent Skill tree. We implement a
compatible subset under `tools/sculpt/`:

| Idea from img2threejs | Local implementation |
|----------------------|----------------------|
| ObjectSculptSpec-first | `tib-sculpt-1` via `tools/sculpt/spec_map.py` |
| strict-quality before build | `tools/sculpt/validate_sculpt_spec.py` |
| component-coverage gate | `tools/sculpt/gates.py` |
| sculptRuntime sockets | `frontend/js/sculpt/runtime.js` |
| pass-based codegen | deferred; static-builder only |

## Why not full subtree

- Upstream is agent-driven (Claude/Codex), not an HTTP service.
- Large CS2 weapon-specific surface; not needed for ink-painting subjects.
- Zero-pip forge scripts can be copied later if Divine Eye PNG math is required.

## Optional future copy

If you need comparison sheets or divine_eye:

```bash
git clone --depth 1 https://github.com/img2threejs/img2threejs.git /tmp/img2threejs
# copy LICENSE + selected forge/stage4_review/*.py + forge/_shared
```

Keep this file updated when bumping upstream references.
