import * as THREE from 'three';

// Ground only: walls and combat remain independent collision systems.
// Cast from just above the feet, never from above the entire castle.
export function createCitadelPlayerGround(city){
 const surfaces=[];city.updateWorldMatrix(true,true);
 city.traverse(o=>{if(o.isMesh&&o.userData.westCityWalkable)surfaces.push(o);});
 const bounds=new THREE.Box3().setFromObject(city),ray=new THREE.Raycaster();
 const up=new THREE.Vector3(),origin=new THREE.Vector3(),down=new THREE.Vector3();ray.layers.enableAll();ray.far=3;
 return position=>{
  if(bounds.distanceToPoint(position)>3)return null;
  up.copy(position).normalize();origin.copy(position).addScaledVector(up,.4);
  ray.set(origin,down.copy(up).negate());
  for(const hit of ray.intersectObjects(surfaces,false)){
   const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld);
   if(normal&&normal.dot(up)>.5)return hit.point.length();
  }
  return null;
 };
}
