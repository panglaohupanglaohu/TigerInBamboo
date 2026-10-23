import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?gregLakePerches=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampCoralPerches}=await import('../../src/world/swampCoralPerches.js');
const before=createMoebiusSwampPlacement({seed:7711,scale:.5}),after=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=after.userData.inner;
const monkeys=root=>{const all=[];root.traverse(o=>{if(o.userData.perches)all.push(o);});return all;};
const a=monkeys(inner),b=monkeys(before),snapshots=a.map(o=>o.userData.perches.map(p=>p.toArray())),references=a.map(o=>[...o.userData.perches]);
const report=installSwampCoralPerches(inner,{enabled:true});

test('ordinary monkey landing points are grounded near real trunks without replacing route objects',()=>{
 inner.updateWorldMatrix(true,true);
 assert.ok(report.ok);assert.equal(report.monkeyCount,3);assert.equal(report.records.length,snapshots.flat().length);assert.equal(report.drawCalls,2);
 for(const r of report.records){
  assert.ok(r.sourceTrunk.name==='world-tree-trunk'||r.sourceTrunk.userData.swampTreePart==='trunk');
  assert.ok(r.curve.getLength()<=6,'short natural branches must not become cross-bowl rails');
  assert.ok(Math.abs(new T.Vector3(...r.root).distanceTo(new T.Vector3(...r.surface))-.2)<1e-6);
  const surface=new T.Vector3(...r.surface),toward=surface.clone().sub(new T.Vector3(...r.root)).normalize(),outside=inner.localToWorld(surface.clone().addScaledVector(toward,1));
  const rootRay=new T.Raycaster(outside,toward.clone().negate().transformDirection(inner.matrixWorld)),rootHit=rootRay.intersectObject(r.sourceTrunk,false)[0];
  assert.ok(rootHit,'branch root must meet actual visible source trunk');assert.ok(inner.worldToLocal(rootHit.point).distanceTo(surface)<.02);
  const origin=inner.localToWorld(new T.Vector3(...r.point).add(new T.Vector3(0,.5,0))),down=new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld),hit=new T.Raycaster(origin,down).intersectObject(report.mesh,false)[0];
  assert.ok(hit);const hitY=inner.worldToLocal(hit.point).y;assert.ok(Math.abs(hitY-r.footTop)<.015,`perch ${a.indexOf(r.monkey)}:${r.index} top ${hitY} expected ${r.footTop}`);
 }
 for(let i=0;i<a.length;i++)for(let j=0;j<a[i].userData.perches.length;j++)assert.equal(a[i].userData.perches[j],references[i][j]);
 assert.ok(report.records.some(r=>r.displacement>0));assert.equal(report.mesh.material.color.getHexString(),'bd929e');
 assert.equal(inner.userData.shipyard.workers.some(o=>report.records.some(r=>r.monkey===o)),false);
});

test('ordinary leap centres clear new branches between original landing zones',()=>{
 const samples=report.records.flatMap(r=>Array.from({length:49},(_,i)=>r.curve.getPointAt(i/48)));
 for(const monkey of a){const u=monkey.userData;
  for(let i=0;i<u.perches.length;i++)for(let j=0;j<u.perches.length;j++){
   if(i===j)continue;
   const A=u.perches[i],B=u.perches[j];
   for(let k=4;k<57;k++){
    const t=k/60,p=A.clone().lerp(B,t);p.y+=Math.sin(t*Math.PI)*u.arc+.65;
    for(const q of samples)assert.ok(p.distanceTo(q)>.64,`monkey ${a.indexOf(monkey)} leap ${i}->${j} at ${t}: centre ${p.toArray()}, branch ${q.toArray()}, gap ${p.distanceTo(q)}`);
   }
  }
 }
});

test('relocated ordinary routes preserve original animation timing and all repair actors through 20 seconds',()=>{
 // Reference factory runs its original animation on the relocated coordinates.
 // This checks that the installer changes only route points, not motion logic.
 for(let i=0;i<a.length;i++)for(let j=0;j<a[i].userData.perches.length;j++)b[i].userData.perches[j].copy(a[i].userData.perches[j]);
 for(let k=0;k<=200;k++){
  const t=k*.1;before.userData.update(.1,t,{});after.userData.update(.1,t,{});
  for(let i=0;i<a.length;i++){assert.deepEqual(a[i].position.toArray(),b[i].position.toArray());assert.deepEqual(a[i].quaternion.toArray(),b[i].quaternion.toArray());}
  for(let i=0;i<2;i++)assert.deepEqual(inner.userData.shipyard.workers[i].position.toArray(),before.userData.inner.userData.shipyard.workers[i].position.toArray());
 }
});

