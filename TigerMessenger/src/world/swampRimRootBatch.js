import * as THREE from 'three';

// Static render-only copies, one per tree/material group. Original roots retain
// their local coordinates, mutable road fitting, semantic nodes and raycasts.
// Never share their writable TubeGeometry: finishSwampV2Art bends each root onto
// a different real road hit, then rebuilds these final draw buffers once.
export function installSwampRimRootBatch(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregRootBatch')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;
 if(!enabled)return null;
 if(inner.userData.gregRimRootBatch)return inner.userData.gregRimRootBatch;
 const roots=[];
 inner.traverse(mesh=>{
  if(mesh.name==='v2-rim-bowed-root'&&mesh.isMesh&&mesh.geometry?.attributes.position&&mesh.geometry.attributes.normal&&mesh.parent&&!Array.isArray(mesh.material))roots.push(mesh);
 });
 // A material may be reused by an unrelated limb or actor. Such roots stay
 // unbatched rather than suppressing any draw belonging to that other object.
 const rootSet=new Set(roots),externalMaterials=new Set();let scope=inner;
 while(scope.parent)scope=scope.parent;
 scope.traverse(node=>{if(!node.isMesh||rootSet.has(node))return;for(const material of Array.isArray(node.material)?node.material:[node.material])externalMaterials.add(material);});
 const safeRoots=roots.filter(root=>!externalMaterials.has(root.material)),visibility=new Map(safeRoots.map(mesh=>[mesh.material,mesh.material.visible])),batches=[];
 let disposed=false;
 const report={version:1,roots,batches,sharedMaterialRootsSkipped:roots.length-safeRoots.length,sourceMeshes:0,renderMeshes:0,savedDrawCalls:0,sourceTriangles:0,renderTriangles:0,geometryBytes:0,rebuild,dispose};
 function release(){for(const batch of batches){batch.mesh.removeFromParent();batch.geometry.dispose();batch.material.dispose();}batches.length=0;}
 function materialKey(m){return [m.type,m.color?.getHex(),m.opacity,m.transparent,m.side,m.vertexColors,m.fog,m.toneMapped,m.depthTest,m.depthWrite,m.blending,m.alphaTest,m.map?.uuid,m.alphaMap?.uuid,m.lightMap?.uuid,m.envMap?.uuid,m.customProgramCacheKey()].join(':');}
 function rebuild(){
  if(disposed)return report;
  release();inner.updateWorldMatrix(true,true);
  const groups=new Map();
  for(const mesh of safeRoots){
   if(!mesh.parent||!mesh.visible||!visibility.get(mesh.material))continue;
   const key=[mesh.parent.uuid,mesh.layers.mask,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,materialKey(mesh.material)].join('|');
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
  }
  for(const members of groups.values()){
   const first=members[0],parent=first.parent,inverse=parent.matrixWorld.clone().invert(),positions=[],normals=[],rootLocal=[],uvs=[],indices=[],ranges=[];
   const v=new THREE.Vector3(),normal=new THREE.Vector3();
   for(const source of members){
    const geometry=source.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,matrix=inverse.clone().multiply(source.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),vertexStart=positions.length/3,indexStart=indices.length;
    for(let i=0;i<p.count;i++){
     v.fromBufferAttribute(p,i);rootLocal.push(v.x,v.y,v.z);v.applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
     normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();normals.push(normal.x,normal.y,normal.z);
     uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);
    }
    const count=geometry.index?.count??p.count,start=geometry.drawRange.start,end=Math.min(count,start+geometry.drawRange.count);
    for(let i=start;i<end;i++)indices.push(vertexStart+(geometry.index?geometry.index.getX(i):i));
    ranges.push({source,vertexStart,vertexCount:p.count,indexStart,indexCount:indices.length-indexStart});
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('rootLocal',new THREE.Float32BufferAttribute(rootLocal,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const sourceMaterial=first.material,material=sourceMaterial.clone();material.visible=true;
   material.onBeforeCompile=shader=>{
    sourceMaterial.onBeforeCompile(shader);
    // The original bark grain is defined in each root's own untransformed
    // coordinates, whereas projection and view depth use the merged position.
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 rootLocal;').replace('gregLocal = position;','gregLocal = rootLocal;');
   };
   material.customProgramCacheKey=()=>sourceMaterial.customProgramCacheKey()+':rim-root-tree-local-batch-1';
   const mesh=new THREE.Mesh(geometry,material);mesh.name='greg-rim-root-render-batch';mesh.userData.gregRimRootBatch=true;mesh.layers.mask=first.layers.mask;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.raycast=()=>{};
   parent.add(mesh);batches.push({mesh,parent,geometry,material,ranges});
  }
  for(const [material]of visibility)material.visible=false;
  report.sourceMeshes=batches.reduce((sum,b)=>sum+b.ranges.length,0);report.renderMeshes=batches.length;report.savedDrawCalls=report.sourceMeshes-report.renderMeshes;
  report.sourceTriangles=batches.reduce((sum,b)=>sum+b.ranges.reduce((n,r)=>n+r.indexCount/3,0),0);report.renderTriangles=batches.reduce((sum,b)=>sum+b.geometry.index.count/3,0);
  report.geometryBytes=batches.reduce((sum,b)=>sum+Object.values(b.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+b.geometry.index.array.byteLength,0);
  return report;
 }
 function dispose(){if(disposed)return;disposed=true;release();for(const [material,visible]of visibility)material.visible=visible;if(inner.userData.gregRimRootBatch===report)delete inner.userData.gregRimRootBatch;}
 rebuild();inner.userData.gregRimRootBatch=report;return report;
}
