import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampRimRootBatch} from '../../src/world/swampRimRootBatch.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregRootBatch=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {finishSwampV2Art}=await import('../../src/world/swampV2Art.js');
const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner;
const roots=[];inner.traverse(o=>{if(o.name==='v2-rim-bowed-root')roots.push(o);});
const snapshots=roots.map(o=>({o,geometry:o.geometry,material:o.material,visible:o.visible,position:o.position.toArray(),rotation:o.rotation.toArray(),scale:o.scale.toArray(),positions:o.geometry.attributes.position.array.slice(),normals:o.geometry.attributes.normal.array.slice(),raycast:o.raycast}));
const rays=roots.map(root=>{
 root.updateWorldMatrix(true,false);const origin=root.localToWorld(new T.Vector3(2.3,8,0)),direction=new T.Vector3(0,-1,0).transformDirection(root.matrixWorld),ray=new T.Raycaster(origin,direction);
 return {root,ray,before:ray.intersectObject(root,false).map(hit=>({distance:hit.distance,point:hit.point.toArray()}))};
});
const batch=installSwampRimRootBatch(inner,{enabled:true});
function checkVertices(report){
 const local=new T.Vector3(),actual=new T.Vector3(),expected=new T.Vector3();let checked=0,maxError=0;
 inner.updateWorldMatrix(true,true);
 for(const b of report.batches)for(const range of b.ranges){
  const source=range.source,p=source.geometry.attributes.position,n=source.geometry.attributes.normal;
  const matrix=b.parent.matrixWorld.clone().invert().multiply(source.matrixWorld),nm=new T.Matrix3().getNormalMatrix(matrix);
  for(let i=0;i<p.count;i++){
   local.fromBufferAttribute(p,i);expected.copy(local).applyMatrix4(source.matrixWorld);actual.fromBufferAttribute(b.geometry.attributes.position,range.vertexStart+i).applyMatrix4(b.mesh.matrixWorld);maxError=Math.max(maxError,actual.distanceTo(expected));assert.ok(actual.distanceTo(expected)<1e-5,'every final world vertex retained');
   assert.deepEqual(new T.Vector3().fromBufferAttribute(b.geometry.attributes.rootLocal,range.vertexStart+i).toArray(),local.toArray(),'bark texture reads exact original root-local vertex');
   const expectedNormal=new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(nm).normalize(),actualNormal=new T.Vector3().fromBufferAttribute(b.geometry.attributes.normal,range.vertexStart+i);assert.ok(actualNormal.distanceTo(expectedNormal)<1e-6);
   checked++;
  }
  const index=source.geometry.index;
  for(let i=0;i<range.indexCount;i++)assert.equal(b.geometry.index.getX(range.indexStart+i)-range.vertexStart,index?index.getX(source.geometry.drawRange.start+i):source.geometry.drawRange.start+i);
 }
 return {checked,maxError};
}
test('54 semantic bank roots render in nine parent-local draws with identical world vertices and triangle count',()=>{
 assert.equal(roots.length,54);assert.equal(batch.sharedMaterialRootsSkipped,0);assert.equal(batch.sourceMeshes,54);assert.equal(batch.renderMeshes,9);assert.equal(batch.savedDrawCalls,45);assert.equal(batch.sourceTriangles,batch.renderTriangles);
 const stats=checkVertices(batch);assert.ok(stats.checked>6000);
 for(const s of snapshots){assert.equal(s.o.geometry,s.geometry);assert.equal(s.o.material,s.material);assert.equal(s.o.visible,s.visible);assert.equal(s.o.raycast,s.raycast);assert.deepEqual(s.o.position.toArray(),s.position);assert.deepEqual(s.o.rotation.toArray(),s.rotation);assert.deepEqual(s.o.scale.toArray(),s.scale);assert.deepEqual(s.o.geometry.attributes.position.array,s.positions);assert.deepEqual(s.o.geometry.attributes.normal.array,s.normals);assert.equal(s.material.visible,false);}
 console.log('root batch initial',JSON.stringify({sources:batch.sourceMeshes,draws:batch.renderMeshes,saved:batch.savedDrawCalls,triangles:batch.renderTriangles,bytes:batch.geometryBytes,...stats}));
});
test('root raycasts preserve exact original semantic hits and render batches cannot intercept them',()=>{
 let hits=0;for(const r of rays){const after=r.ray.intersectObject(r.root,false).map(hit=>({distance:hit.distance,point:hit.point.toArray()}));assert.deepEqual(after,r.before);hits+=after.length;}
 assert.ok(hits>30);for(const b of batch.batches)assert.equal(b.mesh.raycast(),undefined);
});
test('batch bark shader retains original fragment code and source-local grain with actual projection',()=>{
 for(const b of batch.batches){
  const first=b.ranges[0].source,make=()=>({uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader}),source=make(),merged=make();first.material.onBeforeCompile(source);b.material.onBeforeCompile(merged);
  assert.equal(b.material.visible,true);assert.equal(b.material.color.getHex(),first.material.color.getHex());assert.equal(merged.fragmentShader,source.fragmentShader);assert.match(merged.vertexShader,/attribute vec3 rootLocal/);assert.match(merged.vertexShader,/gregLocal = rootLocal/);assert.match(merged.vertexShader,/gregViewDepth = length\(mvPosition.xyz\)/);
 }
});
test('root road deformation, hidden root and spherical parent changes rebuild exact draws without shared geometry',()=>{
 placeMoebiusSwampOnSphere(placement,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);checkVertices(batch);
 assert.equal(new Set(roots.map(r=>r.geometry)).size,54,'individual roots need independent mutable road fitting');
 const changed=roots[0],p=changed.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+.31*i/p.count);p.needsUpdate=true;changed.geometry.computeVertexNormals();roots[1].visible=false;
 const retired=batch.batches.map(b=>b.geometry);let disposed=0;for(const g of retired)g.addEventListener('dispose',()=>disposed++);
 batch.rebuild();assert.equal(disposed,9);assert.equal(batch.sourceMeshes,53);assert.equal(batch.renderMeshes,9);checkVertices(batch);
 roots[1].visible=true;batch.rebuild();assert.equal(batch.sourceMeshes,54);
});
test('shared unrelated material stays visible and mismatched material roots never merge',()=>{
 const isolated=new T.Group(),parent=new T.Group();isolated.add(parent);const shared=new T.MeshBasicMaterial({color:0x123456}),other=new T.Mesh(new T.BoxGeometry(),shared);isolated.add(other);
 for(const material of [shared,new T.MeshBasicMaterial({color:0xaaaaff}),new T.MeshBasicMaterial({color:0x00aa11})]){const root=new T.Mesh(new T.BoxGeometry(),material);root.name='v2-rim-bowed-root';parent.add(root);}
 const report=installSwampRimRootBatch(isolated,{enabled:true});assert.equal(report.sharedMaterialRootsSkipped,1);assert.equal(report.sourceMeshes,2);assert.equal(report.renderMeshes,2);assert.equal(shared.visible,true);report.dispose();assert.equal(shared.visible,true);
});
test('production finish road fitting refreshes root render copies and retains source geometry nodes',()=>{
 const scene=new T.Group();scene.add(placement);const road=new T.Mesh(new T.SphereGeometry(160,32,16),new T.MeshBasicMaterial({side:T.DoubleSide}));road.name='v7-continuous-swamp-promenade';scene.add(road);
 const before=batch.batches.map(b=>b.geometry);let released=0;before.forEach(g=>g.addEventListener('dispose',()=>released++));finishSwampV2Art({scene,swamp:placement});assert.equal(released,9);checkVertices(batch);
 for(const snapshot of snapshots){assert.equal(snapshot.o.geometry,snapshot.geometry);assert.equal(snapshot.o.raycast,snapshot.raycast);}
 console.log('root batch final supported',JSON.stringify({sources:batch.sourceMeshes,draws:batch.renderMeshes,saved:batch.savedDrawCalls}));
});
test('dispose is idempotent and comparison flag leaves source rendering unchanged',()=>{
 let released=0;for(const b of batch.batches)for(const resource of [b.geometry,b.material])resource.addEventListener('dispose',()=>released++);const size=batch.batches.length;batch.dispose();batch.dispose();assert.equal(released,size*2);assert.equal(inner.userData.gregRimRootBatch,undefined);for(const s of snapshots)assert.equal(s.material.visible,true);
 const empty=new T.Group();assert.equal(installSwampRimRootBatch(empty),null);assert.deepEqual(empty.userData,{});
});
