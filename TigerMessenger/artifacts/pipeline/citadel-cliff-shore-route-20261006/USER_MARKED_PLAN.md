# User-marked transit / first diagnostic

Read the actual attachment `codex-clipboard-cd9f5f89-6873-4d50-aa71-174fe4413598.png`. Original diagnostic SVG uses `(650+4*x,365+4*z)`; attachment is scaled/cropped, so manually inferred chart controls have approximately 2 m uncertainty.

The short orange line is an independent walking bridge: old edge [-31,11], [-28,20], [-20,27], [-8,31], [16,38], new edge [49,45]. Heights are not available from the drawing; `sampleWalkHeight` is mandatory to produce a 3D walk path, otherwise the returned path is null and all unmeasured XZs are listed. It must not reuse the purple old bridge by default.

The long line moves the central railway inland to approximately [-27,29] → [7,40] → [35,47], then turns around the plaza west/south edge. The old thin dark-red candidate is superseded in the drawing. The new module retains prior exact production splice endpoints only as a first diagnostic; the far-west marked extension remains separately unresolved. No existing release or global line changed.

Running against the actual authored terrain / retreat / cuts / stepped apron fixture gives first-fit minimum radii red 9.40 m, blue 7.51 m, center 9.53 m, failing the 25 m requirement. Grades are 1.73–1.79%, water probes 0. There are 883 terrain underbody conflict samples, including 258 platform-protected samples. These samples are not permission to remove city foundations. The curve is diagnostic only and must not be installed.

`user-marked-plan.json` includes world/local samples, exact source endpoints/tangents, Bezier serialization, protected conflicts, lane audits and the user-derived controls. Two calibration/contract tests pass; they are not a collision or geometry acceptance claim. Full loaded envelope, structures, walking support and GPU view remain to be tested after a feasible rounded layout is found.

## Rounded revision: ready to evaluate, not accepted
The factory default now uses the most promising rounded branch. Western source endpoints extend to red .798 / blue .800 / center .799. Per-node independent incoming/outgoing Bezier handles avoid copying marker kinks. Actual three-line radius minima: 25.986 / 27.016 / 27.478 m; maximum grades 2.210 / 2.289 / 2.206%. Red endpoint tangent errors .0252 / .0077 degrees. Terrain diagnostic: 525 underbody conflict samples remain; protected platform conflicts 0, wet samples 0, distant-from-shore samples 0. Status is `shape-candidate-needs-cliff-cut`; it does not install anything.

This fit does NOT meet a uniform few-metres tracing tolerance. Maximum central discrepancy is approximately 15.52 m around [22.88,60.31] versus the marker's protruding northwest-plaza corner. Maximum full discrepancy is 24.27 m at the retained production east connection [120.05,67.27], whereas the marker runs out near [131,92]. Root must judge these spatial differences, and may need a different east source splice. Do not silently substitute this candidate as a faithful image match.

`createTargetUserMarkedTransitPlan` returns `curves`, splice `specs`, `castleMatrix`, and independent `walkingConnection.pathXZ`. Consumers must measure short-walk heights and actual public entrances; no world-height inference from the drawing. Previous production release remains unchanged. `user-marked-plan.json` is the current default full report; early failed-fit values above are history.
