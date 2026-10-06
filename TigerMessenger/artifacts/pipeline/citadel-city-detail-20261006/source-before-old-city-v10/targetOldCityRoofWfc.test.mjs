import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
import {TARGET_OLD_CITY_HOUSE_IDS,TARGET_OLD_CITY_ROOF_ROLES,solveTargetOldCityRoofWfc,inspectTargetOldCityRoofWfc,targetOldCityRoofCompatible,targetOldCityRoofRequirements} from '../../src/world/citadel/targetOldCityRoofWfc.js';
const asset=createTargetOldCity({seed:20261005}),report=structuredClone(asset.report);asset.dispose();
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const hasEdge=(edges,a,b)=>edges.some(e=>e.a===a&&e.b===b||e.a===b&&e.b===a);

test('actual 15 plots yield geometric same-street and slope neighbors, not all-to-all adjacency',()=>{
 const r=inspectTargetOldCityRoofWfc({report});assert.equal(r.ok,true);assert.equal(r.cells.length,15);assert.equal(r.edges.length,30);assert.equal(r.edges.filter(e=>e.kind==='street').length,9);assert.equal(r.edges.filter(e=>e.kind==='slope').length,21);
 assert.ok(hasEdge(r.edges,'house-0--1-0','house-1--1-0'));assert.equal(hasEdge(r.edges,'house-0--1-0','house-2--1-0'),false);assert.equal(hasEdge(r.edges,'house-0--1-0','house-0-1-0'),false);
 for(const e of r.edges){assert.equal(e.source,'actual-footprint-proximity');if(e.kind==='slope'){assert.ok(e.projectedOverlap[0]>.1);assert.ok(Math.abs(e.levelDelta-4)<1e-8);assert.ok(e.gap[1]<=6);}else{assert.ok(e.projectedOverlap[1]>1);assert.ok(e.levelDelta<.05);}}
 assert.equal(r.geometryBans.length,0,'all current authored plots can fit the five bounded variants');
});

test('hard roof observation propagates before collapse; double setbacks remain compatible',()=>{
 const id='house-0--1-0',r=inspectTargetOldCityRoofWfc({report,locks:{[id]:'outer-edge-short-tower'}});assert.equal(r.ok,true);
 const neighbors=r.edges.filter(e=>e.a===id||e.b===id).map(e=>e.a===id?e.b:e.a);for(const n of neighbors){const candidates=r.cells.find(c=>c.id===n).candidates.map(c=>c.variant);assert.equal(candidates.includes('outer-edge-short-tower'),false);assert.equal(candidates.includes('upper-street-cupola'),false);}assert.ok(r.stats.bans>0);
 const hip=inspectTargetOldCityRoofWfc({report,locks:{[id]:'hip-roof'}});for(const e of hip.edges.filter(e=>e.kind==='slope'&&(e.a===id||e.b===id)))assert.equal(hip.cells.find(c=>c.id===(e.a===id?e.b:e.a)).candidates.some(c=>c.variant==='hip-roof'),false);
 const paired=solveTargetOldCityRoofWfc({report,locks:{[id]:'setback-upper-room','house-1--1-0':'setback-upper-room'},seed:13});assert.equal(paired.ok,true);assert.equal(paired.assignments[id],'setback-upper-room');assert.equal(paired.assignments['house-1--1-0'],'setback-upper-room');
});

test('contradiction is atomic, retains lock identities, returns no partial solution and never falls back',()=>{
 const input=freeze({report:structuredClone(report),locks:{'house-0--1-0':'upper-street-cupola','house-0--1-1':'outer-edge-short-tower'},seed:42}),before=JSON.stringify(input),r=solveTargetOldCityRoofWfc(input);
 assert.equal(r.ok,false);assert.equal(r.reason,'unsatisfiable');assert.equal(r.assignments,null);assert.equal(r.roofRoles,null);assert.deepEqual(r.changeSet,[]);assert.equal(r.fallbackUsed,false);assert.ok(r.conflict);assert.equal(JSON.stringify(input),before);
 const pinBan=solveTargetOldCityRoofWfc({report,locks:{'house-0--1-0':'hip-roof'},domains:{'house-0--1-0':['setback-upper-room']}});assert.equal(pinBan.ok,false);assert.equal(pinBan.reason,'unsatisfiable');
});

