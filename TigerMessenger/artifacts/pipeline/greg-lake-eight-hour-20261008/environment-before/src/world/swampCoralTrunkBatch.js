import * as THREE from 'three';

// Rendering only. Semantic source meshes keep their geometry, transforms,
// children and raycast method. Material.visible suppresses just their draw.
export function installSwampCoralTrunkBatch(inner,records,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregTrunkBatch')!=='0'}={}){
 if(!enabled)return null;
 if(inner.userData.gregTrunkBatch)return inner.userData.gregTrunkBatch;
 const sources=records.filter(r=>r.mesh.visible&&r.mesh.material===r.material&&r.material.visible&&r.mesh.parent);
 const visibility=new Map(sources.map(r=>[r.material,r.material.visible])),batches=[];
 let disposed=false;
 const report={version:1,sources,batches,sourceMeshes:sources.length,renderMeshes:0,sourceTriangles:0,renderTriangles:0,savedDrawCalls:0,geometryBytes:0,rebuild,dispose};
 function release(){for(const b of batches){b.mesh.removeFromParent();b.geometry.dispose();b.material.dispose();}batches.length=0;}
 function rebuild(){
  if(disposed)return;
  release();inner.updateWorldMatrix(true,true);const groups=new Map();
  for(const source of sources){const m=source.mesh,key=`${m.parent.uuid}:${m.layers.mask}:${m.castShadow}:${m.receiveShadow}:${m.renderOrder}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(source);}
  for(const members of groups.values()){
   const parent=members[0].mesh.parent,parentInverse=parent.matrixWorld.clone().invert(),positions=[],normals=[],barkLocal=[],indices=[],ranges=[];
   const v=new THREE.Vector3(),n=new THREE.Vector3();
   for(const r of members){
    const source=r.mesh,g=source.geometry,p=g.attributes.position,normal=g.attributes.normal,matrix=parentInverse.clone().multiply(source.matrixWorld),nm=new THREE.Matrix3().getNormalMatrix(matrix),vertexStart=positions.length/3,indexStart=indices.length;
    for(let i=0;i<p.count;i++){
     v.fromBufferAttribute(p,i);barkLocal.push(v.x,v.y,v.z);v.applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
     n.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();normals.push(n.x,n.y,n.z);
    }
    const available=g.index?.count??p.count,start=g.drawRange.start,end=Math.min(available,start+g.drawRange.count);
    for(let i=start;i<end;i++)indices.push(vertexStart+(g.index?g.index.getX(i):i));
    ranges.push({source,vertexStart,vertexCount:p.count,indexStart,indexCount:indices.length-indexStart});
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('barkLocal',new THREE.Float32BufferAttribute(barkLocal,3));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const sourceMaterial=members[0].material,material=sourceMaterial.clone();material.visible=true;
   material.onBeforeCompile=shader=>{
    sourceMaterial.onBeforeCompile(shader);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 barkLocal;').replace('coralBarkP=position;','coralBarkP=barkLocal;');
   };
   material.customProgramCacheKey=()=>`${sourceMaterial.customProgramCacheKey()}:tree-local-batch-1`;
   const mesh=new THREE.Mesh(geometry,material),first=members[0].mesh;
   mesh.name='greg-coral-trunk-render-batch';mesh.userData.gregTrunkBatch=true;mesh.layers.mask=first.layers.mask;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.raycast=()=>{};
   parent.add(mesh);batches.push({mesh,geometry,material,parent,ranges});
  }
  for(const [material]of visibility)material.visible=false;
  report.renderMeshes=batches.length;report.sourceTriangles=batches.reduce((n,b)=>n+b.ranges.reduce((sum,r)=>sum+r.indexCount/3,0),0);report.renderTriangles=batches.reduce((n,b)=>n+b.geometry.index.count/3,0);report.savedDrawCalls=sources.length-batches.length;report.geometryBytes=batches.reduce((sum,b)=>sum+Object.values(b.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+b.geometry.index.array.byteLength,0);
 }
 function dispose(){if(disposed)return;disposed=true;release();for(const [material,visible]of visibility)material.visible=visible;if(inner.userData.gregTrunkBatch===report)delete inner.userData.gregTrunkBatch;}
 rebuild();inner.userData.gregTrunkBatch=report;return report;
}
