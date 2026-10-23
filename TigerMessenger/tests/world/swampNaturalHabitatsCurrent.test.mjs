import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:'?gregUnderstory=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},location,localStorage};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');
const current=await import('../../src/world/swampCoralUnderstory.js');
const beforeURL=new URL('../../artifacts/pipeline/greg-nine-resume-20261011/source-before/natural-habitats/swampCoralUnderstory.js',import.meta.url);
const text=fs.readFileSync(beforeURL,'utf8').replace("from 'three'",`from '${import.meta.resolve('three')}'`).replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,new URL('../../src/world/',import.meta.url)).href}'`);
const before=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner;
const prior=before.installSwampCoralUnderstory(inner,{enabled:true}),counts={...prior.counts},draws=prior.drawCalls,route=structuredClone(inner.userData.gregSpatialPlan.route);
const priorPositions=prior.records.map(r=>r.position.slice());prior.dispose();
const after=current.installSwampCoralUnderstory(inner,{enabled:true});
test('current scene keeps exact accepted species counts, route, draw budget, and actual cliff attachments',()=>{
 assert.deepEqual(after.counts,counts);assert.equal(after.drawCalls,draws);assert.deepEqual(inner.userData.gregSpatialPlan.route,route);
 const constraints=createSwampLivingPathConstraints(inner);for(const r of after.records){assert.ok(constraints.inspectPlant(r.envelope).allowed);if(r.source==='cliff')assert.ok(new T.Vector3(...r.position).distanceTo(new T.Vector3(...r.surface))<.03);}
 assert.ok(after.habitatRelocations.length>180,'most wall plants have accepted new natural catchment locations');
 let changed=0;after.records.forEach((r,i)=>{if(new T.Vector3(...r.position).distanceTo(new T.Vector3(...priorPositions[i]))>.1)changed++;});assert.equal(changed,after.habitatRelocations.length);
});
test('unequal wall intervals form overlapping dense patches separated by genuine bare rock windows',()=>{
 let patches=0;for(const colony of after.colonies){const heights=colony.records.map(r=>r.position[1]).sort((a,b)=>a-b),gaps=heights.slice(1).map((y,i)=>y-heights[i]);if(Math.max(...gaps)>3*Math.min(...gaps.filter(g=>g>.01)))patches++;}
 assert.ok(patches>=15,`nonuniform wall habitats ${patches}/18`);assert.ok(after.rimAngularCoverage>.25&&after.rimAngularCoverage<.65,'rim foliage retains real gaps');
 const mesh=after.root.getObjectByName('greg-understory-rim-rocks'),c=mesh.geometry.attributes.color;let warm=0,cool=0;
 for(let i=0;i<c.count;i++){if(c.getX(i)>c.getZ(i)*1.2)warm++;if(c.getZ(i)>c.getX(i))cool++;}
 assert.ok(warm>8&&cool>8,'actual low rocks expose warm coral planes and cool shadow planes');
 console.log(JSON.stringify({counts,relocations:after.habitatRelocations.length,wallPatches:patches,draws,rockWarmVertices:warm,rockCoolVertices:cool}));
});
test('current actual cliff caps and broad rim carry coral colour while rock sides remain cool, without moving walking surfaces',()=>{
 const rock=inner.getObjectByName('greg-natural-cliff-rock'),pc=rock.geometry.attributes.color;let warm=0,cool=0;
 for(let i=0;i<pc.count;i++){if(pc.getX(i)>pc.getZ(i)*1.25)warm++;if(pc.getZ(i)>pc.getX(i))cool++;}
 assert.ok(warm>100&&cool>100,`actual cliff coral/shadow vertices ${warm}/${cool}`);
 const rim=inner.userData.gregCoralRim;assert.ok(rim.ok);assert.equal(rim.topColourVersion,3);
 const mesh=rim.walkMeshes[0],p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;let top=0,coral=0;
 for(let i=0;i<p.count;i+=3)if([0,1,2].every(k=>Math.abs(p.getY(i+k)-40)<1e-4))for(const k of [0,1,2]){top++;if(c.getX(i+k)>c.getZ(i+k)*1.2)coral++;}
 assert.ok(coral/top>.8,'coral stone spreads across actual crown instead of only a narrow lip');
 assert.equal(rim.topY,40);assert.deepEqual(inner.userData.gregSpatialPlan.route,route);
 console.log(JSON.stringify({cliffWarmVertices:warm,cliffCoolVertices:cool,rimCoralFraction:coral/top}));
});
test('non-rim leaf scale variation is deterministic, anchored, and never expands accepted envelopes',()=>{
 assert.ok(after.scaleVariation.length>300,'existing wall, shoulder and trunk plants vary without adding plants');
 const factors=after.scaleVariation.map(r=>r.factor);assert.ok(Math.min(...factors)<.70&&Math.max(...factors)>.97,'small sheltered leaves and existing full-size accents');
 for(const r of after.scaleVariation){assert.ok(r.factor<=1&&r.width<=1&&r.height<=1);assert.notEqual(r.source,'rim');}
 const signature=r=>r.records.map(x=>({type:x.type,position:x.position,scale:x.scale,matrix:x.matrix.toArray()}));
 const saved=signature(after);after.dispose();const again=current.installSwampCoralUnderstory(inner,{enabled:true});
 assert.deepEqual(signature(again),saved,'same authored scene rebuilds the exact leaf transforms');assert.deepEqual(again.counts,counts);assert.equal(again.drawCalls,5);
 console.log(JSON.stringify({varied:again.scaleVariation.length,factorRange:[Math.min(...factors),Math.max(...factors)],counts:again.counts}));
});
