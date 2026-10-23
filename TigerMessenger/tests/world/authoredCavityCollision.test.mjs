import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window={addEventListener(){}};
globalThis.document={getElementById:()=>null,querySelector:()=>null};
const {resolveCollisions}=await import('../../src/world/collision.js');
test('authored excavation with no tread below never lands on the removed planet shell',()=>{
 const player={position:new THREE.Vector3(0,140,0),velocity:new THREE.Vector3(0,-2,0),onGround:false};
 const before=player.position.length();
 resolveCollisions(player.position,player.velocity,.02,[],player,()=>assert.fail('void'),{sampleRadius:()=>160},()=>-Infinity);
 assert.ok(player.position.length()<before);assert.equal(player.onGround,false);
});
test('finite actual tread still catches the descending traveller in an excavation',()=>{
 const player={position:new THREE.Vector3(0,140.01,0),velocity:new THREE.Vector3(0,-2,0),onGround:false};
 resolveCollisions(player.position,player.velocity,.02,[],player,()=>assert.fail('void'),{sampleRadius:()=>160},()=>140);
 assert.equal(player.position.length(),140);assert.equal(player.onGround,true);
});
