import assert from 'node:assert/strict';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {shapeTerrain} from '../src/terrain/shape.js';
for(const build of [buildMixedGrid,buildQuadGrid]){
 const g=build({radius:5,hexSize:1,mergeRate:.55,seed:8}),w=new World(g);
 for(const c of g.cells)if(Math.hypot(c.cx,c.cz)<4)w.fill(c,Math.hypot(c.cx,c.cz)<2?4:2,{rock:true});
 const before=JSON.stringify(w.snapshot()),raw=JSON.stringify(g),base=shapeTerrain(w);
 let pair,best=0;
 for(const c of g.cells)for(let i=0;i<c.n;i++){
  const a=c.pts[i],b=c.pts[(i+1)%c.n];for(let s=0;s<base.slices;s++){
   const q=base.at(a,s),r=base.at(b,s),d=Math.hypot(q[0]-a.x,q[1]-a.z)+Math.hypot(r[0]-b.x,r[1]-b.z);if(d>best){best=d;pair=[a.id,b.id];}
  }
 }
 assert.ok(best>0.01);const hard=shapeTerrain(w,{hardEdges:[pair]});
 for(const id of pair)for(let s=0;s<hard.slices;s++){assert.equal(hard.order(id,s),3);const q=hard.at(g.verts[id],s);assert.ok(Math.hypot(q[0]-g.verts[id].x,q[1]-g.verts[id].z)<1e-6);}
 assert.equal(hard,shapeTerrain(w,{hardEdges:[pair]}),'same options cache');
 const restore=shapeTerrain(w);for(const v of g.verts)for(let s=0;s<base.slices;s++)assert.deepEqual(restore.at(v,s),base.at(v,s));
 const off=shapeTerrain(w,{hardEdges:[pair],enabled:false});for(const v of g.verts)assert.deepEqual(off.at(v,0),[v.x,v.z]);
 for(const edges of ['bad',[[pair[0],pair[0]]],[[-1,0]],[[0,.5]],[[g.verts.length,0]],[[0]],[[0,1,2]]])assert.throws(()=>shapeTerrain(w,{hardEdges:edges}));
 assert.equal(before,JSON.stringify(w.snapshot()));assert.equal(raw,JSON.stringify(g));console.log({cells:g.cells.length,pair,beforeMovement:best,hardVertices:hard.explicitHardVertices,guarded:hard.guard.guardedSlices});
}
console.log('PASS shared hard edges, all-slice pinning, cache/restore, invalid edge rejection, source topology/World immutability');
