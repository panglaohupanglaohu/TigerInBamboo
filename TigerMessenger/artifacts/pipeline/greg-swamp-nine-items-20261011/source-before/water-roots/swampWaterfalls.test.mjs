import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const make=()=>{const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);return {scene,inner:scene.userData.inner};};
const localBox=(inner,o)=>{const b=new T.Box3().setFromObject(o);return b.applyMatrix4(new T.Matrix4().copy(inner.matrixWorld).invert());};
const {installSwampWaterfalls}=await import('../../src/world/swampWaterfalls.js');
test('3–4 thin waterfalls hug the pit wall from rim to water, avoid the stair entrance and walkway, one draw',()=>{
  const {scene,inner}=make();const wf=installSwampWaterfalls({swamp:scene,enabled:true});const r=wf.report;
  assert.ok(r.falls.length>=3&&r.falls.length<=4,`falls ${r.falls.length}`);assert.equal(r.drawCalls,1);
  for(const f of r.falls){
    const d=Math.atan2(Math.sin(f.angle-.5),Math.cos(f.angle-.5));assert.ok(Math.abs(d)>=.4,'not at the stair entrance');
    assert.ok(f.topY>=39.5&&f.bottomY<=25.1,'rim to water');assert.ok(f.walkwayDistance>=3.5,'clear of the walkway');
    assert.ok(f.baseRadius>20&&f.baseRadius<26&&f.topRadius>30&&f.topRadius<36,'on the wall');
  }
  const blocked=installSwampWaterfalls({swamp:scene,enabled:true,angles:[.5,.7]}).report;assert.equal(blocked.falls.length,0);assert.equal(blocked.skipped.length,2);
  const mesh=inner.getObjectByName('swamp-wall-waterfalls');assert.ok(mesh.material.transparent&&!mesh.material.depthWrite);
  wf.update(3.5);assert.equal(mesh.material.uniforms.uTime.value,3.5);
  assert.match(mesh.material.fragmentShader,/uTime\*2\.2/,'stripes flow downward');
  // 对照机位（inner az=1.1、俯仰.62、距离66、看向(0,26,0)、fov40）：至少两道落在画面内
  const az=1.1,pt=.62,D=66,cam=new T.PerspectiveCamera(40,1.6,.1,2000);cam.position.copy(inner.localToWorld(new T.Vector3(Math.cos(az)*Math.cos(pt)*D,26+Math.sin(pt)*D,Math.sin(az)*Math.cos(pt)*D)));
  cam.up.copy(inner.localToWorld(new T.Vector3(0,1,0)).sub(inner.localToWorld(new T.Vector3())).normalize());cam.lookAt(inner.localToWorld(new T.Vector3(0,26,0)));cam.updateMatrixWorld();
  const inView=r.falls.filter(f=>[[f.topRadius-1.6,38],[f.baseRadius-.6,26]].every(([rr,y])=>{const s=inner.localToWorld(new T.Vector3(Math.cos(f.angle)*rr,y,Math.sin(f.angle)*rr)).project(cam);return Math.abs(s.x)<1&&Math.abs(s.y)<1&&s.z<1;}));
  assert.ok(inView.length>=2,`falls in the reference view: ${inView.length}`);
});
