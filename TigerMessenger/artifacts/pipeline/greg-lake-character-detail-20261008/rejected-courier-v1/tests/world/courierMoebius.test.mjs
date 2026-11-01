import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildHumanCourier,animateHumanCourier} from '../../src/assets/characters/humanCourier.js';
import {buildAgentMessenger} from '../../src/player/agentMessenger.js';
import {COURIER_HEIGHT,COURIER_SCALE} from '../../src/core/characterScale.js';

const metrics=root=>{let meshes=0,triangles=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {meshes,triangles};};
test('formal player adapter returns articulated illustrated courier, fitted to existing player scale',()=>{
 const root=buildAgentMessenger(),u=root.userData;root.updateMatrixWorld(true);
 assert.equal(u.runtimeModel,'moebius-courier-1');assert.equal(u.isHumanCourier,true);
 const bounds=new T.Box3().setFromObject(root,true);
 assert.ok(Math.abs(bounds.min.y)<1e-7);assert.ok(Math.abs(bounds.max.y-COURIER_HEIGHT)<1e-7);
 assert.equal(u.letter.parent,u.handR);assert.equal(u.head.parent,u.body);
 assert.equal(u.kneeL.parent,u.legL);assert.equal(u.kneeR.parent,u.legR);
 assert.equal(u.postalSatchel.parent,u.body);assert.ok(u.postalSatchel.children.some(c=>c.children.some(m=>m.isMesh)));
 const enlarged=buildHumanCourier({scale:COURIER_SCALE*1.5});enlarged.updateMatrixWorld(true);
 assert.ok(Math.abs(new T.Box3().setFromObject(enlarged,true).max.y-COURIER_HEIGHT*1.5)<1e-7);
});
test('walking, sprinting, jumping, mounting, dismounted boarding and delivery keep real pivots live',()=>{
 const root=buildHumanCourier(),u=root.userData,player={velocity:new T.Vector3(),onGround:true,holdingLetter:false,lookTarget:{x:.4,y:.2}};
 let standingHand,maxHandTravel=0;
 for(const pose of [
   {speed:0,onGround:true,riding:false,holdingLetter:false},
   {speed:4,onGround:true,riding:false,holdingLetter:false},
   {speed:10,onGround:true,riding:false,holdingLetter:true},
   {speed:2,onGround:false,riding:false,holdingLetter:true},
   {speed:0,onGround:true,riding:true,holdingLetter:true},
   {speed:3,onGround:true,riding:true,boardingOnFoot:true,holdingLetter:false},
 ]){
  Object.assign(player,{boardingOnFoot:false},pose);player.velocity.set(0,0,pose.speed);
  for(let i=0;i<50;i++)animateHumanCourier(player,root,1/60,pose.speed>0);
  root.updateMatrixWorld(true);
  if(!standingHand)standingHand=u.handR.getWorldPosition(new T.Vector3());
  maxHandTravel=Math.max(maxHandTravel,u.handR.getWorldPosition(new T.Vector3()).distanceTo(standingHand));
  assert.equal(u.letter.visible,pose.holdingLetter);
  for(const key of ['head','body','cape','armL','armR','elbowL','elbowR','handL','handR','legL','legR','kneeL','kneeR']){
   assert.ok(u[key].matrixWorld.elements.every(Number.isFinite),key);
   assert.ok(u[key].children.length>0,`${key} has its own geometry or descendants`);
  }
  if(pose.riding&&!pose.boardingOnFoot){assert.ok(u.legL.rotation.x< -1);assert.ok(u.kneeL.rotation.x>1.1);}
 }
 assert.ok(maxHandTravel>.15);
});
test('flat palette, fine outline shader and rigid batches are finite and below legacy geometry cost',()=>{
 const root=buildHumanCourier();let surfaceMaterials=new Set(),outlineMaterials=new Set();
 root.traverse(o=>{if(!o.isMesh)return;assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
  if(o.userData.isOutline){outlineMaterials.add(o.material);const shader={vertexShader:'#include <begin_vertex>'};o.material.onBeforeCompile(shader);assert.match(shader.vertexShader,/normalize\(normal\)/);assert.doesNotMatch(shader.vertexShader,/objectNormal/);}
  else {surfaceMaterials.add(o.material);assert.equal(o.material.vertexColors,true);assert.equal(o.geometry.attributes.color.count,o.geometry.attributes.position.count);}
 });
 assert.equal(surfaceMaterials.size,1);assert.equal(outlineMaterials.size,1);
 const now=metrics(root),old=metrics(buildHumanCourier({style:'expedition'}));
 assert.ok(now.meshes<old.meshes);assert.ok(now.triangles<old.triangles);assert.ok(now.meshes<=32);
});
