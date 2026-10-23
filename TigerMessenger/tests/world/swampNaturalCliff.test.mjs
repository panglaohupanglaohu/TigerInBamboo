import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?gregNaturalCliff=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampNaturalCliff,createSwampCliffSampler}=await import('../../src/world/swampNaturalCliff.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');
const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner;
const wall=inner.getObjectByName('swamp-sinkhole-wall'),wallBefore=wall.geometry.attributes.position.array.slice();
const rim=inner.userData.gregCoralRim,route=structuredClone(inner.userData.gregSpatialPlan.route),story=[];
inner.traverse(o=>{if(o.name.includes('monkey')||o.name.includes('whale')||o.name.includes('tiger')||o.name==='world-tree-trunk'||o===inner.userData.shipyard?.barge||o===inner.userData.shipyard?.dock)story.push({o,position:o.position.toArray(),scale:o.scale.toArray(),visible:o.visible});});
const hiddenBefore=['v2-bank-rock-shelves','v2-bank-ferns','greg-swamp-rooted-ecology'].map(name=>inner.getObjectByName(name)).filter(Boolean).map(o=>({o,visible:o.visible}));
const report=installSwampNaturalCliff(inner,{enabled:true});

test('natural pockets embed in actual clipped wall and taper back into it',()=>{
 assert.ok(report.ok,JSON.stringify(report));assert.ok(report.pockets.length>=8,`accepted ${report.pockets.length}: ${JSON.stringify(report.rejected)}`);
 const wallAt=createSwampCliffSampler(inner);
 for(const p of report.pockets){
  assert.ok(p.top.length>=9);assert.ok(p.backSamples.length>0);
  assert.ok(p.height>=2.1,'shoulders extend diagonally into the cliff instead of ending in a short planter bottom');
  const span=points=>Math.max(...points.map(v=>Math.atan2(v[2],v[0])))-Math.min(...points.map(v=>Math.atan2(v[2],v[0])));
  assert.ok(span(p.bottom)>span(p.top)*1.4,'lower seam spreads along wall instead of tapering to a hanging pot');
  for(const sample of p.backSamples)assert.ok(Math.hypot(sample.point[0],sample.point[2])>Math.hypot(sample.wall[0],sample.wall[2]));
  for(const v of p.bottom){const hit=wallAt(Math.atan2(v[2],v[0]),v[1]);assert.ok(hit);assert.ok(Math.abs(Math.hypot(v[0],v[2])-Math.hypot(hit.x,hit.z)-.16)<1e-6);}
  assert.ok(p.frontSamples.every(s=>s.depth<2.3),'rock remains near wall');
 }
 assert.deepEqual(wall.geometry.attributes.position.array,wallBefore,'main bowl and its upper seam stay exact');assert.equal(inner.userData.gregCoralRim,rim);
});

test('soil plants root on real pocket caps; root seams stay against the wall',()=>{
 inner.updateWorldMatrix(true,true);const rock=report.root.getObjectByName('greg-natural-cliff-rock');
 for(const plant of report.plants){
  const origin=inner.localToWorld(new T.Vector3(...plant.position).add(new T.Vector3(0,.4,0))),down=new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld),hit=new T.Raycaster(origin,down).intersectObject(rock,false)[0];
  assert.ok(hit);assert.ok(Math.abs(inner.worldToLocal(hit.point).y-plant.position[1])<.03);
 }
 assert.ok(report.vines.length>=2);
 const wallAt=createSwampCliffSampler(inner),rockAt=createSwampCliffSampler(inner,rock);
 for(const vine of report.vines)for(let i=1;i<vine.points.length;i++)for(const t of [0,.5,1]){
  const point=new T.Vector3(...vine.points[i-1]).lerp(new T.Vector3(...vine.points[i]),t),a=Math.atan2(point.z,point.x),candidates=[wallAt(a,point.y),rockAt(a,point.y)].filter(Boolean);assert.ok(candidates.length);assert.ok(Math.min(...candidates.map(hit=>point.distanceTo(hit)))<.12,`root ${vine.group}:${i}:${t} at ${point.toArray()} has gaps ${candidates.map(hit=>point.distanceTo(hit))}`);
 }
});

