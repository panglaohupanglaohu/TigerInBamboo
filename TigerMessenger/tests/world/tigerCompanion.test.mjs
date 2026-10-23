import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
globalThis.window=new EventTarget();
const {createTigerCompanion}=await import('../../src/gameplay/tigerCompanion.js');
const key=(shift=false)=>{const e=new Event('keydown',{cancelable:true});e.code='KeyE';e.repeat=false;e.shiftKey=shift;window.dispatchEvent(e);return e;};
function setup({riding=false,rescue=false}={}){
  globalThis.window=new EventTarget();
  const scene=new T.Scene(),swamp=new T.Group();swamp.position.set(0,160,0);swamp.scale.setScalar(.5);scene.add(swamp);
  const tiger=new T.Group();tiger.userData.kind='moebius-swamp-tiger';tiger.position.set(2,0,0);swamp.add(tiger);scene.updateMatrixWorld(true);
  const player={position:new T.Vector3(0,160,0),forward:new T.Vector3(0,0,1),riding:false};
  const toasts=[];const st={riding};
  const c=createTigerCompanion({scene,player,findTiger:()=>tiger,groundRadius:p=>160,isRiding:()=>st.riding,isStarted:()=>true,toast:t=>toasts.push(t),rescueOwnsTiger:()=>rescue});
  return {scene,swamp,tiger,player,toasts,c,st};
}
test('E talks, second E makes the tiger follow on foot; it keeps up behind the courier and walks',()=>{
  const {scene,tiger,player,toasts,c}=setup();
  const e1=key();assert.ok(e1.defaultPrevented);assert.match(toasts.at(-1),/虎虎/);assert.equal(c.isFollowing(),false);
  key();assert.equal(c.isFollowing(),true);assert.equal(tiger.parent,scene);assert.equal(tiger.userData._companion,true);
  // courier walks 20 units forward along the planet
  for(let i=0;i<200;i++){player.position.applyAxisAngle(new T.Vector3(1,0,0),.1/160*1).setLength(160);player.forward.set(0,0,1);c.update(1/30);scene.updateMatrixWorld(true);}
  const w=tiger.getWorldPosition(new T.Vector3());assert.ok(w.distanceTo(player.position)<4,`tiger lags ${w.distanceTo(player.position)}`);
  assert.ok(Math.abs(w.length()-160.02)<1e-3,'tiger stands on the ground');assert.equal(c.report.mode,'walking');
});
test('when the courier rides, the tiger rides along beside it; Shift+E twice sends it home, plain E is left for other interactions',()=>{
  const {swamp,tiger,player,c,st}=setup();key();key();st.riding=true;
  player.position.set(0,190,0);for(let i=0;i<120;i++)c.update(1/30);
  const w=tiger.getWorldPosition(new T.Vector3());assert.ok(w.distanceTo(player.position)<2.5,`ride gap ${w.distanceTo(player.position)} ${w.toArray()}`);assert.equal(c.report.mode,'riding');
  // stop: must be near the tiger
  player.position.copy(w);const plain=key();assert.equal(plain.defaultPrevented,false,'plain E passes through to the fox / letters');assert.equal(c.isFollowing(),true);key(true);key(true);assert.equal(c.isFollowing(),false);assert.equal(tiger.parent,swamp);assert.deepEqual(tiger.position.toArray(),[2,0,0]);
});
test('after the story rescue takes over the tiger, this module stands aside',()=>{
  const {c}=setup({rescue:true});const e=key();assert.equal(e.defaultPrevented,false);c.update(.1);assert.equal(c.report.mode,'rescue');
});
