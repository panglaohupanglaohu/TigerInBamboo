import assert from 'node:assert/strict';
import {auditQAGeometry,applyQAStep} from '../src/core/qa-replay.js';
const good={position:{itemSize:3,count:3,array:new Float32Array([0,0,0,1,0,0,0,1,0])},normal:{itemSize:3,count:3,array:new Float32Array([0,0,1,0,0,1,0,0,1])},color:{itemSize:3,count:3,array:new Float32Array(9)}};
const geometry={getAttribute:n=>good[n],index:null};assert.equal(auditQAGeometry(geometry).valid,true);assert.equal(auditQAGeometry(geometry).degenerateTriangles,0);
good.position.array[0]=NaN;assert.equal(auditQAGeometry(geometry).valid,false);good.position.array[0]=0;
geometry.index={count:3,array:new Uint32Array([0,1,3])};assert.equal(auditQAGeometry(geometry).valid,false);
geometry.index=null;good.position.array.fill(0);assert.equal(auditQAGeometry(geometry).degenerateTriangles,1);
assert.throws(()=>applyQAStep({cells:[],palette:{colors:['#fff']}},{cell:0,level:2,on:true}),RangeError);
console.log('PASS QA finite attributes, bad indices, degeneracy distinction and invalid edit rejection');
