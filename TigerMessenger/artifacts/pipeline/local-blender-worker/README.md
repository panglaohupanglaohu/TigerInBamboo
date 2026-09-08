# Saved-candidate Blender → Godot worker — 2026-09-09

Two actual complete chains passed using Blender 5.2.1 LTS and Godot 4.7.2: saved candidate .blend → a NEW candidate.glb → Blender re-import → that exact new GLB imported and instantiated in a fresh minimal Godot project. This is execution and structural validation evidence; no artwork was improved or deployed.

| Candidate | Source nodes | Godot nodes* | Meshes | Triangles | Used materials | Complete-chain evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Tiger Anatomy V3 | 90 | 91 | 71 | 9,440 | 13 | `chain-tiger-01/report.json` |
| Roman Armor V3 Direction | 4 | 5 | 3 | 696 | 2 | `chain-roman-01/report.json` |

*Godot adds one identity scene wrapper. Geometry counts and material identities match the source export; all coordinates/material factors are finite. Tiger world-bound error is 2.38e-7, within 0.0001. Reports contain measured armor bounds and full checks.

The tiger retains all 80 original IDs, all 30 `candidateHiddenOutline` nodes and ten added nodes. Its original `n4` is intentionally geometry-free: existing `build_anatomy.py:84` marks its geometry as integrated into `n2`. The worker preserves that node, parent and extras, documenting its glTF conversion from zero-vertex MESH to EMPTY. The allowance requires the explicit `integratedInto` contract; no geometry is added, removed or edited.

Armor uses only the named v3 wearable scene. Its saved .blend also contains v2 and original-context scenes, which are excluded from the export.

## Execution and evidence

`blender_jobs.py` starts a separate background Blender with factory startup and auto-run Python disabled, opens the saved candidate .blend, and runs `blender_export_check.py`. The script selects only MESH and EMPTY objects in the exact scene, recording excluded review cameras/lights. It unhides nodes only in this disposable process so hidden outline geometry and its identifying extras survive export. No .blend save or foreground/MCP operation is used.

Output is a new `{run_dir}/candidate.glb`. The Blender script clears only its own in-memory data, re-imports that GLB, and checks exact node names/counts, parents, custom extras, mesh triangle counts, per-material triangle usage, finite vertices/transforms, per-mesh bounds and world transforms.

The wrapper then creates a fresh temporary Godot project containing only a minimal project config, `godot_export_check.gd` and an exact copy of the new GLB. It imports there and inspects node/mesh/triangle/material counts, original IDs, outline metadata, finite geometry/materials and world bounds after the Blender Z-up → Godot Y-up axis conversion. The copied input SHA256 must equal the generated candidate before and after the engine check. The production GLB and active editor cache are never used for this Godot stage.

The wrapper checks source .blend, production GLB and worker-script hashes before/after execution. Both complete runs verified unchanged source/production hashes. Logs, exact argv, engine versions, candidate hash and isolated project paths are recorded. The private projects are retained for audit.

Two negative checks passed: repeated output paths are rejected without changing the existing report/GLB (`overwrite-guard-check.json`), and Godot rejects a deliberately incorrect expected triangle count with exit code 1 (`negative-count/check.json`).

## Runner and Studio integration

`jobs.blender.example.json` uses actual registry IDs, a `blender-background` resource lock, 360-second total timeout, `{run_dir}/report.json`, and expected artifact hashes for the generated GLB plus both stage reports. Root `passed` requires the Blender check, new-GLB Godot check, and current source hashes. Parent runner cancellation reaches the inherited process group. Stage limits are 150 seconds for Blender, 90 for isolated import, and 60 for inspection.

`BLENDER_BINARY` / `--blender` and `GODOT_BINARY` / `--godot` support installed engine paths on the Studio. Only standard Python and those two applications are required; no model service or external Python package is needed. The root runner executes these reviewed jobs separately from the worker scratch tests above.

These GLBs deliberately include hidden-outline geometry. The Godot game adapters remain responsible for runtime visibility/material behavior. This check does not certify visual appearance, textures, shader fidelity, animation, combat, quest behavior or gameplay acceptance, and it does not replace production resources.

Historical evidence: `scratch-tiger-01` records the first rejection of the known empty anchor; `scratch-tiger-02` and `scratch-roman-01` record earlier Blender-only checks. Use the `chain-*` reports for complete-chain claims. Machine-readable current summary: `summary.json`.
