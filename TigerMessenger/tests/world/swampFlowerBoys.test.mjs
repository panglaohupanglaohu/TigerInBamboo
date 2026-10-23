import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {SWAMP_COMPONENT_BUILDERS,createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('every flower cup has precisely two articulated black boys, pale hair and the original separate flower center',()=>{
 for(const seed of [1,3,7711,98765])for(const radius of [2.3,3.8,4.4]){
  const boat=SWAMP_COMPONENT_BUILDERS.lotusLeafBoat(random(seed),radius),boys=boat.children.filter(o=>o.name==='swamp-native-doll');
  assert.equal(boys.length,2);assert.deepEqual(boat.userData.passengers,boys);
  assert.deepEqual(boys.map(b=>b.userData.flowerBoy.pose),['play','look']);
  assert.ok(boat.userData.halo?.isSprite);assert.ok(boat.getObjectByName('swamp-flower-boat-cup'));
  for(const boy of boys){
   const {rig,head,arm,anatomy}=boy.userData.flowerBoy;
   assert.equal(anatomy.length,11);assert.equal(rig.children.length,3);assert.notEqual(head,arm);
   assert.ok(head.position.y>.8);assert.ok(arm.position.x>0);
   let cone=0;boy.traverse(o=>{if(o.geometry?.type==='ConeGeometry')cone++;});assert.equal(cone,0);
   const colors=head.geometry.attributes.color,pale=new THREE.Color(0xd9cbb8);let paleCount=0;
   for(let i=0;i<colors.count;i++)if(Math.abs(colors.getX(i)-pale.r)<1e-5)paleCount++;
   assert.ok(paleCount>300,'fluffy pale tufts belong to head anatomy');
  }
  assert.ok(boys[0].position.z>0&&boys[1].position.z<0,'front and rear occupants');
 }
});

test('boy anatomy and materials are shared by pose; motion uses pivots without allocating geometry',()=>{
 const a=SWAMP_COMPONENT_BUILDERS.lotusLeafBoat(random(1),4.4),b=SWAMP_COMPONENT_BUILDERS.lotusLeafBoat(random(5),2.3);
 for(let i=0;i<2;i++){
  const boy=a.userData.passengers[i],other=b.userData.passengers[i],rig=boy.userData.flowerBoy.rig;
  rig.children.forEach((mesh,j)=>{assert.equal(mesh.geometry,other.userData.flowerBoy.rig.children[j].geometry);assert.equal(mesh.material,other.userData.flowerBoy.rig.children[j].material);});
  const matrices=[];
  for(const time of [0,.5,2,12,90]){boy.userData.updateFlowerBoy(time);boy.updateMatrixWorld(true);matrices.push(boy.userData.flowerBoy.arm.quaternion.toArray());boy.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
  assert.notDeepEqual(matrices[0],matrices[2]);
 }
});

test('the real scene preserves passenger identities while two boys explore shore and water',()=>{
 const scene=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=scene.userData.inner;
 const boats=inner.userData.lotuses;assert.ok(boats.length>=4);
 const raft=boats[0];assert.equal(raft.userData.feeder,raft.userData.passengers[1]);assert.equal(raft.userData.feeder.userData.storyRole,'whale-feeder');
 for(const time of [0,1,5]){
  inner.update(1/60,time,{});
  assert.equal(boats.flatMap(b=>b.userData.passengers).length,10);
  assert.equal(new Set(boats.flatMap(b=>b.userData.passengers)).size,10);
  assert.equal(boats.reduce((n,b)=>n+b.children.filter(o=>o.name==='swamp-native-doll').length,0),8);
  assert.equal(inner.userData.flowerBoyActivities.feeder.parent,inner);
  assert.equal(inner.userData.flowerBoyActivities.shore.parent,inner);
  for(const boat of boats)assert.equal(boat.userData.paddles.length,2);
 }
 assert.ok(inner.userData.shipyard?.dock,'repair story still exists');
});


test('two paddles stay gripped to actual palms and shore hop avoids the protected route',()=>{
 const scene=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=scene.userData.inner,boats=inner.userData.lotuses,a=inner.userData.flowerBoyActivities;
 assert.ok(a.shorePoint);assert.equal(a.passengerCount,10);assert.equal(a.paddleCount,10);
 const strokes=new Set();
 const shore=a.shore,origin=new THREE.Vector3(...a.shorePoint),ray=new THREE.Raycaster();let minRadius=Infinity,minFoot=Infinity;
 for(let time=0;time<=32;time+=.5){
  inner.update(1/60,time,{});scene.updateMatrixWorld(true);
  for(const boat of boats)for(const paddle of boat.userData.paddles){
   const boy=paddle.userData.holder,f=boy.userData.flowerBoy;
   const palm=new THREE.Vector3(...(paddle.userData.hand==='left'?[-.27,.035,.27]:(f.pose==='play'?[.08,-.79,.65]:[.06,.29,.31])));
   (paddle.userData.hand==='left'?f.rig:f.arm).localToWorld(palm);
   assert.ok(palm.distanceTo(paddle.getWorldPosition(new THREE.Vector3()))<1e-6);assert.equal(boy.parent,boat);assert.equal(paddle.children.length,2);
   const blade=paddle.userData.blade,lo=blade.localToWorld(new THREE.Vector3(0,-.36,0)),hi=blade.localToWorld(new THREE.Vector3(0,.36,0));inner.worldToLocal(lo);inner.worldToLocal(hi);assert.ok(Math.abs(lo.distanceTo(hi)-.72)<1e-6,"blade must not stretch with shaft length");
   const widthLo=blade.localToWorld(new THREE.Vector3(-.23,0,0)),widthHi=blade.localToWorld(new THREE.Vector3(.23,0,0));inner.worldToLocal(widthLo);inner.worldToLocal(widthHi);
   assert.ok(widthLo.distanceTo(widthHi)>.45,'broad blade remains readable at scene scale');
   strokes.add(paddle.userData.stroke);
  }
  const body=shore.userData.flowerBoy.rig.children[0],p=body.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);body.localToWorld(v);inner.worldToLocal(v);minRadius=Math.min(minRadius,Math.hypot(v.x,v.z));minFoot=Math.min(minFoot,v.y-origin.y);
   if(time===0&&v.y<origin.y+.11){ray.set(inner.localToWorld(v.clone().setY(45)),new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld));const h=ray.intersectObjects(inner.userData.gregCoralRim.walkMeshes,false)[0];assert.ok(h,'every low foot vertex has real rim under it');assert.ok(Math.abs(inner.worldToLocal(h.point).y-origin.y)<1e-4);}
  }
  assert.ok(a.feeder.userData.flowerSwim,'same feeder has articulated swimming activity');
 }
 assert.ok(strokes.has('power')&&strokes.has('recovery'),'both sides of the stroke are animated');
 assert.ok(minRadius>39.4,`route ${minRadius}`);assert.ok(minFoot>-.01,`foot ${minFoot}`);
 ray.set(inner.localToWorld(origin.clone().setY(45)),new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld));
 const hit=ray.intersectObjects(inner.userData.gregCoralRim.walkMeshes,false)[0];assert.ok(hit);assert.ok(Math.abs(inner.worldToLocal(hit.point).y-origin.y)<1e-4);
 let legacySwimmers=0;inner.traverse(o=>{if(o.userData.coralSwimLimbs)legacySwimmers++;});assert.equal(legacySwimmers,1);
 console.log('flower activities',JSON.stringify({boys:a.passengerCount,aboard:8,shore:1,feeding:1,legacySwimmers,paddles:a.paddleCount,shorePoint:a.shorePoint,minRadius,minFoot,samples:65}));
});
