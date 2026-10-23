import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampCoralRim} from '../../src/world/swampCoralRim.js';
import {createSwampGroundSampler} from '../../src/world/swampGround.js';

const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?gregLakeRim=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
const original=[inner.userData.tiger,...inner.userData.towerTrees,inner.userData.shipyard.dock,inner.userData.shipyard.escort].map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),update:n.userData.update}));
const wall=inner.getObjectByName('swamp-sinkhole-wall'),wallGeo=wall.geometry,wallPos=wall.geometry.attributes.position.array.slice();
const report=installSwampCoralRim(inner,{enabled:true}),ray=new T.Raycaster();
const wrappedDelta=a=>Math.abs(Math.atan2(Math.sin(a-.5),Math.cos(a-.5)));
const localHit=(a,r,y=43)=>{
  inner.updateWorldMatrix(true,true);
  const origin=inner.localToWorld(new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));
  ray.set(origin,new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld));ray.far=10;
  return ray.intersectObjects(report.walkMeshes,false);
};

test('actual rendered wall crown produces one closed-thickness coral rim without moving actors',()=>{
  assert.equal(report.ok,true);assert.equal(report.topY,40);assert.equal(report.renderMeshes,1);assert.ok(report.wallCrownEdges>=40);
  assert.equal(report.triangles,1540);assert.equal(installSwampCoralRim(inner,{enabled:true}),report);
  assert.equal(wall.geometry,wallGeo);assert.deepEqual(wall.geometry.attributes.position.array,wallPos);
  for(const {n,p,q,update}of original){assert.ok(n.position.equals(p));assert.ok(n.quaternion.equals(q));assert.equal(n.userData.update,update);}
  const mesh=report.walkMeshes[0];assert.ok(mesh.geometry.boundingBox.min.y>=37.54);assert.ok(mesh.geometry.boundingBox.max.y<=40.001);
  assert.ok(mesh.geometry.boundingSphere.radius<49)// 2026-10-09 walkway widened ×2 (SWAMP_RIM_OUTER_MAX≈46.8);assert.equal(mesh.material.vertexColors,true);
});

test('720-angle patrol samples and lateral footprints have real upward rim support outside the stair opening',()=>{
  let samples=0;
  for(let i=0;i<720;i++){
    const a=i*Math.PI/360;if(wrappedDelta(a)<report.entranceHalfAngle+.02)continue;
    for(const r of [36.85,37.4,37.95]){
      const hit=localHit(a,r).find(h=>h.face.normal.y>.99);assert.ok(hit,`no top at ${a},${r}`);
      assert.ok(Math.abs(inner.worldToLocal(hit.point.clone()).y-40)<1e-4);samples++;
    }
  }
  assert.ok(samples>1900);
});

test('entrance slot and entire lake interior remain free of new rim triangles',()=>{
  for(let r=15;r<=42;r+=.25)assert.equal(localHit(.5,r).length,0,`entrance filled at ${r}`);
  for(let i=0;i<72;i++)for(const r of [0,15,25,30])assert.equal(localHit(i*Math.PI/36,r).length,0,`lake filled at ${r}`);
});

test('rim support remains at the correct radius after actual spherical placement and radial sampling',()=>{
  placeMoebiusSwampOnSphere(wrapper,new T.Vector3(.3,.8,.5).normalize(),160,.5,-15.8);wrapper.updateMatrixWorld(true);
  const sample=createSwampGroundSampler(inner,report.walkMeshes);
  for(let i=0;i<120;i++){
    const a=i*Math.PI/60;if(wrappedDelta(a)<report.entranceHalfAngle+.04)continue;
    const world=inner.localToWorld(new T.Vector3(Math.cos(a)*37.4,40,Math.sin(a)*37.4));
    const radius=sample(world.clone().setLength(world.length()+.1));
    assert.ok(radius!==null&&Math.abs(radius-world.length())<1e-4,`sphere support ${a}`);
  }
});

test('toggle, invalid input and dispose do not leave geometry or alter caller footing registrations',()=>{
  const empty=new T.Group();assert.equal(installSwampCoralRim(empty,{enabled:false}),null);assert.equal(empty.children.length,0);
  assert.equal(installSwampCoralRim(empty,{enabled:true}).ok,false);assert.equal(empty.children.length,0);
  const surfaces=inner.userData.tigerWalkSurfaces.slice();report.dispose();report.dispose();
  assert.equal(inner.getObjectByName('greg-coral-rim-rock-batch'),undefined);assert.equal(inner.userData.gregCoralRim,undefined);
  assert.deepEqual(inner.userData.tigerWalkSurfaces,surfaces);
  assert.equal(installSwampCoralRim(inner,{enabled:true,entranceWidth:0}).ok,false);
  assert.equal(inner.getObjectByName('greg-coral-rim-rock-batch'),undefined);
});
