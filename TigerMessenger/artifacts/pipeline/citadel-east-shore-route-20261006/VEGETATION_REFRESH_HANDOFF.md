# Default-off canopy refresh candidate

New module: `src/world/citadel/targetEastCliffVegetationRefresh.js`. No production integration, no original vegetation/core terrain changes.

```js
const handle = createEastCliffVegetationRefresh({
 enabled: true, castle,
 surfaces: [candidateFinalMesh], previousSurfaces: [originalFinalMesh],
 protectedMeshes: actualPublicAndActorReserveMeshes,
 railCurves: [candidateRed, candidateBlue],
 sampleSea: (x,z) => actualCastleLocalSeaHeightOrNull,
 maxDistance: 24,
 plantingBounds: {x:[25,135],z:[-65,105]}
});
// Inspect report; if any failure/unsupported type exists, apply() returns false.
// No move occurs before apply(). dispose() restores the exact original matrices.
```

Production contract: canopy factory uses four crown buckets and one trunk InstancedMesh. Matching is by complete world instance-matrix signature, not array index. Both parts retain UUID, materials, geometry, count, color and orientation. Only paired placement matrices change. Already hidden zero-scale instances are not resurrected. A seven-point old/new actual surface comparison preserves unaffected trees without reclassifying the entire original forest.

Changed roots search nearby first, within an explicit new-shore area. Final downward triangle sampling gives slope against castle +Y; only slope>=.72, actual sea+1.6m sites qualify. Six real trunk-base vertex points must all lie between 0.30m embedded and 0.002m above actual support; the root is lowered conservatively to seat every foot. Full crown/trunk envelopes avoid actual public instance triangles, candidate rail samples plus clearance, and all other tree envelopes. All-or-nothing application rejects unresolved trees. No tree is hidden to fake repair.

The surface index is newly built from final meshes. Apply checks surface geometry/matrix epochs, protected geometry/world matrices/visibility/instance count and arrays, and every canopy instance including unmoved trees. A moved actor or changed scene invalidates a held survey. Rollback restores exact saved placement matrices; it does not dispose shared resources.

## CPU evidence and limits

Five tests: paired relocation/support/resource identity and rollback; missing actual sea refusal; default off; stale surface refusal; moving protection refusal.

`survey_east_cliff_vegetation_refresh.mjs` rebuilds the production canopy factory on the exact hash-matched old final mesh, then surveys the refined candidate. It is **not the saved live forest**, because runtime visibility clearances/appearance edits and original actors are absent. The 24m survey has 402 trees: 383 unchanged, 8 legal proposed moves, 11 failed. No apply was called. The saved JSON lists per-tree positions, displacement, six foot gaps and rejected-constraint categories; counts are not claims that there is no possible planting arrangement.

Other visible grass/turf/shrub/companion systems are inventoried as unsupported, and prevent `ready`. Their rebuilding is not silently claimed by this crown/trunk-only module. The caller must supply actual public/actor mesh reserve geometry and handle those systems in a separate verified refresh before full installation. Existing canopyStudy placement metadata is not rewritten; this handle owns a separate candidate report so original rollback data stays intact.

No geometry, route, actor or mountain edits were made. Live GPU transplantation remains untested; root should first export an actual scene survey and examine failures.

## Revised final candidate — joint assignment and actual turf crop

The earlier all-or-nothing failure above is superseded by `vegetation-refresh-fixture-survey.json` from the revised solver. This is still CPU fixture evidence, not live scene acceptance.

