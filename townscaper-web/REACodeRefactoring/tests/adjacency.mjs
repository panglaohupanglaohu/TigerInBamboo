import assert from 'node:assert/strict';
import {meshEdges,edgeSignature,buildFitTable,whichFits,selfCheck} from '../src/core/adjacency.js';
import {buildMixedGrid,buildQuadGrid} from '../src/core/grid.js';
import {World} from '../src/core/world.js';
const verts=[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:1,y:0,z:1},{x:0,y:0,z:1}],square={name:'square',verts,tris:[[0,1,2],[0,2,3]]};
const mesh=meshEdges(verts,square.tris);assert.equal(mesh.boundary.length,4);assert.equal(mesh.pairs.length,1);
const fit=buildFitTable([square,{...square,name:'translated',verts:verts.map(p=>({...p,x:p.x+7}))}]);assert.equal(fit.table[0].slots.length,4);assert.equal(whichFits(fit,0,'0|2').length,0);assert.ok(whichFits(fit,0,'0|1').some(m=>m.module===1));
const diagonals=[1,-1].map(z=>({verts:[{x:0,z:0},{x:1,z},{x:0,z:3}],tris:[[0,1,2]]}));assert.ok(!whichFits(buildFitTable(diagonals),0,'0|1').some(m=>m.module===1&&m.edge==='0|1'));
const soup=meshEdges([...verts,{x:1+1e-6,y:0,z:1}],[[0,1,2],[0,4,3]]);assert.equal(soup.merged.length,4);assert.equal(soup.pairs.length,1);
// Adjacent hash buckets still weld when Euclidean distance is below epsilon.
assert.equal(meshEdges([{x:.000099,z:0},{x:.000101,z:0}],[]).merged.length,1);
assert.equal(meshEdges(verts,[[0,0,1],[0,1,2],[0,1,3],[1,0,3]]).nonManifold.length,1);
assert.equal(meshEdges(verts,[[0,0,1]]).degenerate.length,1);assert.equal(meshEdges(verts,[[0,1,2],[0,3,2]]).windingConflicts.length,1);
assert.throws(()=>meshEdges(verts,[[0,1,99]]));assert.throws(()=>buildFitTable([square],{angleTolerance:-1}));
const reports=[];for(const [kind,grid]of [['mixed',buildMixedGrid({radius:6,seed:5})],['quad',buildQuadGrid({radius:4,seed:5})]]){const world=new World(grid),report=selfCheck(grid,world);assert.equal(report.mismatched,0);assert.equal(report.edgesChecked,grid.cells.reduce((n,c)=>n+c.n,0));const boundary=grid.cells.find(c=>c.edgeNeighbors.includes(-1)),edge=boundary.edgeNeighbors.indexOf(-1);boundary.edgeNeighbors[edge]=123456;assert.equal(selfCheck(grid,world).mismatched,1);boundary.edgeNeighbors[edge]=-1;reports.push({kind,...report});}
console.log('PASS geometry adjacency',reports);

assert.deepEqual(edgeSignature(verts,0,2).direction,edgeSignature(verts,2,0).direction);
const stretched={...square,verts:verts.map(p=>({...p,x:p.x*1.01}))};
assert.ok(!whichFits(buildFitTable([square,stretched]),0,'0|1').some(m=>m.module===1&&m.edge==='0|1'));
