import assert from 'node:assert/strict';
import {beginSpearThrust as start,stepSpearThrust as step} from '../src/core/spear-thrust.js';
const origin={x:0,z:0},dir={x:1,z:0};
for(const hz of [30,60,120]){const a={x:.2,z:0},b={x:.4,z:.02},side={x:.2,z:.3},back={x:-.2,z:0},t=start(origin,dir),hits=[];while(!t.done)hits.push(...step(t,[b,side,a,back],1/hz));assert.deepEqual(hits,[a,b]);assert.deepEqual(step(t,[a,b],1),[])}
const target={x:.35,z:0},a=start(origin,dir),b=start(origin,dir);assert.deepEqual(step(a,[target],1),[target]);assert.deepEqual(step(b,[target],1),[target]);
assert.deepEqual(step(start(origin,dir),[target,target],1),[target]);
const blocked=start(origin,dir);assert.deepEqual(step(blocked,[target],.1,{canHit:()=>false}),[]);assert.deepEqual(step(blocked,[target],.08),[target]);
const t=start(origin,dir);assert.deepEqual(step(t,[target],0),[]);assert.equal(t.age,0);assert(!t.done);
const diagonal=start(origin,{x:1,z:1});assert.deepEqual(step(diagonal,[{x:.25,z:.25}],1).length,1);
for(const dt of [-1,NaN,Infinity])assert.throws(()=>step(start(origin,dir),[],dt),RangeError);
assert.throws(()=>start(origin,{x:0,z:0}),RangeError);assert.throws(()=>start(origin,dir,{length:-1}),RangeError);
console.log('PASS capsule extension, frame rates, independent hit sets, filtering and pause');
// Both frame endpoints miss the shaft, but the target crosses during the tick.
for(const hz of [30,60,120]){
 const moving={x:.15,z:.3},thrust=start(origin,dir,{targets:[moving]}),hits=[];
 let elapsed=0;
 while(!thrust.done){elapsed+=1/hz;moving.z=.3-.6*Math.min(elapsed/.18,1);hits.push(...step(thrust,[moving],1/hz));}
 assert.deepEqual(hits,[moving]);
}
const away={x:.4,z:-.05},escaping=start(origin,dir,{targets:[away]});away.z=-.5;assert.deepEqual(step(escaping,[away],.18),[]);
const late={x:.1,z:.3},expiring=start(origin,dir,{targets:[late]});step(expiring,[late],.17);late.z=-.3;assert.deepEqual(step(expiring,[late],.1),[]);
const capMiss={x:.53,z:.08};assert.deepEqual(step(start(origin,dir),[capMiss],.18),[]);
const capHit={x:.48,z:.08};assert.deepEqual(step(start(origin,dir),[capHit],.18),[capHit]);
console.log('PASS continuous target crossing, time-coupled tip, round caps and expiry clipping');
// Independent dense-distance reference for deterministic random trajectories.
let seed=9271;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(let n=0;n<120;n++){
 const px=random()*1.2-.3,pz=random()-.5,qx=random()*1.2-.3,qz=random()-.5;
 const moving={x:px,z:pz},thrust=start(origin,dir,{targets:[moving]});moving.x=qx;moving.z=qz;
 const hit=step(thrust,[moving],.18).length>0;let minimum=Infinity;
 for(let i=0;i<=4000;i++){const t=i/4000,x=px+(qx-px)*t,z=pz+(qz-pz)*t,along=Math.max(0,Math.min(.44*t,x));minimum=Math.min(minimum,Math.hypot(x-along,z)-.095)}
 if(minimum<-.0001)assert(hit);if(minimum>.0001)assert(!hit);
}
console.log('PASS 120 seeded trajectories vs dense geometric reference');
