# Source epoch diagnosis — candidate not installed

The loaded ordinary page correctly rejected the old remesh artifact. The guard remains strict; refusal now includes `EAST_CLIFF_SOURCE_EPOCH_MISMATCH` and `{expected, measured}` in both the Error object and its message.

The shared CPU fixture invokes production `applyTargetTerrainCandidate`, but does not invoke the later `mountainStudy` `refineRockFaces` pass. That pass emits nonindexed geometry, subdivides selected faces, adds interior relief, and assigns corner normals. Thus the existing 34,612-vertex indexed source and its collision/support audit describe the **pre-refinement terrain epoch**, not the actual final rendered terrain. Preserve those results as earlier-stage evidence; do not install by suppressing the hash guard.

A separate `tools/pipeline/east_cliff_final_surface_fixture.mjs` now reproduces the terrain-first refinement selector with the same 1,000 samples per curve, radial cutoff, normal slope cutoff and rock surface options. It calls the original refinement/normal functions rather than substituting approximate geometry. It does not change shared fixtures or production. Its epoch must still match a fresh loaded page; transforms, current option values and active route may cause further differences.

Read-only diagnostics include raw-byte position/index hashes, index presence/type, position type, vertex/index/triangle counts, local and castle-chart bounds, source-to-castle matrix and refinement/normal reports. This distinguishes refinement, translation and index representation. Array-type mismatch alone is not treated as equivalent geometry.

Pending: compare actual loaded epoch with the reproduced final epoch, then regenerate a separate final-surface artifact and rerun support plus full dual-lane OBB/parity checks. Actual actors, upper structures, dynamic wave clearance and GPU acceptance remain unverified. No production terrain or route was changed by this diagnosis.

## Reproduction result

With current release options (normal pass 4, relief .22, radius160), final fixture produces position hash `2953688361`, no index, 331512 vertices / 110504 triangles. Refinement report: 2669 input faces subdivided, maxOffset .2197625671m. Raw epoch remains position772107960/index1617888706/34612 vertices. Both local bounds are [-143,-159.7925415,-72] to [143,42.9986839,107]. Actual page comparison is pending.

The separate `audit_east_cliff_remesh_final_surface.mjs` now consumes this final fixture. Its first regeneration **failed** the existing `overlapping top partition` guard. Relief-refined steep faces include upward-facing subfaces whose XZ projections are not a single top sheet; treating all such faces as heightfield tops is invalid. No final-surface geometry artifact was published. The next fix must use refinement source-face provenance or true 3D clipping, not disable the partition check or silently flatten the relief layer. Existing final support/vehicle claims remain pre-refinement only.

## Exact live frame resolved; final candidate remains diagnostic

Actual source is translated -52m in castle X, with raw positions stored in the opposite local frame. Re-running production applyTerrain in this frame, then production refine, reproduces **position2638422502 / index null / 331512 vertices** and maxOffset .2193362385370818 exactly. Simply translating an already rounded raw buffer does not reproduce this epoch and was rejected as an approach.

The new artifact `remesh-final-surface-geometry.json` preserves the previously checked raw remesh and then executes production refinement in the same -52m source frame. Its origin is now **[-52,0,0]**, not the old patch origin. `sourceHash` describes the actual old final geometry. `provenance.baseline` records raw→old-final; `provenance.rawCandidate` records the closed 81,440-face candidate; `provenance.finalCandidate` records the new 136,403-face rendered candidate. It is not an installed release.

Final actual-triangle audit: 2949 public support probes retained, maximum delta 2.659e-6m. Full red173/blue177 sampled OBBs have zero surface intersections. Blue has zero parity flags, red has two. Seven-direction diagnostics (`remesh-final-parity-directions.json`) show only +world-X odd parity (11 hits), with first hit 7.96m and 5.27m away respectively; all six other directions are even/empty. This points to far-away relief-fold/intersection or precision topology, not a near vehicle contact. It does **not** justify silently replacing the failed check by majority voting. The raw closed manifold guarantee does not automatically extend to the relief-rendered nonindexed surface.

Three exact-epoch/preview tests passed. The final artifact may be used for explicitly diagnostic GPU preview with strict actual hash checking, but is not yet reported as a fully passed collision release. Actual actors/upper structures and wave versus actual vehicle geometry remain outside this check.
