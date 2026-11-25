import assert from 'node:assert/strict';import {World} from '../src/core/world.js';import {classifyCourtyards} from '../src/core/courtyards.js';
const cells=Array.from({length:9},(_,id)=>({id,n:4})),grid={cells,neighbors:[]};const w=new World(grid);
w.neighbor=(c,i)=>{const x=c.id%3,y=Math.floor(c.id/3),[dx,dy]=[[1,0],[-1,0],[0,1],[0,-1]][i];return x+dx>=0&&x+dx<3&&y+dy>=0&&y+dy<3?cells[(y+dy)*3+x+dx]:null;};
for(const c of cells)w.fill(c,3);w.fill(cells[4],1);assert.equal(classifyCourtyards(w).mask[4],1);
w.setSolid(cells[1],2,false);assert.equal(w.top(cells[1]),3);let r=classifyCourtyards(w);assert.equal(r.mask[4],0);
{const gap=r.openComponents[0].openings.find(o=>o.neighbor===1);   // 拆贴地层、留第3层=上层桥跨过：仍开口，不封院
 assert.ok(gap&&gap.reason==='wall-layer-gap'&&gap.bridge===true);assert.deepEqual(gap.openLayers,[2]);}
w.setSolid(cells[1],2,true);assert.equal(classifyCourtyards(w).mask[4],1);
w.fill(cells[1],1,{rock:true});r=classifyCourtyards(w);assert.equal(r.mask[4],0);
assert.equal(r.openComponents[0].openings.find(o=>o.neighbor===1).reason,'ground-opening');   // 岩面=地面开口
w.fill(cells[1],1);r=classifyCourtyards(w);assert.equal(r.mask[4],0);   // 街道格本身是地面，并入连通块
assert.ok(r.openComponents[0].cells.includes(1)&&r.openComponents[0].openings.some(o=>o.reason==='grid-boundary'));

/* ---- 矮墙（<1 层）：分区不封院 —— 5×5，内 3×3 后院、外圈 3 层楼墙 ---- */
{
  const C=Array.from({length:25},(_,id)=>({id,n:4})),w2=new World({cells:C,neighbors:[]});
  w2.neighbor=(c,i)=>{const x=c.id%5,y=(c.id/5)|0,[dx,dy]=[[1,0],[-1,0],[0,1],[0,-1]][i];return x+dx>=0&&x+dx<5&&y+dy>=0&&y+dy<5?C[(y+dy)*5+x+dx]:null;};
  const inner=c=>{const x=c.id%5,y=(c.id/5)|0;return x>=1&&x<=3&&y>=1&&y<=3;};
  for(const c of C)w2.fill(c,inner(c)?1:3);
  const r0=classifyCourtyards(w2);
  assert.equal(r0.components.length,1);assert.equal(r0.components[0].length,9);
  assert.deepEqual(r0.subregions.map(s=>[...s].sort((a,b)=>a-b)),[[6,7,8,11,12,13,16,17,18]]);   // 无矮墙=整院一个子区
  assert.deepEqual(r0.lowWallEdges,[]);
  const low=[[12,7],[12,11],[12,13],[12,17]];                     // 中心格四边全矮墙
  const r1=classifyCourtyards(w2,{lowWalls:low});
  assert.equal(r1.components.length,1);assert.equal(r1.mask[12],1);   // 矮墙不拆封闭
  assert.equal(r1.openComponents.length,0);
  assert.equal(r1.subregions.length,1);
  const regs=r1.subregions[0].map(s=>[...s].sort((a,b)=>a-b)).sort((a,b)=>a.length-b.length);
  assert.deepEqual(regs,[[12],[6,7,8,11,13,16,17,18]]);           // 分区如实记录成子区
  assert.equal(r1.lowWallEdges.length,4);                        // 四条矮墙边都生效
  // Set<'a:b'> 与函数两种给法同结果；反向写法也认
  const r2=classifyCourtyards(w2,{lowWalls:new Set(['7:12','11:12','13:12','17:12'])});
  assert.deepEqual(r2.subregions[0].map(s=>s.length).sort(),[1,8]);
  const r3=classifyCourtyards(w2,{lowWalls:(a,b)=>(a===12)!==(b===12)});
  assert.deepEqual(r3.subregions[0].map(s=>s.length).sort(),[1,8]);
  // 确定性：同输入逐字节同输出
  assert.equal(JSON.stringify(classifyCourtyards(w2,{lowWalls:low})),JSON.stringify(r1));
}

/* ---- 真实双网格（quad + mixed）：圈墙围院 → 上层桥不封 → 矮墙分区 → 重封 ---- */
const F=await import('./fixtures/g2-build.mjs');
const {yardScene}=await import('../src/build/scenes-r56.js');
for(const kind of ['quad','mixed']){
  const w3=F.world(kind,'town',7),S=yardScene(w3,{depth:4});
  let r3=classifyCourtyards(w3);
  assert.ok(S.yard.length&&S.yard.every(id=>r3.mask[id]),kind+': ring wall seals the yard');
  assert.equal(r3.openComponents.length,0);
  const wc=w3.cells[S.wall[0]];w3.setSolid(wc,2,false);           // 拆贴地层、留第3层 → 桥跨过缺口
  r3=classifyCourtyards(w3);
  assert.ok(S.yard.some(id=>!r3.mask[id]),kind+': bridge above the gap must not seal the yard');
  const op=r3.openComponents.flatMap(o=>o.openings).find(o=>o.neighbor===wc.id);
  assert.ok(op&&op.reason==='wall-layer-gap'&&op.bridge&&op.openLayers.includes(2),kind+': typed opening');
  w3.setSolid(wc,2,true);                                          // 重封闭
  const r4=classifyCourtyards(w3);assert.ok(S.yard.every(id=>r4.mask[id]),kind+': reseal');
  const st=w3.cells[S.start],yardSet=new Set(S.yard),edges=[];      // 起点格与所有院内邻格间摆矮墙
  for(let i=0;i<st.n;i++){const nb=w3.neighbor(st,i);if(nb&&yardSet.has(nb.id))edges.push([st.id,nb.id]);}
  assert.ok(edges.length>=3,kind+': start cell has yard neighbors');
  const r5=classifyCourtyards(w3,{lowWalls:edges});
  assert.equal(r5.components.length,r4.components.length);          // 仍封闭
  assert.ok(r5.subregions[0].length>=2&&r5.subregions[0].some(g=>g.length===1&&g[0]===st.id),kind+': low wall partitions, does not seal');
  assert.equal(r5.subregions[0].flat().length,S.yard.length);       // 子区不丢格
  assert.equal(JSON.stringify(classifyCourtyards(w3,{lowWalls:edges})),JSON.stringify(r5));  // 确定性
}
console.log('PASS enclosure at wall layer, bridge above gap, typed openings, low-wall subregions, dual grid, determinism');
