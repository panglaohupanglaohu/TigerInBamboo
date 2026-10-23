import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const {installSwampWaterMarks}=await import('../../src/world/swampWaterMarks.js');
test('water strokes come from what disturbs the water: boats always, feeder always, whale only while surfaced',()=>{
  const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);const inner=scene.userData.inner;
  const marks=installSwampWaterMarks({swamp:scene,enabled:true});assert.equal(marks.report.enabled,true);
  const water=inner.getObjectByName('swamp-underground-waterline');assert.equal(water.material.customProgramCacheKey(),'swamp-water-marks-1');
  const sh={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};water.material.onBeforeCompile(sh);
  assert.match(sh.fragmentShader,/uEm\[12\]/);assert.match(sh.vertexShader,/vSwIn=/);
  const cam=new T.PerspectiveCamera();cam.position.set(0,60,0);
  const counts=[];for(let i=0;i<300;i++){const t=i*.5;scene.userData.update(.5,t,{});scene.updateMatrixWorld(true);marks.update(t,cam);counts.push(marks.report.emitters);}
  const boats=inner.userData.lotuses.length;
  assert.ok(Math.min(...counts)>=Math.min(12,boats+1),'boats and feeder always disturb the water');
  assert.ok(Math.max(...counts)>Math.min(...counts),'whale rings come and go with surfacing');
});
