// REACode/depfill.js (1447488323845509121 "Erosion valid terrain with no local minimums"):
// micro-slope drainage surface, lake clusters, local-minimum/drained diagnostics and river replanning
// on real generated shared-World terrain (mixed + quad grids).
import assert from'node:assert/strict';
import{World}from'../src/core/world.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';
import{generateTerrain}from'../src/terrain/generate.js';import{fillTerrainDepressions}from'../src/terrain/drainage.js';
import{depressionFill,lakeClusters,localMinima,drainedCells}from'../src/core/depression-fill.js';import{buildNav}from'../src/world/navgraph.js';
// Synthetic: 7x7, ring at 4, 3x3 basin at 1 → one lake of 9 cells, level 4, depth 3.
const n=7,cells=Array.from({length:n*n},(_,id)=>{const x=id%n,y=Math.floor(id/n);return{id,edgeNeighbors:[x?id-1:-1,x+1<n?id+1:-1,y?id-n:-1,y+1<n?id+n:-1]}}),h=cells.map(c=>{const x=c.id%n,y=Math.floor(c.id/n);return x===0||y===0||x===6||y===6?0:x===1||y===1||x===5||y===5?4:1});
assert.deepEqual(localMinima(cells,h),[]);// 3x3 flat floor: none strictly lower than all neighbours…
assert.ok(drainedCells(cells,h).share<1);// …but water is still trapped (REACode drained()).
const pin=[...h];pin[24]=0.5;assert.deepEqual(localMinima(cells,pin),[24]);
const flat=depressionFill(cells,h),slope=depressionFill(cells,h,{microSlope:1e-3});
assert.deepEqual([...slope.filled],[...flat.filled]);// integer World surface unchanged by micro-slope
const L=lakeClusters(cells,h,slope);assert.equal(L.lakes.length,1);assert.equal(L.lakes[0].area,9);assert.equal(L.lakes[0].level,4);assert.equal(L.lakes[0].depth,3);
assert.ok(L.lakes[0].spillCell>=0&&L.lakeOf[L.lakes[0].spillCell]<0&&slope.filled[L.lakes[0].spillCell]<=4);
let flatTies=0;for(const c of cells){const p=flat.parent[c.id];if(p>=0&&flat.filled[p]===flat.filled[c.id])flatTies++;const q=slope.parent[c.id];if(q>=0)assert.ok(slope.surface[q]<slope.surface[c.id],'micro-slope: parent strictly lower');}
assert.ok(flatTies>0,'without micro-slope, flats have no direction');
assert.throws(()=>depressionFill(cells,h,{microSlope:.6}));assert.throws(()=>depressionFill(cells,h,{microSlope:.3}),/micro slope too large/);
// Real generator, both grid kinds, three seeds.
const stats={};
for(const[name,grid]of[['mixed',buildMixedGrid({radius:9,seed:7})],['quad',buildQuadGrid({radius:9,seed:7})]])for(const seed of[1,7,19]){
 const w=new World(grid),r=generateTerrain(w,{seed,drainage:{microSlope:1e-3}}),d=r.drainage,ground=w.cells.map(c=>w.ground(c));
 assert.equal(d.version,w.version);assert.equal(d.minimaAfter,0);assert.equal(d.drained,1);assert.equal(localMinima(w.cells,ground).length,0);assert.equal(drainedCells(w.cells,ground).share,1);
 for(const c of w.cells){assert.equal(ground[c.id],d.filled[c.id]);assert.equal(Math.floor(d.surface[c.id]),d.filled[c.id]);const p=d.parent[c.id];if(p>=0)assert.ok(d.surface[p]<d.surface[c.id]);}
 for(const lake of d.lakes){for(const id of lake.cells)assert.equal(d.filled[id],lake.level);assert.ok(lake.spillCell<0||d.filled[lake.spillCell]<=lake.level);}
 const again=fillTerrainDepressions(w);assert.equal(again.raised,0);// idempotent on the filled World
 stats[name+seed]=[d.minimaBefore,d.raised,d.lakes.length];
}
// Rivers recomputed on the filled terrain (terrain-only generation), navigation reads the replanned tree.
for(const grid of[buildMixedGrid({radius:9,seed:7}),buildQuadGrid({radius:9,seed:7})]){
 const w=new World(grid),r=generateTerrain(w,{seed:7,caves:0,features:false,drainage:{rivers:'replan',riverOptions:{threshold:6}}}),net=w.riverNetwork;
 assert.ok(net&&net.version===w.version&&net.riverCells>0);assert.equal(r.drainage.riverNetwork,net);assert.equal(w.riverFlow,null);
 assert.equal(localMinima(w.cells,w.cells.map(c=>w.ground(c))).length,0);
 const nav=buildNav(w);assert.equal(nav.flowSource,'network');
 for(const c of w.cells)if(w.river[c.id]){const p=net.parent[c.id];if(p>=0&&w.river[p])assert.ok(w.ground(w.cells[p])<=w.ground(c));}
 const snap=JSON.stringify(w.snapshot());assert.throws(()=>fillTerrainDepressions(w,{rivers:'bogus'}));assert.equal(JSON.stringify(w.snapshot()),snap);
}
console.log('PASS depfill: micro-slope strict drainage, lakes(level/depth/spill), minima/drained diagnostics, 6 real terrains zero minima, river replan',JSON.stringify(stats));
