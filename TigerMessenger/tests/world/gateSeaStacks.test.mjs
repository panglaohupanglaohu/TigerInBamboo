import {test} from 'node:test';import assert from 'node:assert/strict';
import {seaStackGeometry} from '../../src/world/gateSeaStacks.js';
test('sea stack geometry is deterministic, finite, closed and stays within clearance envelope',()=>{
 for(let seed=0;seed<27;seed++){
 const g=seaStackGeometry(12,48,seed),again=seaStackGeometry(12,48,seed);assert.deepEqual(g.attributes.position.array,again.attributes.position.array);
 const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert(Math.hypot(p.getX(i),p.getZ(i))<15);assert(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>.95);}
 // Welding the UV-style ring seam by positions leaves exactly two incident
 // triangles per edge, including both caps.
 const edge=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join(',');
 for(let i=0;i<(g.index?g.index.count:p.count);i+=3){const ids=[0,1,2].map(k=>key(g.index?g.index.getX(i+k):i+k));for(let j=0;j<3;j++){const k=[ids[j],ids[(j+1)%3]].sort().join('|');edge.set(k,(edge.get(k)||0)+1);}}
 assert([...edge.values()].every(x=>x===2));g.dispose();again.dispose();
 }
});
