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
let previous=null,maxStepInner=0,feedingFrames=0,surfaceFrames=0,underwaterFrames=0,maxMouthError=0;const stages=new Set(),feeder=activity.feeder,rig=feeder.userData.flowerSwim;
for(let k=0;k<=600;k++){const time=k*.25;swamp.userData.update(.25,time,{});h.update(time);inner.updateWorldMatrix(true,true);const p=feeder.position.clone();if(previous)maxStepInner=Math.max(maxStepInner,p.distanceTo(previous));previous=p;stages.add(rig.phase);if(rig.feeding>.5)feedingFrames++;if(rig.noseY>25)surfaceFrames++;else underwaterFrames++;maxMouthError=Math.max(maxMouthError,Math.abs(rig.mouthY-rig.targetMouthY));}
assert.ok(maxStepInner<.7,'smooth deterministic path, no sudden projection');assert.ok(maxMouthError<1e-6);assert.ok(feedingFrames>0&&surfaceFrames>0&&underwaterFrames>0);assert.equal(activity.passengerCount,10);assert.equal(activity.paddleCount,10);assert.ok(activity.navigation.records.every(r=>r.valid));
console.log(JSON.stringify({seed:7711,maxStepInner,maxStepWorld:maxStepInner*.5,maxMouthError,feedingFrames,surfaceFrames,underwaterFrames,stages:[...stages],identity:feeder.userData.storyRole,boats:5,children:10,paddles:10,GPU:'not checked'},null,2));
