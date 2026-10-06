import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTargetBridgeStairConnector} from '../../src/world/citadel/targetBridgeStairConnector.js';
import {createTargetNewCityStairRoute} from '../../src/world/citadel/targetNewCityStairRoute.js';
const fixture=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r26-wide-arches-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail.newCityStairs.surveyed;

test('actual surveyed side connector trims all tread overlap and preserves descending tread heights',()=>{
 const before=JSON.stringify(fixture.selected.treads),c=createTargetBridgeStairConnector({stairReport:fixture});
 assert.equal(JSON.stringify(fixture.selected.treads),before);assert.deepEqual(c.report.joinTreadIndices,[12,13,14,15,16,17]);assert.ok(c.report.stairOverlapAreaRemaining<1e-7);assert.ok(c.report.seamPoints.length>0);
 for(const s of c.report.seamPoints)assert.equal(s.point[1],Math.max(...s.treadIndices.map(i=>fixture.selected.treads[i].top)));
 assert.equal(c.report.support.validated,false);assert.ok(c.report.walkSurfaces.length>0);assert.ok(c.report.nominalSlope<.04);
 c.group.traverse(m=>{if(m.geometry)for(const n of m.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});c.dispose();
});

test('read-only ground sampling distinguishes missing ground and real terrain penetration',()=>{
 let calls=0;const c=createTargetBridgeStairConnector({stairReport:fixture,groundHeightAt:()=>{calls++;return 10;}});assert.ok(c.report.support.validated);assert.equal(calls,c.report.support.uniqueSamples);c.dispose();
 const missing=createTargetBridgeStairConnector({stairReport:fixture,groundHeightAt:()=>null});assert.equal(missing.report.support.validated,false);assert.ok(missing.report.support.missingCount>0);missing.dispose();
 const blocked=createTargetBridgeStairConnector({stairReport:fixture,groundHeightAt:()=>20});assert.equal(blocked.report.support.validated,false);assert.ok(blocked.report.support.penetrationSamples.length>0);blocked.dispose();
});

test('side openings remove intersecting parapets and can be restored without mutating treads',()=>{
 const stair=createTargetNewCityStairRoute({sampleSurface:()=>0,start:[0,2,0],end:[0,0,12],width:4.4,waypointRoutes:[[]]});
 const initial=stair.report.parapets.instances,before=JSON.stringify(stair.report.selected.treads),open=[[1.8,3],[3,3],[3,6],[1.8,6]];
 const changed=stair.setSideOpeningFootprints([open]);assert.ok(changed.instances<initial);assert.ok(changed.omittedSegments.every(s=>s.side===1));assert.equal(JSON.stringify(stair.report.selected.treads),before);
 stair.setSideOpeningFootprints([]);assert.equal(stair.report.parapets.instances,initial);stair.dispose();assert.throws(()=>stair.setSideOpeningFootprints([]),/disposed/);
});

test('connector resources dispose exactly once and invalid contracts fail',()=>{
 assert.throws(()=>createTargetBridgeStairConnector({}),/sampled stair/);
 assert.throws(()=>createTargetBridgeStairConnector({stairReport:fixture,width:0}),/dimensions/);
 assert.throws(()=>createTargetBridgeStairConnector({stairReport:fixture,groundHeightAt:()=>NaN}),/finite Y/);
 const c=createTargetBridgeStairConnector({stairReport:fixture});let geometries=0,materials=0;const gs=new Set(),ms=new Set();c.group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.addEventListener('dispose',()=>geometries++));ms.forEach(m=>m.addEventListener('dispose',()=>materials++));c.dispose();c.dispose();assert.equal(geometries,gs.size);assert.equal(materials,ms.size);assert.equal(c.group.children.length,0);
});

test('actual seam triangles have bounded slope and thin rails preserve full corridor width',()=>{
 const c=createTargetBridgeStairConnector({stairReport:fixture});assert.ok(c.report.maximumTriangleSlope<.25);assert.ok(c.report.maximumTriangleSlope>c.report.nominalSlope);assert.ok(c.report.railSegments.length>0);
 const [a,b]=[c.report.dock,c.report.endpoint],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);
 for(const r of c.report.railSegments)for(const p of[r.from,r.to]){const across=((p[0]-a[0])*-dz+(p[2]-a[2])*dx)/len;assert.ok(Math.abs(across)>=1.29);assert.ok(r.outwardExtent<.15);}
 c.dispose();
});
