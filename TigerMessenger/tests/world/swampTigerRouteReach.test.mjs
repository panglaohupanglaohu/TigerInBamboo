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


// 2026-10-10 user: wherever the tiger walks, the courier must be able to go too.
const tiger=inner.userData.tiger, roam=tiger.userData.tigerRoam;
const down=[roam.rim[0],...roam.steps,roam.drink].filter(Boolean).map(p=>[p.x,p.y,p.z]);
test('the courier can walk the tiger route from the rim down the tiger stairs to the drinking ledge, with the guard on',()=>{
  const r=walk(down,{guard:mkGuard(),seconds:90});
  console.log('tiger-route-down',JSON.stringify({completed:r.completed,lowest:+r.lowest.toFixed(2),steps:down.length}));
  assert.ok(r.completed,'courier cannot follow the tiger down');
});
test('and back up from the drinking ledge to the rim',()=>{
  const r=walk([...down].reverse(),{guard:mkGuard(),seconds:90});
  console.log('tiger-route-up',JSON.stringify({completed:r.completed,lowest:+r.lowest.toFixed(2)}));
  assert.ok(r.completed,'courier cannot climb back up the tiger stairs');
});