test('real perch supports survive spherical placement without a second coordinate change',()=>{
 placeMoebiusSwampOnSphere(after,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);after.updateMatrixWorld(true);
 for(const r of report.records){const origin=inner.localToWorld(new T.Vector3(...r.point).add(new T.Vector3(0,.5,0))),down=new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld);assert.ok(new T.Raycaster(origin,down).intersectObject(report.mesh,false)[0]);}
 for(const r of report.records)assert.deepEqual(r.monkey.userData.perches[r.index].toArray(),r.point);
});

test('dispose and reinstall seats roots on final V7 shortened trunks, without leaked geometry',async()=>{
 const {buildMoebiusCrystalMetropolis}=await import('../../src/world/moebiusCity.js');
 const {crystalV7Layout,crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
 const {installCrystalV7Shores}=await import('../../src/world/crystalV7Runtime.js');
 const {relocateCrystalCore}=await import('../../src/world/crystalCorePlacement.js');
 const scene=new T.Scene(),city=buildMoebiusCrystalMetropolis(scene,160,{layout:crystalV7Layout(),useStorage:false,v7:true}),swamp=createMoebiusSwampPlacement({scale:.5,seed:7711}),zone=swamp.userData.inner;
 const original=installSwampCoralPerches(zone,{enabled:true}),owned=[zone.getObjectByName('greg-coral-monkey-perch-branches'),zone.getObjectByName('greg-coral-monkey-perch-ink')];
 let disposed=0;for(const mesh of owned)for(const resource of [mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposed++);
 placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,-15.8);scene.add(swamp);city.v7Shores=installCrystalV7Shores(scene,city,swamp);relocateCrystalCore({scene,pack:{moebius:city,bubblePods:new T.Group()},swamp});scene.updateMatrixWorld(true);
 original.dispose();original.dispose();assert.equal(disposed,4);assert.ok(owned.every(mesh=>mesh.parent===null));assert.equal(zone.userData.gregCoralPerches,undefined);
 for(const r of original.records)assert.deepEqual(r.monkey.userData.perches[r.index].toArray(),r.originalPoint,'dispose restores original route coordinates in place');
 const final=installSwampCoralPerches(zone,{enabled:true});assert.ok(final.ok,JSON.stringify(final.missing));assert.equal(final.records.length,original.records.length);zone.updateWorldMatrix(true,true);
 for(const r of final.records){
  const surface=new T.Vector3(...r.surface),outward=surface.clone().sub(new T.Vector3(...r.root)).normalize(),origin=zone.localToWorld(surface.clone().addScaledVector(outward,1));
  const hit=new T.Raycaster(origin,outward.clone().negate().transformDirection(zone.matrixWorld)).intersectObject(r.sourceTrunk,false)[0];
  assert.ok(hit,'final V7 branch root must meet shortened visible trunk');assert.ok(zone.worldToLocal(hit.point).distanceTo(surface)<.02);
  assert.ok(r.curve.getLength()<=6);assert.deepEqual(r.originalPoint,original.records.find(o=>o.monkey===r.monkey&&o.index===r.index).originalPoint,'reinstall starts from original positions rather than accumulating drift');
 }
 const branches=final.records.flatMap(r=>Array.from({length:49},(_,i)=>r.curve.getPointAt(i/48)));
 for(const monkey of monkeys(zone)){const u=monkey.userData;
  for(let i=0;i<u.perches.length;i++)for(let j=0;j<u.perches.length;j++)if(i!==j)for(let k=4;k<57;k++){
   const t=k/60,p=u.perches[i].clone().lerp(u.perches[j],t);p.y+=Math.sin(t*Math.PI)*u.arc+.65;
   assert.ok(branches.every(q=>p.distanceTo(q)>.64),'shortened-tree branch must not obstruct original jump arcs');
  }
 }
 let count=0;zone.traverse(o=>{if(o.name==='greg-coral-monkey-perch-branches')count++;});assert.equal(count,1);
 final.dispose();
});
