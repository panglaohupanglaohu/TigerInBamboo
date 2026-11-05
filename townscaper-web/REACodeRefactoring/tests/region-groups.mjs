import assert from 'node:assert/strict';
import {groupByConnection, regionGraphFromGrid, regionCutRatio, spreadCircles} from '../src/core/region-groups.js';
import {generateCampaign} from '../src/campaign/campaign.js';
const connected = (labels, nb) => {
 for (const group of new Set(labels.values())) {
  const ids=[...labels].filter(([i,g])=>g===group).map(([i])=>i), seen=new Set([ids[0]]), q=[ids[0]];
  for(let h=0;h<q.length;h++)for(const j of nb[q[h]])if(labels.get(j)===group&&!seen.has(j)){seen.add(j);q.push(j)}
  assert.equal(seen.size,ids.length,'each group must stay connected');
 }
};
const isolated=groupByConnection([0,1,2,3],[[1],[0],[3],[2]],1);
assert.equal(isolated.stats.actual,2);assert.equal(isolated.stats.targetReached,false);
assert.equal(isolated.get(0),isolated.get(1));assert.notEqual(isolated.get(0),isolated.get(2));
const all=groupByConnection([0,1,2],[[],[],[]],1);assert.equal(new Set(all.values()).size,3);
const nb=[[1,2],[0,2],[0,1]], weighted=groupByConnection([0,1,2],nb,2,{weight:(a,b)=>a===0&&b===2?9:1});
assert.equal(weighted.get(0),weighted.get(2),'stronger connection wins');
assert.throws(()=>groupByConnection([0,1],[[1],[]],1),/undirected/);
assert.throws(()=>groupByConnection([0,0],[[1],[0]],1),RangeError);
assert.throws(()=>groupByConnection([0,1],[[1],[0]],1,{weight:()=>NaN}),RangeError);
assert.throws(()=>groupByConnection([0], [[]], 0),RangeError);
assert.equal(groupByConnection([], [], 1).size,0);
let moves=0, snapshots=0;
for(let seed=0;seed<100;seed++) {
 const c=generateCampaign({seed}),r=c.region;
 assert.equal(r.stats.actual,6);assert(r.stats.cutAfter<=r.stats.cutBefore+1e-8);
 assert.equal(r.stats.snapshotsDropped,0);assert.equal(r.history.length,r.events.length);
 for(const snapshot of r.history){assert.equal(snapshot.size,c.used.length);connected(snapshot,c.nb)}
 connected(r,c.nb);assert.deepEqual(r,generateCampaign({seed}).region);
 for(const event of r.events)if(event.kind==='node')assert(event.gain>0);
 moves+=r.stats.nodeMoves;snapshots+=r.history.length;
}
assert(moves>0,'real generated graph must exercise node transfers');
const c=generateCampaign(),capped=groupByConnection(c.used,c.nb,6,{historyLimit:2,relaxPasses:8});assert.equal(capped.history.length,2);assert(capped.stats.snapshotsDropped>0);assert.equal(capped.history[0].size,c.used.length);
console.log('PASS region components, weighted merges, connected node refinement and history, 100 seeds',{moves,snapshots});

const circles=[{x:0,y:0,r:.5},{x:0,y:0,r:.5}],before=JSON.stringify(circles),spread=spreadCircles(circles);
assert.equal(JSON.stringify(circles),before);assert(Math.hypot(spread[0].x-spread[1].x,spread[0].y-spread[1].y)>=1.12-1e-9);assert.deepEqual(spread,spreadCircles(circles));
const {buildQuadGrid,buildMixedGrid}=await import('../src/core/grid.js'),{World}=await import('../src/core/world.js');
for(const build of [buildQuadGrid,buildMixedGrid]) {
 const grid=build({radius:3,seed:10,relaxPasses:5}),world=new World(grid);for(const c of grid.cells)world.fill(c,1,{rock:true});
 const version=world.version,solid=[...world.solid],graph=regionGraphFromGrid(grid,world),labels=groupByConnection([...Array(graph.n).keys()],graph.adjacency,4,{weight:graph.weight,relaxPasses:8});
 assert.equal(graph.n,grid.cells.length);assert.equal(world.version,version);assert.deepEqual([...world.solid],solid);connected(labels,graph.adjacency);
 let sum=0,cut=0;
 for(let i=0;i<graph.n;i++)for(const e of graph.neighbors(i))if(e.id>i){assert(Math.abs(e.w-graph.weight(e.id,i))<1e-8);sum+=e.w;if(labels.get(i)!==labels.get(e.id))cut+=e.w;}
 assert(Math.abs(regionCutRatio(graph,labels)-(sum?cut/sum:0))<1e-12);
 for(const c of grid.cells)world.fill(c,0);assert.equal(regionGraphFromGrid(grid,world).n,0);assert.equal(regionGraphFromGrid(grid,world,{landOnly:false}).n,grid.cells.length);
}
console.log('PASS shared mixed/quad World adapter, edge weights, cut ratio, immutable coincident spreading');

assert.throws(()=>groupByConnection([0,1],[[1],[0]],1,{weight:()=>Number.MAX_VALUE}),RangeError);
assert.throws(()=>spreadCircles([{x:Number.MAX_VALUE,y:0,r:1}]),RangeError);
