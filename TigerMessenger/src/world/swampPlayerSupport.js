import {createSwampGroundSampler} from './swampGround.js';
import * as THREE from 'three';
import {createSwampNetworkSampler,collectSwampWalkNetwork} from './swampEdgeGuard.js';

const samplers=new WeakMap();
const authoredSamplers=new WeakMap(),stairSamplers=new WeakMap();
const local=new THREE.Vector3();
function nearby(zone,position){zone.updateWorldMatrix(true,false);local.copy(position);zone.worldToLocal(local);return Math.hypot(local.x,local.z)<50&&local.y>-20&&local.y<120;}
// Never take the highest surface from far above the character: that returns an
// overhead terrace, then loses the actual lower tread when the height gate rejects it.
// The ray starts just above the feet and accepts only upward-facing support.
export function sampleSwampAuthoredGround(zone,position){
  if(!zone?.userData||!nearby(zone,position))return null;
  let sample=authoredSamplers.get(zone);
  if(!sample){sample=createSwampNetworkSampler(zone,()=>collectSwampWalkNetwork(zone));authoredSamplers.set(zone,sample);}
  const radius=sample(position,.35);if(!Number.isFinite(radius))return null;
  const height=position.length()-radius;
  return height>=-.35-1e-6&&height<=3.5?radius:null;
}
// The original entry treads take precedence over a legacy promenade/bridge.
// Dynamic access preserves later stair regrading and harbor connection additions.
export function sampleSwampStairGround(zone,position){
  if(!zone?.userData?.tigerWalkSurfaces?.length||!nearby(zone,position))return null;
  let sample=stairSamplers.get(zone);
  if(!sample){sample=createSwampNetworkSampler(zone,()=>zone.userData.tigerWalkSurfaces);stairSamplers.set(zone,sample);}
  const radius=sample(position,.35);if(!Number.isFinite(radius))return null;
  return position.length()-radius<=7.5?radius:null;
}
// V7's promenade overlaps the new rim in plan but is several world units lower.
// Prefer the rim only for feet already near/on/above it. A traveller beneath it
// keeps the original promenade, water or lower-bank support instead of snapping up.
export function sampleSwampRimGround(zone,position){
  const report=zone?.userData?.gregCoralRim;
  if(!report?.ok||!report.walkMeshes?.length)return null;
  let sample=samplers.get(report);
  if(!sample){sample=createSwampGroundSampler(zone,report.walkMeshes);samplers.set(report,sample);}
  const radius=sample(position);
  if(!Number.isFinite(radius))return null;
  const height=position.length()-radius;
  return height>=-.35&&height<=3.5?radius:null;
}
