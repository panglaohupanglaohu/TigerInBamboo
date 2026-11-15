import assert from 'node:assert/strict';
import {buildHexGrid,buildSquareGrid,buildMixedGrid,buildQuadGrid,buildTriangularSubgrid,gridKindStats,signedArea} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
import {generateTerrain} from '../src/terrain/generate.js';
import {shapeTerrain} from '../src/terrain/shape.js';
// 1670790425232175108：纯六边 / 纯方格 / 纯三角 / 混合 —— 同一套度量（边方向数、顶点度数、内角）
for(const radius of[0,1,4,8])for(const cellSize of[.5,1]){
 const g=buildHexGrid({radius,cellSize}),count=1+3*radius*(radius+1);assert.equal(g.kind,'hex');assert.equal(g.cells.length,count);
 for(const c of g.cells){assert.equal(c.n,6);assert(c.convex);assert(signedArea(c.pts)<0,'clockwise shared contract');
  for(let i=0;i<6;i++){const a=c.pts[i],b=c.pts[(i+1)%6];assert(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-cellSize)<1e-9);const id=c.edgeNeighbors[i];if(id>=0){const o=g.cells[id],j=c.edgeTwins[i];assert.equal(o.edgeNeighbors[j],c.id);assert.equal(o.pts[j],b);assert.equal(o.pts[(j+1)%6],a);}}}
 const st=gridKindStats(g);assert.equal(st.euler,1);if(radius>=1){assert.equal(st.majorDirs,3);assert.deepEqual(Object.keys(st.cellDegree),['3']);assert.equal(st.angleMedian,120);}
}
const S={hex:gridKindStats(buildHexGrid({radius:6})),square:gridKindStats(buildSquareGrid({radius:6})),tri:gridKindStats(buildMixedGrid({radius:7,mergeRate:0,seed:5})),mixed:gridKindStats(buildMixedGrid({radius:7,seed:5})),quad:gridKindStats(buildQuadGrid({radius:7,seed:5}))};
assert.equal(S.square.majorDirs,2);assert.deepEqual(S.square.valence,{4:S.square.interior});assert.equal(S.square.angleMedian,90);
assert.equal(S.tri.majorDirs,3);assert.deepEqual(S.tri.valence,{6:S.tri.interior});assert.equal(S.tri.angleMedian,60);
assert.deepEqual(S.hex.valence,{3:S.hex.interior});
assert(Object.keys(S.mixed.faceTypes).join()==='3,4'&&Object.keys(S.mixed.valence).length>1);
assert(S.quad.sixPct!==null&&S.quad.sixPct<5&&S.square.sixPct===0&&S.hex.sixPct===null);
for(const s of Object.values(S))assert.equal(s.euler,1);
const sub=gridKindStats(buildTriangularSubgrid(buildSquareGrid({radius:3})));assert.equal(sub.faceTypes[3],sub.faces);assert.equal(sub.euler,1);
// 纯六边网格直接进共享 World：地形生成 + 层级切面平滑都能跑、坐标有限
const g=buildHexGrid({radius:9,cellSize:.7}),w=new World(g);generateTerrain(w,{seed:7});const land=g.cells.filter(c=>w.top(c)>0).length;assert(land>20&&land<g.cells.length);
const sh=shapeTerrain(w);let checked=0;for(const c of g.cells)for(const p of c.pts){for(let s=0;s<sh.slices;s++){assert(sh.at(p,s).every(Number.isFinite));checked++;}}
for(const o of[{radius:-1},{radius:1.5},{radius:65},{cellSize:0},{cellSize:NaN}])assert.throws(()=>buildHexGrid(o),RangeError);
console.log(JSON.stringify(S),{land,checked},'PASS pure hex grid on shared contract + World/terrain/shape; unified grid-kind metrics for hex/square/tri/mixed/quad');
