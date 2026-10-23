# Ivory Roman guardian rig — 2026-10-07

Factory: `src/world/citadel/plazaStatue.js`. Original high pedestal and actor root/name/scale retained. Figure remains `.63` within actor `1.2`; pedestal seating height remains 2.875. Source snapshot is under `source-before/`.

`root.userData.heroRig` exposes bodyRoot, joints, anchors.seat, anchors.spearTip, setPose, reset, detachTo(parent), restoreToPedestal(), getSpearTipWorld(target). `setPose('rest'|'mounted'|'raiseSpear', amount=1)` or `setPose({mounted:1,raiseSpear:1})` resets joint rotations then applies bounded fractions. The 13 pivots are bilateral hip/knee/foot and shoulder/elbow/hand plus head. Rigid meshes are merged per link, never across a joint or into the pedestal. Spear belongs to right hand.

`detachTo` preserves world pose. Controller must align the figure's seat anchor with the horse seat after detachment, preserving intended world size under parent scale; no automatic mount/IK/combat is claimed. `restoreToPedestal` restores original parent/transform and joint pose. `reset` only resets joint pose, not parent.

Face now has explicit cheek, jaw/chin, socket/eyelid, brow, nose/nostril and lip geometry instead of importing an untransformed unrelated mesh. Neck is broader/shorter and chest fuller, preserving creamy stone and Roman galea.

Validation: `tests/assets/plazaStatueRig.test.mjs` 3 passed: real downstream movement and spear rise with stationary pedestal; detachable body/world preservation/exact restoration; all joints own rigid meshes and 40 animation frames remain finite. Browser not used; actual material/face readability and horse mounting alignment still require real GPU/controller review.
