import assert from 'node:assert/strict';
import {buildQuadGrid,buildMixedGrid,signedArea} from '../src/core/grid.js';
import {insertRadialPatch,insertRadialPatches,migrateWorldToPatch} from '../src/core/radial-patch.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {shapeTerrain} from '../src/terrain/shape.js';
import {selfCheck} from '../src/core/adjacency.js';
const area=g=>g.cells.reduce((s,c)=>s+Math.abs(signedArea(c.pts)),0);
let multi=0,migrated=0,rejected=0;
for(const build of[buildQuadGrid,buildMixedGrid])for(let seed=1;seed<=16;seed++){
 const g=build({radius:12,hexSize:1,seed}),before=JSON.stringify(g.cells);
 // 1) 两颗"宝石"补丁：互不重叠、面积守恒、各自 cellIds 在最终编号里、接缝半边互逆
 let p;try{p=insertRadialPatches(g,[{x:-4.5,z:0,radius:2.6},{x:4.5,z:1,radius:2.6}])}catch(e){assert(e instanceof RangeError);rejected++;continue}
 multi++;assert.equal(JSON.stringify(g.cells),before);assert(Math.abs(area(p)-area(g))<1e-7);
 assert.equal(p.patches.length,2);const A=new Set(p.patches[0].cellIds),B=new Set(p.patches[1].cellIds);assert(A.size>0&&B.size>0);for(const id of A)assert(!B.has(id));
 for(const id of [...A,...B])assert.equal(p.sourceCellOf[id],-1);
 for(const c of p.cells)if(p.sourceCellOf[c.id]>=0){const o=g.cells[p.sourceCellOf[c.id]];assert.deepEqual(c.pts.map(q=>[q.x,q.z]),o.pts.map(q=>[q.x,q.z]));}
 for(const [cells,cx] of[[A,-4.5],[B,4.5]])for(const id of cells)assert(Math.abs(p.cells[id].cx-cx)<3.2);
 assert.equal(selfCheck(p,new World(p)).mismatched,0);
 // 2) 已有世界迁移：外部格逐列照搬，补丁格从最近的被删源格重采样；地形/切面平滑照常
 const w=new World(g);generateTerrain(w,{seed});const lifted=g.cells.find(c=>w.ground(c)>0);w.setSolid(lifted,w.top(lifted)+1,true);w.color[lifted.id]=4;
 const snap=JSON.stringify(w.snapshot()),m=migrateWorldToPatch(w,p,World);assert.equal(JSON.stringify(w.snapshot()),snap,'source World unchanged');
 assert.equal(m.copied+m.resampled,p.cells.length);assert.equal(m.resampled,A.size+B.size);
 for(const c of p.cells){const s=p.sourceCellOf[c.id];if(s>=0){assert.equal(m.world.solid[c.id],w.solid[s]);assert.equal(m.world.rock[c.id],w.rock[s]);assert.equal(m.world.color[c.id],w.color[s]);}}
 const landBefore=g.cells.filter(c=>w.top(c)>0).length,landAfter=p.cells.filter(c=>m.world.top(c)>0).length;assert(landAfter>0&&Math.abs(landAfter-landBefore)<=A.size+B.size+40);
 const sh=shapeTerrain(m.world);for(const v of p.verts.slice(0,200))assert(sh.at(v,1).every(Number.isFinite));migrated++;
}
assert(multi>=8,'multi '+multi);
// 重叠的两个补丁被拒绝；不是来自这个世界的网格被拒绝
const g=buildQuadGrid({radius:10,seed:2});assert.throws(()=>insertRadialPatches(g,[{x:0,z:0,radius:2.5},{x:1,z:0,radius:2.5}]),RangeError);
assert.throws(()=>migrateWorldToPatch(new World(buildQuadGrid({radius:2,seed:2})),insertRadialPatch(g,{radius:2.6}),World));
assert.throws(()=>migrateWorldToPatch(new World(g),{cells:[]},World));
console.log({multi,migrated,rejected},'PASS two non-overlapping radial patches on one grid, provenance numbering, existing-World migration (copy + nearest resample), shape on migrated World');
