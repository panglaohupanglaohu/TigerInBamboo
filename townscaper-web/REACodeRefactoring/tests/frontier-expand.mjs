import assert from 'node:assert/strict';
import {buildQuadGrid,buildMixedGrid} from '../src/core/grid.js';
import {expandFrontier,frontierCandidates} from '../src/core/frontier-candidates.js';
import {findWFCConflicts} from '../src/core/wfc.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
// edge-height tiles（REACode frontier.makeTileSet，推广到 3/4 边）：每条边要求一个高度 0..2，中心高 = 均值取整
const L=3,tiles=[3,4].flatMap(n=>Array.from({length:L**n},(_,code)=>{const e=[];let x=code;for(let i=0;i<n;i++){e.push(x%L);x=Math.floor(x/L);}return{id:n+':'+code,edges:e,h:Math.round(e.reduce((a,b)=>a+b,0)/n)};}));
const walkable=(a,ea,b,eb)=>a.edges[ea]===b.edges[eb]&&Math.abs(a.h-b.h)<=1;
const stats={};
for(const [name,build] of [['quad',buildQuadGrid],['mixed',buildMixedGrid]]){
 const g=buildQuadGrid===build?build({radius:5,seed:3}):build({radius:7,seed:3}),w=new World(g);generateTerrain(w,{seed:4,maxLevels:3});
 // 真实地形高度当偏好：候选按 |tile.h − 地面层| 排序（"按地形约束坍缩"）
 const want=c=>Math.min(L-1,w.ground(c)),prefer=(c,t)=>Math.abs(t.h-want(c));
 const inner=g.cells.filter(c=>c.edgeNeighbors.every(n=>n>=0)),a=inner[0],b=inner.at(-1),flat=c=>tiles.find(t=>t.edges.length===c.n&&t.edges.every(e=>e===want(c)));
 const before=JSON.stringify(g.cells),r=expandFrontier(g,{tiles,seeds:{[a.id]:flat(a).id,[b.id]:flat(b).id},walkable,prefer});
 assert(r.complete);assert.equal(JSON.stringify(g.cells),before);
 // 1) 已坍缩部分处处插槽一致（只看已放的格子）
 const sub={...g,cells:g.cells.filter(c=>r.assignment[c.id]!==undefined).map(c=>({...c,edgeNeighbors:c.edgeNeighbors.map(n=>r.assignment[n]!==undefined?n:-1)}))};
 assert.deepEqual(findWFCConflicts(sub,r.assignment,tiles),[]);
 assert(r.stats.placed+2+r.dead.length===g.cells.length,'every cell is placed or dead');
 // 2) 只在坍缩边上枚举：每一步的候选数 = 用当时已坍缩邻居做的局部探测；远小于全集
 const replay={};for(const o of r.order){if(o.candidates!==null){const row=frontierCandidates(g,{tiles,collapsed:replay}).rows.find(x=>x.cell===o.cell);assert(row,'placed cell was on the frontier');assert.equal(row.candidates.length,o.candidates);}replay[o.cell]=o.tile;}
 const evaluated=r.order.filter(o=>o.candidates!==null).reduce((s,o)=>s+o.candidates,0);assert(evaluated<r.stats.naiveTests*.25,'candidates around the collapsed edge are few vs placed x catalog');
 // 3) 简化导航图：边都在相邻、可走的已坍缩格之间；两个种子的生长最终互连
 const byId=new Map(g.cells.map(c=>[c.id,c]));for(const [x,y] of r.nav){assert(byId.get(x).edgeNeighbors.includes(y));}
 assert(r.merges.length>=1,'two seed regions interconnect');assert.deepEqual(r.merges[0].seeds.flat().sort((x,y)=>x-y),[a.id,b.id].sort((x,y)=>x-y));
 // 4) 前向检查减少死格；确定性；预算截断
 const blind=expandFrontier(g,{tiles,seeds:{[a.id]:flat(a).id,[b.id]:flat(b).id},walkable,prefer,forwardCheck:false});assert(r.dead.length<=blind.dead.length);
 assert.deepEqual(expandFrontier(g,{tiles,seeds:{[b.id]:flat(b).id,[a.id]:flat(a).id},walkable,prefer}).assignment,r.assignment);
 const cut=expandFrontier(g,{tiles,seeds:{[a.id]:flat(a).id},walkable,maxTests:200});assert(!cut.complete);
 const terrainMatch=g.cells.filter(c=>r.assignment[c.id]!==undefined&&tiles.find(t=>t.id===r.assignment[c.id]).h===want(c)).length/(r.stats.placed+2);
 stats[name]={cells:g.cells.length,placed:r.stats.placed,dead:r.dead.length,blindDead:blind.dead.length,mean:+r.stats.meanCandidates.toFixed(2),probeTests:r.stats.tests,naive:r.stats.naiveTests,nav:r.nav.length,components:r.components.slice(0,3),mergeAt:r.merges[0].at,terrainMatch:+terrainMatch.toFixed(2)};
}
assert.throws(()=>expandFrontier({cells:[]},{tiles:[]}));
console.log(stats,'PASS incremental frontier-only placement on shared grids, forward-checked, nav graph grows from two seeds and interconnects, terrain preference, budget cut');
