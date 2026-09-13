import {citadelRevision} from "./layoutRelease.js";
import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
import {CITADEL_HARBOR_WATER_PLAN as plan} from './harborWaterPlan.js';

// Lower the existing bed locally. No added water surface or hidden seabed copy.
export function applyCitadelHarborSeabed(scene,castle,radius=160){
 if(typeof location==='undefined'||citadelRevision('citadelWater')!=='2')return;
 const bed=scene.getObjectByName('planet-surface'),city=castle.getObjectByName('highland-west-city');
 if(!bed||!city)throw new Error('Harbor seabed requires the original planet and city');
 scene.updateMatrixWorld(true);
 const geometry=bed.geometry.clone(),a=geometry.attributes.position;
 const inv=city.matrixWorld.clone().invert(),origin=new THREE.Vector3().applyMatrix4(inv);
 const bedInv=bed.matrixWorld.clone().invert(),p=new THREE.Vector3(),dir=new THREE.Vector3();
 const b=plan.basin;let changed=0,maxLowering=0;
 for(let i=0;i<a.count;i++){
  p.fromBufferAttribute(a,i).applyMatrix4(bed.matrixWorld);const length=p.length();dir.copy(p).normalize();
  const localDirection=dir.clone().transformDirection(inv);
  if(localDirection.y<=0)continue;
  const local=origin.clone().addScaledVector(localDirection,-origin.y/localDirection.y);
  const dx=Math.max(b.xMin-local.x,0,local.x-b.xMax),dz=Math.max(b.zMin-local.z,0,local.z-b.zMax);
  const weight=1-THREE.MathUtils.smoothstep(Math.hypot(dx,dz),0,14);
  if(weight<=0)continue;
  const target=radius+officialOceanLevelAt(dir)-plan.bedTargetDepth;
  const next=THREE.MathUtils.lerp(length,Math.min(length,target),weight);
  if(length-next<1e-6)continue;
  p.copy(dir).multiplyScalar(next).applyMatrix4(bedInv);a.setXYZ(i,p.x,p.y,p.z);
  changed++;maxLowering=Math.max(maxLowering,length-next);
 }
 a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 bed.geometry=geometry;
 bed.userData.citadelFrontHarborSeabed={version:'r02',terrainRevision:'r09',changedVertices:changed,maxLowering,targetDepth:plan.bedTargetDepth,falloffMetres:14,status:'candidate; measured depth and vessel sweep required'};
 return bed.userData.citadelFrontHarborSeabed;
}
