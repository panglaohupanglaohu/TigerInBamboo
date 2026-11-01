import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
// CPU geometry tests still await the real anatomy + target integration. The
// image shim completes texture readiness; it is not a rendered-image assertion.
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
async function fixture(){const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});return {root,inner,tiger,nodes};}
function sampler(f){const ray=new THREE.Raycaster(),surfaces=[...f.inner.userData.tigerWalkSurfaces,...f.inner.userData.gregCoralRim.walkMeshes];return point=>{const origin=f.inner.localToWorld(new THREE.Vector3(point.x,55,point.z)),direction=new THREE.Vector3(0,-1,0).transformDirection(f.inner.matrixWorld);ray.set(origin,direction);const hit=ray.intersectObjects(surfaces,false)[0];return hit?f.inner.worldToLocal(hit.point).y:null;};}
function localPoint(f,mesh,point){return f.inner.worldToLocal(mesh.localToWorld(point.clone()));}

test('forceDrink traverses actual steps both ways, every stance foot rests on real support, and support diagnostics stay live',async()=>{
 const f=await fixture(),{root,inner,tiger,nodes}=f;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);
 const ground=sampler(f),paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));
 const soles=paws.map(p=>{p.geometry.computeBoundingBox();const a=p.geometry.attributes.position,out=[];for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-p.geometry.boundingBox.min.y)<1e-4)out.push(new THREE.Vector3().fromBufferAttribute(a,i));return out;});
 const previousRandom=Math.random;Math.random=()=>.5;const states=[],previous=tiger.position.clone();let mode='',stanceSamples=0,drinkSamples=0,maxStep=0;const entryRadius=Math.hypot(tiger.userData.tigerRoam.rim[0].x,tiger.userData.tigerRoam.rim[0].z);
 tiger.userData.forceDrink=true;
 try{for(let i=0;i<=780;i++){
  const t=i/30;tiger.userData.update(1/30,t,{});root.updateMatrixWorld(true);
  maxStep=Math.max(maxStep,Math.hypot(tiger.position.x-previous.x,tiger.position.z-previous.z));previous.copy(tiger.position);
  const report=tiger.userData.tigerTargetSupport;assert.equal(report.time,t);assert.equal(report.mode,tiger.userData._mode);assert.ok(report.grounded);
  if(mode!==report.mode){if(mode==='ascend'&&report.mode==='patrol')assert.ok(Math.abs(Math.hypot(tiger.position.x,tiger.position.z)-entryRadius)<.02,'finish climb at rim before circular patrol');mode=report.mode;states.push([mode,t]);}
  if(i%6)continue;
  if(['descend','drink'].includes(report.mode)){
   const inward=new THREE.Vector3(-tiger.position.x,0,-tiger.position.z).normalize(),facing=new THREE.Vector3(0,0,1).applyQuaternion(tiger.quaternion).setY(0).normalize();
   assert.ok(facing.dot(inward)>.999,'descending/drinking tiger faces lake centre, not outer rim');
  }
  for(let j=0;j<4;j++){
   let nearest=Infinity,minGap=Infinity,hits=0;
   for(const point of soles[j]){const local=localPoint(f,paws[j],point),height=ground(local);if(height===null)continue;hits++;minGap=Math.min(minGap,local.y-height);nearest=Math.min(nearest,Math.abs(local.y-height));}
   assert.ok(hits>0,`paw ${j} missing support at ${t}`);assert.ok(minGap>=-.012,`paw ${j} penetrates at ${t}: ${minGap}`);
   const swing=tiger.userData.targetGait.swing[j];assert.ok(nearest<.023+.145*swing,`paw ${j} floats at ${t}: ${nearest}`);if(swing<.001)stanceSamples++;
  }
  // Independent torso sampling catches belly collisions between grounded feet.
  const torso=nodes.get('n2'),a=torso.geometry.attributes.position;
  for(let j=0;j<a.count;j+=17){const p=localPoint(f,torso,new THREE.Vector3().fromBufferAttribute(a,j)),h=ground(p);if(h!==null)assert.ok(p.y-h>-.02,`torso collides at ${t}`);}
  if(tiger.userData._drinking&&tiger.userData.drinkDetail.blend>.98){
   const nose=nodes.get('n25'),a=nose.geometry.attributes.position;let low=Infinity;for(let j=0;j<a.count;j++)low=Math.min(low,localPoint(f,nose,new THREE.Vector3().fromBufferAttribute(a,j)).y);
   assert.ok(Math.abs(low-25.12)<.002,'muzzle reaches the actual water datum');
   nose.geometry.computeBoundingSphere();const noseCentre=localPoint(f,nose,nose.geometry.boundingSphere.center);
   assert.ok(Math.hypot(noseCentre.x,noseCentre.z)<Math.hypot(tiger.position.x,tiger.position.z)-.5,'drinking muzzle extends inward over lake water');
   drinkSamples++;
  }
  if(t>19)assert.ok(report.feet.every(p=>Math.abs(p.height-40)<1e-4),'rim report must not retain old 26.x stair samples');
 }}finally{Math.random=previousRandom;}
 assert.deepEqual(states.map(s=>s[0]),['to-steps','descend','drink','ascend','patrol']);assert.ok(maxStep<=2.6/30+.0001,'no radial teleport when ascent finishes');assert.ok(stanceSamples>200);assert.ok(drinkSamples>15);assert.equal(tiger.userData.displayName,'湖沼之虎');
});

