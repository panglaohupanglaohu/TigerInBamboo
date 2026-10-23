import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const make=()=>{const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);return {scene,inner:scene.userData.inner};};
const localBox=(inner,o)=>{const b=new T.Box3().setFromObject(o);return b.applyMatrix4(new T.Matrix4().copy(inner.matrixWorld).invert());};
const {installSwampRimFlowers}=await import('../../src/world/swampRimFlowers.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');
test('6–8 giant red-orange rim flowers sit on the rim ring, pass walkway/tiger/root clearance, two draws',()=>{
  const {scene,inner}=make();const fl=installSwampRimFlowers({swamp:scene,enabled:true});const r=fl.report;
  assert.ok(r.flowers.length>=6&&r.flowers.length<=8,`flowers ${r.flowers.length}`);assert.equal(r.drawCalls,2);
  const guard=createSwampLivingPathConstraints(inner);
  for(const f of r.flowers){
    assert.ok(f.radius>=f.lip&&f.radius<=f.lip+4&&f.lip>=29&&f.lip<=38,'on the inner lip of the rim, leaning over the lake');assert.ok(Math.abs(f.y-40)<2.5,'rim top');
    assert.ok(Math.abs(Math.atan2(Math.sin(f.angle-.5),Math.cos(f.angle-.5)))>.5,'clear of the stair mouth');
    const res=guard.inspectPlant({position:[Math.cos(f.angle)*f.radius,f.y,Math.sin(f.angle)*f.radius],radius:f.spread,height:3.4*f.scale});
    assert.ok(res.allowed,res.reasons.join());
  }
  const mesh=inner.getObjectByName('swamp-rim-giant-flowers');const c=mesh.geometry.attributes.color;let warm=0;
  for(let i=0;i<c.count;i++)if(c.getX(i)>.7&&c.getX(i)>c.getZ(i)+.2)warm++;assert.ok(warm/c.count>.5,'mostly red-orange');
  const glow=inner.getObjectByName('swamp-rim-flower-glow');assert.equal(glow.material.blending,T.AdditiveBlending);
  assert.match(glow.material.vertexShader,/min\(.*uMaxNdc\)/,'glow is capped on screen');assert.ok(glow.material.uniforms.uMaxNdc.value<=.1&&glow.material.uniforms.uOpacity.value<=.5);
  const sz=glow.geometry.attributes.aSize;for(let i=0;i<sz.count;i++)assert.ok(sz.getX(i)<=1.6,'halo half size');
  assert.ok(r.flowers.filter(f=>f.scale>=1.1).length>=5,'most flowers are scaled up');
  fl.update(2);assert.equal(glow.material.uniforms.uTime.value,2);
  const angs=r.flowers.map(f=>f.angle).sort((a,b)=>a-b);assert.ok(angs[angs.length-1]-angs[0]>3.5,'ring around the pit');
});
