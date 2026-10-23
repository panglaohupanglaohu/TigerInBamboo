import test from 'node:test';
import assert from 'node:assert/strict';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {installSwampTigerEncounter}=await import('../../src/world/swampTigerEncounter.js');
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
async function fixture(flag){location.search='?tigerGroundIndex='+flag;const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);return{root,inner,tiger};}

for(const [method,roll]of [['swim',0],['boat',.5],['whale',.99]])test('actual factory tiger and carrier: '+method,async()=>{
 const f=await fixture(1),controller=installSwampTigerEncounter(f.inner,{random:()=>roll}),player={position:f.inner.localToWorld(f.tiger.userData.tigerRoam.steps[0].clone().add(new (await import('three')).Vector3(0,2,0)))};
 controller.random=()=>roll;
 f.tiger.userData.update(0,0,{});f.root.updateMatrixWorld(true);
 f.tiger.userData.forceDrink=true;const phases=new Set();let maximum=0,maxPhase=null,maxFrame=null;const prior=f.tiger.position.clone();
 for(let i=0;i<2600&&controller.report.cycles<1;i++){f.tiger.userData.update(.1,i*.1,{player});controller.syncCarrier(i*.1);f.root.updateMatrixWorld(true);phases.add(controller.report.phase);if(f.tiger.position.distanceTo(prior)>maximum){maximum=f.tiger.position.distanceTo(prior);maxPhase=controller.report.phase;maxFrame=i;}prior.copy(f.tiger.position);}
 assert.equal(controller.report.transport,method);assert.equal(controller.report.cycles,1);assert.ok(phases.has('eye-contact')&&phases.has('meeting')&&phases.has('meet-return'));assert.ok(maximum<2,'no long-distance snap '+maximum+' phase '+maxPhase+' frame '+maxFrame);console.log(method,'actual fixture max displacement at dt .1:',maximum,'skinV3',!!f.tiger.userData.skinV3);
});
