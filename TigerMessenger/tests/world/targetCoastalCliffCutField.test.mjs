import test from 'node:test';
import assert from 'node:assert/strict';
import {createTargetCoastalCliffCutField} from '../../src/world/citadel/targetCoastalCliffCutField.js';
const cut={id:'test-coast',edge:[[-20,0],[20,0]],polygon:[[-20,-3],[20,-3],[20,40],[-20,40]],seaSide:1,transitionWidth:2};

test('retreat removes the entire seaward toe, keeps a short cliff and does not excavate an enclosed rail trench',()=>{
  const f=createTargetCoastalCliffCutField({cuts:[cut]});
  assert.equal(f.height(0,-4,20,0),20);
  assert.equal(f.height(0,-2,20,0),20);
  assert.equal(f.height(0,-1,20,0),8.5);
  for(const z of [0,2,5,15,30,39])assert.equal(f.height(0,z,20,0),-3);
  assert.equal(f.height(21,10,20,0),20,'outside authored polygon unchanged');
  assert.equal(f.height(0,10,-8,0),-8,'never fill existing deep sea');
  assert.equal(f.report.railClearanceVerified,false);
});
test('protected city/landmark overlap is retained and explicitly fails as a conflict',()=>{
  const f=createTargetCoastalCliffCutField({cuts:[cut],platforms:[{center:[0,4],radii:[3,3]}],protectedPolygons:[[[8,8],[12,8],[12,12],[8,12]]]});
  assert.equal(f.height(0,4,20,0),20);
  assert.equal(f.height(10,10,20,0),20);
  assert.equal(f.report.protectedConflicts,2);
  assert.equal(f.height(15,10,20,0),-3);
});
test('mirrored cliff orientation and sloping actual sea are honoured without changing unconfigured terrain',()=>{
  const f=createTargetCoastalCliffCutField({cuts:[{...cut,edge:[...cut.edge].reverse(),seaSide:-1}]});
  assert.equal(f.height(5,10,20,-7),-10);
  assert.equal(createTargetCoastalCliffCutField().height(5,10,20,-7),20);
  assert.throws(()=>createTargetCoastalCliffCutField({cuts:[{...cut,edge:[[0,0],[0,0]]}]}),RangeError);
  assert.throws(()=>f.height(NaN,0,20,0),TypeError);
});
