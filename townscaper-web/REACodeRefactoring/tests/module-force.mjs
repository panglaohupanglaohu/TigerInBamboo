import assert from 'node:assert/strict';
import {buildMixedGrid} from '../src/core/grid.js';
import {synthesizeModulePatch,PATCH_EXAMPLE,generateModulePatch} from '../src/core/module-patch.js';
import {describeModule,findModulePatches} from '../src/core/module-search.js';
import {solveWithModule,solveWFC,findWFCConflicts} from '../src/core/wfc.js';
import {World} from '../src/core/world.js';
import {selfCheck} from '../src/core/adjacency.js';
// 1) 从邻接图"造那一小块网格"：诱导邻接与模式完全一致（含环），走共享模板校验
const patterns={chain:{sides:[4,4,3],adj:[[1],[0,2],[1]]},
 star4:{sides:[4,4,4,4],adj:[[1,3],[0,2],[1,3],[0,2]]},        // 4 个方格围一个顶点（环）
 hex6:{sides:[3,3,3,3,3,3],adj:[[1,5],[0,2],[1,3],[2,4],[3,5],[0,4]]}, // 6 个三角围一个顶点
 clip:{sides:[4,4,3,3,3,4,4],adj:[[1,4,6],[0,2,5],[1,3],[2,4],[0,3],[1],[0]]}}; // 4 方 + 3 三角（1751932427272909032 那块的格型构成；围点 3.3.3.4.4 闭环）
const made={};
for(const [name,p] of Object.entries(patterns)){const r=synthesizeModulePatch(p);assert.deepEqual(describeModule(r.grid,r.mapping),p,name);assert.equal(selfCheck(r.grid,new World(r.grid)).mismatched,0);made[name]={cells:r.grid.cells.length,verts:r.grid.verts.length,tries:r.tries};}
// 正多边形的边界：PATCH_EXAMPLE 里是直角三角（半个方格），正三角形拼不出来 → 明确拒绝而不是糊一个错的
assert.throws(()=>synthesizeModulePatch(describeModule(generateModulePatch(PATCH_EXAMPLE),[0,1,2,3,4])),/not realisable/);
assert.throws(()=>synthesizeModulePatch({sides:[4,4,4,4,4],adj:[[1,4],[0,2],[1,3],[2,4],[3,0]]}),RangeError,'5 regular quads cannot close around a vertex');
assert.throws(()=>synthesizeModulePatch({sides:[4,3],adj:[[],[]]}),RangeError);
// 2) 强制模块出现：在真实混合网格里找到同构位置 → 模块格钉成"内部接口"的 tile → WFC 填周围
const tiles=[3,4].flatMap(n=>{const S=[0,1,'M'],out=[];for(let code=0;code<3**n;code++){const e=[];let x=code;for(let i=0;i<n;i++){e.push(S[x%3]);x=Math.floor(x/3);}out.push({id:n+':'+e.join(''),edges:e});}return out;});
let forced=0,rejectedFootprints=0;
for(let seed=1;seed<=6;seed++){
 const g=buildMixedGrid({radius:6,seed}),w=new World(g);
 const free=solveWFC(g,{tiles:tiles.filter(t=>!t.edges.includes('M')),seed});assert(free.ok);
 for(const name of['chain','clip']){
  const found=findModulePatches(g,patterns[name],{limit:8});if(!found.matches.length)continue;
  let hit=null;for(const m of found.matches){const r=solveWithModule(g,{tiles,mapping:m,inner:'M',seed});if(r.ok){hit=r;break;}rejectedFootprints++;}
  assert(hit,'some footprint hosts the module');forced++;
  assert.deepEqual(findWFCConflicts(g,hit.tiles,tiles),[]);
  const inside=new Set(hit.mapping);
  for(const c of g.cells){const t=tiles.find(t=>t.id===hit.tiles[c.id]);c.edgeNeighbors.forEach((nb,e)=>{assert.equal(t.edges[e]==='M',inside.has(c.id)&&inside.has(nb),'M exactly on module-internal edges');});}
  // 模块形状在网格里真实存在（诱导同构）
  assert.deepEqual(describeModule(g,hit.mapping),patterns[name]);
 }
 void w;
}
assert(forced>=6,'forced '+forced);
assert.throws(()=>solveWithModule(buildMixedGrid({radius:2}),{tiles,mapping:[],inner:'M'}));
console.log(made,{forced,rejectedFootprints},'PASS adjacency-pattern synthesis with exact induced adjacency (cycles close), module forced into real grids via joint WFC sockets');
