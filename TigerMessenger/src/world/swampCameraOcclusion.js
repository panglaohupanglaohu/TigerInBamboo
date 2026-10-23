import * as THREE from 'three';

// The camera rig expects a short list of actual Mesh objects in WORLD space;
// intersectObjects(..., false) deliberately does not descend into Groups.
// This provider never changes materials, visibility, camera direction or actors.
export function createSwampCameraOccluders(swamp){
 const inner=swamp?.userData?.inner||swamp,meshes=[],localBounds=new THREE.Box3(),worldBounds=new THREE.Box3(),box=new THREE.Box3();
 let disposed=false;
 const externalSources=new Map(),probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 function refresh(){
  meshes.length=0;externalSources.clear();localBounds.makeEmpty();if(disposed||!inner?.isObject3D)return;
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
  // 2026-10-10: trunks now make way (swampOcclusionFade) instead of pulling the camera in; ?swampCamFade=0 restores trunk occluders.
  if(new URLSearchParams(globalThis.location?.search||'').get('swampCamFade')==='0')inner.traverse(object=>{if(object.name==='world-tree-trunk'||object.userData.swampTreePart==='trunk')add(object);});
  for(const mesh of selected){
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   localBounds.union(box.copy(mesh.geometry.boundingBox).applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));meshes.push(mesh);
  }
  // V7 shoreline geometry belongs to a sibling scene group, not to the lake.
  // Its quay courses can occupy the rear camera corridor even when the lake
  // bank itself is clear. Cache only authored nearby shore solids, once.
  const lakeWorldBounds=localBounds.clone().applyMatrix4(inner.matrixWorld).expandByScalar(12);
  let scene=inner;while(scene.parent)scene=scene.parent;
  scene.traverse(source=>{
   if(!source.isMesh||!source.geometry?.attributes.position||!/^v7-(quay-|swamp-outer-|continuous-swamp-)/.test(source.name))return;
   source.updateWorldMatrix(true,false);if(!source.geometry.boundingBox)source.geometry.computeBoundingBox();
   if(!box.copy(source.geometry.boundingBox).applyMatrix4(source.matrixWorld).intersectsBox(lakeWorldBounds))return;
   // Detached ray-only proxy: both faces matter for camera clearance. Never
   // change the renderer material's sidedness or add another drawable object.
   const proxy=new THREE.Mesh(source.geometry,probeMaterial);proxy.name=source.name;proxy.matrixAutoUpdate=false;
   proxy.matrix.copy(source.matrix);proxy.parent=source.parent;proxy.updateWorldMatrix(true,false);
   proxy.userData.swampCameraExternalSolid=true;externalSources.set(proxy,source);meshes.push(proxy);
  });
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
   const source=externalSources.get(mesh)||mesh;
   if(!source.parent||!visible(source))continue;
   if(source!==mesh){mesh.parent=source.parent;mesh.matrix.copy(source.matrix);}
   mesh.updateWorldMatrix(true,false);
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
   if(box.distanceToPoint(position)<=reach)nearbyMeshes.push(mesh);
  }
  return nearbyMeshes;
 }
 nearby.refresh=refresh;
 nearby.dispose=()=>{disposed=true;meshes.length=0;externalSources.clear();localBounds.makeEmpty();probeMaterial.dispose();};
 nearby.getMeshes=()=>meshes.slice();
 refresh();return nearby;
}
