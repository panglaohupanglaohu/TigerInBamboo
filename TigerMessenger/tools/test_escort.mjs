import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createEscortMotion } from '../src/story/escortMotion.js';

// A player walks around a square building; a direct lerp would cut its corner.
const start = new THREE.Vector3(-5, 0, -5);
let maxStep = 0, steps = 0;
const follower = createEscortMotion({ position: start, lag: 1.8, advance(pos, velocity, dt) {
  maxStep = Math.max(maxStep, velocity.length() * dt); steps++;
  pos.addScaledVector(velocity, dt);
  assert(!(Math.abs(pos.x) < 2 && Math.abs(pos.z) < 2), 'cut through building');
}});
const player = start.clone();
for (const end of [new THREE.Vector3(5,0,-5),new THREE.Vector3(5,0,5),new THREE.Vector3(-5,0,5)]) {
  while(player.distanceTo(end) > 0.01) {
    const delta=end.clone().sub(player);
    player.addScaledVector(delta,Math.min(0.07/delta.length(),1));
    follower.update(player,1/60);
  }
}
for(let i=0;i<240;i++) follower.update(player,1/60);
assert(follower.position.distanceTo(player)<3.1,'failed to follow around corners');
assert(maxStep<=9/120+1e-8,'unbounded movement step');
const frozen=follower.position.clone();
follower.update(player,0); assert(follower.position.equals(frozen));

// A newly closed wall blocks the follower even if the player teleports beyond it.
let contacts=0;
const blocked=createEscortMotion({position:new THREE.Vector3(-3,0,0),advance(pos,v,dt){
  pos.addScaledVector(v,dt);
  if(pos.x>-.5){pos.x=-.5;contacts++;}
}});
for(let i=0;i<300;i++) blocked.update(new THREE.Vector3(20,0,0),.1);
assert(blocked.position.x<=-.5 && contacts>0);
console.log('ESCORT_OK',JSON.stringify({steps,maxStep,followDistance:follower.position.distanceTo(player),blockedContacts:contacts}));

// Jump height must not leave an unreachable waypoint floating above the ground.
const grounded=createEscortMotion({position:new THREE.Vector3(),lag:1.8,
  distanceBetween:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
  advance(pos,v,dt){pos.addScaledVector(v,dt);pos.y=0;},
});
for(let i=0;i<300;i++)grounded.update(new THREE.Vector3(i*.04,2*Math.abs(Math.sin(i*.1)),0),1/60);
for(let i=0;i<300;i++)grounded.update(new THREE.Vector3(12,0,0),1/60);
assert(grounded.position.x>9,'stuck at a waypoint recorded in mid-jump');
console.log('ESCORT_JUMP_ROUTE_OK');
