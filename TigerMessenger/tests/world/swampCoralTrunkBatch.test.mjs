import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampCoralTrunkBatch} from '../../src/world/swampCoralTrunkBatch.js';
import {installSwampCoralTrunkDetail} from '../../src/world/swampCoralTrunkDetail.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregTrunkBatch=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const before=createMoebiusSwampPlacement({seed:7711,scale:.5});globalThis.location.search='';const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,detail=inner.userData.gregTrunkDetail,report=detail.batch;
function checkWorldGeometry(){
 root.updateMatrixWorld(true);let vertices=0,triangles=0,maxPositionError=0,maxNormalError=0;
 for(const b of report.batches){
  const p=b.geometry.attributes.position,n=b.geometry.attributes.normal,local=b.geometry.attributes.barkLocal,batchNormal=new T.Matrix3().getNormalMatrix(b.mesh.matrixWorld);
  for(const r of b.ranges){
   const sp=r.source.geometry.attributes.position,sn=r.source.geometry.attributes.normal,normalMatrix=new T.Matrix3().getNormalMatrix(r.source.matrixWorld);
   for(let i=0;i<r.vertexCount;i++){
    const a=new T.Vector3().fromBufferAttribute(sp,i),c=new T.Vector3().fromBufferAttribute(local,r.vertexStart+i);assert.ok(a.equals(c),'shader barkLocal exactly equals source vertex');
    a.applyMatrix4(r.source.matrixWorld);c.fromBufferAttribute(p,r.vertexStart+i).applyMatrix4(b.mesh.matrixWorld);maxPositionError=Math.max(maxPositionError,a.distanceTo(c));
    a.fromBufferAttribute(sn,i).applyMatrix3(normalMatrix).normalize();c.fromBufferAttribute(n,r.vertexStart+i).applyMatrix3(batchNormal).normalize();maxNormalError=Math.max(maxNormalError,a.distanceTo(c));vertices++;
   }
   const sourceIndex=r.source.geometry.index;for(let i=0;i<r.indexCount;i++){const original=sourceIndex?sourceIndex.getX(i):i;assert.equal(b.geometry.index.getX(r.indexStart+i)-r.vertexStart,original,'index order/winding unchanged');}triangles+=r.indexCount/3;
  }
 }
 assert.ok(maxPositionError<1e-5,`world position error ${maxPositionError}`);assert.ok(maxNormalError<1e-6,`world normal error ${maxNormalError}`);assert.equal(triangles,report.sourceTriangles);return{vertices,triangles,maxPositionError,maxNormalError};
}
test('285 real organic source meshes become eleven render batches with identical world triangles/normals and no extra triangles',()=>{
 assert.equal(report.sourceMeshes,285);assert.equal(report.renderMeshes,11);assert.equal(report.savedDrawCalls,274);assert.equal(report.renderTriangles,report.sourceTriangles);
 assert.equal(inner.userData.gregTrunkBatch,report);assert.equal(installSwampCoralTrunkBatch(inner,detail.records),report);
 for(const r of report.sources){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);assert.equal(r.mesh.visible,true);assert.equal(r.material.visible,false);}
 const snapshot=checkWorldGeometry();console.log('tree render batching',JSON.stringify({sourceMeshes:report.sourceMeshes,renderMeshes:report.renderMeshes,geometryBytes:report.geometryBytes,...snapshot}));
 const baseline=before.userData.inner.userData.gregTrunkDetail;
 for(let i=0;i<detail.records.length;i++){assert.deepEqual(detail.records[i].geometry.attributes.position.array,baseline.records[i].geometry.attributes.position.array);assert.deepEqual(detail.records[i].mesh.position.toArray(),baseline.records[i].mesh.position.toArray());}
 for(const b of report.batches){const shader={vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};b.material.onBeforeCompile(shader);assert.match(shader.vertexShader,/attribute vec3 barkLocal/);assert.match(shader.vertexShader,/coralBarkP=barkLocal/);assert.match(shader.fragmentShader,/fwidth\(groove\)/);assert.equal(b.material.color.getHexString(),'bd929e');}
});
test('source meshes still provide exact perch rays and no duplicate batch ray hits after spherical / V7 parent scaling',()=>{
 placeMoebiusSwampOnSphere(root,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);
 for(const tree of inner.userData.towerTrees||[])if(tree.name==='swamp-towering-tree')tree.scale.y*=.55;
 checkWorldGeometry();
 for(const record of inner.userData.gregCoralPerches.records){
  const source=record.sourceTrunk,p=source.geometry.boundingBox.getCenter(new T.Vector3()),world=source.localToWorld(p.clone()),direction=new T.Vector3(1,.13,.21).transformDirection(source.matrixWorld),origin=world.clone().addScaledVector(direction,10),ray=new T.Raycaster(origin,direction.negate());
  assert.ok(ray.intersectObject(source,false).length,'material-hidden source remains raycastable');
  assert.equal(ray.intersectObjects(report.batches.map(b=>b.mesh),false).length,0,'render proxies never duplicate semantic collisions');
 }
 const oldBatches=report.batches.map(b=>b.mesh);report.rebuild();assert.ok(oldBatches.every(m=>m.parent===null));assert.equal(report.renderMeshes,11);checkWorldGeometry();
});
test('dispose restores draw visibility and trunk detail disposal/reinstall restores original source geometry without batch leaks',()=>{
 const originals=detail.records.map(r=>({mesh:r.mesh,geometry:r.originalGeometry,material:r.originalMaterial}));let disposed=0;
 for(const b of report.batches){b.geometry.addEventListener('dispose',()=>disposed++);b.material.addEventListener('dispose',()=>disposed++);}
 detail.dispose();detail.dispose();assert.equal(disposed,22);assert.equal(inner.userData.gregTrunkBatch,undefined);assert.equal(inner.getObjectByName('greg-coral-trunk-render-batch'),undefined);
 for(const r of originals){assert.equal(r.mesh.geometry,r.geometry);assert.equal(r.mesh.material,r.material);assert.equal(r.mesh.visible,true);}
 const reinstalled=installSwampCoralTrunkDetail(inner);assert.equal(reinstalled.batch.renderMeshes,11);assert.equal(reinstalled.batch.sourceMeshes,285);let count=0;inner.traverse(o=>{if(o.name==='greg-coral-trunk-render-batch')count++;});assert.equal(count,11);
 reinstalled.dispose();
});
