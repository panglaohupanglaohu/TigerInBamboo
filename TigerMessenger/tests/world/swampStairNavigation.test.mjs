import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {sampleSwampAuthoredGround,sampleSwampStairGround,sampleSwampRimGround}=await import('../../src/world/swampPlayerSupport.js');
const {createSwampEdgeGuard,installSwampEntranceBridge,collectSwampWalkNetwork}=await import('../../src/world/swampEdgeGuard.js');
const {createSwampWalkwaySteer}=await import('../../src/world/swampWalkwaySteer.js');
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {resolveCollisions}=await import('../../src/world/collision.js');const {updatePlayerControl}=await import('../../src/player/controller.js');
test('real lower tread remains available beneath an upper terrace, late quay registration stays dynamic',()=>{
 const zone=new T.Group();zone.position.set(0,160,0);
 const lower=new T.Mesh(new T.BoxGeometry(4,.2,4),new T.MeshBasicMaterial()),upper=lower.clone();upper.position.y=4;zone.add(lower,upper);zone.userData.gregSpatialPlan={walkMeshes:[upper,lower]};zone.updateMatrixWorld(true);
 const foot=new T.Vector3(0,160.15,0);assert.ok(Math.abs(sampleSwampAuthoredGround(zone,foot)-160.1)<1e-6);
 const quay=lower.clone();quay.position.set(7,-1,0);zone.add(quay);zone.userData.swampHarborScene={pier:{walkMeshes:[quay]}};
 assert.ok(collectSwampWalkNetwork(zone).includes(quay));const point=zone.localToWorld(new T.Vector3(7,-.89,0));assert.ok(sampleSwampAuthoredGround(zone,point)!==null);
 assert.equal(sampleSwampAuthoredGround(zone,new T.Vector3(0,158,0)),null,'no lifting the traveller through a lower slab');
});
test('production controller and gravity can enter from the outer rim and descend actual stairs with guard and steer active',()=>{
 const wrapper=createMoebiusSwampPlacement({seed:7711,scale:.5}),zone=wrapper.userData.inner;
 placeMoebiusSwampOnSphere(wrapper,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);wrapper.updateMatrixWorld(true);installSwampEntranceBridge(zone);
 const a=.5,point=r=>zone.localToWorld(new T.Vector3(Math.cos(a)*r,40,Math.sin(a)*r));
 const chain=p=>sampleSwampStairGround(zone,p)??sampleSwampAuthoredGround(zone,p)??sampleSwampRimGround(zone,p)??zone.userData.sampleGroundRadius(p);
 const pos=point(40.5),start=chain(pos.clone().setLength(pos.length()+.05));assert.ok(Number.isFinite(start));pos.setLength(start+.01);
 const player={position:pos,velocity:new T.Vector3(),onGround:true,groundR:start,checkpoint:pos.clone(),forward:new T.Vector3(),facing:new T.Vector3()};
 const guard=createSwampEdgeGuard({getZone:()=>zone,supportRadius:chain,enabled:true}),steer=createSwampWalkwaySteer({getZone:()=>zone,enabled:true});
 const direction=point(25).sub(pos).addScaledVector(pos.clone().normalize(),-point(25).sub(pos).dot(pos.clone().normalize())).normalize(),camera={getWorldDirection:v=>v.copy(direction)},dt=1/120;let reached=false,minR=Infinity,maxMove=0,prev=pos.clone();
 for(let i=0;i<120*12;i++){
   const local=zone.worldToLocal(player.position.clone());minR=Math.min(minR,Math.hypot(local.x,local.z));if(minR<28){reached=true;break;}
   // Real W uses one camera heading rather than steering toward the target each frame.
   guard.begin(player);updatePlayerControl({player,keys:{KeyW:true},camera,dt,gameStarted:true,onJump(){}});steer.apply(player,dt);resolveCollisions(player.position,player.velocity,dt,[],player,()=>assert.fail('void'),null,chain);guard.end(player,dt);
   maxMove=Math.max(maxMove,prev.distanceTo(player.position));prev.copy(player.position);
 }
 assert.ok(reached,`did not descend: radial=${minR}, blocked=${guard.report.blockedSteps}, last=${JSON.stringify(guard.report.lastBlock)}, landing=${JSON.stringify(guard.report.lastLanding)}, rescues=${guard.report.rescues}, local=${zone.worldToLocal(player.position.clone()).toArray()}`);
 assert.ok(start-player.position.length()>3,'actual foot elevation decreases');assert.equal(guard.report.rescues,0);assert.equal(guard.report.blockedSteps,0,JSON.stringify(guard.report.lastLanding)+' '+JSON.stringify(guard.report.lastBlock));assert.ok(maxMove<.8,`no movement beyond production .75 step-up plus one tangent substep: ${maxMove}`);
});
