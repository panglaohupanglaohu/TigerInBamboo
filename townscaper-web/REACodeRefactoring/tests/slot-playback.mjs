// 第 55 批 G5 slotsolve（865200072685912064）：slots.html 用的数据——10×8 槽位表、27 种变体缩略图池、逐帧候选快照与每帧的红色依赖链。
import assert from 'node:assert/strict';
import {generateModulePatch} from '../src/core/module-patch.js';
import {cornerSlots,solveWFC,dependencyChain,findWFCConflicts} from '../src/core/wfc.js';
const COLS=10,ROWS=8,vertices=[],faces=[];for(let r=0;r<=ROWS;r++)for(let c=0;c<=COLS;c++)vertices.push([c,r]);
for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const v=(cc,rr)=>rr*(COLS+1)+cc;faces.push([v(c,r),v(c+1,r),v(c+1,r+1),v(c,r+1)]);}
const grid=generateModulePatch({vertices,faces});assert.equal(grid.cells.length,80);
let frames=0,chains=0;
for(const seed of[1,7,13]){
 const S=cornerSlots(grid,{K:3,seed,givenRatio:.18});assert.equal(S.tiles.length,27);
 const r=solveWFC(grid,{tiles:S.tiles,seed,pins:S.pins,traceLimit:256,explain:true});assert(r.ok);assert(!r.traceTruncated);
 assert.deepEqual(findWFCConflicts(grid,r.tiles,S.tiles),[]);
 // 动画帧：未定槽位数单调不增（无回溯时），最后一帧全定
 const und=r.trace.map(f=>Object.values(f.domains).filter(d=>d.length>1).length);
 if(!r.backtracks)for(let i=1;i<und.length;i++)assert(und[i]<=und[i-1]);assert.equal(und.at(-1),0);
 // 每帧的依赖链：只用到该帧之前的删减记录；相邻链节共边；链源是决定或给定
 const byCell=new Map(grid.cells.map(c=>[c.id,c]));
 for(const f of r.trace){const live=r.causes.filter(c=>c.decisions<=f.decisions),li=live.findLastIndex(c=>c.from!==null&&c.from!==undefined);if(li<0)continue;
  const ch=dependencyChain(live.slice(0,li+1),live[li].cell);assert(ch.length>=2);for(let i=0;i+1<ch.length;i++)assert(byCell.get(ch[i].cell).edgeNeighbors.includes(ch[i+1].cell));
  assert(['decision','pin'].includes(ch.at(-1).kind));chains++;}
 frames+=r.trace.length;
 // 冲突示例：把一个给定槽位改成与给定邻居不符 → 初始传播即矛盾，冲突链终于一个给定
 const c=grid.cells.find(c=>S.pins[c.id]!==undefined&&c.edgeNeighbors.some(nb=>S.pins[nb]!==undefined)),e=c.edgeNeighbors.findIndex(nb=>S.pins[nb]!==undefined),cur=S.tiles.find(t=>t.id===S.pins[c.id]);
 const bad=solveWFC(grid,{tiles:S.tiles,seed,pins:{...S.pins,[c.id]:S.tiles.find(t=>t.edges[e]!==cur.edges[e]).id},traceLimit:256,explain:true});
 assert(!bad.ok);assert(bad.conflicts.length>=1);assert.equal(bad.conflicts[0].at(-1).kind,'pin');
}
console.log('PASS SLOTS playback data: 27-variant pool, per-frame candidate snapshots, per-frame red dependency chains, conflict chain',{frames,chains});
