import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
test('greet return keeps original route and water support until actual stairs, with distance gait and no stopped paddling',async()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.rotation.set(.2,-.3,.1);root.position.set(3,7,-11);root.updateMatrixWorld(true);
 const nodes=new Map();tiger.traverse(o=>{if(o.userData.blenderSourceNode)nodes.set(o.userData.blenderSourceNode,o);});const paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));
 const player={position:inner.localToWorld(new T.Vector3(0,25,0)),facing:new T.Vector3(0,0,1).transformDirection(inner.matrixWorld),velocity:new T.Vector3(),onGround:true};
 let phase=0,previous=tiger.position.clone(),water=0,ground=0,stopped=0,mode='';const states=[],old=Math.random;Math.random=()=>.5;
 try{for(let i=0;i<=900;i++){
  const t=i/30;root.userData.update(1/30,t,t<20?{player}:{});root.updateMatrixWorld(true);
  const u=tiger.userData,s=u.tigerTargetSupport,g=u.targetGait,d=Math.hypot(tiger.position.x-previous.x,tiger.position.z-previous.z);previous.copy(tiger.position);assert.ok(Math.abs(g.distance-d)<1e-8);
  const dp=((g.phase-phase)%1+1)%1;phase=g.phase;if(d<1e-8){assert.ok(Math.min(dp,1-dp)<1e-8);stopped++;}
  if(mode!==s.mode){mode=s.mode;states.push(mode);}assert.notEqual(s.supportKind,'unsupported');
  if(u._waterReturning){water++;assert.equal(s.mode,'ascend');assert.equal(s.supportKind,'water-supported');assert.equal(s.grounded,false);assert.deepEqual(s.feet,[]);assert.equal(u._baseY,25.15);
   if(i%6===0)for(const paw of paws){const a=paw.geometry.attributes.position;let low=Infinity;for(let j=0;j<a.count;j++){const p=inner.worldToLocal(paw.localToWorld(new T.Vector3().fromBufferAttribute(a,j)));low=Math.min(low,p.y);}assert.ok(low>=25.14,'returning feet never sink beneath their water-walk plane');}
  }else if(s.mode==='ascend'){ground++;assert.equal(s.supportKind,'real-ground');assert.equal(s.grounded,true);assert.ok(s.feet.every(f=>f.height!==null));}
 }}finally{Math.random=old;}
 assert.deepEqual(states.slice(0,5),['greet-jump','greet-meet','greet-stay','ascend','patrol']);assert.ok(water>200);assert.ok(ground>75);assert.ok(stopped>200);
});
