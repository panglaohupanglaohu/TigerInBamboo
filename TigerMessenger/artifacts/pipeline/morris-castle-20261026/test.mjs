import assert from 'node:assert/strict';
import * as T from 'three';
import {createMorrisCastle} from '../../../src/world/morrisCastle.js';
const parent=new T.Group(),position=new T.Vector3(14,10.5,5),a=createMorrisCastle({root:parent,position}),checks=[];
const check=(n,f)=>{f();checks.push(n);};
check('root uses supplied original castle seat',()=>assert.ok(a.castle.position.equals(position)));
check('finite real geometry',()=>a.castle.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}));
check('compact original plateau footprint',()=>{const s=a.bounds.getSize(new T.Vector3());assert.ok(s.x<=14.01&&s.z<=10.01);});
check('three distinct massing heights',()=>assert.deepEqual(a.report.mainHeights,[10.5,7,5.5]));
check('gate central passage is a real geometric void',()=>{
 const meshes=[];a.castle.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const x of[-1,0,1])for(const y of[.5,1.5,2.1]){
  const ray=new T.Raycaster(position.clone().add(new T.Vector3(x,y,6)),new T.Vector3(0,0,-1),0,3.5);
  assert.equal(ray.intersectObjects(meshes,false).length,0);
 }
});
check('courtyard actual floor supports entrance approach',()=>{
 const ray=new T.Raycaster(position.clone().add(new T.Vector3(0,5,2)),new T.Vector3(0,-1,0));assert.ok(ray.intersectObjects(a.supports).length>0);
});
check('east exit remains open to music court',()=>{
 const ray=new T.Raycaster(position.clone().add(new T.Vector3(0,1.5,3.2)),new T.Vector3(1,0,0),0,10);assert.equal(ray.intersectObjects(a.castle.children,false).length,0);
});
check('physical stone relief, thick window surrounds, layered roof tiles and footings',()=>{
 assert.ok(a.report.detailCounts.masonry>300);assert.ok(a.report.detailCounts.windowSurrounds>=40);assert.ok(a.report.detailCounts.roofTiles>700);assert.ok(a.report.detailCounts.footings>=12);
});
check('static details share finite material batches rather than one draw per stone',()=>{
 const batches=a.castle.children.filter(x=>x.name==='castle-static-detail-batch');assert.equal(batches.length,a.report.detailBatches);assert.ok(batches.length<=14);
 assert.ok(batches.every(x=>x.geometry.attributes.position.count>100));
});
check('gate stays clear at its exact jamb boundary',()=>{
 const objects=a.castle.children.filter(x=>x.isMesh);for(const x of[-1.295,1.295]){
 const ray=new T.Raycaster(position.clone().add(new T.Vector3(x,1.4,6)),new T.Vector3(0,0,-1),0,3);assert.equal(ray.intersectObjects(objects,false).length,0);
 }
});
console.log(JSON.stringify({passed:checks.length,checks,report:a.report},null,2));
