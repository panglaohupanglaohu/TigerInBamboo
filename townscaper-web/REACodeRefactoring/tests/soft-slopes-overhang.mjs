// REACode/terracecliff.js + overhangterrain.js (815236105079398400 terraces/cliffs, 1447488323845509121
// "seamless soft slopes with distinct sharp cliffs" + "no local minimums", 1671808851895627776 overhangs):
// softSlopes quantization in the shared generator, slope classification, and the overhang/cave measure on World.
import assert from'node:assert/strict';
import{World}from'../src/core/world.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';
import{generateTerrain,slopeMask}from'../src/terrain/generate.js';import{terraceProfile}from'../src/core/terrace-profile.js';
import{measureOverhang,rockTopology}from'../src/core/rock-topology.js';import{localMinima}from'../src/core/depression-fill.js';
// Synthetic tunnel: 6x3 block of rock 1..4; middle row cells x=0..3 hollowed at levels 1-2 (x=0 opens to the boundary).
function block(nx,nz){return Array.from({length:nx*nz},(_,id)=>{const x=id%nx,z=(id/nx)|0;return{id,n:4,cx:x,cz:z,pts:[{x:x-.5,z:z-.5},{x:x+.5,z:z-.5},{x:x+.5,z:z+.5},{x:x-.5,z:z+.5}],edgeNeighbors:[z?id-nx:-1,x+1<nx?id+1:-1,z+1<nz?id+nx:-1,x?id-1:-1]}})}
{const w=new World({cells:block(6,3)}),c=w.cells;for(const x of c)w.fill(x,4,{rock:true});for(let i=0;i<4;i++){w.setSolid(c[6+i],1,false);w.setSolid(c[6+i],2,false);}
 w.setSolid(c[10],3,false);// sealed pocket: rock above/below and on every side
 const snap=JSON.stringify(w.snapshot()),m=measureOverhang(w);assert.equal(JSON.stringify(w.snapshot()),snap);
 assert.equal(m.coveredAir,9);assert.equal(m.reachableCoveredAir,8);assert.equal(m.sealedAir,1);assert.equal(m.caveDepth,4);
 assert.equal(m.overhangAboveWater,4);assert.equal(m.soffits,5);// lv3 roof over x=0..3 (rock above); pocket lid at lv4 is a soffit but has nothing above
 assert.equal(m.soffits,rockTopology(w).undersides);}
const agg={def:{soft:0,cliff:0},soft:{soft:0,cliff:0}},out={};
for(const[name,grid]of[['mixed',buildMixedGrid({radius:9,seed:7})],['quad',buildQuadGrid({radius:9,seed:7})]])for(const seed of[1,7,19]){
 const a=new World(grid),b=new World(grid),b2=new World(grid);generateTerrain(a,{seed});const r=generateTerrain(b,{seed,softSlopes:true,drainage:true});generateTerrain(b2,{seed,softSlopes:true,drainage:true});
 assert.deepEqual(b.snapshot(),b2.snapshot(),'deterministic');
 const pa=terraceProfile(a),pb=terraceProfile(b);agg.def.soft+=pa.softSteps;agg.def.cliff+=pa.cliffSteps;agg.soft.soft+=pb.softSteps;agg.soft.cliff+=pb.cliffSteps;
 assert.equal(pa.slope.flat+pa.slope.soft+pa.slope.cliff,pa.landCells);
 // Soft steps sit in the low-mask (soft) province, cliffs in the sharp province: same field, no straight seam.
 const m=slopeMask(grid.cells,seed);let ms=0,ns=0,mc=0,nc=0;
 for(const c of grid.cells){const h=b.ground(c);if(!h)continue;for(const id of c.edgeNeighbors){if(id<0)continue;const oh=b.ground(grid.cells[id]);if(!oh||oh>=h)continue;if(h-oh===1){ms+=m[c.id];ns++}else{mc+=m[c.id];nc++}}}
 assert.ok(ns>0&&nc>0&&ms/ns<mc/nc,'soft steps in soft province');
 const sorted=[...m].sort((x,y)=>x-y);assert.equal(sorted[0],0);assert.equal(sorted[sorted.length-1],1);
 // Erosion-valid: no strict local minimum after depression fill on the soft/sharp terrain.
 assert.equal(r.drainage.minimaAfter,0);assert.equal(localMinima(b.cells,b.cells.map(c=>b.ground(c))).length,0);
 // Overhangs/caves on real generated terrain (features + caves enabled by default).
 const o=measureOverhang(a);assert.ok(o.overhangAboveWater>0&&o.soffits>=o.overhangAboveWater&&o.coveredAir>0&&o.caveDepth>=1);
 out[name+seed]={soft:[pa.softSteps,pb.softSteps],cliff:[pa.cliffSteps,pb.cliffSteps],mask:[+(ms/ns).toFixed(2),+(mc/nc).toFixed(2)],overhang:o.overhangAboveWater,cave:o.caveDepth};
}
assert.ok(agg.soft.soft>agg.def.soft&&agg.soft.cliff<agg.def.cliff,'softSlopes trades cliffs for one-level steps');
console.log('PASS softSlopes provinces, slope classes, zero minima after fill, overhang/cave measure',JSON.stringify(agg),JSON.stringify(out));
