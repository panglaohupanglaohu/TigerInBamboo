import test from 'node:test';
import assert from 'node:assert/strict';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
async function fixture(flag){location.search='?tigerGroundIndex='+flag;const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);return{root,inner,tiger};}
test('indexed support preserves exact original tiger poses and diagnostics through patrol, drinking, ascent and greeting',async()=>{
 const prior=Math.random;Math.random=()=>.51;
 try{const a=await fixture(0),b=await fixture(1),modes=new Set();a.tiger.userData.forceDrink=b.tiger.userData.forceDrink=true;
 for(let i=0;i<2700;i++){const t=i/30;for(const f of [a,b]){f.tiger.userData.update(1/30,t,{});f.root.updateMatrixWorld(true);}const x=a.tiger.userData.tigerTargetSupport,y=b.tiger.userData.tigerTargetSupport;modes.add(x.mode);assert.equal(y.mode,x.mode);assert.equal(y.supportKind,x.supportKind);assert.ok(a.tiger.position.distanceTo(b.tiger.position)<1e-7);assert.ok(a.tiger.quaternion.angleTo(b.tiger.quaternion)<1e-6);for(let j=0;j<x.feet.length;j++){const p=x.feet[j],q=y.feet[j];assert.equal(q.samplesSupported,p.samplesSupported);if(p.height===null)assert.equal(q.height,null);else assert.ok(Math.abs(q.height-p.height)<1e-7);for(let k=0;k<3;k++)assert.ok(Math.abs(q.foot[k]-p.foot[k])<1e-7);}}
 assert.ok(modes.has('drink')&&modes.has('ascend')&&modes.has('patrol'));assert.ok(b.tiger.userData.tigerGroundIndex.indexedMeshes>0);
 // Real runtime player triggers the existing airborne/water greeting state.
 for(let i=0;i<120;i++)for(const f of [a,b]){const player={position:f.inner.localToWorld(f.tiger.position.clone().setY(30))};f.tiger.userData.update(1/30,90+i/30,{player});}
 assert.equal(a.tiger.userData._mode,b.tiger.userData._mode);assert.ok(a.tiger.position.distanceTo(b.tiger.position)<1e-7);console.log('paired support modes', [...modes]);
 }finally{Math.random=prior;}
});
