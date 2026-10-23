import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {getCityFrame}=await import('../../src/world/crystalCityLayout.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711});
placeMoebiusSwampOnSphere(wrapper,crystalV7SwampDir(),160,.5,-15.8);
const rotation=new T.Quaternion().setFromAxisAngle(getCityFrame().center,-Math.PI/6);
wrapper.position.applyQuaternion(rotation);wrapper.quaternion.premultiply(rotation);wrapper.updateMatrixWorld(true);
const inner=wrapper.userData.inner,plan=inner.userData.gregSpatialPlan;


const {sampleSwampRimGround,sampleSwampAuthoredGround}=await import('../../src/world/swampPlayerSupport.js');
const {resolveCollisions}=await import('../../src/world/collision.js');
const {buildMoebiusCrystalMetropolis}=await import('../../src/world/moebiusCity.js');
const {crystalV7Layout}=await import('../../src/world/crystalV7Layout.js');
const {installCrystalV7Shores}=await import('../../src/world/crystalV7Runtime.js');
const {relocateCrystalCore}=await import('../../src/world/crystalCorePlacement.js');
const scene=new T.Scene(),city=buildMoebiusCrystalMetropolis(scene,160,{layout:crystalV7Layout(),useStorage:false,v7:true});
const swamp=createMoebiusSwampPlacement({scale:.5,seed:7711});placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,-15.8);scene.add(swamp);
city.v7Shores=installCrystalV7Shores(scene,city,swamp);relocateCrystalCore({scene,pack:{moebius:city,bubblePods:new T.Group()},swamp});scene.updateMatrixWorld(true);
const zone=swamp.userData.inner;
const ground=p=>sampleSwampRimGround(zone,p)??sampleSwampAuthoredGround(zone,p)??city.v7Shores.userData.sampleGroundRadius(p)??zone.userData.sampleGroundRadius(p);
test('real V7 promenade overlap no longer steals support from feet on the coral rim',()=>{
 let tested=0,overlap=0;
 for(let i=0;i<72;i++){
  const angle=i*Math.PI/36;if(Math.abs(Math.atan2(Math.sin(angle-.5),Math.cos(angle-.5)))<.14)continue;
  const world=zone.localToWorld(new T.Vector3(Math.cos(angle)*37.4,40,Math.sin(angle)*37.4)),radius=world.length(),probe=world.clone().setLength(radius+.06);
  const rim=sampleSwampRimGround(zone,probe);assert.ok(rim!==null&&Math.abs(rim-radius)<.08);
  const shore=city.v7Shores.userData.sampleGroundRadius(probe);if(shore!==null&&shore<radius-1)overlap++;
  assert.equal(ground(probe),rim);tested++;
 }
 assert.ok(tested>65&&overlap>60);
});
test('feet below rim retain lower promenade and entrance/water are not captured',()=>{
 let lower=0;
 for(let i=0;i<24;i++){
  const angle=i*Math.PI/12,world=zone.localToWorld(new T.Vector3(Math.cos(angle)*37.4,40,Math.sin(angle)*37.4)),shore=city.v7Shores.userData.sampleGroundRadius(world);
  if(shore===null||world.length()-shore<1)continue;
  const below=world.clone().setLength(shore+.05);assert.equal(sampleSwampRimGround(zone,below),null);assert.ok(Math.abs(ground(below)-shore)<1e-8);lower++;
 }
 assert.ok(lower>20);
 const water=zone.localToWorld(new T.Vector3(10,25,8));assert.equal(sampleSwampRimGround(zone,water),null);
 const entry=zone.localToWorld(new T.Vector3(Math.cos(.5)*37.4,40,Math.sin(.5)*37.4));assert.equal(sampleSwampRimGround(zone,entry),null);
});
test('production collision substeps keep a standing player on the actual new rim',()=>{
 const foot=zone.localToWorld(new T.Vector3(Math.cos(2)*37.4,40,Math.sin(2)*37.4)),radius=foot.length();
 const velocity=new T.Vector3(),player={onGround:true,groundR:radius,checkpoint:foot.clone()};
 for(let i=0;i<240;i++){velocity.addScaledVector(foot.clone().normalize(),-9.8/120);resolveCollisions(foot,velocity,1/120,[],player,()=>assert.fail('unexpected void'),null,ground);}
 assert.ok(Math.abs(foot.length()-radius)<.08,'must not fall to the lower promenade');
 assert.equal(player.onGround,true);
});

test('all three real bank midpoints stay supported through gravity instead of falling to old V7 terrain',()=>{
 for(const level of zone.userData.gregSpatialPlan.levels){
  const angle=(level.angleStart+level.angleEnd)/2;
  const point=zone.localToWorld(new T.Vector3(Math.cos(angle)*level.radius*2,level.innerY,Math.sin(angle)*level.radius*2));
  const expected=point.length(),foot=point.clone().setLength(expected+.025),velocity=new T.Vector3(),player={onGround:true,groundR:expected,checkpoint:foot.clone()};
  assert.ok(Math.abs(sampleSwampAuthoredGround(zone,foot)-expected)<.05);
  for(let i=0;i<240;i++){velocity.addScaledVector(foot.clone().normalize(),-9.8/120);resolveCollisions(foot,velocity,1/120,[],player,()=>assert.fail('bank fell to void'),null,ground);}
  assert.ok(Math.abs(foot.length()-expected)<.08,'player remains on authored bank '+level.innerY);
  assert.equal(player.onGround,true);
  assert.equal(sampleSwampAuthoredGround(zone,point.clone().setLength(expected-1)),null,'lower traveller is not lifted up');
 }
});
