# Scout Aircraft Art V1 — two-round Blender MCP candidate

Actual MCP calls used `execute_blender_code`, not an offline substitute. Original foreground file was dirty moebiusTiger.blend with Scene and Bookshop Art V1. Both scenes remain untouched in memory; Scout Aircraft Art V1 was appended independently. Candidate saved using libraries.write(scene), never saving over the original foreground file or source archive. The candidate is a standalone scene library; exporters should explicitly select Scout Aircraft Art V1 if an empty default Scene appears.

## Actual comparison

Viewed original.png, scoutAircraft-target-v1.png, round-1.png and round-2.png. Both candidate renders use the identical original camera, lighting and resolution. Round 1 added restrained 12mm single-segment bevels on 11 existing parts, paint roughness variation, and transmissive 6mm canopy glass. It exposed an existing problem: the solid fuselage occupied the cockpit. Round 2 cuts a small 16-sided recess entirely under the canopy and adds one dark open liner; the visible glass now reveals an interior opening instead of solid blue hull.

The original silhouette, wing shapes, cream pointed nose, yellow tips, gun anchors and all 46 original node IDs remain. No propeller blades, weapon changes, or external asset packs.

## Remaining difference from concept

This is a review candidate, not visual acceptance or a finished game asset. The concept has a designed seat, richer panel seams, clearer ink lines and warmer presentation; this candidate deliberately has no invented seat and still needs engine-specific glass/ink rendering. The original painterly outline shells remain archived/hidden in Blender. Small bevels are visible but subtle at gameplay scale. A recessed empty cockpit is an improvement over the intersection, but its exact interior should be reviewed in Godot before adoption.

23 visible meshes versus original 22. One extra material/mesh for the liner; actual engine draw-call cost is not measured. Procedural roughness nodes will not automatically become a Godot shader or glTF texture. Export must bake or explicitly translate these, and treat glass transmission as a Godot material adaptation. Never mark Web or Godot integration complete from these renders.

## Replay

Execute 01-append.py, 02-refine.py, 03-cockpit.py in order through the project's Blender MCP client, with a fresh appended scout scene. They are not idempotent on an already modified scene. render-candidate.py and verify-candidate.py run read-only in background Blender. round-1.png and round-2.png retain the two observed steps; foreground-viewport.png is the first-round viewport, not the final render.
