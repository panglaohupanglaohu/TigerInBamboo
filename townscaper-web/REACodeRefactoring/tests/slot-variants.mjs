import assert from 'node:assert/strict';
import {buildSquareGrid,buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {solveWFC,findWFCConflicts,cornerVariantTiles,cornerSlots,dependencyChain} from '../src/core/wfc.js';
// 1) 原版 variants()：4 边 K=3，边值 = 两角之和 mod 3，去重后 27 种（REACode slotsolve.variants() 实跑也是 27；其注释写的"24 个变体"与代码不符）
const v4=cornerVariantTiles(4,3);assert.equal(v4.length,27);for(const t of v4)t.edges.forEach((e,i)=>assert.equal(e,(t.corners[i]+t.corners[(i+1)%4])%3));
assert.equal(new Set(v4.map(t=>t.edges.join())).size,27);assert.equal(cornerVariantTiles(3,3).length,27);assert.throws(()=>cornerVariantTiles(2,3));
// 2) 共享网格上的槽位表：真值自洽、给定格钉住、求解后没有冲突、确定性
let explained=0,chains=0;const stats={};
for(const [name,g] of [['square',buildSquareGrid({radius:4})],['mixed',buildMixedGrid({radius:5,seed:3})],['quad',buildQuadGrid({radius:4,seed:2})]]){
 const {tiles,truth,pins}=cornerSlots(g,{seed:9});assert.deepEqual(findWFCConflicts(g,truth,tiles),[],'truth is self-consistent');
 const pinned=Object.keys(pins).length;assert(pinned>0&&pinned<g.cells.length);
 const r=solveWFC(g,{tiles,pins,seed:4,explain:true,traceLimit:64});assert(r.ok,name+' '+r.reason);assert.deepEqual(findWFCConflicts(g,r.tiles,tiles),[]);
 for(const [id,t] of Object.entries(pins))assert.equal(r.tiles[id],t);
 assert.deepEqual(solveWFC({...g,cells:[...g.cells].reverse()},{tiles:[...tiles].reverse(),pins,seed:4}).tiles,r.tiles);
 // 3) 依赖链（红链）：每条链从某格的最近一次删减出发，沿 from 回到一个决策/给定格；链上相邻两格确实共边
 const byId=new Map(g.cells.map(c=>[c.id,c]));
 for(const c of g.cells){const ch=dependencyChain(r.causes,c.id);if(!ch.length)continue;chains++;assert.equal(ch[0].cell,c.id);const last=ch.at(-1);assert(['decision','pin'].includes(last.kind),'chain ends at a decision or pin');
  for(let i=0;i<ch.length-1;i++){assert.equal(ch[i].from,ch[i+1].cell);assert(byId.get(ch[i].cell).edgeNeighbors.includes(ch[i].from));assert(ch[i].removed.length>0);}}
 assert(r.causes.every(x=>x.kind||x.removed.length));explained+=r.causes.length;
 // explain 不改变解
 assert.deepEqual(solveWFC(g,{tiles,pins,seed:4}).tiles,r.tiles);
 stats[name]={cells:g.cells.length,pool:tiles.length,pinned,decisions:r.decisions,backtracks:r.backtracks,causes:r.causes.length};
}
// 4) 冲突时记录导致空域的那条链
const g=buildSquareGrid({radius:1}),tiles=[{id:'a',edges:[0,0,0,0]},{id:'b',edges:[1,1,1,1]}],bad=solveWFC(g,{tiles,pins:{0:'a',8:'b'},explain:true});
assert(!bad.ok);assert(bad.conflicts.length>=1);const ch=bad.conflicts[0];assert(['pin','decision'].includes(ch.at(-1).kind));assert.equal(ch[0].left,0);
assert.throws(()=>solveWFC(g,{tiles,explain:'yes'}));
console.log(stats,{explained,chains},'PASS original 27-variant corner pool, shared-grid slot tables with givens, dependency (red) chains back to decisions/pins, conflict chains');
