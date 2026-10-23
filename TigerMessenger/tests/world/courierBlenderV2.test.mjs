import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
globalThis.self??=globalThis;
const {GLTFLoader}=await import('../../vendor/jsm/loaders/GLTFLoader.js');
const {buildHumanCourier,animateHumanCourier}=await import('../../src/assets/characters/humanCourier.js');
const {upgradeCourierToBlenderV2,revertCourierBlenderV2}=await import('../../src/assets/characters/courierBlenderV2.js');
const glb=fs.readFileSync(new URL('../../assets/models/courier-blender-v2/courier-v2.glb',import.meta.url));
const loader={loadAsync:()=>new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'')};

test('Blender courier v2 replaces the visible model but keeps the game joint contract, feet and height',async()=>{
  const root=buildHumanCourier();root.updateMatrixWorld(true);
  const before=new T.Box3().setFromObject(root,true);
  await upgradeCourierToBlenderV2(root,{loader});root.updateMatrixWorld(true);
  const u=root.userData;assert.ok(u.blenderV2);assert.equal(u.isHumanCourier,true);
  for(const n of ['body','head','legL','legR','kneeL','kneeR','armL','armR','elbowL','elbowR','handL','handR','letter']){
    assert.ok(u[n]?.isObject3D,n);assert.ok(u.blenderV2.holder.getObjectById(u[n].id),`${n} belongs to the v2 model`);
  }
  const visible=new T.Box3();u.blenderV2.holder.updateMatrixWorld(true);visible.setFromObject(u.blenderV2.holder,true);
  assert.ok(Math.abs(visible.min.y-before.min.y)<.03,'same feet line');
  assert.ok(Math.abs((visible.max.y-visible.min.y)-(before.max.y-before.min.y))<.06,'same height');
  assert.ok(u.blenderV2.legacyChildren.every(c=>!c.visible));
});

test('the six existing animation states move the v2 joints (idle, walk, run, letter, ride, jump)',async()=>{
  const root=buildHumanCourier();await upgradeCourierToBlenderV2(root,{loader});const u=root.userData;
  const pose=(state,moving)=>{const p={velocity:new T.Vector3(state.speed||0,0,0),onGround:true,riding:false,holdingLetter:false,animPhase:0,...state};
    for(let i=0;i<40;i++){p.animPhase=Math.PI/2-.05*(moving?(p.speed>8?14:9):2.2);animateHumanCourier(p,root,.05,moving);}
    return {legL:u.legL.rotation.x,kneeL:u.kneeL.rotation.x,armR:u.armR.rotation.x,elbowR:u.elbowR.rotation.x,letter:u.letter.visible};};
  const idle=pose({},false),walk=pose({speed:5},true),run=pose({speed:9.5},true),letter=pose({holdingLetter:true},false),ride=pose({riding:true},false),jump=pose({onGround:false},false);
  assert.ok(Math.abs(idle.legL)<.05);
  assert.ok(Math.abs(walk.legL)>.25&&Math.abs(run.legL)>Math.abs(walk.legL));
  assert.ok(letter.letter&&letter.armR<-.4);
  assert.ok(ride.legL<-1&&ride.kneeL>1);
  assert.ok(jump.kneeL>.3);
});

test('revert restores the approved courier and its joints',async()=>{
  const root=buildHumanCourier();const legacyBody=root.userData.body;await upgradeCourierToBlenderV2(root,{loader});
  revertCourierBlenderV2(root);assert.equal(root.userData.body,legacyBody);assert.equal(root.userData.blenderV2,undefined);
  assert.ok(root.children.every(c=>c.visible));
});
