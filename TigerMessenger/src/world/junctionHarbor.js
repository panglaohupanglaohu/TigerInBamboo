import * as THREE from 'three';
import {officialOceanLevelAt} from './waterV8/officialOcean.js';
/** Candidate dredging affects only the original bed in front of the new quays. */
export function applyJunctionHarbor(scene,city){
 if(new URLSearchParams(location.search).get('junctionHarbor')!=='1'||!city.userData.junctionTarget)return null;
 const bed=scene.getObjectByName('planet-surface');if(!bed)return null;
 scene.updateMatrixWorld(true);const original=bed.geometry,geometry=original.clone(),a=geometry.attributes.position,inv=city.matrixWorld.clone().invert(),bedInv=bed.matrixWorld.clone().invert(),p=new THREE.Vector3(),dir=new THREE.Vector3();let changed=0;
 for(let i=0;i<a.count;i++){
  p.fromBufferAttribute(a,i).applyMatrix4(bed.matrixWorld);const length=p.length();dir.copy(p).normalize();const local=p.clone().applyMatrix4(inv);
  // Exclude rear island; apron and turning pocket extend into the open front water.
  const dx=Math.max(-24-local.x,0,local.x-24),dz=Math.max(17-local.z,0,local.z-52);
  const weight=1-THREE.MathUtils.smoothstep(Math.hypot(dx,dz),0,12);if(weight<=0)continue;
  const desired=160+officialOceanLevelAt(dir)-2.6,next=THREE.MathUtils.lerp(length,Math.min(length,desired),weight);if(length-next<1e-6)continue;
  p.copy(dir).multiplyScalar(next).applyMatrix4(bedInv);a.setXYZ(i,p.x,p.y,p.z);changed++;
 }
 a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();bed.geometry=geometry;bed.userData.terrainGeometryVersion=(bed.userData.terrainGeometryVersion||0)+1;
 const restore=city.userData.restoreOriginalTown;city.userData.restoreOriginalTown=()=>{restore?.();if(bed.geometry===geometry){bed.geometry=original;geometry.dispose();bed.userData.terrainGeometryVersion++;}};
 return city.userData.junctionHarbor={changed,targetDepth:2.6,status:'candidate; no dispatch until dock and route checks pass'};
}
