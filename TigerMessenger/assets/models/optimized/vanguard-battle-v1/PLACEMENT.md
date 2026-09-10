# Vanguard battle candidate v1

Source-derived single actor, not the 27-soldier layout. Original source files and battle values remain unchanged. This is an authored model/motion candidate; gameplay integration is separate.

## Coordinate and identity contract

Three/glTF coordinates: +Z forward, +Y up, +X the character’s left. Original root scale is 1. Retain each world actor’s existing placement, spherical orientation, scale and identity; never bake squad/world transforms into this asset.

All 84 original `three_node_id` nodes retain their original parents. 33 additions use `vanguard_added_id`; their exact parents are in the assembly. `n39` gun remains under `n27` left arm; `n59` blade remains under `n47` right arm. The candidate compensates weapon matrices against those parents so the shoulder gun is carried by its frame while the hand can release to a rope.

Factory refs: fig n1, torso n2, head n17, armL n27, armR n47, legL n64, legR n74, gun n39, blade n59. Left/right hands are n34/n54, gun grip geometry n44, sword hilt n60. Existing hidden outline nodes remain tagged empties in GLB; their original geometry is retained in meshes via `candidateHidden` + `archivedHiddenMeshIndex`. Do not restore these archived outlines as visible shells.

## Motion

The GLB is static idle frame 1, with no animation clips. The Blender file stores all 161 frames at 30 fps with LINEAR transform keys. `poseFrames[].transforms` gives column-major local matrices in Three/glTF coordinates for every original and added node. These are authored motions, not a claim that the original combat animator can drive the changed child geometry unchanged. Apply each complete pose, or adapt an equivalent articulated controller; do not combine the old rigid arm rotation on top of these matrices.

Semantic key frames: idle 1, aim 31, windup 46, slash 61, idle 76, stagger 101, rope 131, idle 161. Use `keyPhases`, since a boundary pose’s `name` may retain its preceding interpolation interval label. Frame 31 gun direction is exactly [0,0,1]. Cannon muzzle: n39 local [0,0,.47]. Sword grip: n59 origin. Gun grip: n39 [0,-.11,-.12]. Exact hand/rope anchors are listed in the assembly.

The left hand releases the cannon during the rope interval; `leftHandRole` distinguishes gun grip, transition and rope. The world supplies the rope at `add:rope-grip`; no rope mesh or world rope contact is baked. The right hand remains on the blade throughout.

## Materials and UV

All 17 original material base colors are verified in exported GLB factors. Fresh import verifies RGB and Alpha for the 11 visible material instances; the other six archived outline materials have no visible mesh instance. The source shader’s color factors are explicitly restored in glTF. Original red thigh stripes n67/n77 are non-emissive source m8, not sword glow. Source UV layers survive armor bevel operations; new untextured gloves and added meshes use per-face planar UV. No texture assets were fabricated.

## Verified scope and limits

The saved Blender timeline matches all 161 portable poses (maximum component error below 4e-7). Right grip anchor error is zero, left gun-grip error below 3e-7. Continuous actual triangle checks also find no left/right forearm armor intersections with their hands or weapon grips. Continuous actual triangle checks find no cannon barrel/receiver/grip intersections with tested shoulder, upper arm, helmet, crown, visor, face and chest geometry. In aim, all cannon geometry lies at X >= .199 while the full head lies at X <= .12, giving guaranteed lateral clearance .079. Review 3q camera projection can overlap the muzzle and visor; front/top evidence resolves the separation.

This does not certify every pair of body surfaces, world rope geometry, projectile behavior, spherical combat motion, damage or gameplay. The world integration keeps the previous model available and preserves original combat values.
