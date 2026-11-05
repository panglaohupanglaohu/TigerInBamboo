import assert from 'node:assert/strict';
import {buildSquareGrid,buildQuadGrid,buildMixedGrid,traceStraightReport,traceStraight} from '../src/core/grid.js';
let walks=0;
for(const grid of [buildSquareGrid({radius:3}),buildQuadGrid({radius:4,seed:5}),buildMixedGrid({radius:4,seed:5})]){
 const before=JSON.stringify(grid);
 for(const cell of grid.cells)for(let e=0;e<cell.n;e++){
  const r=traceStraightReport(grid,cell,e,1000);assert.notEqual(r.reason,'budget');assert.ok(['boundary','nonquad','loop','cycle'].includes(r.reason));assert.deepEqual(traceStraight(grid,cell,e,1000),r.cells);assert.deepEqual(traceStraightReport({...grid,cells:[...grid.cells].reverse()},cell,e,1000),r);
  for(const s of r.segments)if(s.exit!==null)assert.equal(s.exit,(s.entry+2)%4);walks++;
 }
 assert.equal(JSON.stringify(grid),before);
 const start=grid.cells[0];assert.equal(traceStraightReport(grid,start,0,0).reason,'budget');for(const args of [[start,-1,10],[start,0,-1],[start,0,Infinity]])assert.throws(()=>traceStraightReport(grid,...args));
}
// One cell glued to itself across opposite edges: same directed state returns.
const cell={id:0,n:4,pts:[{x:0,z:0},{x:0,z:1},{x:1,z:1},{x:1,z:0}],cx:.5,cz:.5,edgeNeighbors:[0,0,0,0],edgeTwins:[2,3,0,1]},g={cells:[cell]};assert.equal(traceStraightReport(g,cell,0).closed,true);
// Returning to the same cell through a different state must NOT close early.
cell.edgeTwins=[1,0,3,2];const cross=traceStraightReport(g,cell,0,10);assert.equal(cross.reason,'loop');assert.equal(cross.steps,2);assert.equal(traceStraightReport(g,cell,0,1).closed,false);
cell.edgeTwins[0]=3;assert.throws(()=>traceStraightReport(g,cell,0),/Nonreciprocal/);
console.log('PASS '+walks+' real-grid directed walks, reversed storage, compatibility arrays, segment exits, budgets, true/crossed loops, malformed twins, immutable source');
