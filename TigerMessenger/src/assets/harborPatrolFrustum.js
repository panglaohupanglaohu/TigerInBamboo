import * as THREE from 'three';

// Three r172 Frustum.intersectsObject supports object.boundingSphere on Mesh.
// Compute an independent sphere: never inflate the shared crew geometry bounds.
function rigidSphere(geometry){
 const position=geometry.attributes.position,box=new THREE.Box3().setFromBufferAttribute(position),sphere=new THREE.Sphere(box.getCenter(new THREE.Vector3()),0),point=new THREE.Vector3();
 for(let i=0;i<position.count;i++)sphere.radius=Math.max(sphere.radius,point.fromBufferAttribute(position,i).distanceTo(sphere.center));
 return sphere;
}
function outlineExpansion(mesh){
 const material=mesh.material;
 if(!material||Array.isArray(material))return null;
 if(!mesh.userData.isOutline)return material.isShaderMaterial||material.displacementMap||material.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile?null:0;
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
 // Read the numeric width from the actual cached outline hook, without changing
 // material or geometry. Unknown extrusion shaders retain their old forced draw.
 try{material.onBeforeCompile(shader);}catch{return null;}
 const match=shader.vertexShader.match(/transformed\s*\+=\s*normal\s*\*\s*\(\s*([\d.]+)\s*\*\s*\(0\.65\s*\+\s*0\.6\s*\*\s*tmHash\)\)/);
 if(!match)return null;
 let normalLength=1;const normal=mesh.geometry.attributes.normal,point=new THREE.Vector3();
 if(normal)for(let i=0;i<normal.count;i++)normalLength=Math.max(normalLength,point.fromBufferAttribute(normal,i).length());
 return Number(match[1])*1.25*normalLength;
}

export function configureHarborPatrolFrustum(soldier,{enabled=new URLSearchParams(globalThis.location?.search||'').get('harborPatrolFrustum')!=='0'}={}){
 const report={version:1,enabled,meshes:0,culledMeshes:0,outlines:0,skipped:0,maxOutlineExpansion:0};
 soldier.traverse(mesh=>{
  if(!mesh.isMesh)return;
  report.meshes++;
  // Retain the former behavior for explicit rollback and nonrigid meshes.
  mesh.frustumCulled=false;
  if(!enabled)return;
  if(mesh.isSkinnedMesh||mesh.isInstancedMesh||mesh.geometry?.morphAttributes.position?.length||!mesh.geometry?.attributes.position){report.skipped++;return;}
  const expansion=outlineExpansion(mesh);
  if(expansion===null){report.skipped++;return;}
  const sphere=rigidSphere(mesh.geometry);sphere.radius+=expansion+1e-6;
  mesh.boundingSphere=sphere;
  mesh.frustumCulled=true;report.culledMeshes++;
  if(mesh.userData.isOutline){report.outlines++;report.maxOutlineExpansion=Math.max(report.maxOutlineExpansion,expansion);}
 });
 return report;
}
