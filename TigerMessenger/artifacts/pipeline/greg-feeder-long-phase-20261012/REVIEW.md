# Feeder longer phase combination CPU review

Read-only production source; no navigation or feeder edits. Reused0..150s detailed evidence from greg-feeder-clearance-20261012 instead of repeating it. Additional150..900s sampled every1second:751 samples for each of five current flowerboats against the same whale-feeding child. Actual production seed7711, original departure, true sphere placement/matrixWorld, inner world scale0.5. Full actual visible triangle geometry nearest distance with BVH AABB-distance pruning, vertex-triangle/edge-edge checks. Geometry update receives dt0.25 while absolute authored animation time advances1second per sample; examined feeder/boat/whale trajectories are functions of absolute time.

| Boat | Actual minimum sampled world distance | Time |
|---|---|---|
| 0 | 1.732857m | 292s |
| 1 | 5.407972m | 356s |
| 2 | 0.968939m | 423s |
| 3 | 4.185043m | 420s |
| 4 | 1.454395m | 554s |

All sampled distances exceed0.25m; no new low-clearance window was found, so no extra fine scan or source changes were made. Additional minimum0.968939m, combined with earlier0..150s detailed minimum0.875159m. Extended evidence covers about6.56 adult2.4-orbit surfacing cycles and27.4 flowerboat32.8s navigation cycles from0..900s. It still does not cover every possible continuous phase combination or prove perpetual safety. CPU distance pass runtime9.43s (not game frame rate).

Discrete1s new sampling does not certify between-sample clearance; previously near window86.55..86.60s at0.001s remains separately recorded. Closed mesh containment not tested; positive surface distance does not disprove containment. No shader/outline geometry and no GPU acceptance. Do not interpret this as continuous collision certification.

Source SHA256 swampFlowerActivities.js: 21a40dc33a0389a3a10b0f06d02a01992793f1fd89e7f21559a6c30b3558b5b5

Files: long-phase-cpu.json; copied swampFlowerSurfaceDistance.inspect.mjs. Formal test command: Node tests/world/swampFlowerSurfaceDistance.inspect.mjs --long-feeder.
