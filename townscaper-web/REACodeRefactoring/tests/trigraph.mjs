import assert from 'node:assert/strict';
import {TriGraph} from '../src/core/trigraph.js';
let state=19;const rnd=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
let total=0;
for(const scale of [.001,1,1000]) {
 const g=new TriGraph(scale*10);
 for(let i=0;i<150;i++){assert.equal(g.add((rnd()-.5)*scale,(rnd()-.5)*scale),i+3);const q=g.check(Infinity);assert.ok(q.manifold && q.delaunay,JSON.stringify(q));total++;}
 assert.deepEqual(g.check(20),g.check(20)); assert.equal(g.check(20).full,false);assert.equal(g.check(Infinity).full,true);
 const before=JSON.stringify(g);
 for(const p of [[NaN,0],[Infinity,0],[0,scale*30],[g.x[3],g.y[3]]])assert.throws(()=>g.add(...p));
 assert.equal(JSON.stringify(g),before);
 const copy=new TriGraph();copy.add(0,0);copy.tris.push([...copy.tris[0]]);copy.circ.push([...copy.circ[0]]);assert.equal(copy.check(Infinity).manifold,false);
 g.x.push(0);g.y.push(.1);assert.equal(g.check(0).orphanVertices,1);assert.equal(g.check(0).manifold,false);
}
for(const b of [0,-1,NaN,Infinity,1e80])assert.throws(()=>new TriGraph(b));
assert.throws(()=>new TriGraph().check(-1));
console.log('PASS '+total+' incremental full audits; deterministic samples, immutable rejection, duplicate faces/orphans, bounded constructor');
