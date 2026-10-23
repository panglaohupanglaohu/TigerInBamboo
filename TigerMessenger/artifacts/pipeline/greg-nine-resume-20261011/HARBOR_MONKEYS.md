# Cliff quay and existing monkey repair — resume batch

Owned source: `src/world/swampHarborScene.js`, new `src/world/swampMonkeyRepair.js`. Original HarborScene saved under `source-before/harbor/`. No main/V2Art/actor factory changes, no commits or publication.

The former decorative ship finger is replaced with eight short quay segments following the nearest real cliff face at actual deck height. The water-side quay edge remains in the basin; closest audited outer edge gap is 0.12 inner units. The existing shore landing, original stern-quarter gangway, repair ship, original departure ship voyage, oars, escort whale and original two mast workers remain authoritative. The quay width is 4.2 inner units / 2.1 world metres. Its deck exposes `walkMeshes` and `gregWalkable=true`; player collision registration still requires the integration owner, so this record does not claim the new work route is already player-accessible. The existing two-metre rim route is unchanged.

The same three ordinary long-tail monkeys and three chili monkeys now join repair, alongside the existing two mast workers. Actor UUIDs, body geometry, colours, counts and original mast hoist cycle are preserved. Ordinary monkeys inspect, strike a fixed repair timber, carry a timber or pull a visible hand-attached rope. Chili monkeys cling above the quay and check/pull rigging. Tools and rope endpoints follow actual actor/arm transforms; cycles alternate inspect, work and check-result. Ordinary fruit dodge remains allowed. Ordinary branch-hopping resumes only after disposal; during this installed phase these same actors are assigned to the shore repair tasks.

CPU verification: `tests/world/swampMonkeyRepair.verify.mjs` builds the actual seed-7711 production factory and verifies 2 + 3 + 3 identities, existing actor UUIDs, 6 held-tool trajectories over five times, surviving original mast motion, positions outside the protected rim path, and all five flower navigation footprints over 120 simulated seconds against every quay segment. Passed. Raw record `harbor-monkeys-cpu.json`.

GPU acceptance still needed: inspect ordinary hanging-tail clearance around quay planks/wall; confirm mallet contact and carried timber scale from the formal camera; verify near-camera monkey pose readability and original departure/escort geometry across the full lake route. CPU navigation footprint clearance is not pixel or detailed hull collision proof. The existing HarborScene test is updated from the old finger assumption to the actual cliff quay and all 10 tests pass. Rendered low-position departure/escort vertices are sampled over the voyage and tested against quay segments; this is a detailed vertex-envelope check, not complete triangle collision proof.

## Camera clearance correction

The 31 existing giant foreground crowns are retained, raised 26 inner units above their original support points. Every crown remains connected to its original ground point by a new slender petiole; one batched petiole mesh is added. Original smaller rim understory is unchanged. CPU test verifies crown geometry starts above 65 inner units; clearing the actual camera view is verified by the integration owner. Root's formal GPU follow-up remains required.

The widened quay searches adjacent real cliff bays against the original repair ship low hull/oar vertices plus conservative full flower route envelopes. Final CPU measured minimum flower route gap is 2.359 inner units and minimum deck-edge cliff gap 0.12 inner units. Actual terrain ray intersections seat every supported pile, with 0.2 inner units embed. Chili repair actors now cling to the wall face sampled at their real height instead of hanging away from the cliff.

### Formal GPU feedback correction

Reviewed `overview-current.jpg`: the raised crowns clear more lake, but the 31 opaque dark-green connector stems read as bars at the left camera edge. Keep the same continuous root-to-crown connections and one batch, reduce connector radius .085 → .012 inner units, change to muted sage, opacity .35 with depthWrite false. No leaf identity/count/height change. Root performs the fresh GPU comparison.


## Follow-up: free flower craft rowing

Dedicated flower-craft underwater stems removed in the production factory; natural flora stems retained. Five boats and ten original children remain, each boat has two oars. Sole passengers now hold opposite-side oars. `swampFlowerActivities.js` drives motion with the exact cumulative submerged-power portion of the visible two-oar cycle (2.4 s, offset .08). Raised simultaneous recovery contributes no backwards displacement. Each raft rows a protected straight lane, rests 2 s, reverses its strokes, then rows back; continuous closed loop 32.8 s. Actual one-way formal distances are 1.0 / 0.7 / 0.7 / 1.5 / 1.5 m, not long lake crossings.

`flower-navigation-cpu.json` / `swampFlowerNavigation.verify.mjs`: formal seed7711, actual globe placement plus `departure=original` harbor. Five valid routes, identity and no-stem checks pass; 0.05 s frame continuity and power/recovery samples pass; actual cliff/root triangles versus cup/paddle envelopes every .5 s pass. Craft-pair minimum conservative gap 1.476 inner, cliff-quay gap 3.139 inner. Factory plus harbor build approximately 2.7 s on this CPU. Planning runs once; no route search per frame.

`flower-harbor-regression.txt`: 9/10 older checks pass. The optional `departure=proxy` far-shore decorative longboat has one conservative lotus capsule overlap, minimum -0.257 inner, with the new rowing craft. Formal main explicitly uses `departure=original`, where this proxy longboat is absent. Original longship and tiger barge were not changed to conceal the optional-mode failure. This remains an optional-proxy-mode gap.

New GPU review is pending because root reports the embedded-browser controller unavailable. Old screenshots are not evidence for the new flower navigation. No FPS improvement or GPU acceptance is claimed. Detailed implementation and limits: `FLOWER_NAVIGATION.md`. Recovery sources: `source-before/flower-navigation/`.


Coordinate-metric clarification: `r.travel` and the previous `range` are inner-local values. Formal placement has wrap scale 0.5 and inner local scale 1, yielding actual inner world scale 0.5. The verification now measures both lane endpoints after `inner.localToWorld()` rather than labeling local units as metres. Local one-way spans are 2.0 / 1.4 / 1.4 / 3.0 / 3.0 units; measured world one-way spans are 1.0 / 0.7 / 0.7 / 1.5 / 1.5 m. World amplitudes are 0.5 / 0.35 / 0.35 / 0.75 / 0.75 m. JSON now separates `travelLocal`, `travelWorld`, `oneWayLocal`, endpoint-measured `oneWayWorld`, `rangeLocal`, `rangeWorld` and `coordinateUnits`. Motion source is unchanged.
