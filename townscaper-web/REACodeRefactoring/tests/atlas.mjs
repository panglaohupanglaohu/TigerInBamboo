import assert from 'node:assert/strict';
import {Atlas} from '../src/core/atlas.js';
for(const bad of [0,-1,NaN,Infinity,1.5]) {
  assert.throws(()=>new Atlas(bad,16));
  const a=new Atlas(16,16),before=JSON.stringify(a.root);
  assert.throws(()=>a.allocate(bad,4));assert.equal(JSON.stringify(a.root),before);
}
assert.throws(()=>new Atlas(Number.MAX_SAFE_INTEGER,2));
// Stale root handles previously freed a replacement, causing overlapping slots.
const a=new Atlas(8,8),old=a.allocate(8,8);assert.ok(a.free(old));const replacement=a.allocate(8,8);
assert.equal(a.free(old),false);assert.equal(a.free({...replacement}),false);assert.equal(new Atlas(8,8).free(replacement),false);assert.equal(a.allocate(1,1),null);assert.equal(a.report().usedArea,64);
assert.ok(a.free(replacement));assert.equal(a.report().leaves,1);
// Diagonal holes have sufficient total area, but do not form a free leaf.
const f=new Atlas(10,10),q=Array.from({length:4},()=>f.allocate(5,5));f.free(q[0]);f.free(q[3]);
assert.equal(f.report().freeArea,50);assert.equal(f.report().largestShare,.5);assert.equal(f.allocate(10,5,{trace:true}),null);assert.ok(f.lastTrace.some(x=>x.decision==='size'));
const positions=f.rects();assert.equal(f.free(q[0]),false);assert.deepEqual(f.rects(),positions);f.free(q[1]);f.free(q[2]);assert.equal(f.report().leaves,1);assert.ok(f.allocate(10,10));
let operations=0;
for(let seed=1;seed<=40;seed++) {
  let state=seed;const rnd=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296),a=new Atlas(64,64),live=[],dead=[];
  for(let j=0;j<600;j++) {
    if(live.length&&rnd()<.42){const i=Math.floor(rnd()*live.length),r=live.splice(i,1)[0];assert.ok(a.free(r));dead.push(r)}
    else {const w=1+Math.floor(rnd()*20),h=1+Math.floor(rnd()*20),r=a.allocate(w,h,{trace:j%10===0});if(r)live.push(r)}
    if(dead.length)assert.equal(a.free(dead[Math.floor(rnd()*dead.length)]),false);
    const boxes=a.rects(),R=a.report();assert.equal(boxes.length,live.length);const coords=r=>JSON.stringify([r.x,r.y,r.w,r.h]);assert.deepEqual(boxes.map(coords).sort(),live.map(coords).sort());assert.equal(R.usedArea,live.reduce((s,r)=>s+r.w*r.h,0));assert.equal(R.usedArea+R.freeArea,4096);
    for(let i=0;i<boxes.length;i++){const r=boxes[i];assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=64&&r.y+r.h<=64);for(let k=i+1;k<boxes.length;k++){const t=boxes[k];assert.ok(r.x+r.w<=t.x||t.x+t.w<=r.x||r.y+r.h<=t.y||t.y+t.h<=r.y)}}
    operations++;
  }
  for(const r of live)assert.ok(a.free(r));assert.equal(a.report().leaves,1);
}
const deep=new Atlas(1,6000),handles=[];for(let i=0;i<6000;i++)handles.push(deep.allocate(1,1));assert.equal(deep.rects().length,6000);assert.equal(deep.report().maxDepth,5999);for(const h of handles.reverse())deep.free(h);assert.equal(deep.report().leaves,1);
console.log('PASS',operations,'dynamic operations, stale/foreign handles, area conservation, disjoint stable slots, explicit fragmentation and 6000-depth traversal');
