# Inner-bay transit structure v1

CPU-only implementation; no visual score or GPU acceptance is claimed.

## Integration

`createTargetCityDetailCandidate({castle, cliffTransitRelease, ...})` consumes the exact release produced by `createTargetCliffTransitRelease`. Absent this option, the existing default bridge/foreground candidate remains unchanged. With it, the old candidate bay bridge is not constructed, the static foreground rail is suppressed, and the new structure is added under the candidate root. No rails or vehicles are created by this module.

Refresh candidate import as `targetCityDetailCandidate.js?revision=cliff-transit-v1`. It imports `targetCliffTransitStructure.js?revision=1`. Candidate report revision is `target-city-detail-candidate-3-cliff-transit`; factory version is `target-cliff-transit-structure-1`.

The main runtime/tram owner must provide the same release used for terrain cuts and global curve splicing. This candidate does not cut or change terrain. Optional `cliffTransitStructureOptions` controls geometry settings; current default loaded-freight envelope is half-width 1.75 m, half-length 3.49 m, rail-relative top 5.36 m plus 0.35 m top margin. Upper walk offset is 6.9 m. These cover the reported folded transport robot cargo; aiming/unfolded weapons are outside that measured state.

## Real generated geometry

The three center curves remain exact borrowed release curves: new shore 154.82 m, central bridge 56.68 m, old shore 78.47 m. There are 9 / 3 / 5 real sea-facing openings respectively, with lower rail support arches, lateral pillars, transverse bearings and an upper guarded walkway. The old upper bridge is replaced together with its obstructing piers, rather than left above a separate railway elsewhere.

Back to the city, the old connection is 42.79 m with 31 nonzero rises, maximum 0.15 m. The new 42.27 m connection is almost level after the loaded-freight roof increase: one 0.075 m rise and a supported stone walk, not a falsely labelled long staircase. Both retain 2.4 m clear width, actual sampled foundations, paired open arches, side stringers and explicit walkable top meshes. Junction rails are cut at the new link footprints; the new city dock remains connected to surveyed tread 14. End aprons are actual geometry, not a report-only endpoint change.

Rail foundation/underbody samples combine the final mountain mesh and visible `planet-surface` displaced sphere triangles. Town placement continues to sample only the target mountain. No analytical seabed was invented. The generated structure currently has 140 meshes and 51,010 triangles.

## Waterfall

The joint old-shore survey requires both lane centerlines to cross the curtain band, then checks full vehicle OBBs and actual outlet stone triangles. It does not borrow a central or returning global branch to claim a waterfall tunnel.

For the actual CPU release fixture, the default terrain-dependent mouth `[-34.8475,14.33,33.3952]`, yaw 45°, is replaced by `[-38.5,16.1,37.5788]`, yaw 30°. The real outlet reach is 16.037 m; the existing water-supply connection is 25.929 m, descending from the original 17.3 m feed. Raising only this outlet avoids the new upper walker's head hitting its trough; the old city platform stays fixed. The finite loaded-vehicle-to-sill headroom is 3.774 m.

## Evidence and limits

`loaded-cpu-production-curves.json` records the final factory report: 776 actual red/blue poses, no tested structure/city triangle collisions; gallery foundations, underbody terrain and public deck sample checks pass. The final fixture first runs actual `createChristchurchTramSourceCurves` and `prepareCitadelRailStartup`, then supplies those full final global curves together with the released cliff cut to `applyTargetTerrainCandidate`. It also runs actual `createPlanet` and compiled official ocean geometry. Final dedicated tests: 7/7; 45 distinct related tests passed across the combined and final reruns. Earlier JSON files preserve prior stages and are not substituted for this final terrain input.

The existing player provider passes both directions along both city connections at <=0.1 m steps and center offsets -0.4/0/+0.4 m, plus dock-to-tread14 and gallery floor queries. Tests also reject the former 5.2 m empty-wagon ceiling for loaded cargo, retain missing-foundation failures, prove disposal and late-construction rollback, and preserve caller-owned terrain/curves.

This is finite static evidence, not full continuous sweeps, moving-ship clearance, engineering load certification, fresh WFC scene re-audits, or visual/GPU acceptance. The original/empty-wagon stages remain in this batch. Main/tram installation, the actual ship audit, and same-camera visual assessment belong to the integration owner.
