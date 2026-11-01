import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
// CPU geometry tests still await the real anatomy + target integration. The
// image shim completes texture readiness; it is not a rendered-image assertion.
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');
async function fixture(){const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});return {root,inner,tiger,nodes};}
function sampler(f){const ray=new THREE.Raycaster(),surfaces=[...f.inner.userData.tigerWalkSurfaces,...f.inner.userData.gregCoralRim.walkMeshes];return point=>{const origin=f.inner.localToWorld(new THREE.Vector3(point.x,55,point.z)),direction=new THREE.Vector3(0,-1,0).transformDirection(f.inner.matrixWorld);ray.set(origin,direction);const hit=ray.intersectObjects(surfaces,false)[0];return hit?f.inner.worldToLocal(hit.point).y:null;};}
function localPoint(f,mesh,point){return f.inner.worldToLocal(mesh.localToWorld(point.clone()));}


const f=await fixture(),{root,tiger,nodes}=f,paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));
root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);
const rows=[];let previous=null,world=new THREE.Vector3(),turnMax=0,straightMax=0,total=0;const old=Math.random;Math.random=()=>.5;
try{for(let i=0;i<240;i++){
 tiger.userData.update(1/30,i/30,{});root.updateMatrixWorld(true);
 const g=tiger.userData.targetGait,current={yaw:tiger.rotation.y,stance:g.stance,phase:g.footPhases,feet:paws.map(p=>p.localToWorld(new THREE.Vector3(0,-2.075,.22)))};
 if(previous)for(let j=0;j<4;j++)if(current.stance[j]&&previous.stance[j]&&current.phase[j]>previous.phase[j]){
  const p0=f.inner.worldToLocal(previous.feet[j].clone()),p1=f.inner.worldToLocal(current.feet[j].clone());const moved=Math.hypot(p1.x-p0.x,p1.z-p0.z)*.5;const turn=Math.abs(current.yaw-previous.yaw)>1e-5;
  if(moved>.025)rows.push({i,t:i/30,foot:j,moved,mode:tiger.userData._mode,yawDelta:current.yaw-previous.yaw,rootDistance:g.distance,phase:current.phase[j],previousPhase:previous.phase[j],speed:g.speed});if(turn)turnMax=Math.max(turnMax,moved);else straightMax=Math.max(straightMax,moved);total++;
 }
 previous=current;
}}finally{Math.random=old;}
console.log(JSON.stringify(rows.sort((a,b)=>b.moved-a.moved).slice(0,12)));
console.log(JSON.stringify({samples:240,stancePairs:total,maxTurningPawWorldStep:turnMax,maxStraightPawWorldStep:straightMax,scope:'actual transformed four paw representative sole point; existing turn/body sway not world foot locking'}));
