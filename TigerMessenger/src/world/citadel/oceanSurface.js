import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// All citadel water attachments use the one world ocean, after placement/yaw.
// No independent local water level, bowl, or translated sphere is introduced.
export function createOceanHeightSampler(owner,radius){
 owner.updateWorldMatrix(true,false);
 const world=new THREE.Vector3();
 return (x,z)=>{
  let low=-radius*2,high=radius;
  // Find the upper intersection along the object's local vertical. The city
  // footprint lies on this hemisphere, above the sphere's local center.
  const center=owner.worldToLocal(new THREE.Vector3(0,0,0));
  low=center.y;
  for(let i=0;i<44;i++){
   const y=(low+high)/2;world.set(x,y,z);owner.localToWorld(world);
   if(world.length()>radius+officialOceanLevelAt(world))high=y;else low=y;
  }
  return (low+high)/2;
 };
}
