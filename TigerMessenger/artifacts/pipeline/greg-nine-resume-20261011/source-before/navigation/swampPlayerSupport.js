import {createSwampGroundSampler} from './swampGround.js';

const samplers=new WeakMap();
const authoredSamplers=new WeakMap();
// Terraces and entrance stairs sit above the older V7 shore shell. Prefer
// their actual radial surface while feet are near it, without lifting someone
// already walking below an overhang onto the upper path.
export function sampleSwampAuthoredGround(zone,position){
  if(!zone?.userData?.gregSpatialPlan)return null;
  const report=zone.userData.gregSpatialPlan;
  let sample=authoredSamplers.get(report);
  if(!sample){
    const meshes=[...(report.walkMeshes||[]),...(zone.userData.tigerWalkSurfaces||[]),...(zone.userData.gregShoreDock?.walkMeshes||[])];
    sample=createSwampGroundSampler(zone,meshes);authoredSamplers.set(report,sample);
  }
  const radius=sample(position);if(!Number.isFinite(radius))return null;
  const height=position.length()-radius;
  return height>=-.35&&height<=3.5?radius:null;
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
