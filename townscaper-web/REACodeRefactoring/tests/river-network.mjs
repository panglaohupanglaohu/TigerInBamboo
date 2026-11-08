import{buildNav}from'../src/world/navgraph.js';
import assert from 'node:assert/strict';
import{planRiverNetwork}from'../src/core/river-network.js';
import{rebuildRiverNetwork}from'../src/terrain/river-network.js';
import{World}from'../src/core/world.js';
const n=9,cells=Array.from({length:n*n},(_,id)=>{const x=id%n,z=(id/n)|0;return{id,cx:x,cz:z,n:4,edgeNeighbors:[x?id-1:-1,x+1<n?id+1:-1,z?id-n:-1,z+1<n?id+n:-1]}}),w=new World({cells});
for(const c of cells){const x=c.id%n,z=(c.id/n)|0;w.fill(c,x===0||z===0||x===8||z===8?0:x===1||z===1||x===7||z===7?4:1,{rock:true});}
const before=w.snapshot(),h=cells.map(c=>w.ground(c)),r=rebuildRiverNetwork(w,{threshold:3,depth:1});assert.ok(r.raised>0&&r.riverCells>0&&r.changed>0);assert.deepEqual(h,cells.map(c=>{const mask=before.rock[c.id];return mask?32-Math.clz32(mask):0}));
for(const c of cells){const id=c.id,p=r.parent[id];if(p>=0)assert.ok(r.area[p]>=r.area[id]);if(!r.river[id])continue;let a=id,seen=new Set();while(r.parent[a]>=0&&r.filled[r.parent[a]]>0){assert.ok(!seen.has(a));seen.add(a);const b=r.parent[a];assert.ok(r.river[b]);assert.ok(w.ground(cells[b])<=w.ground(cells[a]));a=b;}}
assert.equal(r.area.filter((_,id)=>r.parent[id]<0).reduce((a,b)=>a+b,0),cells.length);
const nav=buildNav(w);let flat=0;for(const c of cells){const p=r.parent[c.id];if(w.river[c.id]&&p>=0&&w.river[p]&&w.top(c)===w.top(cells[p])){assert.equal(nav.riverDirection(c,cells[p]),1);assert.equal(nav.riverDirection(cells[p],c),-1);flat++;}}assert.ok(flat>0);
const version=w.version;assert.equal(rebuildRiverNetwork(w,{threshold:3,depth:1}),r);assert.equal(w.version,version);
w.restore(before);const repeat=rebuildRiverNetwork(w,{threshold:3,depth:1});assert.deepEqual(repeat.river,r.river);assert.deepEqual(repeat.bed,r.bed);
for(const option of[{threshold:0},{depth:-1}]){const snap=JSON.stringify(w.snapshot());assert.throws(()=>rebuildRiverNetwork(w,option));assert.equal(JSON.stringify(w.snapshot()),snap)}
w.setSolid(cells[40],6,true);let snap=JSON.stringify(w.snapshot());assert.throws(()=>rebuildRiverNetwork(w));assert.equal(JSON.stringify(w.snapshot()),snap);w.restore(before);w.setSolid(cells[10],1,false);snap=JSON.stringify(w.snapshot());assert.throws(()=>rebuildRiverNetwork(w));assert.equal(JSON.stringify(w.snapshot()),snap);
assert.throws(()=>planRiverNetwork([{id:0,edgeNeighbors:[0]}],[1]));console.log('PASS accumulation conservation, tributary closure, monotone outlet paths, deterministic restore, cached no-op, atomic cave/building/options rejection',r.riverCells,r.raised);
