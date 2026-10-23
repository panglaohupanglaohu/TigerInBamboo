import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const make=()=>{const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);return {scene,inner:scene.userData.inner};};
const localBox=(inner,o)=>{const b=new T.Box3().setFromObject(o);return b.applyMatrix4(new T.Matrix4().copy(inner.matrixWorld).invert());};
const {installSwampWhaleCalves}=await import('../../src/world/swampWhaleCalves.js');
test('two small belugas follow the adult underwater and never surface',()=>{
  const {scene,inner}=make();const before=inner.userData.whales.length;
  const c=installSwampWhaleCalves({swamp:scene,enabled:true});const r=c.report;
  assert.equal(r.calves,2);assert.equal(inner.userData.whales.length,before,'swamp whale list untouched');
  assert.ok(r.drawCalls<=6);
  const adult=inner.userData.whale;let minGap=Infinity,maxGap=0,maxTop=-Infinity;
  for(let i=0;i<400;i++){const t=i*.7;scene.userData.update(.7,t,{});c.update(t);
    for(const w of c.calves){assert.ok(w.position.y>=21&&w.position.y<=23,`calf y ${w.position.y}`);assert.equal(w.userData.surfacing,0);
      const g=Math.hypot(w.position.x-adult.position.x,w.position.z-adult.position.z);minGap=Math.min(minGap,g);maxGap=Math.max(maxGap,g);}
    maxTop=Math.max(maxTop,r.maxTopY);}
  assert.ok(maxTop<24.5,'backs stay below the water');
  assert.ok(minGap>2.4,`no overlap with the adult (${minGap.toFixed(2)})`);assert.ok(maxGap<12,`stay with the adult (${maxGap.toFixed(2)})`);
  assert.ok(c.calves.every(w=>w.scale.x<.6));
});
