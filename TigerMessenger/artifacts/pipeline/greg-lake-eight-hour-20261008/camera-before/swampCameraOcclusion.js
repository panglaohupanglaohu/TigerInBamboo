import * as THREE from 'three';

// The camera rig expects a short list of actual Mesh objects in WORLD space;
// intersectObjects(..., false) deliberately does not descend into Groups.
// This provider never changes materials, visibility, camera direction or actors.
export function createSwampCameraOccluders(swamp){
 const inner=swamp?.userData?.inner||swamp,meshes=[],localBounds=new THREE.Box3(),worldBounds=new THREE.Box3(),box=new THREE.Box3();
 let disposed=false;
 function refresh(){
  meshes.length=0;localBounds.makeEmpty();if(disposed||!inner?.isObject3D)return;
  inner.updateWorldMatrix(true,true);
  const inverse=inner.matrixWorld.clone().invert(),selected=new Set();
  const add=object=>{if(object?.isMesh&&object.geometry?.attributes.position)selected.add(object);};
  add(inner.getObjectByName('swamp-sinkhole-wall'));
  add(inner.getObjectByName('swamp-lake-floor'));
  for(const object of inner.userData.tigerWalkSurfaces||[])add(object);
  for(const report of [inner.userData.gregCoralRim,inner.userData.gregSpatialPlan,inner.userData.gregShoreDock])for(const object of report?.walkMeshes||[])add(object);
  add(inner.getObjectByName('greg-natural-cliff-rock'));
  // Trunks are solid architecture-scale obstacles. Exclude crowns, branches,
  // flowers, birds, line shells and all animated / story objects.
  inner.traverse(object=>{if(object.name==='world-tree-trunk'||object.userData.swampTreePart==='trunk')add(object);});
  for(const mesh of selected){
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   localBounds.union(box.copy(mesh.geometry.boundingBox).applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));meshes.push(mesh);
  }
 }
 function visible(mesh){for(let object=mesh;object;object=object.parent)if(!object.visible)return false;return true;}
 function nearby(position,reach=12){
  if(disposed||!position?.isVector3||![position.x,position.y,position.z,reach].every(Number.isFinite)||reach<=0||localBounds.isEmpty())return [];
  // Only one parent transform/bounds test far from the lake; no per-frame scene
  // traversal. Use world distances, including the real .5 placement scale.
  inner.updateWorldMatrix(true,false);worldBounds.copy(localBounds).applyMatrix4(inner.matrixWorld);
  if(worldBounds.distanceToPoint(position)>reach)return [];
  const nearbyMeshes=[];
  for(const mesh of meshes){
   if(!mesh.parent||!visible(mesh))continue;
   mesh.updateWorldMatrix(true,false);
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
   if(box.distanceToPoint(position)<=reach)nearbyMeshes.push(mesh);
  }
  return nearbyMeshes;
 }
 nearby.refresh=refresh;
 nearby.dispose=()=>{disposed=true;meshes.length=0;localBounds.makeEmpty();};
 nearby.getMeshes=()=>meshes.slice();
 refresh();return nearby;
}
