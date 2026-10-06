import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetCityBayBridge} from '../../src/world/citadel/targetCityBayBridge.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} vs ${b}`);
const fixture={path:[[0,10,0],[24,9,0]],groundHeightAt:()=>-5,oceanHeightAt:()=>0};

test('bridge has real traversable arch voids, supported piers and a solid continuous deck',()=>{
 const b=createTargetCityBayBridge(fixture);b.group.updateMatrixWorld(true);
 assert.equal(b.report.spans.length,2);assert.equal(b.report.supportSampledPass,true);assert.equal(b.report.navigationSampledPass,true);
 for(const span of b.report.spans){
   const x=(span.from[0]+span.to[0])/2;
   const ray=new THREE.Raycaster(new THREE.Vector3(x,3,8),new THREE.Vector3(0,0,-1),0,16);
   assert.equal(ray.intersectObject(b.group,true).length,0,'boat opening has no hidden solid slab');
   const ceiling=new THREE.Raycaster(new THREE.Vector3(x,2,0),new THREE.Vector3(0,1,0),0,12).intersectObject(b.group,true);
   assert.ok(ceiling.length);near(ceiling[0].point.y,span.crownY,2e-4);
 }
 const pier=new THREE.Raycaster(new THREE.Vector3(12,3,8),new THREE.Vector3(0,0,-1),0,16);assert.ok(pier.intersectObject(b.group,true).some(h=>h.object.name.startsWith('bay-bridge-pier-')));
 for(let x=.1;x<24;x+=.37)for(const z of[-1.8,0,1.8]){
   const hits=new THREE.Raycaster(new THREE.Vector3(x,13,z),new THREE.Vector3(0,-1,0),0,6).intersectObject(b.group,true);assert.ok(hits.length);assert.match(hits[0].object.name,/walking-deck/);near(hits[0].point.y,10-x/24);
 }
 for(const p of b.report.piers){near(p.footingY,-5.15);assert.equal(p.groundSamples.length,5);}
 b.dispose();
});

test('polyline joints and smooth curves keep endpoints and shared walkable sections',()=>{
 for(const curve of['polyline','catmull-rom']){
  const path=[[0,12,0],[10,11.5,4],[24,11,9]],b=createTargetCityBayBridge({...fixture,path,curve});
  assert.deepEqual(b.report.endpoints.oldCity,path[0]);assert.deepEqual(b.report.endpoints.newCity,path.at(-1));
  for(let i=1;i<b.report.walkSurfaces.length;i++){
   const prev=b.report.walkSurfaces[i-1].corners,next=b.report.walkSurfaces[i].corners;assert.deepEqual(prev[1],next[0]);assert.deepEqual(prev[2],next[3]);
  }
  b.group.updateMatrixWorld(true);
  for(const w of b.report.walkSurfaces){const x=(w.from[0]+w.to[0])/2,y=(w.from[1]+w.to[1])/2,z=(w.from[2]+w.to[2])/2,hits=new THREE.Raycaster(new THREE.Vector3(x,y+3,z),new THREE.Vector3(0,-1,0),0,4).intersectObject(b.group,true);assert.ok(hits.length);near(hits[0].point.y,y);}
  b.dispose();
 }
});

test('missing or blocked sea/ground is unaccepted instead of guessed support/navigation',()=>{
 const b=createTargetCityBayBridge({path:fixture.path});assert.equal(b.report.supportSampledPass,false);assert.equal(b.report.navigationSampledPass,false);assert.ok(b.report.piers.every(p=>p.footingY===null));assert.ok(b.report.spans.every(p=>p.navigationSampledPass===null));b.dispose();
 const blocked=createTargetCityBayBridge({...fixture,groundHeightAt:()=>-.1});assert.equal(blocked.report.navigationSampledPass,false);blocked.dispose();
 assert.throws(()=>createTargetCityBayBridge({path:[[0,1,0],[0,2,0]]}),/zero/);
 assert.throws(()=>createTargetCityBayBridge({width:0}),/positive/);
 assert.throws(()=>createTargetCityBayBridge({...fixture,oceanHeightAt:()=>NaN}),/finite/);
});