- 402 active trees before and after: 383 original placements retained; all 19 affected pairs found a simultaneous legal placement. No retirements were needed in this fixture.
- The original-size-priority phase exhausted its bounded search. Compact fallback solved at total 8,114 search nodes. The 19 relocated trees are each uniformly scaled to .8 of their original size, oriented to the sampled top normal, and moved 5–24m within the specified new-shore area. This is a candidate visual change requiring GPU review, not an invisible metadata repair.
- Original positions of all 19 movable trees are excluded from fixed obstacles. 383 unchanged trees remain fixed. Domains include dispersed sites, original/.9/.8 scales, actual six-foot support, actual public instance triangles plus solid containment, rail clearance, and crown/trunk oriented-box SAT. Dynamic smallest-remaining-domain backtracking jointly checks all selected tree pairs.
- CPU apply succeeded; all 114 relocated trunk-base points passed against actual replacement triangles after Float32 instance upload. Full matrix/color/count rollback matched originals exactly.
- Of 56,529 old turf triangles, 54,731 retain all existing vertex/attribute data. Exactly 1,798 with failed actual final-surface support are removed from a staged replacement overlay geometry. Unchanged turf is no longer rejected merely by name. Mesh/material identity is retained and original geometry restored on rollback. New cliff-top green-edge continuity has not been visually verified; this crop is not a claim of complete revegetation.
- Seven unit tests pass, including actual paired retirement compaction, matrix/color/index remapping and rollback. Retirement is available when authorized and no bounded joint placement is found; it reduces actual crown/trunk counts instead of hiding floating instances. Existing zero-scale cleared instances remain cleared.

### Current options and lifecycle

Use `previousSurfaces:[originalFinalMesh]`, `maxDistance:24`, `spacing:1` for the tested survey. `minimumScale:.8`, `repairUnsupportedTurf:true`, `retireUnplaced:true` are candidate defaults; the entire module remains `enabled:false` by default. The handle exposes `instanceBackups` with full matrices/colors/count, and `report.instanceRemap` maps every old instance index to its new index or null for retirement.

`report.metadataRefreshRequired` explicitly lists canopyStudy placement records, external instance references and scene surface/cache publication. These are not automatically updated by the standalone helper. Main/runtime integration remains owner-controlled. `report.accepted` stays false even when `ready` and the CPU transaction succeed.

## Metadata transaction (after live survey, 2026-10-06)

Source consumer check: `mountainCanopyCandidate.js` publishes `group.userData.canopyStudy`; `mountainStudy.js` stores that same report at `castle.userData.mountainStudy.canopy`. No other runtime source directly reads `canopyStudy.placements`. `targetForestCompanions.js`, forest clearance and plaza clearance inspect actual matrices/instance indices; companion report anchors retain crown bucket name/index and must be remapped or rebuilt separately.

The helper now publishes a new report only during successful apply. Original authored placement IDs survive matching against the actual trunk slot/world root. Each active placement binds actual post-compaction crown/trunk indices, uploaded local matrix, world matrix/root, size/scale, final sampled surface/face, six-foot support fields and current geometry epochs. `instances` and per-mesh `eastCliffPlacementBindings` are explicit candidate records, not claims that existing navigation reads them.

Retired placements move to `retiredPlacements` with their IDs/reason. Existing zero-scale cleared slots stay in `placements` with status `hidden-zero-scale` and active=false; factory variant ordering is used to bind their crown slot only when counts and the zero matrix agree. They are not restored to view. `accepted` now counts active roots; `slotCount` and `hiddenSlotCount` make that distinct from allocated instance slots.

Apply replaces the forest report and the known mountainStudy alias together. Rollback restores both **original object references**, original placement array/data, per-mesh binding property state, complete instance buffers/colors/counts and turf geometry. A report reference or content change between survey/apply rejects the transaction. Nine tests cover these contracts, including retire+hidden+retained slot remapping and exact report-reference rollback.

Remaining owner work: actual mountainStudy surface sampling/index publication, player/navigation collision caches, cloud final-surface/swept-clearance fields and forest companion anchor indices. These are not silently changed here. Parent’s live survey has 297 active trees (not fixture402): 278 remain,16 move,3 retire. This metadata change does not replace that live evidence with the fixture distribution, and requires one refreshed live survey before apply.
