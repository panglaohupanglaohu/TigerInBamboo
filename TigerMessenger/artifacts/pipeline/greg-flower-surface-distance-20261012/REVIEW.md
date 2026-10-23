# Actual dynamic surface-distance survey

Read-only production source. Formal seed7711, original longship/no far proxy, actual placement/matrixWorld, uniform inner world scale0.5. Investigated the seven broad-phase overlap pairings at all707 candidate frames from the prior150-second survey. Flowerboat0 versus original dock ship additionally measured all601 frames, not only the smallest coarse-bound frame.

BVH triangle-AABB squared-distance pruning; exact minimum of vertex-to-triangle and nine edge-to-edge distances; full triangle SAT to detect intersection. Native triangle and segment algorithm sanity assertions cover parallel triangles, intersecting triangles, crossing and endpoint-separated segments. Production source unchanged.

| Flowerboat | Actor | Samples | Minimum actual surface distance, world metres | Time |
|---|---|---|---|---|
| 0 | original-dock-ship | 601 | 1.232432 | 8.750 |
| 0 | feeding-child | 9 | 0.548965 | 129.000 |
| 1 | original-dock-ship | 601 | 2.844971 | 106.500 |
| 2 | whale-0 | 17 | 0.959487 | 148.250 |
| 2 | feeding-child | 56 | 0.032037 | 86.500 |
| 4 | whale-0 | 16 | 0.658818 | 2.250 |
| 4 | escort-whale | 1 | 1.266408 | 121.000 |
| 4 | original-longship | 7 | 1.772767 | 119.000 |

Flowerboat0/dock actual nearest sampled distance1.232432m: the earlier0.077172m mesh-bound separation was a loose lower bound.

## Unresolved close encounter

Flowerboat2 paddle blade versus feeding child right lower leg is only0.032037m apart at86.5s in the original0.25-second samples. Refining85.9..87.1s at0.01s found0.002390m at86.57s. Further86.55..86.60s at0.001s found 0.001874683m at 86.573s. This is insufficient clearance, even though sampled triangles do not intersect. It must not be passed as safe traffic. Outline thickness or a time between samples may visually contact. Suggest a narrow feeder avoidance adjustment against actual moving paddle envelopes with a meaningful safety margin, while preserving child identity, whale feeding interaction and current flowerboat routes. Do not blindly shorten all boats or move the dock. No fix applied in this read-only batch.

## Boundaries

707-candidate set is selected from the previous0.25-second mesh-bounds survey; it does not find the global nearest time over an entire continuous150 seconds. Additional flowerboat0/dock601 frames are specifically covered. Refined feeder windows remain discrete. No continuous swept-time certification; no closed-mesh containment test (positive surface distance alone cannot exclude complete containment); no shader/outline geometry; no GPU acceptance. Actual triangle vertices of the nearest surfaces are saved in the JSON for reproduction.

Artifacts: surface-distance-cpu.json, feeder-window-refined-cpu.json, feeder-window-fine-cpu.json, copied swampFlowerSurfaceDistance.inspect.mjs. Formal test source tests/world/swampFlowerSurfaceDistance.inspect.mjs.