test('default bridge batches ornament, stays finite and releases owned assets exactly once',()=>{
 const b=createTargetCityBayBridge();assert.ok(b.report.performance.meshes<60);assert.ok(b.report.performance.triangles<15000);
 const gs=new Set(),ms=new Set();b.group.traverse(m=>{if(m.isMesh){gs.add(m.geometry);ms.add(m.material);for(const attr of Object.values(m.geometry.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n));assert.equal(m.userData.preserveCitadelMaterials,true);}});
 const host=new THREE.Group(),other=new THREE.Group();host.add(b.group,other);let g=0,m=0;for(const o of gs)o.addEventListener('dispose',()=>g++);for(const o of ms)o.addEventListener('dispose',()=>m++);
 b.dispose();b.dispose();assert.equal(g,gs.size);assert.equal(m,ms.size);assert.deepEqual(host.children,[other]);
});

test('r25 shore abutment may embed the deck underside while its walking top stays clear',()=>{
 // r25 actual pier 0: deck=17.3, maximum sampled ground=16.829331069311362.
 // Previously the underside - .25 test misclassified this ground as a blocker.
 const path=[[-32.23116164579317,17.3,3.7674098192195498],[-10,16,24],[23,14.8,33],[68.51168130326376,13.2,36.84296212355201]];
 const b=createTargetCityBayBridge({path,groundHeightAt:(x,z)=>Math.hypot(x-path[0][0],z-path[0][2])<3?16.829331069311362:-12,oceanHeightAt:()=>-10});
 assert.equal(b.report.spans.length,10);const first=b.report.piers[0];
 assert.equal(first.groundObstructsDeck,false);assert.equal(first.supportSampledPass,true);near(first.walkingTopY,17.3);
 assert.ok(first.deckClearanceSamples.length>=6);assert.ok(first.deckClearanceSamples.every(p=>p.intrusion===0));b.dispose();
 const embedded=createTargetCityBayBridge({path:[[0,17.3,0],[12,17.3,0]],groundHeightAt:()=>17.1,oceanHeightAt:()=>0});
 assert.equal(embedded.report.supportSampledPass,true,'terrain inside slab thickness supports rather than obstructs the top');embedded.dispose();
});

test('ground above actual sloping deck top remains rejected even below a pier node level',()=>{
 const b=createTargetCityBayBridge({path:[[0,17.3,0],[12,16.1,0]],groundHeightAt:(x)=>x>.2&&x<1?17.28:-5,oceanHeightAt:()=>0});
 const first=b.report.piers[0];assert.equal(first.groundObstructsDeck,true);assert.equal(first.supportSampledPass,false);
 const blocked=first.deckClearanceSamples.filter(p=>p.intrusion>1e-5);assert.ok(blocked.length>0);
 assert.ok(blocked.every(p=>p.groundY<first.walkingTopY&&p.groundY>p.walkingTopY),'must compare with the sampled slope, not just 17.3 node');b.dispose();
 const above=createTargetCityBayBridge({path:[[0,17.3,0],[12,17.3,0]],groundHeightAt:()=>17.301,oceanHeightAt:()=>0});
 assert.equal(above.report.supportSampledPass,false);assert.equal(above.report.piers[0].groundObstructsDeck,true);above.dispose();
});

test('side opening removes actual batched curb and rail geometry across full clear corridor',()=>{
 const path=[[0,10,0],[24,10,0]],opening=[[8,1.9],[11,1.9],[11,5],[8,5]],b=createTargetCityBayBridge({...fixture,path,sideOpeningFootprints:[opening]});
 assert.ok(b.report.sideOpenings.length>0);b.group.updateMatrixWorld(true);
 const ornaments=b.group.children.filter(m=>/batched-(curbs|handrails|rail-posts|post-caps)/.test(m.name));
 // Rays cross the side passage at foot, curb and handrail levels, and near both edges.
 for(const x of[8.01,8.2,9.5,10.8,10.99])for(const y of[10.05,10.15,10.65,11.03]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,y,1.9),new THREE.Vector3(0,0,1),0,2).intersectObjects(ornaments,false);assert.equal(hits.length,0,`${x},${y} remains blocked`);
 }
 const outside=new THREE.Raycaster(new THREE.Vector3(6,10.1,1.9),new THREE.Vector3(0,0,1),0,2).intersectObjects(ornaments,false);assert.ok(outside.length,'opening must preserve rail outside the gap');b.dispose();
});
