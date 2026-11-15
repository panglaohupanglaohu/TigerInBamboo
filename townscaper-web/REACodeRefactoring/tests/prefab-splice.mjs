// 第 55 批 G5 tileforce：1751932427272909032「先生成模块需要的那一小块网格」+ 1579483114178768898「一个房子 tile 同时盖方格和三角格」
// + 1670794261669769217「条件特别苛刻的 tile 很久都不出现」。合成小块 → 缝进已有网格（周边补网/接缝）→ 3D prefab 带 socket 强制出现。
import assert from 'node:assert/strict';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {synthesizeModulePatch,spliceModulePatch,halfEdgeClosure} from '../src/core/module-patch.js';
import {describeModule,findModulePatches} from '../src/core/module-search.js';
import {findWFCConflicts,layerGrid,solveWithPrefab} from '../src/core/wfc.js';
import {migrateWorldToPatch} from '../src/core/radial-patch.js';
import {World} from '../src/core/world.js';
import {selfCheck} from '../src/core/adjacency.js';
import {CLIP,forcePrefab} from './fixtures/g5-prefab.mjs';
// ① 缝进：合成块放进真实网格，原外圈顶点对象保留，半边全闭合，模块诱导邻接与模式一致
let spliced=0,seams=0,minAngle=180;
for(const [kind,mk] of [['mixed',s=>buildMixedGrid({radius:12,seed:s})],['quad',s=>buildQuadGrid({radius:8,seed:s})]])for(const seed of[1,3,5]){
 const g=mk(seed),before=JSON.stringify(g.cells.map(c=>c.pts.map(p=>p.id))),s=synthesizeModulePatch(CLIP,{scale:g.hexSize});
 for(const at of[{x:0,z:0},{x:1.3,z:-.8}]){
  const out=spliceModulePatch(g,s.grid,at);const h=halfEdgeClosure(out);assert(h.ok,JSON.stringify(h));
  assert.equal(selfCheck(out,new World(out)).mismatched,0,'geometry adjacency');
  assert.deepEqual(describeModule(out,out.splice.patchCellIds),CLIP,'module adjacency survives the splice');
  // 外圈原样：没被切的格，角点坐标完全不动
  for(const [i,src] of out.sourceCellOf.entries())if(src>=0){const a=out.cells[i].pts.map(p=>[p.x,p.z]).sort().join(),b=g.cells[src].pts.map(p=>[p.x,p.z]).sort().join();assert.equal(a,b);}
  // 接缝：只有三角形，全部同向（不翻折），面积和 = 洞面积
  for(const id of out.splice.seamCellIds){const c=out.cells[id];assert.equal(c.n,3);const ang=[0,1,2].map(k=>{const p=c.pts[k],q=c.pts[(k+1)%3],r=c.pts[(k+2)%3],u=[q.x-p.x,q.z-p.z],v=[r.x-p.x,r.z-p.z];return Math.acos((u[0]*v[0]+u[1]*v[1])/Math.hypot(...u)/Math.hypot(...v))*180/Math.PI;});minAngle=Math.min(minAngle,...ang);}
  const area=c=>{let a=0;for(let i=0;i<c.n;i++){const p=c.pts[i],q=c.pts[(i+1)%c.n];a+=p.x*q.z-q.x*p.z;}return Math.abs(a)/2;};
  const holeA=out.splice.removedCells.reduce((s,id)=>s+area(g.cells[id]),0),newA=[...out.splice.patchCellIds,...out.splice.seamCellIds].reduce((s,id)=>s+area(out.cells[id]),0);
  assert(Math.abs(holeA-newA)<1e-6*holeA,'no gaps/overlaps: area conserved');
  assert.equal(JSON.stringify(g.cells.map(c=>c.pts.map(p=>p.id))),before,'source grid untouched');
  spliced++;seams+=out.splice.seamCellIds.length;
 }
}
assert.throws(()=>spliceModulePatch(buildMixedGrid({radius:3,seed:1}),synthesizeModulePatch(CLIP).grid,{x:2.5,z:0}),RangeError,'hole reaching the boundary refused');
// ② 已有 World 跟着迁过去：外圈逐列照抄，补进来的格按最近被切格重采样
{const g=buildMixedGrid({radius:12,seed:3}),w=new World(g);for(const c of w.cells)if(Math.hypot(c.cx,c.cz)<5)w.fill(c,1+(c.id%3),{rock:true});
 const out=spliceModulePatch(g,synthesizeModulePatch(CLIP,{scale:g.hexSize}).grid,{x:.5,z:.2}),m=migrateWorldToPatch(w,out,World);
 assert.equal(m.copied+m.resampled,out.cells.length);for(const [i,src] of out.sourceCellOf.entries())if(src>=0)assert.equal(m.world.top(m.world.cells[i]),w.top(w.cells[src]));}
// ③ 3D prefab/socket：两层 × 7 格（4 方 + 3 三角）的房子，四周 W 墙、底层一扇 D 门、顶 R、底 S；周围由 WFC 按 socket 补齐
let forcedSplice=0,forcedFound=0;
for(const seed of[1,2,3,4]){
 const g=buildMixedGrid({radius:12,seed});
 for(const forceSplice of[true,false]){
  const F=forcePrefab(g,{seed,forceSplice,at:{x:.4*seed-1,z:.3}});if(!forceSplice&&!F.result)continue;assert(F.result?.ok,'prefab forced, seed '+seed);
  if(F.spliced){forcedSplice++;assert(F.closure.ok);}else forcedFound++;
  const r=F.result;assert.deepEqual(findWFCConflicts(F.lattice,r.tiles,r.catalog,{compatible:r.compatible}),[]);
  F.mapping.forEach((id,i)=>assert.equal(r.tiles[id],'prefab#'+i));
  assert.equal(Object.values(r.tiles).filter(t=>t.startsWith('prefab#')).length,F.mapping.length,'prefab appears exactly once');
  // socket 真起作用：底面 S → 下面一层必须是顶面 S 的实心（台基）；门 D 外侧必须是空气或墙
  for(const id of F.mapping){const c=F.lattice.cells[id],below=c.edgeNeighbors.at(-1);if(below>=0&&!F.mapping.includes(below)){const t=r.catalog.find(x=>x.id===r.tiles[below]);assert(t.solid&&t.edges.at(-2).label==='S','plinth under prefab');}}
  const doorPart=r.parts.find(p=>p.edges.some(e=>e?.label==='D'));assert(doorPart,'door socket');
 }
}
assert(forcedSplice>=4,'spliced prefab every seed');
// 原随机网格上搜索 3D 足迹：同一 prefab 在 r 很小的随机网格里大多找不到 → 必须合成
assert(minAngle>5,'seam quality after flips '+minAngle);
let missing=0;for(let s=1;s<=10;s++)if(!findModulePatches(buildQuadGrid({radius:4,seed:s}),CLIP,{limit:1}).matches.length)missing++;
console.log('PASS splice synthesized module patch into live grid (closed half-edges, area conserved, World migrated) + forced 3D prefab with sockets',{spliced,seams,minSeamAngle:+minAngle.toFixed(1),forcedSplice,forcedFound,smallQuadGridsMissingClip:missing});
