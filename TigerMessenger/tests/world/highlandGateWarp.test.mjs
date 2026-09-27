import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {refineGateForRail} from '../../src/world/citadel/highlandGateWarp.js';
test('gate refinement keeps authored bounds and UVs while preventing long chord triangles',()=>{
 const source=new THREE.BoxGeometry(3,7,48);source.computeBoundingBox();const positions=source.attributes.position.array.slice(),result=refineGateForRail(source,2);result.computeBoundingBox();assert.notEqual(result,source);assert.deepEqual(result.boundingBox,source.boundingBox);assert.deepEqual(source.attributes.position.array,positions);assert.equal(result.attributes.uv.count,result.attributes.position.count);assert.deepEqual(result.groups.map(g=>g.materialIndex),source.groups.map(g=>g.materialIndex));assert.equal(result.groups.reduce((n,g)=>n+g.count,0),result.attributes.position.count);
 const p=result.attributes.position;for(let i=0;i<p.count;i+=3){const z=[p.getZ(i),p.getZ(i+1),p.getZ(i+2)];assert(Math.max(...z)-Math.min(...z)<=2.00001);}
 for(const n of result.attributes.uv.array)assert(n>=0&&n<=1);assert(result.attributes.position.count>source.attributes.position.count);
});
test('short gate pieces retain their original geometry instance',()=>{const small=new THREE.BoxGeometry(1,1,1);assert.equal(refineGateForRail(small),small);});
