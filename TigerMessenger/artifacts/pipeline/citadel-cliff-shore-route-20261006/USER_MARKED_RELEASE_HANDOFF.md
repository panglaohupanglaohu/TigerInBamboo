# Alternative user-marked release

`createTargetUserMarkedTransitRelease({sourceCurves,sampleTerrain,sampleSea,platforms})` in `src/world/citadel/targetUserMarkedTransitRelease.js` returns world `curves`, startup-compatible `specs`, `segments`, `ranges`, `castleMatrix`, explicit `coastalCliffCuts`, and an independent short `walkingConnection.pathXZ`. It does not install or overwrite the old release. The production three source curves are required. Terrain and sea callbacks use castle-chart X/Z and return chart Y, not world radius.

Short bridge remains independent: the structure worker must measure actual public tread endpoints and solve its height, including the reported new-city dock correction. No automatic stacked central bridge is requested.

Three-line radius minima 25.986 / 27.016 / 27.478 m and slopes 2.210 / 2.289 / 2.206% pass finite shape sampling. Source start intervals are inherited exact low-grade east entries; west ends red .798 / blue .800 / center .799. Searching source .60–.70 for the painted east endpoint [131,92] finds nearest red distance 26.69 m at .648, but slope is 4.49%; changing to that endpoint would reduce fidelity error very little and violate the 4% limit. The low-grade entry is retained and its mismatch disclosed. Maximum inner marked-route discrepancy remains roughly 15.5 m; this is not an exact drawing match.

## Joint terrain / loaded body check

`tools/pipeline/audit_target_user_marked_scene.mjs` rebuilds current target terrain with retreat and global-rail cut, then applies this release's explicit landward-edge-to-sea cliff polygons and generates the closed 1.7 m mesh. It checks that mesh, reconstructed original bridge solids and the production planet sphere against loaded oriented vehicle boxes (local half width 2.32, half length 3.49, bottom -.6, top 5.71 m), at approximately 1 m stations. It also checks nine underbody points against actual triangle surface hits.

Results in `user-marked-scene-audit.json`: 1064 poses, zero triangle/OBB contacts and zero tested underbody soil intrusions. 8333 samples across full three platform ellipses remain exactly unchanged. Cut queries blocked by the explicit full-platform guard are counted, not suppressed. Missing underbody rays outside this target mesh remain unverified; they are not world clearance. The largest cut drop includes the inherited old-global sphere-side toe cut and is not a claim that a 151 m main peak was removed.

`user-marked-engineering-layout.png` was actually inspected. It is a CPU chart/camera projection, not GPU proof of occlusion. New gallery/short bridge/waterfall geometry must be separately tested with this release by the structure worker; old-inner results must not be reused. Continuous train sweep, live all-world geometry, boat hull/draft, and visual acceptance remain pending. Release report remains accepted/installed false.

Four tests pass: SVG calibration, separate walking-route contract, actual-source endpoints/three-lane finite shape, explicit bounded cut polygons and platform guards.
