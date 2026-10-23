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


test('actual four sole centres remain locked on a rotated lake during idle, startup turning and continuous circular stance',async()=>{
 const {root,inner,tiger,nodes}=await fixture();root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);
 const paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));const centres=paws.map(paw=>{paw.geometry.computeBoundingBox();const p=paw.geometry.attributes.position,out=new THREE.Vector3();let n=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-paw.geometry.boundingBox.min.y)<1e-4){out.add(new THREE.Vector3().fromBufferAttribute(p,i));n++;}return out.multiplyScalar(1/n);});
 const old=Math.random;Math.random=()=>.5;let maxError=0,maxSlip=0,pairs=0,idle=0,turning=0,previous=null;
 try{for(let i=0;i<180;i++){
  tiger.userData.update(1/30,i/30,{});root.updateMatrixWorld(true);const g=tiger.userData.targetGait;
  const feet=paws.map((p,j)=>inner.worldToLocal(p.localToWorld(centres[j].clone())));
  if(g.stanceAnchors){for(let j=0;j<4;j++)if(g.stance[j]&&g.stanceAnchors[j]){
   const a=g.stanceAnchors[j];maxError=Math.max(maxError,Math.hypot(feet[j].x-a[0],feet[j].z-a[2]));
   if(previous?.anchors[j]&&a[0]===previous.anchors[j][0]&&a[2]===previous.anchors[j][2]){maxSlip=Math.max(maxSlip,Math.hypot(feet[j].x-previous.feet[j].x,feet[j].z-previous.feet[j].z)*.5);pairs++;if(g.distance<1e-9)idle++;else if(Math.abs(tiger.rotation.y-previous.yaw)>1e-6)turning++;}
  }}
  previous={feet,anchors:g.stanceAnchors?.map(a=>a&&a.slice())||[null,null,null,null],yaw:tiger.rotation.y};
 }}finally{Math.random=old;}
 assert.ok(pairs>350&&idle>100&&turning>100);assert.ok(maxError<1e-8);assert.ok(maxSlip<1e-8);
 console.log('actual sole world lock',JSON.stringify({frames:180,stancePairs:pairs,idlePairs:idle,turningPairs:turning,maxInnerAnchorError:maxError,maxWorldHorizontalSlip:maxSlip}));
});
