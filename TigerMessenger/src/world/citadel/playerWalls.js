import * as THREE from 'three';
import {PLAYER_RADIUS,PLAYER_HEIGHT} from '../../core/constants.js';

// Swept body samples for authored stone barriers. This does not replace
// terrain grounding or claim full capsule/triangle contact for every asset.
export function createCitadelPlayerWalls(city){
 city.updateWorldMatrix(true,true);
 const names=new Set(['tower-interior-solid','main-gate-wall','main-gate-carved-surround','court-solid-stone','processional-solid-stone','processional-solid-coping']);
 const obstacles=[];city.traverse(o=>{if(o.isMesh&&names.has(o.name))obstacles.push({mesh:o,box:new THREE.Box3().setFromObject(o)});});
 const ray=new THREE.Raycaster(),up=new THREE.Vector3(),move=new THREE.Vector3(),side=new THREE.Vector3(),origin=new THREE.Vector3(),normal=new THREE.Vector3();ray.layers.enableAll();
 return (previous,position,velocity)=>{
  up.copy(previous).normalize();move.copy(position).sub(previous);move.addScaledVector(up,-move.dot(up));
  const length=move.length();if(length<1e-7)return false;move.multiplyScalar(1/length);side.crossVectors(up,move).normalize();
  const near=obstacles.filter(o=>o.box.distanceToPoint(previous)<PLAYER_HEIGHT+length+1).map(o=>o.mesh);
  if(!near.length)return false;
  let allowed=length;ray.far=length+PLAYER_RADIUS;
  for(const h of [.28,.8,PLAYER_HEIGHT-.1])for(const offset of [-PLAYER_RADIUS*.8,0,PLAYER_RADIUS*.8]){
   origin.copy(previous).addScaledVector(up,h).addScaledVector(side,offset);ray.set(origin,move);
   for(const hit of ray.intersectObjects(near,false)){
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if(Math.abs(normal.dot(up))>.7)continue;
    allowed=Math.min(allowed,Math.max(0,hit.distance-PLAYER_RADIUS-.015));break;
   }
  }
  if(allowed>=length)return false;
  position.addScaledVector(move,allowed-length);
  const into=velocity.dot(move);if(into>0)velocity.addScaledVector(move,-into);
  return true;
 };
}
