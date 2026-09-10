# Kun battle v2 — local mouth cavity candidate

Derived from kun-battle-v1, with all 295 original IDs, parents and rest transforms exact. The 100 visible original mesh instances retain their vertex positions. Existing eyes, back island n102 and six live garden attachment behavior remain untouched. Keep current world transform and root scale .5; glTF +X is forward and +Y is up.

The same outer jaw, mouth silhouette and visible thick lips remain. Upper/lower lining fans become longitudinal curved strips and a five-section rear throat taper reaches source X13 (front lip X43). Only the artificial rear lip/rim closure across the hinge is removed: it had formed a bar through the mouth. Outer lip contours are preserved. Local internal relief moves the palate nose inward at most .03 with width factor .998 and raises the rear floor by up to 1.0 to keep it within the existing shell. The model has 6,077 visible triangles versus v1's 5,091.

## Runtime mapping

Existing add:jaw-pivot rotation, add:throat-membrane JawTurnSin/JawTurnCos, add:jaw-shell ThroatInflation and add:lower-lip LipFullness remain unchanged. Continue using the exact sine/cosine coupling for the 38° maximum jaw rotation.

Add two entries to the existing runtime morph table:
- add:mouth-floor / ThroatInflation = existing inflation amount.
- add:inner-throat / JawTurnSin and JawTurnCos = the same analytic weights already used for add:throat-membrane.

add:inner-throat is a child of add:mouth-roof, so adopting the existing mouth-roof subtree brings the new node into the scene. No new top-level world placement is needed. The assembly provides all 121 poses and a dedicated mouthV2Contract. The GLB is closed frame 1, static, with morph targets. The Blender file stores the 121-frame review cycle.

## Evidence and limits

Actual GLB fresh import was used for all v2-prefixed images. Normal-light front/front-high/3q/side-below, closed, half-open and engulf views remain available. Diagnostic front/3q images (render_v2_diagnostic.py) add a separate area light inside the front opening only to expose the cavity; they do not alter the final material or GLB.

All 121 sampled poses report zero triangle intersections for four tested surface pairs: palate/body, floor/jaw shell, inner throat/body and inner throat/jaw shell. This is a local mouth-shell test, not an assertion about every pair of meshes or world combat collisions. Closed-mouth visual checks complement it; subframe continuous collision and original world gameplay remain separate.

Original/v1 archives were not edited. No Godot cache or live world file is changed by this asset build. Main-task visual review must precede copying into Godot.
