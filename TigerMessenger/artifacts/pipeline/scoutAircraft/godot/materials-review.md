# Scout material surface optimization

Controlled real Godot run, same current inspection UI (including root's return button/rotation/zoom hint), same fixed camera and 1200×1000 window: **85 → 32 draw calls**, reduction53 (62.35%). Rendered primitives remain2,104 including UI. Earlier historical81 count used a different UI and is not the comparison baseline.

Actual imported GLB primitive surfaces:147 →41, including18 hidden archive outline meshes;19 material definitions unchanged. The main cause was original Three groups retained as out-of-range face material indices against a single Blender slot. Blender/glTF resolved them to the same last valid material, but still emitted separate primitive surfaces. The exporter now evaluates existing modifiers, resolves effective slots with identical semantics, compacts face indices, and canonicalizes only fully matching PBR inputs/culling/render properties. Materials with residual linked inputs remain identity-specific.

All46 originalIDs, required anchors,23 visible meshes,18 hidden outline nodes and one canopy override pass the runtime checks. No dynamic nodes merged. Independent binary GLB comparison confirms every triangle's position, normal, winding and effective PBR properties unchanged (1e-6 numeric tolerance), plus node properties and child hierarchy. Source blend remains unchanged. No edits to scout_candidate.gd, root UI controls, registry or currentResource.

Viewed materials-after.png against materials-before.png. Pixel comparison has0 pixels exceeding1/255 channel difference; maximum difference1/255, consistent with submission order precision. Existing empty cockpit, alpha glass, missing panel/ink details and aliasing remain; this change claims reduced draw submission only, not final art completion or fleet performance.

Evidence: materials-before/after.png, materials-before/after.json, materials-comparison.json, surface-equivalence.json. A materials-before.glb evidence copy preserves the exact previous resource outside Godot import directories.
