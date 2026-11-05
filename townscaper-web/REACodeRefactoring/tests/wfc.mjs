import assert from 'node:assert/strict';import{solveWFC}from'../src/core/wfc.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';
const catalog=[3,4].flatMap(n=>Array.from({length:2**n},(_,i)=>({id:n+':'+i,edges:Array.from({length:n},(_,e)=>(i>>e)&1)})));
for(const grid of [buildMixedGrid({radius:4,seed:4}),buildQuadGrid({radius:3,seed:4})]){
 const a=solveWFC(grid,{tiles:catalog,seed:7}),b=solveWFC({...grid,cells:[...grid.cells].reverse()},{tiles:[...catalog].reverse(),seed:7});assert.ok(a.ok);assert.deepEqual(a.tiles,b.tiles);
 const byId=new Map(catalog.map(t=>[t.id,t]));for(const c of grid.cells)for(let e=0;e<c.n;e++){const id=c.edgeNeighbors[e];if(id<0)continue;const b=grid.cells[id],t=c.edgeTwins[e];assert.equal(byId.get(a.tiles[c.id]).edges[e],byId.get(a.tiles[b.id]).edges[t]);}
 assert.equal(solveWFC(grid,{tiles:catalog,maxSteps:1}).reason,'budget');
}
// Odd cycle with 2 colors forces real backtracking and remains unsatisfiable.
const cells=[{id:0,n:3,edgeNeighbors:[1,2,-1]},{id:1,n:3,edgeNeighbors:[0,2,-1]},{id:2,n:3,edgeNeighbors:[0,1,-1]}];const tiles=[{id:'a',edges:[0,0,0]},{id:'b',edges:[1,1,1]}];
const bad=solveWFC({cells},{tiles,compatible:(a,b)=>a!==b});assert.equal(bad.ok,false);assert.ok(bad.backtracks>0);
const pinned=solveWFC({cells:cells.slice(0,1).map(c=>({...c,edgeNeighbors:[-1,-1,-1]}))},{tiles,pins:{0:'b'}});assert.equal(pinned.tiles[0],'b');
assert.throws(()=>solveWFC({cells},{tiles,pins:{9:'a'}}));assert.throws(()=>solveWFC({cells},{tiles:[...tiles,tiles[0]]}));
console.log('PASS deterministic mixed/quad constraints, reversed cells/catalog, pins, iterative unsat backtracking and budget');
