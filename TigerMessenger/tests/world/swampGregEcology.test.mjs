import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampGregEcology,GREG_ECOLOGY_SPECIES} from '../../src/world/swampGregEcology.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711});placeMoebiusSwampOnSphere(wrapper,new T.Vector3(-.4,-.8,-.3).normalize(),160,.5,-15.8);wrapper.updateMatrixWorld(true);
const swamp=wrapper.userData.inner;
const story=[swamp.userData.tiger,swamp.userData.shipyard?.dock,swamp.userData.shipyard?.barge].filter(Boolean).map(o=>[o,o.position.clone(),o.uuid]);
const report=installSwampGregEcology(swamp);

test('default factory admits three habitat-specific plants only on real dry support',()=>{
 assert.ok(report);assert.equal(report.renderMeshes,3);assert.ok(report.counts.every(n=>n>0&&n<=22));assert.equal(report.waterSurfaceInstances,0);
 const supports=[...swamp.userData.gregSpatialPlan.walkMeshes,swamp.getObjectByName('v2-bank-rock-shelves')],ray=new T.Raycaster();
 const up=new T.Vector3(0,1,0).transformDirection(swamp.matrixWorld);
 for(const record of report.records){
  const s=GREG_ECOLOGY_SPECIES[record.speciesIndex],p=new T.Vector3(...record.position);assert.ok(p.y>=s.minY&&p.y<s.maxY);assert.ok(record.waterClearanceLocal>.5);
  for(const d of [[0,0],[.17,0],[-.17,0],[0,.17],[0,-.17]]){
   const target=swamp.localToWorld(p.clone().add(new T.Vector3(d[0],0,d[1])));ray.set(target.clone().addScaledVector(up,.2),up.clone().negate());ray.far=.3;
   assert.ok(ray.intersectObjects(supports,false).some(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.9),'five actual root-footprint supports after spherical placement');
  }
 }
 assert.ok(report.records.length>=15);console.log('ecology counts',report.counts,'rejected',report.rejected);
});

test('plant crowns clear route and original tiger/ship anchors do not move',()=>{
 for(const record of report.records)assert.ok(record.pathDistanceLocal-record.radiusLocal>=2.15);
 for(const [o,p,id]of story){assert.equal(o.uuid,id);assert.ok(o.position.equals(p));}
 assert.equal(swamp.userData.tigerWalkSurfaces.length,8);
});

test('three instanced species carry rooted geometry at constrained world scale',()=>{
 for(const mesh of report.root.children){assert.ok(mesh.isInstancedMesh);assert.equal(mesh.userData.gregVisualRole,'ecology');assert.ok(mesh.geometry.boundingBox.min.y<0);assert.ok(mesh.geometry.boundingBox.max.y<1.7);}
 assert.ok(report.maxWorldHeight<.8);
});

test('repeat, toggle and dispose are reversible and do not accumulate geometry',()=>{
 const children=swamp.children.length;assert.equal(installSwampGregEcology(swamp),report);assert.equal(swamp.children.length,children);
 installSwampGregEcology(swamp,{enabled:false});assert.equal(report.root.visible,false);installSwampGregEcology(swamp);assert.equal(report.root.visible,true);
 const saved=report.records.map(r=>r.position);report.dispose();assert.equal(swamp.userData.gregEcology,undefined);assert.equal(swamp.children.length,children-1);
 assert.equal(installSwampGregEcology(swamp,{enabled:false}),null);const second=installSwampGregEcology(swamp);
 // Default construction now installs before the wrapper transform; reinstall
 // casts through that transform. IEEE rounding must not count as a moved root.
 assert.equal(second.records.length,saved.length);
 second.records.forEach((r,i)=>r.position.forEach((v,k)=>assert.ok(Math.abs(v-saved[i][k])<1e-8)));
});


test('missing rock shelves fail closed instead of planting on invisible theoretical terrain',()=>{
 const existing=swamp.userData.gregEcology;existing.dispose();
 const shelf=swamp.getObjectByName('v2-bank-rock-shelves');shelf.removeFromParent();
 const empty=installSwampGregEcology(swamp);assert.equal(empty.records.length,0);assert.equal(empty.renderMeshes,0);empty.dispose();swamp.add(shelf);
 installSwampGregEcology(swamp);
});

test('all actual plant envelopes pass independent living-path audit',async()=>{
 const {auditSwampLivingPlants}=await import('../../src/world/swampGregLivingPaths.js');
 const audit=auditSwampLivingPlants(swamp,swamp.userData.gregEcology.records);assert.equal(audit.passed,true);assert.equal(audit.checked,66);assert.equal(audit.clearWidthWorld,2);
});

test('spherical placement does not change deterministic habitat choices',()=>{
 const old=swamp.userData.gregEcology,keys=r=>r.records.map(x=>[x.species,...x.position.map(v=>+v.toFixed(4))]);
 const expected=keys(old);old.dispose();
 wrapper.position.applyAxisAngle(new T.Vector3(1,2,3).normalize(),.9);wrapper.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,2,3).normalize(),.9));wrapper.updateMatrixWorld(true);
 const rotated=installSwampGregEcology(swamp);assert.deepEqual(keys(rotated),expected);
});
