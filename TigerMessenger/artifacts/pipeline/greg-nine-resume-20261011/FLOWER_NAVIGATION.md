# Free rowing flower craft — 2026-10-11

Production sources: `src/world/swampFlowerActivities.js` (navigation and sole-passenger opposite-side oar fix), `src/world/moebiusSwamp.js` (only dedicated flower-craft underwater stem creation removed). Other teams' source edits retained. Original recovery source is in `source-before/flower-navigation/`.

The four dedicated lake-floor-to-flower-craft stems are gone. Natural botanical stems and the central pink crystal/core remain. All five craft preserve their passenger roster (ten original children, including shore and whale feeder) and two real oars per craft. The surviving single passengers hold opposite-side oars.

Navigation is now stroke-driven, not an orbit added to decorative paddle animation. Both blades use the same 2.4-second cycle and 0.08-cycle offset as their actual meshes; submerged power strokes integrate nonnegative propulsion, while simultaneous raised recovery strokes integrate zero. At each lane end the raft rests two seconds, then children reverse their rowing stroke and return. The full 32.8-second voyage closes continuously. Free rafts need no underwater support or mooring anchor.

Routes are planned once from the actual cup/arm/oar envelopes against clipped real wall/root triangles. The original whale-orbit and longship departure corridor remain reserved, and craft lanes reserve one another conservatively. A broad spatial rejection before triangle/box tests keeps planning bounded; there is no per-frame route search.

## Actual formal CPU evidence

`tests/world/swampFlowerNavigation.verify.mjs` creates production seed 7711 (`loadMoebius.js:91`), places it on the actual globe orientation, and installs the original-ships harbor. All five lanes are valid, identities remain distinct, and no craft has a `flowerStem`. Positions are continuous at turns and wrapping. All five complete their rowing ranges in the 40-second sample; their one-way formal-world distances are 1.0, 0.7, 0.7, 1.5 and 1.5 metres. These are small protected-area rowing circuits, not long lake crossings.

Recorded factory plus harbor CPU build: 2655 ms. Actual-submerged power samples: 2503; simultaneous recovery samples with exactly zero reverse travel: 944. Real cliff/root triangle versus envelope checks run every 0.5 seconds; per-frame motion sampling is 0.05 seconds. Minimum conservative flower pair gap 1.476 inner; new cliff quay gap 3.139 inner. See `flower-navigation-cpu.json` for positions and real blade world-water heights.

## Validation boundary

New GPU screenshots/playback are **not available**: root reports current embedded-browser control unavailable. Earlier screenshots predate this change and are not evidence for the new rowing craft. The unchanged whale/longship orbit reservations are conservative CPU protections; the recently changed tiger-carrier encounter is not independently GPU-validated here.

The older optional `departure=proxy` far-shore decorative longboat regression has 9/10 checks passing; one conservative craft/longboat capsule clearance fails at -0.257 inner. Formal main uses `departure=original`, where that proxy boat is not instantiated. Neither original longship nor tiger barge was changed to conceal this optional-mode failure. See `flower-harbor-regression.txt`.

No commit, publication, new debug overlay or external sharing.


Coordinate-metric clarification: `r.travel` and the previous `range` are inner-local values. Formal placement has wrap scale 0.5 and inner local scale 1, yielding actual inner world scale 0.5. The verification now measures both lane endpoints after `inner.localToWorld()` rather than labeling local units as metres. Local one-way spans are 2.0 / 1.4 / 1.4 / 3.0 / 3.0 units; measured world one-way spans are 1.0 / 0.7 / 0.7 / 1.5 / 1.5 m. World amplitudes are 0.5 / 0.35 / 0.35 / 0.75 / 0.75 m. JSON now separates `travelLocal`, `travelWorld`, `oneWayLocal`, endpoint-measured `oneWayWorld`, `rangeLocal`, `rangeWorld` and `coordinateUnits`. Motion source is unchanged.
