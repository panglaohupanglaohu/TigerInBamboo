import test from 'node:test';
import assert from 'node:assert/strict';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {installSwampTigerEncounter}=await import('../../src/world/swampTigerEncounter.js');
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
async function fixture(flag){location.search='?tigerGroundIndex='+flag;const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);return{root,inner,tiger};}


const THREE=await import('three');
const {installSwampOppositeLanding}=await import('../../src/world/swampOppositeLanding.js');
test('actual faceted wall exposes all sixteen opposite treads and retains submerged shell',async()=>{
 const {root,inner}=await fixture(1),landing=installSwampOppositeLanding(inner),wall=inner.getObjectByName('swamp-sinkhole-wall');
 const probe=wall.clone();probe.material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});inner.add(probe);root.updateMatrixWorld(true);
 const forward=new THREE.Vector3(Math.cos(landing.angle),0,Math.sin(landing.angle)),side=new THREE.Vector3(-forward.z,0,forward.x),ray=new THREE.Raycaster();
 const blocked=[];
 for(let i=0;i<landing.steps.length;i++)for(const offset of [-2.15,0,2.15]){
  const origin=forward.clone().multiplyScalar(8).addScaledVector(side,offset);origin.y=landing.steps[i].y+.08;
  const world=inner.localToWorld(origin),direction=forward.clone().transformDirection(inner.matrixWorld);ray.set(world,direction);ray.far=25;
  if(ray.intersectObject(probe,false).length)blocked.push([i,offset]);
 }
 assert.deepEqual(blocked,[],'wall obstructs tread sight lines');
 const origin=forward.clone().multiplyScalar(8);origin.y=24.3;ray.set(inner.localToWorld(origin),forward.clone().transformDirection(inner.matrixWorld));ray.far=25;assert.ok(ray.intersectObject(probe,false).length,'underwater wall remains closed');
 const p=wall.geometry.attributes.position;assert.ok(p.array.every(Number.isFinite));assert.equal(p.count,wall.geometry.attributes.normal.count);assert.equal(p.count,wall.geometry.attributes.color.count);assert.ok(wall.geometry.groups.length<=10,'no per-triangle material groups');
 console.log('actual opposite wall: sixteen treads × three sight lines open, underwater closed, groups',wall.geometry.groups.length,'vertices',p.count);
 inner.remove(probe);probe.material.dispose();
});
