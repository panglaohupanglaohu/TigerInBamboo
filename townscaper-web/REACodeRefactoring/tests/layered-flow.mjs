import assert from 'node:assert/strict';
import {buildLayeredFlowField} from '../src/badnorth/flowfield.js';
// Same XZ column, two disconnected floors. Floor-specific source inheritance.
const graph={version:4,nodes:[{id:0,floor:1},{id:1,floor:1},{id:2,floor:3},{id:3,floor:3}],adj:[[{to:1,cost:.3}],[{to:0,cost:.65}],[{to:3,cost:1}],[{to:2,cost:1}]]};
const sources=[{node:1,type:'步兵'},{node:3,type:'矛兵'}];
const f=buildLayeredFlowField(graph,sources);assert.equal(f.atNode(0).source.type,'步兵');assert.equal(f.atNode(2).source.type,'矛兵');assert.equal(f.dist[0],.3);assert.equal(f.parent[0],1);assert.equal(f.version,4);assert.equal(f.atNode(-1),null);
const onlyRoof=buildLayeredFlowField(graph,[sources[1]]);assert.equal(onlyRoof.atNode(0),null,'no influence through floor');assert.equal(onlyRoof.dist[0],Infinity);
const empty=buildLayeredFlowField(graph,[]);assert.ok([...empty.src].every(x=>x===-1));
const duplicate=buildLayeredFlowField(graph,[{node:1,type:'first'},{node:1,type:'second'},{node:-1}]);assert.equal(duplicate.atNode(0).source.type,'first');
console.log('PASS layered inheritance, directed costs, disconnected floors, empty/invalid/duplicate sources');
