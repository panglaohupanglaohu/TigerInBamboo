import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {sampleSwampRimGround,sampleSwampAuthoredGround}=await import('../../src/world/swampPlayerSupport.js');
const {createSwampEdgeGuard,installSwampEntranceBridge}=await import('../../src/world/swampEdgeGuard.js');
const {resolveCollisions}=await import('../../src/world/collision.js');
const {updatePlayerControl}=await import('../../src/player/controller.js');

const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner;
placeMoebiusSwampOnSphere(placement,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);
const rim=inner.userData.gregCoralRim;
const bridge=installSwampEntranceBridge(inner);
const rimTopR=inner.localToWorld(new T.Vector3(38,rim.topY,0)).length();
// Real swamp supports, same order as main.js. Outside the crater the planet is a canyon
// terrace far below the rim (the drop that made the courier fall).
const chain=p=>bridge.ground(p)??sampleSwampRimGround(inner,p)??sampleSwampAuthoredGround(inner,p)??inner.userData.sampleGroundRadius(p)??null;
const support=p=>chain(p)??rimTopR-8.6;
const localGround=p=>chain(p)??rimTopR-8.6;

function walk(points,{guard=null,seconds=60,fixedRef=null}={}){
  const P=points.map(p=>new T.Vector3(...p));
  const w=inner.localToWorld(P[0].clone()),g=support(w.clone().setLength(w.length()+1.5));
  const pl={position:w.clone().setLength(g+.01),velocity:new T.Vector3(),onGround:true,groundR:g,checkpoint:w.clone(),forward:new T.Vector3(),facing:new T.Vector3()};
  const dir=new T.Vector3(),camera={getWorldDirection:v=>v.copy(dir)},keys={KeyW:true},dt=1/120;
  let k=1,lowest=Infinity,progress=0,i=0;
  for(;i<seconds*120&&k<P.length;i++){
    const target=inner.localToWorld(P[k].clone()),d=target.sub(pl.position),up=pl.position.clone().normalize();d.addScaledVector(up,-d.dot(up));
    if(d.length()<.6){k++;progress=i;continue;}
    if(i-progress>120*6)break;
    dir.copy(d.normalize());guard?.begin(pl);
    updatePlayerControl({player:pl,keys,camera,dt,gameStarted:true,onJump(){}});
    resolveCollisions(pl.position,pl.velocity,dt,[],pl,()=>{},null,localGround);
    guard?.end(pl,dt);
    const ref=fixedRef??inner.localToWorld(P[Math.min(k,P.length-1)].clone()).length();lowest=Math.min(lowest,pl.position.length()-ref);
  }
  return {completed:k>=P.length,lowest,player:pl};
}
const mkGuard=(extra={})=>createSwampEdgeGuard({getZone:()=>inner,supportRadius:support,enabled:true,maxDrop:.7,...extra});
const lap=(r,sign)=>Array.from({length:73},(_,i)=>{const a=rim.entranceAngle+.25+sign*i/72*Math.PI*2;return [Math.cos(a)*r,rim.topY,Math.sin(a)*r];});
const straight=(a,r0,r1)=>[[Math.cos(a)*r0,rim.topY,Math.sin(a)*r0],[Math.cos(a)*r1,rim.topY,Math.sin(a)*r1]];

test('entrance bridge closes the rim gap outside the stair head only',()=>{
  assert.ok(bridge.ok);assert.equal(bridge.walkMeshes.length,1);
  const [a0,a1]=bridge.angles;assert.ok(a0<rim.entranceAngle-rim.entranceHalfAngle&&a1>rim.entranceAngle+rim.entranceHalfAngle);
  // The stair head (top tread, radius ~37) is still the tiger's/courier's way down.
  const head=inner.localToWorld(new T.Vector3(Math.cos(rim.entranceAngle)*36.5,rim.topY+2,Math.sin(rim.entranceAngle)*36.5));
  assert.equal(bridge.ground(head),null);
});

test('without the guard, stepping off the rim inward falls into the crater (the reported bug)',()=>{
  const r=walk(straight(2,37,20),{seconds:4,fixedRef:rimTopR});
  assert.ok(r.lowest<-3,`fell ${r.lowest.toFixed(2)}`);
});

for(const a of [0,.9,2,3.1,4,5.2])test(`guard keeps the courier on the rim walking inward and outward at angle ${a}`,()=>{
  for(const [r0,r1] of [[37.5,18],[38.5,60]]){
    const r=walk(straight(a,r0,r1),{guard:mkGuard(),seconds:4,fixedRef:rimTopR});
    assert.ok(r.lowest>-.45,`angle ${a} ${r0}->${r1}: ${r.lowest.toFixed(2)} below the rim`);
  }
});

// Node has no async tiger-stair grading, so the lap runs on the bridge-covered outer band;
// the live game additionally crosses on the graded top tread (see artifacts report).
for(const radius of [38.8,39.4,39.9])for(const sign of [1,-1])test(`full rim lap at radius ${radius} ${sign>0?'counter-clockwise':'clockwise'} completes, through the entrance, without dropping`,()=>{
  const r=walk(lap(radius,sign),{guard:mkGuard()});
  assert.ok(r.completed,'lap incomplete');assert.ok(r.lowest>-.3,`dipped ${r.lowest.toFixed(2)}`);
});

test('authored bank route (entry link, three terraces, flights) is still walkable with the guard on',()=>{
  const route=inner.userData.gregSpatialPlan.route;
  const r=walk(route.filter((_,i)=>i%3===0||i===route.length-1),{guard:mkGuard(),seconds:120});
  assert.ok(r.completed,'route blocked');assert.ok(r.lowest>-.8,`route dip ${r.lowest.toFixed(2)}`);
});

test('swampEdgeGuard=0 style disable leaves physics untouched',()=>{
  const g=mkGuard({enabled:false});const r=walk(straight(2,37,20),{guard:g,seconds:4,fixedRef:rimTopR});
  assert.ok(r.lowest<-3);assert.equal(g.report.blockedSteps,0);
});
