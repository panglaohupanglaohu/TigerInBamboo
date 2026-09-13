// Shared author-space layout, tied to the frozen R09 terrain proposal.
// Reservations are design inputs, not proof that a vessel can navigate them.
export const CITADEL_HARBOR_WATER_PLAN = Object.freeze({
 version:'citadel-water-r01',terrainRevision:'r09',frame:'highland-west-city',
 status:'candidate; depth and vessel clearance under verification',
 gate:[54,107],quay:{xMin:43,xMax:67,z:108,freeboard:.9},
 basin:{xMin:24,xMax:76,zMin:111,zMax:152},
 approach:[[30,142],[44,134],[54,119]],
 turning:{center:[48,130],radius:9},
 holdingBerth:{center:[54,114.5],heading:[-1,0],status:'holding pose; boarding connector still required'},
 minimumDepth:1.25,turnClearanceRadius:7,
 designDepth:4.6,bedTargetDepth:5.5,
 waterAuthority:'planet-v8-curved-ocean; no secondary local water plane',
});
