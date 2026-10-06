import * as THREE from 'three';
// Approved 2026-09-28 layout. Move by an arc on the planet, not a flat
// translation: waterfront freeboard and the buildings' local up stay intact.
export const BAY_SEPARATION_METRES=34;
export function bayLayoutEnabled(){return new URLSearchParams(globalThis.location?.search||'').get('citadelBay')!=='0';}
export function bayRotation(frame,radius,weight=1){
 const up=new THREE.Vector3().setFromMatrixPosition(frame).normalize();
 const right=new THREE.Vector3(1,0,0).transformDirection(frame).addScaledVector(up,-new THREE.Vector3(1,0,0).transformDirection(frame).dot(up)).normalize();
 return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(up,right).normalize(),BAY_SEPARATION_METRES/radius*weight);
}
export function bayWeight(x,z=0){const oldCrown=Math.max(0,-z*.6);return THREE.MathUtils.smoothstep(x,-20+oldCrown,-8+oldCrown);}
