# Godot local worker evidence — 2026-09-09

Three existing regressions passed against fresh copies of current project inputs. This is structural evidence only: no screenshots, no visual approval, and no refresh of the running editor.

| Job | Actual result | Report |
| --- | --- | --- |
| Lake swamp tiger | Exact original world transform; four enable/disable transitions; original visibility preserved | `20260909/tiger-world.json` |
| Red/blue short-sword soldier | 252 pose cases; max grip error 5.33e-7; minimum body/sword separation 0.180872 / 0.032879 model-root units | `20260909/roman-armor.json` |
| Castle shared-edge town | 20,202 original nodes checked; only 12 town layers hidden; 796 candidate meshes; original placement and restoration preserved | `20260909/castle-world-current.json` |

The castle is a world placement (`castleContainer`), not an independent asset-registry item. Its catalog `asset_id` is null and `world_placement` names the real placement. The soldier job identifies the red registry asset and lists the blue sibling in `related_asset_ids`.

## Reusable entry points

`tools/pipeline/local/jobs.godot.example.json` supplies explicit argv, project-relative cwd/input paths, expected report, success criteria, timeout, and the shared Godot resource lock. The parent runner substitutes an absolute unique `{run_dir}`. Root `passed: true` requires process success, the exact structured regression result, domain assertions, and input freshness.

`tools/pipeline/local/godot_jobs.py` makes a fresh private temporary project, copies the current source tree excluding `.godot`, copies the external Roman assembly contract, optionally seeds only the old checkpoint import cache, and performs import only inside the private project. The active project is never passed to an import/editor subprocess. The reports record all input SHA256 values, command argv, temporary project paths and logs. Each report path must be new, protecting earlier evidence.

The old checkpoint copy was not assumed current: 397 non-cache files were compared; the registry and import map differed, and the Roman assembly contract was missing outside that old project. Each new source snapshot was verified byte-for-byte before import and against the live sources after testing. Candidate resources match the checkpoint hashes. Temporary projects remain available for audit.

## Exact scope and caveats

- Tiger runs the existing `test_tiger_world_deployment.gd`. The isolated copy alone removes the line 28 `frame_post_draw` wait, which otherwise requires a renderer signal. All assertions remain; screenshots stay disabled by headless mode. This tests static placement, not roaming, dialog, rescue, or visual anatomy approval.
- Soldier runs the existing `test_roman_armor_direction.gd` without edits. It checks the actual v3 armor adapter, crest direction, source preservation, gripping and separation for 252 discrete poses. This does not prove continuous leg/skirt collision or combat integration.
- Castle runs the existing `test_castle_world_adapter.gd` without edits. It checks original placement, layer visibility and reversible restoration. It does not test navigation, collisions, native WFC editing or concept-art fidelity.
- Three importer warnings state missing script `.uid` files were recreated from cache. They occurred only in the new temporary projects; test logs contain no errors.
- `20260909/castle-world.json` is an earlier passing run with legacy asset ID metadata. Use `castle-world-current.json`, which correctly uses a null asset ID and explicit world placement.
- Existing screenshot-capable regressions also include `test_tiger_anatomy_candidate.gd` and `test_roman_full_candidate.gd`. Their historical screenshots remain in the original artifact folders; they were not regenerated here.

Machine-readable summary: `summary.json`. No shared queue, gameplay code, source art, or shared handoff documents were changed by this worker.
