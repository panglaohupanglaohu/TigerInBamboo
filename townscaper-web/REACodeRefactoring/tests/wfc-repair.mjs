import assert from 'node:assert/strict';import{solveWFC,repairWFC,findWFCConflicts}from'../src/core/wfc.js';import{buildMixedGrid,buildQuadGrid}from'../src/core/grid.js';
const tiles=[3,4].flatMap(n=>Array.from({length:2**n},(_,i)=>({id:n+':'+i,edges:Array.from({length:n},(_,e)=>(i>>e)&1)})));
for(const grid of [buildMixedGrid({radius:4,seed:5}),buildQuadGrid({radius:3,seed:5})]){
 const current=solveWFC(grid,{tiles,seed:5}).tiles,snapshot=JSON.stringify(current),c=grid.cells[Math.floor(grid.cells.length/2)],id=c.id;
 const edit=c.n+':'+((Number(current[id].split(':')[1])+1)%(2**c.n)),edits={[id]:edit};
 const repaired=repairWFC(grid,{tiles,current,edits,seed:5});assert.ok(repaired.ok);assert.equal(repaired.tiles[id],edit);assert.deepEqual(findWFCConflicts(grid,repaired.tiles,tiles),[]);assert.equal(JSON.stringify(current),snapshot);
 for(const cell of grid.cells)if(!repaired.region.includes(cell.id))assert.equal(repaired.tiles[cell.id],current[cell.id]);
 assert.deepEqual(repaired.tiles,repairWFC({...grid,cells:[...grid.cells].reverse()},{tiles:[...tiles].reverse(),current,edits,seed:5}).tiles);
 assert.equal(repairWFC(grid,{tiles,current}).reason,'unchanged');assert.equal(repairWFC(grid,{tiles,current,edits,maxSteps:1}).reason,'budget');
 console.log('repair',grid.kind,'changed',repaired.changedCells.length,'region',repaired.region.length,'total',grid.cells.length);
}
// Uniform tiles force a repair wave to propagate beyond the edited cell.
const cells=Array.from({length:5},(_,id)=>({id,n:3,edgeNeighbors:[id>0?id-1:-1,id<4?id+1:-1,-1]}));const catalog=[{id:'a',edges:[0,0,0]},{id:'b',edges:[1,1,1]}],current=Object.fromEntries(cells.map(c=>[c.id,'a']));
const fail=repairWFC({cells},{tiles:catalog,current,edits:{2:'b'},maxRadius:0});assert.equal(fail.ok,false);assert.deepEqual(fail.tiles,current);
const ok=repairWFC({cells},{tiles:catalog,current,edits:{2:'b'},maxRadius:4});assert.ok(ok.ok);assert.equal(ok.changedCells.length,5);assert.ok(ok.radius>0);
assert.throws(()=>repairWFC({cells},{tiles:catalog,current,edits:{99:'a'}}));
console.log('PASS frozen exterior, edits, preferred originals, expanding repairs, budgets and rollback');
