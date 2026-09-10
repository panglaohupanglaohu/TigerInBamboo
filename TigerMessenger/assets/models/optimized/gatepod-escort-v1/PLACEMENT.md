# GatePod Escort v1

Three source-derived variants: pod-55-2 (serial 2, root scale .62), pod-41-7 (serial 7, scale .55), pod-08-9 (serial 9, scale .58). Preserve each existing world actor, identity, flight slot, placement and spherical orientation. The source scale is already in GLB n0; when swapping under an existing transformed root, use one root scale, not both.

+Z is the nose and +Y is up. Original nodes and parents are retained: 79 / 81 / 81. The original `tranqMuzzle` node is n78 / n80 / n80, local [0,-1.35,2.5], unchanged. Keep original projectile and battle behavior. No troops or formation placements are baked.

Each candidate has 28 added nodes tagged `gatepod_added_id`, alongside original `three_node_id`. Hidden old outline mesh instances are replaced by tagged empty nodes while `candidateHidden` and `archivedHiddenMeshIndex` retain their geometry in GLB meshes. Do not re-enable these archived shells.

## Actual rope anchors

| Seat | Anchor | Parent winch | Actor-local point before root scale |
|---|---|---|---|
| 0 | add:rope-anchor-left | add:winch-left | [-.50,-1.66,-.15] |
| 1 | add:rope-anchor-right | add:winch-right | [.50,-1.66,-.15] |

Each winch parent is at [±.50,-1.27,-.15]; each anchor’s local point is [0,-.39,0]. The orange guide is hollow. The two mounts are forward of the original six thrusters. Convert the anchor’s actual global transform to a rope endpoint; do not shift the whole craft to compensate. Existing source logic used pod root center as rope start and has no old rope anchor ID.

The rope tops are .62 / .55 / .58 world units apart at source scale. The world must choose lower-end troop spacing using actual troop bounds, possibly splaying the ropes outward. Validation here checks vertical rope paths against the actor, not arbitrary angled paths or two troopers’ body clearance.

## Authored review motion

The static GLB is stowed frame 1 and contains no animation clips or full ropes/hooks. The Blender timeline stores 121 frames at 30 fps: stowed 1, deploying 31, lowered 61, recovering 91, stowed 121. Orange spools rotate on their local X shaft with deploy amount; the fixed guide and anchor stay in place. `poseFrames` contains complete column-major Three/glTF local matrices and the review rope length.

`REVIEW ONLY` ropes/hooks in Blender explicitly lack export tags and are excluded from GLB. They demonstrate deployment; the runtime continues to own real rope geometry and troops. Source root motion is unchanged, so original flight/bank animation remains independent.

## Source geometry and validation

The original spherical nose, ports, serial ticks, panels, canopy/pilot, thruster cluster and muzzle remain. Box corners have small bevels. Four original wing struts retain their IDs/parents and now end at the actual wing underside, with new end clamps. Their local matrices intentionally change; all original attachment APIs remain.

All 11 original material factors are checked in GLB. The importer instantiates eight visible source materials, whose RGB/Alpha are checked; three archived outline materials do not produce visible instances. Source UV layers remain; untextured new mechanical meshes receive explicit planar UV. Actual source Blender files are read-only.

Validation covers original parents, saved local matrices, fresh GLB static transforms/materials/UV/triangle counts, source root/muzzle, rope anchor positions, wing strut endpoints and vertical ray clearance. It does not certify all mechanical surface pairs, combat timing, troop harnesses or world collisions. Runtime integration remains a separate step.
