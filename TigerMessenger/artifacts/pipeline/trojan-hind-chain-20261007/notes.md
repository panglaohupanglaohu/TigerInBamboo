# Wooden horse hind chain correction — 2026-10-07

User screenshots show an exposed small axle and long thin rod hanging below the large haunch disk. The target has a full upper thigh that contains the stifle and leads directly to one bent hock and the hoof. This is a project observation from the three supplied images, not a claim about an external author's rig.

The actual `src/assets/citadelTrojanHorse.js` factory now uses `wood-rearing-trojan-4-concealed-hip`. Hip pivot moved inside the body; stifle lifted from y=2.85 to y=3.35 and tucked backward to z=-1.13. The exposed hip disks and rear gold bearing rings were removed. Continuous wooden haunch/thigh shells cover the upper link; a solid tapered shin meets one wooden hock and the pastern. The existing long cheeked head, wood texture, raised forelegs, chassis, belly opening and rider/rein anchors remain.

Canonical parent chain is hip → stifle → hock → hoof. `knee` remains a non-enumerable alias for `stifle`, preserving old pose callers without creating an additional node. Geometry stays batched per rigid link, and all descendants follow parent rotations. Locomotion is still explicitly unimplemented; this change does not claim a completed running animation.

Six asset tests passed, including existing hatch/rope/actor-scale and pose-reset tests. The new test samples ten combined poses and 240 rays against each adjacent rigid link's own geometry (without recursively borrowing the child's mesh) to verify timber remains joined. Bone lengths remain constant; opposite limb and belly hatch remain unchanged. Evidence: `cpu-joints.json`. Original factory snapshot: `source-before.js`.

No GPU or normal-scene visual acceptance was performed. Browser safety denial was not bypassed. Next verification is an actual side/rear view and a short pose sweep in the normal scene. The missing personal `threejs-game-director` skill path was checked; this work used the available Oskar skill constraints, actual source and supplied reference images instead.
