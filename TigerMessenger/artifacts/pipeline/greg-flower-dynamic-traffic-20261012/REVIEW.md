# Formal flowerboat dynamic traffic CPU survey

Read-only source batch. Seed7711, actual production placeMoebiusSwampOnSphere / matrixWorld, scale0.5, departure=original. No far-longboat proxy is created. All original updates run before bounds sampling. 601 samples over0..150s at0.25s cover the adult whale 2.4-orbit surface cycle (~137s), multiple32.8s flowerboat cycles and moving original longship/escort.

Five actual flowerboats versus two orbit whales, escort whale, original departure longship, original dock ship, repair barge and feeding child are checked. Current visible mesh geometry bounds include actual animated paddles, feeder limbs, tail-deformed whale bodies, and longship orientation. Outlines are excluded.

## Results

| Flowerboat | Dynamic actor | Minimum signed mesh AABB gap (inner) | Samples with bounds overlap | Real triangle intersections |
|---|---|---|---|---|
| 0 | whale-0 | 0.367647 | 0 | bounds separated |
| 0 | whale-1 | 1.116065 | 0 | bounds separated |
| 0 | escort-whale | 1.486453 | 0 | bounds separated |
| 0 | original-longship | 0.847799 | 0 | bounds separated |
| 0 | original-dock-ship | 0.154343 | 0 | bounds separated |
| 0 | repair-barge | 12.293970 | 0 | bounds separated |
| 0 | feeding-child | -0.287011 | 9 | 0 / 9 overlap samples |
| 1 | whale-0 | 6.800733 | 0 | bounds separated |
| 1 | whale-1 | 8.574919 | 0 | bounds separated |
| 1 | escort-whale | 9.451456 | 0 | bounds separated |
| 1 | original-longship | 9.193917 | 0 | bounds separated |
| 1 | original-dock-ship | -0.627277 | 601 | 0 / 601 overlap samples |
| 1 | repair-barge | 8.190020 | 0 | bounds separated |
| 1 | feeding-child | 7.377844 | 0 | bounds separated |
| 2 | whale-0 | -0.642710 | 17 | 0 / 17 overlap samples |
| 2 | whale-1 | 0.218744 | 0 | bounds separated |
| 2 | escort-whale | 8.015221 | 0 | bounds separated |
| 2 | original-longship | 7.244562 | 0 | bounds separated |
| 2 | original-dock-ship | 13.460669 | 0 | bounds separated |
| 2 | repair-barge | 25.625904 | 0 | bounds separated |
| 2 | feeding-child | -0.805531 | 56 | 0 / 56 overlap samples |
| 3 | whale-0 | 4.382047 | 0 | bounds separated |
| 3 | whale-1 | 5.720634 | 0 | bounds separated |
| 3 | escort-whale | 8.275596 | 0 | bounds separated |
| 3 | original-longship | 7.572120 | 0 | bounds separated |
| 3 | original-dock-ship | 10.282281 | 0 | bounds separated |
| 3 | repair-barge | 22.515168 | 0 | bounds separated |
| 3 | feeding-child | 4.892729 | 0 | bounds separated |
| 4 | whale-0 | -0.415466 | 16 | 0 / 16 overlap samples |
| 4 | whale-1 | 1.334960 | 0 | bounds separated |
| 4 | escort-whale | -0.195707 | 1 | 0 / 1 overlap samples |
| 4 | original-longship | -0.135565 | 7 | 0 / 7 overlap samples |
| 4 | original-dock-ship | 10.941646 | 0 | bounds separated |
| 4 | repair-barge | 21.356598 | 0 | bounds separated |
| 4 | feeding-child | 0.188468 | 0 | bounds separated |

Seven pairings produce conservative mesh-AABB overlap. Every corresponding overlap time was replayed through the real update and checked using transformed indexed geometry triangles: triangle AABB broad phase and full triangle separating axes including coplanar axes. All707 overlap samples have zero surface intersections.734 triangle pairs required full SAT; all others separate at actual triangle AABB level. Negative broad-phase gaps are not evidence of actual contact. Original dock ship coarse mesh bounds overlap flowerboat1 for all601 frames, but none of its actual triangle boxes intersect the flowerboat geometry.

The smallest strictly positive unrefined broad-phase pair is flowerboat0 versus original dock ship:0.154343 inner units =0.077172 world metres at the sampled nearest state. This is an axis-separation lower bound, not Euclidean exact clearance. Seven refined pairings have no certified positive global distance value in this report; absence of sampled triangle intersections must not be described as a guaranteed safety margin. No navigation edits are justified by the observed broad-phase false positives alone.

## Limits

Sampling is discrete at0.25s; it does not prove absence of between-sample contacts. Tests detect surface intersections, not arbitrary containment of one closed mesh inside another. CPU envelopes are geometry-based and do not model shader displacement/visual outline thickness. This is the actual original traffic, not the earlier failing optional far-boat proxy. No source was changed, no GPU check is available, and no visual acceptance is claimed.

Files: dynamic-traffic-cpu.json; test source tests/world/swampFlowerDynamicTraffic.inspect.mjs; copied test alongside this report.