test('large continuous erosion bands meet the rim seam; fissure plants attach to rendered stone',()=>{
 assert.equal(report.version,8);assert.equal(report.rockBands.length,6);assert.ok(report.strata.length>=12&&report.strata.length<=18);for(const band of report.rockBands)assert.ok(report.strata.filter(s=>s.band===band.id).length>=2,'sparse irregular bedding remains on every band');assert.ok(report.fissurePlants.length>35);assert.ok(Math.max(...report.fissurePlants.map(p=>p.size))/Math.min(...report.fissurePlants.map(p=>p.size))>2);
 const sampler=createSwampCliffSampler(inner,report.root.getObjectByName('greg-natural-cliff-rock')),wallSampler=createSwampCliffSampler(inner);
 for(const band of report.rockBands){
  assert.ok(40-band.bottom>10);assert.ok(band.triangles>150);
  for(const sample of band.vertices.filter(v=>v.point[1]===40))assert.ok(new T.Vector3(...sample.point).distanceTo(new T.Vector3(...sample.surface))<1e-6,'top remains flush with real rim edge');
 }
 const constraints=createSwampLivingPathConstraints(inner);
 for(const plant of report.fissurePlants){
  const p=new T.Vector3(...plant.position),a=Math.atan2(p.z,p.x),candidates=[sampler(a,p.y),wallSampler(a,p.y)].filter(Boolean);assert.ok(candidates.length);assert.ok(Math.min(...candidates.map(hit=>p.distanceTo(hit)))<.04);assert.ok(constraints.inspectPlant(plant.clearance).allowed);
 }
});

test('protected paths, story worksite, original tree and swimming domain remain unchanged',()=>{
 const constraints=createSwampLivingPathConstraints(inner);
 for(const p of report.pockets)assert.ok(constraints.inspectPlant(p.clearance).allowed);
 for(const plant of report.plants)assert.ok(constraints.inspectPlant(plant).allowed,JSON.stringify(plant));
 assert.deepEqual(inner.userData.gregSpatialPlan.route,route);assert.equal(report.walkMeshes.length,0,'new decorative soil must not steal player ground');
 for(const snapshot of story){assert.deepEqual(snapshot.o.position.toArray(),snapshot.position);assert.deepEqual(snapshot.o.scale.toArray(),snapshot.scale);assert.equal(snapshot.o.visible,snapshot.visible);}
 for(const mesh of report.root.children){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(p.getY(i)>25.1,'new wall growth cannot enter water');}
 assert.equal(report.drawCalls,3);assert.equal(report.root.children.length,3);
 assert.deepEqual(report.hidden.map(x=>x.object.name).sort(),hiddenBefore.map(x=>x.o.name).sort());assert.ok(report.hidden.every(x=>!x.object.visible));
});

test('spherical placement preserves attachment and dispose exactly restores old visuals',()=>{
 placeMoebiusSwampOnSphere(placement,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);
 const wallAt=createSwampCliffSampler(inner);
 for(const p of report.pockets){const hit=wallAt(p.angle,p.y);assert.ok(hit);assert.ok(Math.abs(Math.hypot(hit.x,hit.z)-Math.hypot(p.centre[0],p.centre[2])-p.depth*.38)<1e-5);}
 let disposed=0;for(const mesh of report.root.children)for(const resource of [mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposed++);
 assert.equal(installSwampNaturalCliff(inner,{enabled:true}),report);report.dispose();report.dispose();assert.equal(disposed,6);assert.equal(report.root.parent,null);assert.equal(inner.userData.gregNaturalCliff,undefined);
 for(const prior of hiddenBefore)assert.equal(prior.o.visible,prior.visible);
 const again=installSwampNaturalCliff(inner,{enabled:true});assert.ok(again.ok);assert.equal(again.pockets.length,report.pockets.length);again.dispose();
});
