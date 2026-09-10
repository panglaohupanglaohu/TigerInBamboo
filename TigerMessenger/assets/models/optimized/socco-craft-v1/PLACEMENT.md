# SOCCO craft v1 — original derived functional candidate

Keep the existing world actor root position, spherical tangent orientation, scale, serial and damage identity. GLB uses +Z forward, +Y up. Do not bake scene/world offsets into this asset. The exported file retains archive rest; set the n87 ramp before first visible frame.

127 original three_node_id values, every parent, all 14 seat anchors and both rope anchors survive. Source-local matrices differ by at most 3.72e-7 in actual GLB. Four added detail batches keep their original-root or ramp parent. The original GLB/snapshot/Blender archive is unchanged; this is a separate reversible candidate.

## Visible geometry changes

The original coral main shell and cream belly now have an actual open cargo volume. Original side silhouette, rounded bow, canopy, color identity and black edge decoration remain. The former central fixed skid becomes two side hinge mounts, leaving a usable rear doorway. The ramp is a tapered slab with original transverse treads and kerbs, plus underside braces visible when closed. Original lower propulsion geometry is compacted under the floor to clear the ramp; its source nodes and transforms remain unchanged. The exact geometry node list and repack factors are in boarding-contract.json. 1,858 to 2,970 visible triangles; no crew is baked into the craft GLB.

## Seats and passengers

Preserve all 14 factory seats n109–n122. Current battle occupancy is seven per SOCCO (3×7 + 3 GatePod×2 =27). Tested active factory indices are 0,1,2,4,5,8,9. The original rounded bow prevents treating the frontmost anchors as evidence of 14-body physical capacity.

For the new vanguard-battle-v1 GLB, use its static idle pose without applying the old rigid-arm animator, and disable blade light meshes n62/n63 during transport. Keep scale 1. Under each existing seat (which already faces rear), passenger root local X offset is -.12 for left seats and +.09 for right seats. This yields craft-local X lanes -.40 and +.43. The original archived trooper uses a separate stowed-arm fixture and unmodified ±.52 lanes. Geometry checks identify the precise crew GLB hash; passing with old troopers is not used as proof that new ones fit.

Exit rear rows first in their own lanes, clearing the ramp foot before spreading to formation. The boarding paths are verification fixtures, not world navigation paths. Character feet must sample support geometry continuously; root interpolation alone does not provide a walk cycle or foot IK.

## Ramp and landing

n87 remains the original hinge at (0,-1.4,-2.62); its ramp points local -Z and is 2.9 units long. Closed X rotation is +π/2. The original factory's angle zero was flat, and -1.36 made the deployed ramp too steep. New deployment solves the bottom tip against sampled terrain using the formula in boarding-contract.json. The fixed -1.99 ground in review is only a fixture. In the world, raycast actual land in the craft frame and refine the endpoint. Reposition or delay landing when unreachable, steeper than 25°, or over water; do not let the foot penetrate sea or terrain. Preserve the source hinge parent and other rotations. In Blender reimports set rotation_mode=XYZ before assigning Euler values.

## Materials, visibility and scope

Source material RGB/Alpha factors are portable Principled values, checked in the actual exported GLB. The canopy retains alpha .45. Honor candidate_hidden_outline and source_visible metadata; archived outline empties must not be restored as white shells. Original spray n86 remains exported with its metadata; it is hidden only in studio evidence. Runtime owns its VFX visibility.

The before/after images share camera and lighting. GLB screenshots are fresh reimports. Validation covers real geometry, original-node binding and a kinematic loading fixture. Full world terrain/nav, continuous walking animation, combat and 14 simultaneous passengers are not certified by these files. Original world integration is a separate reversible adapter.

The new-crew fixture checks 231 full-body surface samples and 14,784 sampled boot support points: zero wall/passenger intersections and zero sole penetration, with a 0.001-unit contact skin. The maximum unsupported opposite boot-corner gap is 0.154 units at step/threshold transitions. This static-boot fixture therefore still needs per-foot IK or a walking gait in the world; it is not a claim that every sole stays flush. The 31 tested ground heights produce maximum ramp-tip contact error 3.21e-7.

The archived old-trooper regression is retained transparently: full-boot checks found 7 threshold contacts after its earlier upper-body-only pass. Release boarding evidence is for the new vanguard-battle-v1 crew, not the old fixture. Do not use the archived-trooper demo as a zero-collision claim.
