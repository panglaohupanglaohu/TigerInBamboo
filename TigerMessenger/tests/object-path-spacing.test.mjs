import {test} from 'node:test';import assert from 'node:assert/strict';
import {runObjectPlan} from '../src/system-workshop/object/capabilities.js';
import {verifyObjects} from '../src/system-workshop/object/verify.js';
const row=(id,x,extra={})=>({id,kind:'tree',x,z:0,r:0.05,edit:{dx:0,dy:0,dz:0,ry:0,s:1,hidden:false},...extra});
const steps=[{id:'object.path-spacing',params:{maxMove:1,axis:0}}];
test('actual REA arc sampling redistributes interiors and passes existing verifier',()=>{
 const L=[row('a',0),row('b',0.4),row('c',2)];const r=runObjectPlan(L,steps);
 assert.equal(r.edits.b.dx,0.6);assert.ok(!r.edits.a&&!r.edits.c);assert.equal(verifyObjects(L,r.edits,{steps}).status,'pass');assert.equal(L[1].edit.dx,0);
});
test('manual anchors, hidden and out-of-scope objects remain untouched',()=>{
 const L=[row('a',0),row('b',0.5,{locked:true}),row('c',1),row('d',3),row('outside',5,{outOfScope:true}),row('hidden',6,{edit:{dx:0,dy:0,dz:0,ry:0,s:1,hidden:true}})];
 const r=runObjectPlan(L,steps);for(const id of ['a','b','d','outside','hidden'])assert.ok(!r.edits[id]);assert.equal(verifyObjects(L,r.edits,{steps}).status,'pass');
});
test('over-budget or blocked segment produces no unsafe edits',()=>{
 const L=[row('a',0),row('b',0.4),row('c',2)];assert.deepEqual(runObjectPlan(L,[{id:'object.path-spacing',params:{maxMove:0.1}}]).edits,{});
 L.push(row('obstacle',1,{kind:'rock',outOfScope:true}));assert.deepEqual(runObjectPlan(L,steps).edits,{});
});
test('source ordering does not affect stable layout results',()=>{
 const L=[row('a',0),row('b',0.4),row('c',2)];assert.deepEqual(runObjectPlan(L,steps).edits,runObjectPlan([...L].reverse(),steps).edits);
});
