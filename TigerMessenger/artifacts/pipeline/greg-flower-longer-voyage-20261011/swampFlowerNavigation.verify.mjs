import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHarborScene,overviewCamera,HARBOR_OVERVIEW}=await import('../../src/world/swampHarborScene.js');
const {pruneTaggedOfficialOceanOccludeds}=await import('../../src/core/officialOceanOcclusionPruning.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');


const start=performance.now();
const swamp=createMoebiusSwampPlacement({seed:7711,scale:.5});
placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,0);
const inner=swamp.userData.inner,activity=inner.userData.flowerBoyActivities;
const h=installSwampHarborScene({swamp,departure:'original',workerScale:1});
const buildMilliseconds=performance.now()-start,n=activity.navigation;
assert.equal(n.records.length,5);assert.ok(n.records.every(r=>r.valid));
assert.equal(activity.passengerCount,10);assert.equal(activity.paddleCount,10);
const identities=n.records.flatMap(r=>r.boat.userData.passengers.map(b=>b.uuid));assert.equal(new Set(identities).size,10);
assert.ok(n.records.every(r=>!r.boat.userData.flowerStem));
const distance=(p,s)=>{const a=new T.Vector3(...s.from),b=new T.Vector3(...s.to),d=b.clone().sub(a);d.y=0;const q=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq()));return Math.hypot(p.x-a.x-q*d.x,p.z-a.z-q*d.z)-s.width/2;};
let quayGap=Infinity,pairGap=Infinity,powerSamples=0,recoverySamples=0;
const ranges=n.records.map(()=>({min:Infinity,max:-Infinity})),previous=[];
for(let k=0;k<=800;k++){
 const time=k*.05;n.update(time);
 for(const [i,r]of n.records.entries()){
  const p=r.boat.position,m=r.boat.userData.paddleMotion;
  ranges[i].min=Math.min(ranges[i].min,r.distance);ranges[i].max=Math.max(ranges[i].max,r.distance);
  if(k%10===0)assert.ok(n.solids.boxesClear(p.x,p.z,r.angle,r.boxes),'actual cliff/root clearance boat '+i+' time '+time);
  for(const s of h.pier.segments)quayGap=Math.min(quayGap,distance(p,s)-r.radius);
  for(const other of n.records)if(other!==r)pairGap=Math.min(pairGap,Math.hypot(p.x-other.boat.position.x,p.z-other.boat.position.z)-r.radius-other.radius);
  const old=previous[i];if(old)assert.ok(Math.abs(r.distance-old.distance)<.08,'continuous route at turn/wrap boat '+i);const phase=m.phase/(2*Math.PI),bothRecovery=phase>.625&&phase<.915;
  if(old&&old.direction===m.direction&&m.moving&&old.moving){
    const progress=(r.distance-old.distance)*m.direction;
    assert.ok(progress>=-1e-8,'recovery never reverses boat '+i);
    if(bothRecovery&&old.bothRecovery){assert.ok(Math.abs(progress)<1e-8);recoverySamples++;}
    else if(progress>.00001)powerSamples++;
  }
  previous[i]={distance:r.distance,direction:m.direction,moving:m.moving,bothRecovery};
 }
}
assert.ok(quayGap>0,'new cliff quay clearance '+quayGap);assert.ok(pairGap>0,'no boat pairs collide '+pairGap);
assert.ok(powerSamples>0&&recoverySamples>0);
for(const [i,r]of n.records.entries())assert.ok(ranges[i].max-ranges[i].min>1.39,'visible complete rowing travel boat '+i);
const snapshots=[];
for(const time of [0,1,2,5,10,16.4,20,32.8]){
 swamp.userData.update(.05,time,{});h.update(time);inner.updateWorldMatrix(true,true);
 snapshots.push({time,boats:n.records.map(r=>({index:r.index,position:r.boat.position.toArray(),state:r.state,paddles:r.boat.userData.paddles.map(p=>({stroke:p.userData.stroke,bladeY:inner.worldToLocal(p.userData.blade.getWorldPosition(new T.Vector3())).y,holder:p.userData.holder.uuid,hand:p.userData.hand}))}))});
}
for(const sample of snapshots)for(const b of sample.boats){assert.equal(b.paddles.length,2);for(const p of b.paddles)if(p.stroke==='power')assert.ok(p.bladeY<25,'actual submerged paddle power');}
console.log(JSON.stringify({buildMilliseconds,formalSeed:7711,planning:n.planning,coordinateUnits:{range:'inner-local units',innerLocalScale:inner.scale.toArray(),wrapScale:swamp.scale.toArray(),innerWorldScale:inner.getWorldScale(new T.Vector3()).toArray()},counts:{boats:5,kids:10,paddles:10},routes:n.records.map((r,i)=>({index:i,valid:r.valid,travelLocal:r.travel,travelWorld:r.travel*inner.getWorldScale(new T.Vector3()).x,oneWayLocal:2*r.travel,oneWayWorld:inner.localToWorld(new T.Vector3(r.x-Math.cos(r.angle)*r.travel,25,r.z-Math.sin(r.angle)*r.travel)).distanceTo(inner.localToWorld(new T.Vector3(r.x+Math.cos(r.angle)*r.travel,25,r.z+Math.sin(r.angle)*r.travel))),fullCycle:r.period,rangeLocal:ranges[i],rangeWorld:{min:ranges[i].min*inner.getWorldScale(new T.Vector3()).x,max:ranges[i].max*inner.getWorldScale(new T.Vector3()).x},clearance:r.routeClearance})),quayGap,pairGap,powerSamples,recoverySamples,snapshots},null,2));
