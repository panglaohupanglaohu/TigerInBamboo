import assert from 'node:assert/strict';
import {buildSquareGrid,buildQuadGrid,buildMixedGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {cornerFootprint,cornerCutPlan,footprintMetrics,islandFootprints} from '../src/core/corner-footprint.js';
// 1) 全格切角计划：方格/四边形网格的顶点图二分 → 每格恰好两个对角被切，共享顶点四面一致
for(const g of [buildSquareGrid({radius:5}),buildQuadGrid({radius:6,seed:4})]){const p=cornerCutPlan(g);assert(p.bipartite);for(const c of g.cells){const k=c.pts.map(q=>p.cut.has(q.id));assert.equal(k.filter(Boolean).length,2);assert(k[0]===k[2]&&k[1]===k[3]);}}
assert.equal(cornerCutPlan(buildMixedGrid({radius:4,seed:2})).bipartite,false);
// 2) REACode squarehex.runMetrics 的口径，在真实格子上量：两角切(t=.5)：6 边形、内角 90°×2+135°×4、面积 0.75、共边 0.5
const sq=buildSquareGrid({radius:4}),plan=cornerCutPlan(sq),all=sq.cells.map(c=>cornerFootprint(c,{cut:.5,corners:c.pts.map(q=>plan.cut.has(q.id))}));
for(const f of all)assert.equal(f.points.length,6);const m2=footprintMetrics(sq,all);
assert(Math.abs(m2.areaRatio-.75)<1e-12);assert(Math.abs(m2.contact-.5)<1e-12);assert.equal(m2.brokenEdges,0);assert(Math.abs(m2.meanAngleDev-20)<1e-9,'mean |angle-120| = 20°');
const four=sq.cells.map(c=>cornerFootprint(c,{cut:.5,all:true})),m4=footprintMetrics(sq,four);
// 与 REACode runMetrics(.5,'cut4') 实跑一致：退成菱形，hexErr 30、面积 0.5、共边 0（其注释里的“15°”与代码不符；15° 是 cut4@0.25 的八边形）
assert(Math.abs(m4.meanAngleDev-30)<1e-9&&Math.abs(m4.areaRatio-.5)<1e-12);assert.equal(m4.contact,0);
const oct=footprintMetrics(sq,sq.cells.map(c=>cornerFootprint(c,{cut:.25,all:true})));assert(Math.abs(oct.meanAngleDev-15)<1e-9&&Math.abs(oct.contact-.5)<1e-12);assert.equal(m4.brokenEdges,m4.sharedEdges,'cut4: tiles only touch at points');
const none=footprintMetrics(sq,sq.cells.map(c=>cornerFootprint(c,{cut:0})));assert(Math.abs(none.meanAngleDev-30)<1e-9&&none.contact===1);
// 3) 岩岛：共享 World 的真实地形，只给陆地方格出轮廓；计划模式保持连通，cut4 散开
const stats={};
for(const [name,g] of [['square',buildSquareGrid({radius:9,cellSize:.8})],['quad',buildQuadGrid({radius:8,seed:6})]]){
 const w=new World(g);generateTerrain(w,{seed:3});const snap=JSON.stringify(w.snapshot()),cells=JSON.stringify(g.cells.map(c=>c.edgeNeighbors));
 const p=islandFootprints(w,{cut:.5}),a=islandFootprints(w,{cut:.5,mode:'all'});
 assert.equal(p.footprints.length,g.cells.filter(c=>w.ground(c)>0).length);assert(p.footprints.length>10);
 assert.equal(p.metrics.brokenEdges,0);assert(p.metrics.contact>.3);assert.equal(a.metrics.contact,0);assert(p.metrics.meanAngleDev<none.meanAngleDev);
 assert.equal(JSON.stringify(w.snapshot()),snap);assert.equal(JSON.stringify(g.cells.map(c=>c.edgeNeighbors)),cells);
 stats[name]={land:p.footprints.length,plan:{angleDev:+p.metrics.meanAngleDev.toFixed(2),area:+p.metrics.areaRatio.toFixed(3),contact:+p.metrics.contact.toFixed(3)},cut4:{angleDev:+a.metrics.meanAngleDev.toFixed(2),contact:a.metrics.contact}};
}
assert.throws(()=>islandFootprints(new World(buildMixedGrid({radius:3})),{}),/bipartite/);assert.throws(()=>cornerFootprint(sq.cells[0],{corners:[true]}));
console.log(stats,'PASS whole-grid bipartite corner plan, squarehex runMetrics on real cells (cut2 6-gon/0.75/0.5/20°, cut4@.5 diamond 0 contact, cut4@.25 octagon 15°), rocky-island footprints on shared World');
