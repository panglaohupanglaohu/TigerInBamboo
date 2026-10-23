import * as THREE from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
/** Fixed snapshot of the installed public floor triangles. This is not a
 * nearest-point fallback: a miss, steep wall or >1m vertical gap returns null. */
export function createTargetCityPatrolSupport({castle,supports,maxDistance=1}={}){
 if(!castle?.isObject3D||!Array.isArray(supports)||!supports.length||!Number.isFinite(maxDistance)||maxDistance<=0||maxDistance>1)throw new TypeError('actual public support triangles and distance <=1 required');
 castle.updateWorldMatrix(true,true);const index=buildMountainSurfaceIndex(supports),ray=new THREE.Ray(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
 const sample=point=>{
  if(!point?.isVector3||![point.x,point.y,point.z].every(Number.isFinite)||point.lengthSq()<1)return null;
  const up=point.clone().normalize();ray.set(point.clone().addScaledVector(up,maxDistance),up.clone().negate());
  const hit=index.sample(ray,0,2*maxDistance+.00001,h=>{
   if(!h.face)return false;matrix.copy(h.object.matrixWorld);if(h.instanceId!==undefined){const instance=new THREE.Matrix4();h.object.getMatrixAt(h.instanceId,instance);matrix.multiply(instance);}
   normal.copy(h.face.normal).applyMatrix3(normalMatrix.getNormalMatrix(matrix)).normalize();return normal.dot(up)>.5;
  });
  return hit&&hit.point.distanceTo(point)<=maxDistance+.00001?hit.point.clone():null;
 };
 return sample;
}
