# Godot bookshop original surroundings — verified local batch

## Result and scope

The default playable `godot/scenes/main.tscn` now loads all six actual Web corridor trees captured in `godot/data/bookshop-surroundings.json`. This is a bookshop-local adaptation, not a migration of the whole original world. No random replacement houses, signs, streetlights, poles, or generic substitute trees were added.

Only legacy decorative roots within a 14 m world-space distance of the bookshop are suppressed during generation: 6 houses, 2 towers, and 12 pines (20 total). The eight legacy buildings' colliders disappear with those roots; the suppressed ambient pines had no colliders. Chapter roots are never filtered. All surviving legacy roots preserve their exact recorded transforms/scales, including later random pine placements. The explicit `--bookshop-legacy-context` flag restores the previous context; unavailable source data also keeps the legacy context.

## Implementation

- `godot/scripts/bookshop_surroundings.gd`: source validation, terrain adaptation, batched meshes, original palette/brush materials, six trunk-radius collision proxies, and inspection metadata.
- `godot/scripts/world.gd`: minimal helper preload, source-aware decoration exclusions, preserved random draws, and helper creation. Garden, bookshop, chapter, and interaction logic are unchanged in this batch.
- `godot/scripts/test_bookshop_context.gd`: actual-main before/after, source completeness, colors, placement, scope fingerprints, walking, grounding, R interaction, screenshots, and render counters.
- `godot/scripts/inspect_bookshop_context.gd`: preflight inventory.
- `artifacts/bookshop-context/godot-check-boundaries.gd`: precise boundary surface-intersection diagnostic.

Source SHA256: `ef474b18e646ff94a3c7138e7c179905b68b6ea06dec6719b21d493aee222e52`.

All 282 captured surface parts / 3,876 surface triangles are retained, plus the same number of already pressure-expanded ink triangles. Each original tree's geometry, source scale and yaw, and bookshop-relative XZ layout are preserved. Height is adapted by raycasting along bookshop up against only the shared rendered terrain's actual physics mesh. Native XZ displacement is under 0.0001 m. Tree up follows native spherical gravity. Heights are approximately 3.15–4.93 m.

The surfaces are combined into seven original-color surfaces, and ink into two original dry-value surfaces: two mesh instances, nine material surfaces total. Three linear RGB is converted once for Godot's `source_color` shader input; round-trip palette checks pass. Winding is reversed for Godot while preserving authored normals. The existing two-band shader and warm dry-brush shader are reused. Ink casts no shadows, has no GI, and creates no collision. Six cylinder proxies use the source world-scaled collider radii; these are trunk gameplay proxies, not detailed branch collisions.

No source Blender/GLB files, frontend files, shared planning documents, global lighting, camera settings, other regions, or foreground Blender contents were modified.

## Verification

| Check | Result |
| --- | --- |
| Legacy fallback actual-main run | Passed; 20 expected near decorations present |
| Default actual-main run | Passed; all 6 source trees, all 3,876 triangles, 7 color + 2 ink surfaces |
| Outside-scope/root fingerprint comparison | Passed; 82 legacy roots before, 62 after, only the scoped 20 omitted |
| Source palette and exact planar placement | Passed |
| Spawn → bookshop → original entrance path | Walked using actual CharacterBody3D; grounded at entrance |
| R letter interaction | Passed; chapter advanced to 1 |
| Existing six-waypoint route regression | `NATIVE_ROUTE_OK`, all six walked in 12.5 s |
| Diff whitespace validation | `git diff --check` passed |

Actual-main screenshots are `godot-before.png` / `godot-after.png`, with supplemental player-turn views `godot-forest-before.png` / `godot-forest-after.png`. All were inspected. They use the existing player camera and unchanged lighting, not an asset-review camera. Captures are 976 × 610. The before/after player pose uses the same route and heading; the side-view transforms differ by under 0.0002 m from physics settling, rather than being bit-identical. The front pair most clearly demonstrates removal of the experimental bookshop surroundings; these gameplay viewpoints do not show every imported tree at once.

At the captured frontal view, measured total render calls decrease from 703 to 565. Reported total primitives increase from 157,902 to 169,722. These are scene-wide Godot render counters for this fixed view, including render passes, not asset-only triangle counts or a general frame-rate benchmark.

Commands used (from project directory, through the required RTK wrapper):

```text
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --path godot --script res://scripts/test_bookshop_context.gd -- --bookshop-legacy-context
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --path godot --script res://scripts/test_bookshop_context.gd
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --headless --path godot -- --route-test
rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://../artifacts/bookshop-context/godot-check-boundaries.gd
rtk proxy git diff --check
```

## Boundary and remaining limits

Two surviving old pines at bookshop distances 16.794 m and 18.334 m have world-axis-aligned bounding-box overlap with source tree 5. The closer pine is approximately 1.95 m away in source-local XZ. A bidirectional triangle-edge/face intersection check of the actual transformed meshes finds no surface crossings for either candidate (`godot-boundary-check.json`). Bounding boxes therefore remain overlapping; this diagnostic is not a proof against every possible containment case. No extra objects were suppressed and the radius stays 14 m.

The terrain/gravity adaptation intentionally differs from the source Web ground height and world-up orientation while keeping local planar layout. Native lighting still differs from the Web renderer. Distant experimental scenery, the compact native sphere, and other chapter regions remain unchanged. Missing-data fallback is supported; a runtime terrain-ray failure is reported and not silently replaced with invented tree placement.
