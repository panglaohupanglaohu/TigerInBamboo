# Original warship candidate — integration contract

**BLOCKED CANDIDATE. Do not replace live battle ships yet.** Adjacent original oar blades intersect in 36/301 saved frames, with exactly the same frames and pairs in the read-only source. This is explicitly unresolved. Next: rowing synchronization/clearance, then 25-person scheduling and fleet instancing.

This is the original `createFisherBoat` model, not a replacement generic longboat. Source archives are read-only. Retain the existing ship root transform, route, combat values, water placement, rower sedation state, wake and night-light ownership.

## Identity and axes

Three coordinates: +X bow, +Y up, Z across hull. The original bow eyes and bronze ram remain at +X. Preserve all 340 original `three_node_id` nodes and parent links. There are exactly 26 oars (13 per side) and 26 rowers. The 286 original crew instances carry `three_instance_owner`, `three_instance_index` and `three_instance_key` (`n220:i0`, etc.). They remain children of their original InstancedMesh owner nodes n220..n230. The 25 landing soldiers are independent gameplay actors and are not included in the ship GLB.

Every addition is identified by `warship_added_id`. Use IDs, not Blender object names. `candidateHidden` source outline nodes remain present; their original GLB mesh is retained at `archivedHiddenMeshIndex`, but the node has no visible mesh. Do not instantiate these archived outlines. Source n339 is a runtime-owned night light anchor; create/update the runtime light from the original night logic. Default emission of the two original night lantern meshes is zero, matching source `emissiveIntensity=0`.

## Static GLB versus saved actions

The GLB contains only static frame 1 and no animation clips. The Blender file stores every integer frame 1..301 at 60 fps, with LINEAR transform keys. The assembly contains matching column-major Three local matrices. `restTransforms` covers the whole asset; `poseFrames` contains changed nodes only. Matrices are relative to the exact declared parent, including crew instance owners.

Frames 1..121: captured original accelerating/rowing motion. Frames 122..181: original stop/deceleration input. Frames 182..211: authored boarding preparation. Frames 212..271: stopped boarding hold. Frames 272..301: stow. These are review actions, not an endlessly looping runtime animation.

The original source oar phase, side, index and base rotation survive. Candidate pivots are 0.20 higher; source crew hips shift X -0.10 and sit at Z ±0.16 while rowing. A per-row vertical correction keeps original lower leg geometry above actual deck Y=0.665. The 52 added hands follow real inner handle points [0,-0.15,0] and [0,-0.23,0] in each original oar pivot. Upper arms retain original source instance IDs; added forearms and hands use the original owner parent. Do not blindly replay old crew/oar matrices over candidate poses: that would detach the hands and restore collisions. Port the documented solver or apply matching candidate matrices. Preserve sedation and casualty ownership; this capture did not validate sedated/dead rower poses.

## Boarding preparation

Boarding is only enabled once the ship stops and preparation completes. Rowers shift outwards onto the outer seating area to Z ±0.35; inner seat leaves `add:seat-leaf-0`..`25` fold after that shift; their shortened front edge clears the retained animated legs. The retained sail and original red motifs furl vertically about Y=3.125 to 22% height. The original n325 fore-stay top remains [0.55,3.77,0]; its lower end moves from [2.18,0.64,0] to the opposite bow cleat [2.18,0.64,-0.40]. This clears the +Z transfer path. These changes reverse on stowing.

`add:boarding-hinge` is parented to n0 at [1.94,0.664,0.48]. Board width is 0.40, length 1.35 along local +Z. Stowed local X angle is -π/2. Review deployed angle is +0.12 radians. The +Z original rail terminates at X=1.70 to form a real gate.

`add:boarding-deck` and `add:boarding-foot` are local [0,0.024,0] and [0,0.024,1.35]; left/right lash anchors are also present. Ground-fit the whole board to actual dry land. For an angle a, the nominal foot anchor height is 0.664 + 0.024*cos(a) - 1.35*sin(a), in ship local coordinates; the visible board top is at local Y=0.019. The original ship transform, spherical local-up and terrain height must be applied before solving. No fixed sea-plane or shoreline is baked into the asset.

`boarding-path.json` supplies a bounded single blue-gladius actor review route and a narrow carry pose with actual shield/sword grip contact. Tested ship world scale is 1.7; actor parent scale is therefore 1/1.7 in ship-local coordinates, preserving the existing actor's world size. The review route uses full actual soldier geometry. It is not a 25-agent boarding scheduler, gait/foot IK, arbitrary-ramp-angle certification, or a completed gameplay integration. Apply ground support/foot IK rather than blindly using the review heights on other shores.

## Rendering budget

Final proof GLB: 961 tagged nodes, 754 visible mesh nodes, 50,040 visible instance triangles, 3,184,712 bytes. This is not a measured fleet performance result. The original 11 rower part groups were InstancedMesh buckets; use the retained owner/index mapping to restore runtime instancing or batch compatible meshes before deploying a fleet. No Godot import cache, runtime code or existing model was altered by the asset build.

The 26 rowers retain their original paper-cut faces and helmets. They are a separate source character family and are not the six newly refined Roman battle soldiers. The original 26 broad blade geometries remain present in the fresh GLB top view; a thin edge appears as a rod from the 3/4 view.
