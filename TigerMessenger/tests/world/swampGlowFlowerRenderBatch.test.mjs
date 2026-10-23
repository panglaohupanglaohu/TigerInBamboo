import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampGlowFlowerRenderBatch} from '../../src/world/swampGlowFlowerRenderBatch.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,SWAMP_COMPONENT_BUILDERS}=await import('../../src/world/moebiusSwamp.js');
function census(root){let draws=0,triangles=0;root.traverseVisible(node=>{if(node.isSprite){draws++;triangles+=2;}else if(node.isMesh){draws+=Array.isArray(node.material)?node.geometry.groups.length:1;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3*(node.isInstancedMesh?node.count:1);}});return {draws,triangles};}
function sameWorldVertices(source,batch,index){
 const instance=new T.Matrix4();batch.getMatrixAt(index,instance);const combined=batch.matrixWorld.clone().multiply(instance),v=new T.Vector3(),w=new T.Vector3(),p=source.geometry.attributes.position,n=source.geometry.attributes.normal;
 // Test original vertices AND the actual local-space toon extrusion. Identical
 // local attributes and exact original material reference preserve dry-brush hash.
 for(let i=0;i<p.count;i++)for(const thickness of [0,.006]){
  v.fromBufferAttribute(p,i);const hash=Math.sin(v.dot(new T.Vector3(12.9898,78.233,37.719)))*43758.5453;
  v.addScaledVector(w.fromBufferAttribute(n,i),thickness*(.65+.6*(hash-Math.floor(hash))));w.copy(v).applyMatrix4(combined);v.applyMatrix4(source.matrixWorld);
  assert.ok(v.distanceTo(w)<1e-5,`world vertex delta ${v.distanceTo(w)}`);
 }
 assert.equal(batch.material,source.material);for(const key of Object.keys(source.geometry.attributes))assert.deepEqual(batch.geometry.attributes[key].array,source.geometry.attributes[key].array);
 const a=new T.Matrix3().getNormalMatrix(source.matrixWorld),b=new T.Matrix3().getNormalMatrix(combined);
 for(let i=0;i<n.count;i++){v.fromBufferAttribute(n,i).applyMatrix3(a).normalize();w.fromBufferAttribute(n,i).applyMatrix3(b).normalize();assert.ok(v.distanceTo(w)<1e-5);}
}
test('actual formal flowers preserve original geometry, ink shader, animation and rollback while removing eight draws each',()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,flowers=[];inner.userData.glowFlowerRenderBatch?.dispose();inner.traverse(n=>{if(n.name==='swamp-glow-flower')flowers.push(n);});
 const before=flowers.map(census),halo=flowers.map(f=>f.userData.halo),halomats=halo.map(h=>h.material),report=installSwampGlowFlowerRenderBatch(inner);
 assert.equal(report.records.length,flowers.length);assert.ok(flowers.length>=16);assert.deepEqual(report.skipped,[]);assert.equal(report.drawsSaved,8*flowers.length);assert.equal(installSwampGlowFlowerRenderBatch(inner),report);
 report.records.forEach((r,i)=>{const after=census(r.flower);assert.equal(after.draws,before[i].draws-8);assert.equal(after.triangles,before[i].triangles);assert.equal(r.flower.userData.halo,halo[i]);assert.equal(halo[i].material,halomats[i]);assert.ok(halo[i].visible);assert.ok(r.petals.every(p=>!p.visible));assert.ok(r.outlines.every(p=>p.visible));});
 for(const time of [0,3.1,8,21]){root.userData.update(.02,time,{});root.updateMatrixWorld(true);for(const r of report.records)for(let i=0;i<5;i++){sameWorldVertices(r.petals[i],r.batch,i);sameWorldVertices(r.outlines[i],r.inkBatch,i);}}
 // Deliberately move/rotate/nonuniformly scale one entire flower, exercising the
 // retained animated parent rather than assuming today's flowers are stationary.
 const f=flowers[0];f.position.add(new T.Vector3(1,2,3));f.rotation.set(.3,.5,.7);f.scale.set(.7,1.3,1.1);root.updateMatrixWorld(true);
 for(let i=0;i<5;i++)sameWorldVertices(report.records[0].outlines[i],report.records[0].inkBatch,i);
 let geometryDisposed=0,materialDisposed=0,instancesDisposed=0;for(const r of report.records){r.batch.geometry.addEventListener('dispose',()=>geometryDisposed++);r.batch.material.addEventListener('dispose',()=>materialDisposed++);r.batch.addEventListener('dispose',()=>instancesDisposed++);r.inkBatch.addEventListener('dispose',()=>instancesDisposed++);}
 report.dispose();report.dispose();assert.equal(geometryDisposed,0);assert.equal(materialDisposed,0);assert.equal(instancesDisposed,flowers.length*2);assert.equal(inner.userData.glowFlowerRenderBatch,undefined);flowers.forEach((f,i)=>assert.deepEqual(census(f),before[i]));
 const again=installSwampGlowFlowerRenderBatch(inner);assert.equal(again.records.length,flowers.length);again.dispose();console.log('glow-flower-batch',JSON.stringify({flowers:flowers.length,before:before.reduce((n,c)=>n+c.draws,0),after:before.reduce((n,c)=>n+c.draws,0)-report.drawsSaved,drawsSaved:report.drawsSaved,trianglesUnchanged:true}));
});
test('unsafe transparent, differing geometry/material, custom shader or reflected petals remain untouched',()=>{
 for(const change of [p=>{p.material=p.material.clone();p.material.transparent=true;},p=>{p.geometry=p.geometry.clone();p.geometry.attributes.position.setX(0,20);},p=>{p.material=p.material.clone();},p=>{p.material=p.material.clone();p.material.onBeforeCompile=()=>{};},p=>{p.scale.x=-1;}]){
  const inner=new T.Group(),flower=SWAMP_COMPONENT_BUILDERS.glowFlower(()=>.5,0);inner.add(flower);change(flower.children[1]);const before=census(flower),report=installSwampGlowFlowerRenderBatch(inner);assert.equal(report.records.length,0);assert.equal(report.skipped.length,1);assert.deepEqual(census(flower),before);report.dispose();
 }
});