test('fixed seed, stable IDs and input ordering reproduce exactly and successful solutions obey every active edge',()=>{
 const a=solveTargetOldCityRoofWfc({report,seed:123}),b=solveTargetOldCityRoofWfc({report:{...report,houses:report.houses.slice().reverse(),footprints:report.footprints.slice().reverse()},seed:123});assert.equal(a.ok,true);assert.deepEqual(a,b);assert.deepEqual(Object.keys(a.assignments),TARGET_OLD_CITY_HOUSE_IDS);
 for(const e of a.edges.filter(e=>e.active))assert.equal(targetOldCityRoofCompatible(a.assignments[e.a],a.assignments[e.b],e.kind),true);
 assert.ok(a.stats.observations>0&&a.stats.propagations>0);for(const c of a.changeSet){assert.equal(c.from,report.houses.find(h=>h.id===c.id).roofRole);assert.equal(c.to,a.assignments[c.id]);}
 assert.notEqual(solveTargetOldCityRoofWfc({report,seed:124}).solutionHash,a.solutionHash);
});

test('deletion removes active constraints but retains stable null slots and hidden geometry roles for saving',()=>{
 const id='house-0--1-0',r=solveTargetOldCityRoofWfc({report,occupied:{[id]:false},locks:{[id]:null},domains:{[id]:[]},seed:9});assert.equal(r.ok,true);assert.equal(r.assignments[id],null);assert.equal(r.occupied[id],false);assert.equal(r.roofRoles[id],report.houses.find(h=>h.id===id).roofRole);assert.equal(Object.keys(r.assignments).length,15);assert.ok(r.edges.filter(e=>e.a===id||e.b===id).every(e=>!e.active));assert.equal(r.changeSet.some(c=>c.id===id),false);
 assert.equal(solveTargetOldCityRoofWfc({report,occupied:{[id]:false},locks:{[id]:'hip-roof'}}).reason,'lock-occupancy-conflict');assert.equal(solveTargetOldCityRoofWfc({report,locks:{[id]:null}}).reason,'lock-occupancy-conflict');
 const all=solveTargetOldCityRoofWfc({report,occupied:Object.fromEntries(TARGET_OLD_CITY_HOUSE_IDS.map(id=>[id,false]))});assert.equal(all.ok,true);assert.equal(all.deletedIds.length,15);assert.ok(Object.values(all.assignments).every(v=>v===null));
});

test('real triangular plot constraints exercise shared-core finite backtracking, not relabeling',()=>{
 const keep=['house-0--1-0','house-0--1-1','house-1--1-1'],occupied=Object.fromEntries(TARGET_OLD_CITY_HOUSE_IDS.map(id=>[id,keep.includes(id)])),domains=Object.fromEntries(keep.map(id=>[id,['hip-roof','outer-edge-short-tower']]));
 const r=solveTargetOldCityRoofWfc({report,occupied,domains,seed:7,maxBacktrack:1});assert.equal(r.ok,true);assert.equal(r.stats.backtracks,1);assert.equal(r.assignments['house-0--1-0'],'hip-roof');assert.equal(r.assignments['house-0--1-1'],'hip-roof');assert.equal(r.assignments['house-1--1-1'],'outer-edge-short-tower');assert.equal(r.maxBacktrack,1);
});

test('undersized footprints ban unbuildable variants and an empty geometric domain fails explicitly',()=>{
 const input=structuredClone(report),id='house-0--1-0',fp=input.footprints.find(p=>p.id===id),centre=(fp.polygon[0][0]+fp.polygon[1][0])/2;fp.polygon=fp.polygon.map(p=>[p[0]<centre?centre-2.60:centre+2.60,p[1]]);
 const partial=inspectTargetOldCityRoofWfc({report:input});assert.equal(partial.ok,true);assert.ok(partial.geometryBans.some(b=>b.id===id&&b.role==='hip-roof'));assert.equal(partial.cells.find(c=>c.id===id).candidates.some(c=>c.variant==='hip-roof'),false);
 fp.polygon=fp.polygon.map(p=>[p[0]<centre?centre-1:centre+1,p[1]]);const none=solveTargetOldCityRoofWfc({report:input});assert.equal(none.ok,false);assert.equal(none.reason,'unsatisfiable');assert.equal(none.geometryBans.filter(b=>b.id===id).length,5);assert.equal(none.assignments,null);
});

test('invalid input and unknown IDs are rejected without changing factory or invoking a fallback',()=>{
 for(const opts of[{seed:-1},{seed:1.2},{maxBacktrack:0},{maxBacktrack:Infinity},{occupied:{tower:false}},{occupied:{'house-0--1-0':'false'}},{locks:{'house-0--1-0':'castle'}},{domains:{'house-0--1-0':['roof']}},{houses:report.houses.slice(1)}]){const r=solveTargetOldCityRoofWfc({report,...opts});assert.equal(r.ok,false);assert.equal(r.reason,'invalid-input');assert.deepEqual(r.changeSet,[]);}
 for(const roofRoles of[null,[],{'tower-shaft':'hip-roof'},{'house-0--1-0':'missing-role'}])assert.throws(()=>createTargetOldCity({roofRoles}),/roofRoles/);
});

