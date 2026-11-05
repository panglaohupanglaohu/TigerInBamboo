import assert from 'node:assert/strict';import {advanceWake} from '../src/core/wake-sampling.js';import {fogEnvelope} from '../src/core/fog-envelope.js';
const runs=[];for(const hz of [10,30,60,120]){const s={trail:[],acc:0};advanceWake(s,{x:0,z:0,dx:1,dz:0},0);for(let i=1;i<=hz*3;i++)advanceWake(s,{x:i/hz,z:0,dx:1,dz:0},1/hz);assert.equal(s.trail.length,50);runs.push(s);}
for(const s of runs)for(let i=0;i<50;i++)for(const k of ['l','r'])for(let axis=0;axis<2;axis++)assert.ok(Math.abs(s.trail[i][k][axis]-runs[0].trail[i][k][axis])<1e-9);
const s=runs[0],first={...s.trail.at(-1),l:[...s.trail.at(-1).l]};advanceWake(s,{x:3,z:1,dx:0,dz:1},.01);assert.ok(Math.abs(s.trail.at(-1).l[0]-first.l[0])<1e-9);advanceWake(s,{x:4,z:1,dx:1,dz:0},1000);assert.equal(s.trail.length,70);assert.throws(()=>advanceWake(s,{x:0,z:0,dx:1,dz:0},NaN));
assert.equal(fogEnvelope(8,8,24),0);assert.equal(fogEnvelope(24,8,24),0);assert.equal(fogEnvelope(25,8,24),0);assert.ok(fogEnvelope(20,8,24)>0);assert.ok(fogEnvelope(24-1e-5,8,24)<1e-8);assert.throws(()=>fogEnvelope(1,2,1));
console.log('PASS 10/30/60/120Hz emission/remainder, world-space trail after turn, bounded catchup and smooth fog edge');
