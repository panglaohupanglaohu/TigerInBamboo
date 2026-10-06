import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {animateArticulatedRobot} from '../../src/assets/robotArticulation.js';
import {productionTransportRobots} from './robotTransportEnvelope.fixture.mjs';

test('never-greeted production robots have finite stowed cargo geometry and restore combat aim',async()=>{
 for(const{robot,box}of await productionTransportRobots()){
  assert.ok([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite));
  assert.ok(box.max.z<=1.75&&box.min.z>=-1.75,'cargo exceeds reserved half-width');
  assert.ok(box.max.y-box.min.y+.65+.12<=5.36,'cargo exceeds bridge rail-top envelope');
  if(robot.userData.robotType==='locust'){
   assert.equal(robot.userData.mobileFire.weaponReady,false);
   animateArticulatedRobot(robot,{state:'attack'});
   assert.equal(robot.userData.mobileFire.weaponReady,true);
   animateArticulatedRobot(robot,{state:'transport'});robot.updateMatrixWorld(true);
   const returned=new T.Box3().setFromObject(robot,true);
   assert.ok(returned.min.distanceTo(box.min)<1e-6&&returned.max.distanceTo(box.max)<1e-6,'transport pose must recover after combat');
  }
 }
});
