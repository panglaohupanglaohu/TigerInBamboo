import test from 'node:test';
import assert from 'node:assert/strict';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {installSwampTigerEncounter}=await import('../../src/world/swampTigerEncounter.js');
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
async function fixture(flag){location.search='?tigerGroundIndex='+flag;const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);return{root,inner,tiger};}


const THREE=await import('three');
for(const [station,p]of [['middle',[16.815,30.9,-17.487]],['rim',[Math.cos(1.25)*40.9,40.2,Math.sin(1.25)*40.9]],['stairs',[25.6,28.8,14]]])test('actual authored '+station+' meeting and connected return',async()=>{
 const f=await fixture(1),c=installSwampTigerEncounter(f.inner);c.random=()=>0;
 await f.inner.userData.gregSpatialPlan.ready;f.root.updateMatrixWorld(true);
 const meshes=[...f.inner.userData.tigerWalkSurfaces,...f.inner.userData.gregSpatialPlan.walkMeshes,...f.inner.userData.gregCoralRim.walkMeshes];for(const mesh of meshes)mesh.updateWorldMatrix(true,false);
 const point=new THREE.Vector3(...p),ray=new THREE.Raycaster(f.inner.localToWorld(new THREE.Vector3(point.x,65,point.z)),new THREE.Vector3(0,-1,0).transformDirection(f.inner.matrixWorld));
 const hit=ray.intersectObjects(meshes,false)[0];assert.ok(hit,'station actual support exists');point.y=f.inner.worldToLocal(hit.point.clone()).y+.2;
 const player={position:f.inner.localToWorld(point.clone())};f.tiger.userData.update(0,0,{});f.root.updateMatrixWorld(true);f.tiger.userData.forceDrink=true;let meetingDistance=null,phases=new Set(),maxMove=0,maxInfo=null;const prior=f.tiger.position.clone();
 for(let i=0;i<4200&&c.report.cycles<1;i++){f.tiger.userData.update(.1,i*.1,{player});c.syncCarrier(i*.1);f.root.updateMatrixWorld(true);if(f.tiger.position.distanceTo(prior)>maxMove){maxMove=f.tiger.position.distanceTo(prior);maxInfo={phase:c.report.phase,index:i,kind:c.report.meetingPath,from:prior.toArray(),to:f.tiger.position.toArray(),bank:f.tiger.userData._bankWalking,support:f.tiger.userData.tigerTargetSupport?.supportKind};}prior.copy(f.tiger.position);phases.add(c.report.phase);if(c.report.phase==='meeting')meetingDistance=f.tiger.getWorldPosition(new THREE.Vector3()).distanceTo(player.position);}
 assert.ok(phases.has('meeting'),'meeting reached '+JSON.stringify(c.report));assert.ok(meetingDistance<=7.5);assert.equal(c.report.cycles,1);assert.ok(maxMove<2,'max movement '+maxMove+' '+JSON.stringify(maxInfo));console.log(station,{meetingDistance,maxMove,path:c.report.meetingPath,elevation:point.y});
});
