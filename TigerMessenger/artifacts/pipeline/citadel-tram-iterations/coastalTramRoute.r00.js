import * as THREE from 'three';
// Surveyed current castleContainer frame; affects only the existing holy-city leg.
// These controls are a candidate until full train/boat clearance is measured.
const FRAME = new THREE.Matrix4().fromArray([-0.5771265090244172, 0.12463062405961449, 0.807088718870361, 0, 0.6354855835814281, 0.689249750214348, 0.3479839865419536, 0, -0.5129162364767383, 0.7137240288626759, -0.4769852670498, 0, 124.43456408079132, 72.61606956254715, 90.15650671642375, 1]);
export const COASTAL_TRAM_CONTROLS = Object.freeze([[100,105],[65,128],[25,130],[-15,113],[-50,90],[-85,90,13],[-125,75,16],[-160,45,16],[-170,5,14],[-180,-60,11],[-150,-130,8],[-80,-180,4]]);
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
