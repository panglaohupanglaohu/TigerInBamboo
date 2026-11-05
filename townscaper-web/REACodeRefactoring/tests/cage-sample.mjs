import assert from 'node:assert/strict';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {shapeTerrain} from '../src/terrain/shape.js';
for(const build of [buildMixedGrid,buildQuadGrid]){
 const g=build({radius:4,hexSize:1,mergeRate:.55,seed:19}),w=new World(g);
 for(const c of g.cells)if(Math.hypot(c.cx,c.cz)<3.7)w.fill(c,Math.hypot(c.cx,c.cz)<1.5?6:2,{rock:true});
 const before=JSON.stringify(w.snapshot()),raw=JSON.stringify(g),shape=shapeTerrain(w);let queries=0,motion=0;
 for(const p of g.verts)for(let l=0;l+1<shape.slices;l++){
  const a=shape.at(p,l),b=shape.at(p,l+1);motion=Math.max(motion,Math.hypot(a[0]-b[0],a[1]-b[1]));
  for(const t of [.01,.125,.5,.875,.99]){const q=shape.at(p,l+t);assert.ok(q.every(Number.isFinite));assert.ok(Math.hypot(q[0]-(a[0]+(b[0]-a[0])*t),q[1]-(a[1]+(b[1]-a[1])*t))<1e-12);assert.equal(shape.order(p.id,l+t),Math.max(shape.order(p.id,l),shape.order(p.id,l+1)));queries++;}
  if(l>0){const left=shape.at(p,l-1e-8),right=shape.at(p,l+1e-8);assert.ok(Math.hypot(left[0]-right[0],left[1]-right[1])<1e-7);}
 }
 assert.ok(motion>.001);assert.deepEqual(shape.at(g.verts[0],-1),shape.at(g.verts[0],0));assert.deepEqual(shape.at(g.verts[0],1e6),shape.at(g.verts[0],shape.slices-1));
 for(const s of [NaN,Infinity,-Infinity]){assert.throws(()=>shape.at(g.verts[0],s));assert.throws(()=>shape.order(0,s));}
 assert.throws(()=>shape.at({id:-1},.5));assert.throws(()=>shape.order(.5,.5));
 const off=shapeTerrain(w,{enabled:false});assert.deepEqual(off.at(g.verts[0],.5),[g.verts[0].x,g.verts[0].z]);
 assert.equal(before,JSON.stringify(w.snapshot()));assert.equal(raw,JSON.stringify(g));console.log({cells:g.cells.length,queries,motion});
}
console.log('PASS fractional cage corner samples, continuity, integer endpoints, clamping/ranks, input validation and immutable World/grid');
