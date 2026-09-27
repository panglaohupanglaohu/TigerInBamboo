import * as THREE from 'three';

// Sample only walkable paving and registered loading platforms, never roofs,
// cranes, rolling stock or people. Terrain belonging to other regions is left
// to their existing sampler. The root may be installed after the assault system.
export function createBookshopGroundSampler(root,platforms,R=160){
 const ray=new THREE.Raycaster(),up=new THREE.Vector3(),origin=new THREE.Vector3(),delta=new THREE.Vector3();
 const cache=new Map();
 const raised=platforms.filter(p=>p.topHeight>R+.92);
 const floors=[];root.traverse(o=>{if(o.isMesh&&['bookshop-spherical-ground','factory-spherical-yard','shop-plaza-path'].includes(o.name))floors.push(o);});
 return dir=>{
  up.copy(dir).normalize();const key=[up.x,up.y,up.z].map(v=>Math.round(v*8192)).join(',');
  if(cache.has(key))return cache.get(key);
  if(cache.size>2000)cache.clear();
  origin.copy(up).multiplyScalar(R+8);ray.set(origin,up.clone().negate());ray.far=10;
  for(const floor of floors)floor.updateWorldMatrix(true,false);
  const hits=ray.intersectObjects(floors,false);if(!hits.length){cache.set(key,null);return null;}
  let height=hits[0].point.length();
  for(const p of raised){
   delta.copy(up).multiplyScalar(p.topHeight).sub(p.center);
   if(Math.abs(delta.dot(p.right))<=p.half.x&&Math.abs(delta.dot(p.forward))<=p.half.z&&Math.abs(delta.dot(p.normal))<1)height=Math.max(height,p.topHeight);
  }
  cache.set(key,height);return height;
 };
}
