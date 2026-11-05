import assert from 'node:assert/strict';
import {World} from '../src/core/world.js';
import {buildNav} from '../src/world/navgraph.js';
import {BattleNavigation} from '../src/world/battle-navigation.js';
import {buildFlowField} from '../src/badnorth/flowfield.js';
function row(n){return Array.from({length:n},(_,id)=>({id,n:4,cx:id,cz:0,pts:[{x:id-.5,z:-.5},{x:id+.5,z:-.5},{x:id+.5,z:.5},{x:id-.5,z:.5}],edgeNeighbors:[id>0?id-1:-1,id+1<n?id+1:-1,-1,-1]}))}
const w=new World({cells:row(5)}),c=w.cells;
for(let i=0;i<4;i++){w.fill(c[i],i===2?2:1,{rock:true});w.river[i]=1;}
let nav=buildNav(w,{start:c[0]});
assert.deepEqual([...nav.riverDist],[3,2,1,0,-1]);
assert.equal(nav.cost(c[1],c[2]),.65,'uphill toward mouth must not receive downstream bonus');
assert.equal(nav.cost(c[2],c[1]),.3,'downhill away from mouth still downstream');
assert.equal(nav.cost(c[0],c[1]),.3,'flat outlet-connected reach downstream');
assert.equal(nav.cost(c[1],c[0]),.65);
assert.equal(nav.cost(c[0],c[3]),Infinity,'no teleport edges');assert.equal(nav.cost(c[4],c[3]),Infinity,'sea cannot be source');
const battle=new BattleNavigation(w,{});battle.refresh();
for(let a=0;a<4;a++)for(const b of c[a].edgeNeighbors.filter(id=>id>=0&&id<4)){
 const from=battle.graph.at(c[a],w.top(c[a])),to=battle.graph.at(c[b],w.top(c[b]));
 assert.equal(battle.graph.adj[from].find(e=>e.to===to)?.cost,nav.cost(c[a],c[b]));
}
for(let target=0;target<4;target++){
 const field=buildFlowField(w,nav,[{cell:c[target]}]);const from=battle.graph.at(c[target],w.top(c[target])),tree=battle.graph.treeTo(from);
 for(let i=0;i<4;i++)assert.ok(Math.abs(field.dist[i]-tree.distance[battle.graph.at(c[i],w.top(c[i]))])<1e-6);
}
// Closed flat reach has no inferred direction, but still retains general river speed.
w.fill(c[4],1,{rock:true});w.river[4]=1;nav=buildNav(w);
assert.equal(nav.riverDirection(c[0],c[1]),0);assert.equal(nav.cost(c[0],c[1]),.65);assert.equal(nav.cost(c[1],c[0]),.65);
console.log('PASS river: uphill shortcut, flat downstream, closed neutral, directed BattleNavigation/flowfield parity, invalid edges');
