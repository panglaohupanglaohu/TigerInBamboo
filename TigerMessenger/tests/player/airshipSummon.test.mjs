import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const listeners=[];
globalThis.window={addEventListener(type,handler){if(type==='keydown')listeners.push(handler);}};
globalThis.document={getElementById(){return null;},addEventListener(){}};
const {createAirshipRide}=await import('../../src/player/airshipRide.js');
const {createMoebiusAirship}=await import('../../src/assets/moebiusAirship.js');

test('real airship factory summons within rope reach and F starts boarding at several elevations',()=>{
 for(const [direction,height] of [[[0,1,0],160],[[.4,.8,.2],210],[[-.5,.7,-.4],250]]){
  listeners.length=0;
  const up=new T.Vector3(...direction).normalize(),forward=new T.Vector3(0,0,1).projectOnPlane(up).normalize();
  const player={position:up.multiplyScalar(height),forward,facing:forward.clone(),velocity:new T.Vector3(),onGround:true,riding:false};
  const original=player.position.clone(),ship=createMoebiusAirship();ship.scale.setScalar(1.25);
  const ride=createAirshipRide({player,getAirship:()=>ship,planetRadius:160,keys:{}});
  assert.equal(ride.summon(),true);
  assert.ok(ship.userData.rope.getWorldPosition(new T.Vector3()).distanceTo(player.position)<5);
  assert.ok(ship.position.toArray().every(Number.isFinite));
  assert.equal(ship.visible,true);assert.equal(ship.userData.flown,true);
  assert.ok(player.position.equals(original),'summon must not teleport player');
  const event={code:'KeyF',preventDefault(){this.defaultPrevented=true;}};
  for(const listener of listeners)listener(event);
  assert.equal(ride.getState(),'climbing');assert.equal(player.riding,true);
  assert.equal(ride.summon(),true,'Q also recovers from an existing climb');
  assert.equal(ride.getState(),'idle');assert.equal(player.riding,false);
 }
});
