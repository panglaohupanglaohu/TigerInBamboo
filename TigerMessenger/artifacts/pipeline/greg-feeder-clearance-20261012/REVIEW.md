# Feeder paddle-envelope avoidance

Owned source: only feeder swimming-position segment in src/world/swampFlowerActivities.js. Original source is in source-before/. Five flowerboat routes, paired paddle power, identity roster, original whale motion, boat hulls and environment are unchanged.

The same child now follows the opposite side of the adult whale snout, preserving the original1.65-inner side offset and4.5-inner forward offset magnitude. When the whale is submerged, the child smoothly swims1.5-inner units toward the adult orbit centre. This offset returns smoothly as the adult surfaces. It is a deterministic path from the existing whale orbit/surfacing function; no collision projection or teleport, no reset of boat phases. The original hand-to-food-to-mouth sequence, mouth waterline correction, swimming limbs and breathing loop remain.

## Rejected candidate

First candidate retained the original side and only moved inside while the whale was submerged. It fixed the86.573-second encounter but failed full150-second checks at144.5 seconds:0.135816m. Evidence rejected-inside-only-cpu.json is preserved. The0.25m threshold was not lowered.

## Final CPU result

Formal seed7711 / true spherical placement and actual indexed triangles / scale0.5 / original departure, no far proxy. Before:150-second original survey with707 broad-overlap times refined; closest flowerboat2 blade/right lower leg1.875mm at86.573s. After:each of five flowerboats measured against the child across all601 frames0..150s, using BVH triangle distance pruning and vertex-triangle/edge-edge distances.

| Boat | Closest final world distance | Time |
|---|---|---|
| 0 | 1.944856m | 128.250s |
| 1 | 5.634840m | 126.250s |
| 2 | 0.875159m | 140.750s |
| 3 | 4.594101m | 19.250s |
| 4 | 1.743959m | 99.500s |

All five exceed0.25m at the tested times; final minimum0.875159m. Original86.55..86.60s window at0.001s now has minimum 1.570747m. Actual static wall/walk/root geometry distance over601 frames has minimum 1.312046m near world-tree-trunk at15.5s. These are actual surface distances, not the old circular reservation or coarse mesh bounds.

Identity and action check:10children/five boats/ten paddles; unchanged whale-feeder. Over150s,29 feeding frames,557 nose-above-water frames and44 submerged frames; maximum mouth target error9.6e-14inner; maximum child displacement0.200213m per0.25s sample, following a smooth analytic path. No food or mouth-contact meaning is removed.

## Validation limits

Discrete0.25s global samples and0.001s old near-contact window do not certify all continuous instants. Closed-mesh containment has not been tested; positive surface distance alone cannot exclude containment. Root/wall diagnostic copies share actual production indexed geometry and exact transforms; they are CPU-only test objects, not added to production. No GPU tools/visual acceptance; outline thickness not directly modeled, hence the0.25m requirement. No FPS claims.

Evidence: dynamic-after-cpu.json, feeder-all-after-cpu.json, feeder-fine-after-cpu.json, feeder-shore-root-after-cpu.json, feeder-action-cpu.json, rejected-inside-only-cpu.json; copied CPU test sources. Original before evidence remains in greg-flower-surface-distance-20261012/.
