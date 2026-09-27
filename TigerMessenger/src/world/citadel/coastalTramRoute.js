import * as THREE from 'three';
// Surveyed current castleContainer frame; affects only the existing holy-city leg.
// These controls are a candidate until full train/boat clearance is measured.
const FRAME = new THREE.Matrix4().fromArray([-0.5771265090244172, 0.12463062405961449, 0.807088718870361, 0, 0.6354855835814281, 0.689249750214348, 0.3479839865419536, 0, -0.5129162364767383, 0.7137240288626759, -0.4769852670498, 0, 124.43456408079132, 72.61606956254715, 90.15650671642375, 1]);
export function citadelCoastalFrame(){return FRAME;}
// Default since 2026-09-24; ?citadelCoastalTram=0 restores the legacy tunnel route.
export function citadelCoastalTramEnabled(){return new URLSearchParams(globalThis.location?.search || '').get('citadelCoastalTram')!=='0';}
// r10 (user-approved route, now default): bay crossing hugs footbridge A-B on its
// seaward side (~4.5 m centre offset, ~0.7 m deck gap) before turning along the old quay.
// r06: old-harbour leg crosses the basin east of the pier and passes south of the
// ravine wall; station/planter clearances widened.
// r04 (2026-09-24, user direction): no sea wall in front of the cities. The line
// hugs the plaza's south wall at plaza level (new-city station), climbs the
// plaza's west rim, crosses the inner bay parallel to footbridge A-B (~10 m west),
// then runs along the old-town quay wall (old-town station) and round the old
// harbour to the western global line. Ocean patrol ships already clip through
// the city on their great-circle route, so the old 16 m mast arch is dropped.
export const COASTAL_TRAM_CONTROLS = Object.freeze([[114,79,6],[98,74,5.2],[88,64,4.7],[78.5,51,5],[62,43.5,5.3],[40,43,4.1],[22,45,2.9],[12,47.6,1.9],[3.5,46.6,2.1],[-3.2,47,2.1],[-11,44,2.1],[-19,40,2.1],[-32,41,2.2],[-45,45,2.7],[-48,51,3.5],[-49.5,63,4.5],[-57,76,5.7],[-72,83,7.2],[-94,80,8.6],[-112,75,9],[-128,72,9.5],[-150,55,9.5],[-170,5,10.5],[-180,-60,11],[-150,-130,8],[-80,-180,4]]);
// r20: west half lowered (portal 1.8 m) so the lining stays under footbridge-B promenade;
// tunnel east portal trimmed to the measured cliff face (x≈58).
// r13 (2026-09-24, user): tunnel through the new-city massif so no track stands in front
// of the new city; exits south of footbridge B, passes under its deck, low old-town quay.
// Measured cover (r22): >=4.3 m above the rail only between x≈5 and x≈59.
const TUNNEL = {minX: 5, maxX: 62, minZ: 30, maxZ: 56, minY: -45};
const _tinv = new THREE.Matrix4();
export function inCitadelTramTunnel(worldPoint) {
  _tinv.copy(FRAME).invert();
  const l = worldPoint.clone().applyMatrix4(_tinv);
  return l.y > TUNNEL.minY && l.x > TUNNEL.minX && l.x < TUNNEL.maxX && l.z > TUNNEL.minZ && l.z < TUNNEL.maxZ;
}
export function citadelCoastalTramPoints(radius) {
  const points = COASTAL_TRAM_CONTROLS.map(([x,z,h=10.5])=>new THREE.Vector3(x,0,z).applyMatrix4(FRAME).normalize().multiplyScalar(radius+h));
  // Keep the long ocean approach on a gradual spherical grade. A single
  // Cartesian spline span cuts through the sphere and creates a steep ramp.
  const lat=-2*Math.PI/180, lon=130*Math.PI/180;
  const start=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
  const end=points[0].clone().normalize();
  const angle=start.angleTo(end), axis=new THREE.Vector3().crossVectors(start,end).normalize();
  const approach=[.2,.4,.6,.8].map(t=>start.clone().applyAxisAngle(axis,angle*t).multiplyScalar(radius+.3+10.2*t));
  return [...approach,...points];
}
