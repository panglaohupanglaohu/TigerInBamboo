import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const make=()=>{const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);return {scene,inner:scene.userData.inner};};
const localBox=(inner,o)=>{const b=new T.Box3().setFromObject(o);return b.applyMatrix4(new T.Matrix4().copy(inner.matrixWorld).invert());};
const {installSwampFloatingDebris}=await import('../../src/world/swampFloatingDebris.js');
test('lily leaves and twigs float in clusters on the water, clear of boats, trunk and whale, drifting gently',()=>{
  const {scene,inner}=make();const d=installSwampFloatingDebris({swamp:scene,enabled:true});const r=d.report;
  assert.ok(r.leaves>=30&&r.leaves<=60,`leaves ${r.leaves}`);assert.ok(r.twigs>=10&&r.twigs<=20,`twigs ${r.twigs}`);
  assert.equal(r.drawCalls,2);assert.ok(r.clusters>=5);assert.ok(r.maxRadius<21,'inside the lake');
  const lot=inner.userData.lotuses.map(l=>l.position),sw=inner.userData.whale.userData.swim;
  for(const l of [...d.items.leaves,...d.items.twigs]){
    assert.ok(lot.every(p=>Math.hypot(p.x-l.x,p.z-l.z)>2.5),'not under a lotus boat');
    assert.ok(Math.hypot(l.x-sw.cx,l.z-sw.cz)>sw.rx+1.5,'not on the whale breathing spot');
  }
  const m=new T.Matrix4(),p=new T.Vector3(),a=[],b=[];
  d.update(0);for(let i=0;i<r.leaves;i++){d.leafMesh.getMatrixAt(i,m);a.push(p.setFromMatrixPosition(m).clone());}
  d.update(40);for(let i=0;i<r.leaves;i++){d.leafMesh.getMatrixAt(i,m);b.push(p.setFromMatrixPosition(m).clone());}
  const moved=a.map((v,i)=>v.distanceTo(b[i]));assert.ok(Math.max(...moved)>.05&&Math.max(...moved)<1.5,'gentle drift');
  for(const v of b)assert.ok(v.y>25.02&&v.y<25.12,'on the water surface');
});
