import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?gregLakeDock=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const before=createMoebiusSwampPlacement({seed:7711,scale:.5});location.search='';
const after=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=after.userData.inner,dock=inner.userData.gregShoreDock;
function position(n){return n.position.toArray();}
function topHit(at,meshes){inner.updateWorldMatrix(true,true);const ray=new T.Raycaster(inner.localToWorld(at.clone().add(new T.Vector3(0,.4,0))),new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld));return ray.intersectObjects(meshes,false)[0];}

test('shore landing uses actual bank, has four solid footings and reuses original barge',()=>{
 assert.ok(dock?.ok);assert.equal(dock.barge,inner.userData.shipyard.barge);assert.equal(dock.footings.length,4);assert.equal(dock.renderMeshes,3);
 const centre=new T.Vector3(...dock.deckCentre),shore=new T.Vector3(...dock.shore);assert.ok(Math.abs(centre.distanceTo(shore)-2.1)<1e-6);
 assert.ok(Math.hypot(centre.x,centre.z)>19,'must be shoreward of original r14 berth');
 for(const f of dock.footings){assert.ok(f.top[1]>=f.foot[1]);assert.equal(f.embedded,.25);}
 assert.equal(dock.connectedToMainPath,false,'must not claim an unbuilt main-path connection');
 assert.ok(dock.barge.getObjectByName('v2-repair-workbench'));
 assert.equal(before.userData.inner.userData.gregShoreDock,undefined);
});

test('closed deck and gangway have continuous top surfaces, away from the oar rows',()=>{
 for(const link of [dock.shipLink,dock.shoreLink]){
  const a=new T.Vector3(...link.from),b=new T.Vector3(...link.to);
  for(let i=0;i<=30;i++){const at=a.clone().lerp(b,i/30),hit=topHit(at,dock.walkMeshes);assert.ok(hit,`unsupported ${link.name}:${i}`);assert.ok(Math.abs(inner.worldToLocal(hit.point).y-dock.deckY)<1e-4);}
 }
 const ship=inner.userData.shipyard.dock;inner.updateWorldMatrix(true,true);
 for(const v of [dock.shipLink.from,dock.shipLink.to]){const p=ship.worldToLocal(inner.localToWorld(new T.Vector3(...v)));assert.ok(p.x< -2.1,'boarding corridor must stay aft of the oar pivots');}
});

test('26-second update preserves ship, repair actors and departure choreography against rollback',()=>{
 const a=inner.userData.shipyard,b=before.userData.inner.userData.shipyard,bargePosition=a.barge.position.clone(),bargeRotation=a.barge.rotation.clone();
 assert.equal(a.workers[0].parent,a.dock);assert.equal(a.workers[1].parent,a.mastPivot);assert.equal(a.waterLizard.parent,a.dock);
 for(let k=0;k<=520;k++){
  const t=k*.05;before.userData.update(.05,t,{});after.userData.update(.05,t,{});
  for(const key of ['dock','departure','escort','waterLizard','mastPivot']){assert.deepEqual(position(a[key]),position(b[key]),`${key}@${t}`);assert.deepEqual(a[key].quaternion.toArray(),b[key].quaternion.toArray());}
  assert.ok(a.barge.position.equals(bargePosition));assert.ok(a.barge.rotation.equals(bargeRotation));
 }
});

test('dock remains in real ground sampler after spherical placement',()=>{
 placeMoebiusSwampOnSphere(after,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);after.updateMatrixWorld(true);
 const local=new T.Vector3(...dock.deckCentre),world=inner.localToWorld(local.clone()),up=world.clone().normalize();
 const sampled=inner.userData.sampleGroundRadius(world.clone().addScaledVector(up,.1));
 assert.ok(sampled!==null);assert.ok(Math.abs(sampled-world.length())<.15,`unexpected sampled level ${sampled} vs ${world.length()}`);
});

test('new fixed dock stays outside departing ship and escort bounds throughout their cycle',()=>{
 const yard=inner.userData.shipyard,staticMeshes=[inner.getObjectByName('greg-shore-dock-walk'),inner.getObjectByName('greg-shore-dock-piles')];
 for(let k=0;k<=130;k++){
  const t=k*.2;after.userData.update(.2,t,{});after.updateMatrixWorld(true);
  const fixed=staticMeshes.map(mesh=>new T.Box3().setFromObject(mesh));
  for(const actor of [yard.departure,yard.escort]){
   if(!actor.visible)continue;
   const bounds=new T.Box3().setFromObject(actor);
   for(const box of fixed)assert.equal(box.intersectsBox(bounds),false,`${actor.name} intersects fixed dock bounds at ${t}`);
  }
 }
});