test('greeting remains an airborne jump followed by original water walking, never stair-constrained',async()=>{
 const f=await fixture(),{root,inner,tiger}=f;root.updateMatrixWorld(true);const player={position:inner.localToWorld(new THREE.Vector3(0,25,0))};
 tiger.userData.update(1/30,0,{player});assert.equal(tiger.userData._mode,'greet-jump');assert.equal(tiger.userData.tigerTargetSupport.grounded,false);
 for(let i=1;i<90;i++)tiger.userData.update(1/30,i/30,{player});
 assert.ok(['greet-meet','greet-stay'].includes(tiger.userData._mode));assert.equal(tiger.userData._baseY,25.15);assert.equal(tiger.userData.tigerTargetSupport.grounded,false);assert.deepEqual(tiger.userData.tigerTargetSupport.feet,[]);assert.equal(tiger.userData.speech.line,'两家秋雨一家声，你猜');
});

test('real scene update keeps all four patrol feet supported across the entrance joints for varied drink durations',async()=>{
 const previousRandom=Math.random;
 try{for(const random of [0,.51,.999]){
  Math.random=()=>random;
  const f=await fixture(),{root,tiger}=f;root.position.set(-3,7,9);root.rotation.set(.14,-.37,.08);root.updateMatrixWorld(true);
  const ground=sampler(f);tiger.userData.forceDrink=true;let patrolSamples=0,sawDrink=false,sawAscent=false,minAngle=Infinity,maxAngle=-Infinity;
  const duration=random===0?120:90;
  for(let i=0;i<=duration*30;i++){
   const t=i/30;root.userData.update(1/30,t,{});root.updateMatrixWorld(true);
   const report=tiger.userData.tigerTargetSupport;
   assert.equal(report.time,t);sawDrink ||= report.mode==='drink';sawAscent ||= report.mode==='ascend';
   if(report.grounded)for(let paw=0;paw<4;paw++)assert.notEqual(report.feet[paw].height,null,`random ${random}, ${report.mode}, time ${t}, paw ${paw}`);
   if(report.mode!=='patrol')continue;
   patrolSamples++;
   let angle=Math.atan2(tiger.position.z,tiger.position.x);if(angle<.49)angle+=Math.PI*2;
   minAngle=Math.min(minAngle,angle);maxAngle=Math.max(maxAngle,angle);
   if(i%6===0)for(const foot of report.feet){
    const point=new THREE.Vector3(...foot.foot),height=ground(point);
    assert.notEqual(height,null,'independent ray hits visible stair or rock, not fallback Y');
    assert.ok(Math.abs(height-foot.height)<1e-4,'diagnostic matches actual support after whole-scene update');
   }
  }
  assert.ok(sawDrink&&sawAscent);assert.ok(patrolSamples>1500);assert.ok(maxAngle-minAngle>4.5,'patrol crosses most of the perimeter');
 }}finally{Math.random=previousRandom;}
});


test('eight entrance stair groups descend radially toward lake centre and end at the water; side-bank passage also descends inward',async()=>{
 const f=await fixture(),{root,inner,tiger}=f;root.updateMatrixWorld(true);
 const steps=inner.userData.tigerWalkSurfaces;assert.equal(steps.length,8);
 const inward=steps.at(-1).position.clone().sub(steps[0].position).setY(0).normalize();
 assert.ok(inward.dot(steps[0].position.clone().setY(0).normalize().negate())>.9999);
 for(let i=1;i<8;i++){
  assert.ok(Math.hypot(steps[i].position.x,steps[i].position.z)<Math.hypot(steps[i-1].position.x,steps[i-1].position.z));
  assert.ok(steps[i].position.y<steps[i-1].position.y);
 }
 // Raycast final graded/rendered geometry, not its ungraded group positions.
 const ground=sampler(f),angle=Math.atan2(steps[0].position.z,steps[0].position.x);let previous=Infinity,lowestDry=Infinity,submerged=false,samples=0;
 for(let r=37.4;r>=24.8;r-=.025){const height=ground(new THREE.Vector3(Math.cos(angle)*r,0,Math.sin(angle)*r));assert.ok(height!==null,`entrance radial support missing at ${r}`);assert.ok(height<=previous+.002,'every inward tread is level or lower');previous=height;if(height>=25)lowestDry=Math.min(lowestDry,height);else submerged=true;samples++;}
 assert.ok(samples>500);assert.ok(lowestDry>=25&&lowestDry<25.02,'lowest dry tread meets water, not a cliff above it');assert.ok(submerged,'inner end continues gently below waterline');
 const route=tiger.userData.tigerRoam.steps;for(let i=1;i<route.length;i++)assert.ok(Math.hypot(route[i].x,route[i].z)<Math.hypot(route[i-1].x,route[i-1].z));
 const bank=inner.userData.gregSpatialPlan;assert.ok(bank.route.length>50);
 for(let i=1;i<bank.route.length;i++){const a=bank.route[i-1],b=bank.route[i];assert.ok(b[1]<=a[1]+1e-5);assert.ok(Math.hypot(b[0],b[2])<=Math.hypot(a[0],a[2])+1e-5,'side passage stays inside bowl while descending');}
 assert.equal(bank.levels.at(-1).innerY,26.8);
});
