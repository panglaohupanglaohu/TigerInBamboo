// 第 55 批 G5：gridmodes（1670790425232175108 / 1447496205282549761 / 1447494168448753667）3D 分层联合约束
// + tileplace（784847588893814785 Placer 加权）共享 WFC 加权香农熵。
import assert from 'node:assert/strict';
import {buildSquareGrid,buildQuadGrid,buildMixedGrid,buildTriangularSubgrid} from '../src/core/grid.js';
import {solveWFC,findWFCConflicts,layerGrid,layeredJointCatalog} from '../src/core/wfc.js';
import {VCOMPAT,joint3dTiles} from './fixtures/g5-joint3d.mjs';
// ① 加权熵：默认关时 weight 不起作用（与 r53 行为一致）；开后出现频率跟权重走
const g=buildSquareGrid({radius:6}),free=[{id:'a',weight:9,edges:['x','x','x','x']},{id:'b',weight:1,edges:['x','x','x','x']}];
const share=r=>Object.values(r.tiles).filter(t=>t==='a').length/g.cells.length;
const off=solveWFC(g,{tiles:free,seed:4}),offW=solveWFC(g,{tiles:free.map(t=>({...t,weight:1})),seed:4});
assert.deepEqual(off.tiles,offW.tiles,'weighted=false ignores weights');
let on=0;for(const seed of[1,2,3,4,5])on+=share(solveWFC(g,{tiles:free,seed,weighted:true}))/5;
assert(Math.abs(share(off)-.5)<.12,'unweighted ≈ 50%');assert(on>.82&&on<.97,'weighted ≈ 90% got '+on);
// 熵挑格：同为 2 个候选，权重偏斜（9:1）的格熵更低，先被决定——即使它 id 更大
const two={cells:[{id:0,n:3,edgeNeighbors:[-1,-1,-1]},{id:1,n:3,edgeNeighbors:[-1,-1,-1]}]};
const t2=[{id:'p',weight:1,edges:[0,0,0]},{id:'q',weight:1,edges:[0,0,0]},{id:'r',weight:9,edges:[0,0,0]},{id:'s',weight:1,edges:[0,0,0]}];
const first=o=>solveWFC(two,{tiles:t2,allowed:{0:['p','q'],1:['r','s']},explain:true,...o}).causes.find(c=>c.kind==='decision').cell;
assert.equal(first({}),0,'count entropy: tie -> lower id');assert.equal(first({weighted:true}),1,'Shannon: skewed cell first');
assert.throws(()=>solveWFC(g,{tiles:[{id:'z',weight:0,edges:[1,1,1,1]}],weighted:true}),RangeError);
// ② layerGrid：上下半边互为孪生
const L=layerGrid(buildMixedGrid({radius:3,seed:2}),3);
for(const c of L.cells)c.edgeNeighbors.forEach((nb,e)=>{if(nb<0)return;assert.equal(L.cells[nb].edgeNeighbors[c.edgeTwins[e]],c.id);});
// ③ 3D 分层联合约束：四个对角子三角 × 每层同一模块；两层高的塔模块 = 4 子格 × 2 层 共 8 个子格同一模块
const {quadTiles,triTiles}=joint3dTiles();let towers=0,groups=0,solves=0;
for(const [name,src] of [['square',buildSquareGrid({radius:2})],['quad',buildQuadGrid({radius:3,seed:4})],['mixed',buildMixedGrid({radius:4,seed:5})]]){
 const sub=buildTriangularSubgrid(src),J=layeredJointCatalog(sub,3,{quadTiles,triTiles,compatible:VCOMPAT}),byId=new Map(J.tiles.map(t=>[t.id,t]));
 for(const seed of[1,3,9]){
  const r=solveWFC(J.lattice,{tiles:J.tiles,allowed:J.allowed,compatible:J.compatible,seed,weighted:true});assert(r.ok,name+seed+r.reason);solves++;
  assert.deepEqual(findWFCConflicts(J.lattice,r.tiles,J.tiles,{compatible:J.compatible}),[]);
  const d=J.decode(r.tiles);assert.equal(d.levels.length,3);
  // 每层每个父格都解回一个父 tile；父格之间共享边插槽一致（父网格层面也是合法解）
  for(let k=0;k<3;k++){assert.equal(Object.keys(d.levels[k]).length,src.cells.length);
   for(const c of src.cells)c.edgeNeighbors.forEach((nb,e)=>{if(nb<0)return;const A=[...quadTiles,...triTiles].find(t=>t.id===d.levels[k][c.id]),B=[...quadTiles,...triTiles].find(t=>t.id===d.levels[k][nb]);assert.equal(A.edges[e],B.edges[c.edgeTwins[e]],'parent sockets per layer');});}
  // 重力：实心不压在空气上
  for(const c of src.cells)for(let k=1;k<3;k++){const lo=[...quadTiles,...triTiles].find(t=>t.id===d.levels[k-1][c.id]),hi=[...quadTiles,...triTiles].find(t=>t.id===d.levels[k][c.id]);assert(!(hi.solid&&!lo.solid),'no floating');}
  for(const m of d.modules){if(m.levels===2){towers++;assert.equal(d.levels[m.level-1][m.cell],'qT');assert.equal(d.levels[m.level][m.cell],'qT');}}
  groups+=d.modules.length;
  // 拆散跨层模块：decode 拒绝
  const tw=d.modules.find(m=>m.levels===2);if(tw){const g4=sub.subdivision.groups.find(x=>x.sourceCell===tw.cell),bad={...r.tiles},id=g4.children[0]*3+tw.level;bad[id]=J.allowed[id].find(x=>!x.startsWith('quad:qT@1'));assert.throws(()=>J.decode(bad),/joint|multi-level/);}
 }
 // 钉住塔的一个子格（第 1 层下半部）→ 同组 4 子格 × 2 层都跟着成塔
 const g4=sub.subdivision.groups.find(x=>x.children.length===4),pin=J.allowed[g4.children[0]*3].find(id=>id.startsWith('quad:qT@0'));
 const p=solveWFC(J.lattice,{tiles:J.tiles,allowed:J.allowed,compatible:J.compatible,seed:2,pins:{[g4.children[0]*3]:pin},weighted:true});assert(p.ok,p.reason);
 for(const ch of g4.children){assert(p.tiles[ch*3].startsWith('quad:qT@0'));assert(p.tiles[ch*3+1].startsWith('quad:qT@1'));}
 // 塔的下半部不能放在最顶层（上面没地方放上半部）
 for(const ch of g4.children)assert(!J.allowed[ch*3+2].some(id=>id.startsWith('quad:qT@0')));
}
assert(towers>3,'weighted catalog yields two-storey joint modules: '+towers);
console.log('PASS weighted Shannon entropy (opt-in) + 3D layered four-subtile joint modules incl. 2-storey modules',{weightedShare:+on.toFixed(3),solves,groups,towers});
