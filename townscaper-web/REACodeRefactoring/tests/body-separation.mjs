import assert from 'node:assert/strict';
import {localSeparation,leftLaneTarget} from '../src/world/traffic.js';
const results=[];
for(const hz of [30,60,120]){const a={x:-.04,y:.5,z:0,radius:.0825},b={x:.04,y:.5,z:0,radius:.055};assert.deepEqual(localSeparation(a,[a,b],0),{x:0,z:0});for(let i=0;i<hz;i++){const da=localSeparation(a,[b],1/hz),db=localSeparation(b,[a],1/hz);a.x+=da.x;b.x+=db.x;}const d=b.x-a.x;assert(Math.abs(d-.1375)<1e-8);results.push({hz,d})}
const a={x:0,y:0,z:0,radius:.0825},v={x:.04,y:0,z:0,radius:.055};assert(localSeparation(a,[v],1/60).x<0);for(const patch of [{y:2},{dead:true},{onBoat:{}},{fall:{}}])assert.deepEqual(localSeparation(a,[{...v,...patch}],1/60),{x:0,z:0});
const many=Array.from({length:30},()=>v),push=localSeparation(a,many,1/120);assert(Math.hypot(push.x,push.z)<=.8/120+1e-12);
const cell={cx:0,cz:0,n:4,pts:[{x:-.1,z:-.1},{x:.1,z:-.1},{x:.1,z:.1},{x:-.1,z:.1}]},lane=leftLaneTarget({cx:0,cz:-1},cell,{width:.08,bodyRadius:.09});assert(Math.hypot(lane.x,lane.z)<=.01+1e-12);
for(const dt of [-1,NaN,Infinity])assert.throws(()=>localSeparation(a,[v],dt),RangeError);
console.log('PASS radius-aware separation, pause, time scaling, cap and lane clearance',results);