test('all 75 ID-role combinations generate actual bounded roofs, preserve public geometry and match geometric domain dimensions',()=>{
 const reference=createTargetOldCity({seed:20261005});
 for(const role of TARGET_OLD_CITY_ROOF_ROLES){const roofRoles=Object.fromEntries(TARGET_OLD_CITY_HOUSE_IDS.map(id=>[id,role])),a=createTargetOldCity({seed:20261005,roofRoles});a.group.updateMatrixWorld(true);assert.deepEqual(a.report.entry,reference.report.entry);assert.deepEqual(a.report.exits,reference.report.exits);assert.deepEqual(a.report.stairs,reference.report.stairs);assert.equal(a.report.roofRoleSelection.solverRun,false);
  for(const h of a.report.houses){const group=a.group.getObjectByName(h.id),fp=a.report.footprints.find(f=>f.id===h.id),before=reference.report.footprints.find(f=>f.id===h.id),b=new THREE.Box3().setFromObject(group),req=targetOldCityRoofRequirements(role,h.volumes[0].w,h.authoredHeight,h.position[1]);assert.equal(h.roofRole,role);assert.deepEqual(fp.polygon,before.polygon);assert.ok(b.min.x>=Math.min(...fp.polygon.map(p=>p[0]))-1e-5&&b.max.x<=Math.max(...fp.polygon.map(p=>p[0]))+1e-5);assert.ok(b.min.z>=Math.min(...fp.polygon.map(p=>p[1]))-1e-5&&b.max.z<=Math.max(...fp.polygon.map(p=>p[1]))+1e-5);assert.ok(b.max.x-b.min.x<=req.width+1e-5&&b.max.z-b.min.z<=req.depth+1e-5);assert.ok(Math.abs(b.max.y-req.roofY)<1e-5);assert.ok(Math.abs(b.max.y-fp.roofY)<1e-5);assert.ok(fp.roofY<33);assert.equal(group.userData.targetEditableHouse.id,h.id);}
  a.dispose();
 }
 const result=solveTargetOldCityRoofWfc({report,seed:7}),built=createTargetOldCity({seed:report.seed,roofRoles:result.roofRoles});for(const h of built.report.houses)assert.equal(h.roofRole,result.assignments[h.id]);built.dispose();reference.dispose();
});

test('bounded backtracking exhaustion returns failure with no fallback or partial assignments',()=>{
 const keep=['house-0--1-0','house-0--1-1','house-1--1-1','house-0-1-0','house-0-1-1','house-1-1-1'],occupied=Object.fromEntries(TARGET_OLD_CITY_HOUSE_IDS.map(id=>[id,keep.includes(id)])),domains=Object.fromEntries(keep.map(id=>[id,['hip-roof','outer-edge-short-tower']])),options={report,occupied,domains,seed:21};
 const limited=solveTargetOldCityRoofWfc({...options,maxBacktrack:1});assert.equal(limited.ok,false);assert.equal(limited.reason,'max-backtrack');assert.equal(limited.stats.backtracks,1);assert.equal(limited.assignments,null);assert.deepEqual(limited.changeSet,[]);assert.equal(limited.fallbackUsed,false);
 const enough=solveTargetOldCityRoofWfc({...options,maxBacktrack:4});assert.equal(enough.ok,true);assert.ok(enough.stats.backtracks>1&&enough.stats.backtracks<=4);
});

test('default factory preserves r33 fixed plots, authored roof roles and protected routes without invoking WFC',async()=>{
 const fs=await import('node:fs'),before=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r33-roofs-shadow-forest-old-city-detail-plants-terrain.json',import.meta.url),'utf8')).cityDetail.oldCity.geometry,a=createTargetOldCity({seed:before.seed,palette:before.palette});
 for(const key of['footprints','walkable','entry','exits','stairs'])assert.deepEqual(a.report[key],before[key],key);
 for(let axis=0;axis<3;axis++){assert.ok(a.report.bounds.min[axis]>=before.bounds.min[axis]-1e-5);assert.ok(a.report.bounds.max[axis]<=before.bounds.max[axis]+1e-5);}assert.equal(a.report.bounds.max[1],before.bounds.max[1]);
 for(const h of a.report.houses){const old=before.houses.find(p=>p.id===h.id);for(const key of['id','position','height','colour','roofRole','roofY','terrace'])assert.deepEqual(h[key],old[key]);assert.ok(Number.isFinite(h.authoredHeight));}
 // Body/facade refinement is explicitly allowed in v7. Its real openings,
 // smaller window rhythm and bounds are checked in targetOldCity.test.mjs.
 assert.equal(a.report.roofRoleSelection.solverRun,false);assert.deepEqual(a.report.roofRoleSelection.overrides,{});a.dispose();
});
