import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?swampV2=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
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

test('the real feeding raft reuses its second boy, preserving two people through scene animation',()=>{
 const scene=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=scene.userData.inner;
 const boats=inner.userData.lotuses;assert.ok(boats.length>=4);
 const raft=boats[0];assert.equal(raft.userData.feeder,raft.userData.passengers[1]);assert.equal(raft.userData.feeder.userData.storyRole,'whale-feeder');
 for(const time of [0,1,5]){
  inner.update(1/60,time,{});
  for(const boat of boats)assert.equal(boat.children.filter(o=>o.name==='swamp-native-doll').length,2);
 }
 assert.ok(inner.userData.shipyard?.dock,'repair story still exists');
});
