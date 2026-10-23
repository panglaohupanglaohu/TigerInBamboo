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

test('three reachable bank levels use default placed scale and preserve story anchors',()=>{
 assert.deepEqual(plan.levels.map(l=>l.innerY),[34.8,30.8,26.8]);
 assert.ok(plan.levels.every(l=>l.width===2&&l.waterClearance>0));
 assert.equal(plan.renderMeshes,2);assert.equal(plan.walkMeshes.length,1);assert.equal(plan.slabParts,76);
 assert.equal(inner.userData.tigerWalkSurfaces.length,8);
 assert.ok(inner.userData.tiger);assert.ok(inner.userData.shipyard.escort);
 assert.deepEqual(inner.userData.shipyard.dock.position.toArray(),[-6.455017679273978,25.02,12.423073160867256]);
 assert.ok(Math.abs(wrapper.position.length()-144.2)<1e-9);
});

test('every 0.1 world unit from original entry tread through all layers has a top-facing radial support',()=>{
 const route=plan.route.map(a=>new T.Vector3(...a)),ray=new T.Raycaster();let samples=0;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],n=Math.max(1,Math.ceil(a.distanceTo(b)*.5/.1));
  for(let j=0;j<=n;j++)for(const lateral of [-.9,0,.9]){
   const local=a.clone().lerp(b,j/n);
   // At the radial entry bridge use its across-path axis; elsewhere offset across bank.
   if(i<=16)local.add(new T.Vector3(-Math.sin(.5),0,Math.cos(.5)).multiplyScalar(lateral));
   else {const r=Math.hypot(local.x,local.z);local.x*=1+lateral/r;local.z*=1+lateral/r;}
   const world=inner.localToWorld(local.clone()),up=world.clone().normalize(),radius=world.length();
   const meshes=[...plan.walkMeshes,...inner.userData.tigerWalkSurfaces];
   ray.set(world.clone().addScaledVector(up,.2),up.clone().negate());ray.far=.4;
   const hit=ray.intersectObjects(meshes,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.8);
   assert.ok(hit,`top support missing at route ${i}:${j}, side ${lateral}, ${local.toArray()}`);
   assert.ok(Math.abs(hit.point.length()-radius)<.14,'radial hit must be the intended layer, not a higher terrace');
   const sample=inner.userData.sampleGroundRadius(world.clone().addScaledVector(up,.1));
   assert.ok(sample!==null&&Math.abs(sample-radius)<.14,'runtime sampler must resolve same layer');samples++;
  }
 }
 assert.ok(samples>1500);
});

test('actual V7 shore sampler cannot preempt the new intended bank surfaces',async()=>{
 const {buildMoebiusCrystalMetropolis}=await import('../../src/world/moebiusCity.js');
 const {crystalV7Layout}=await import('../../src/world/crystalV7Layout.js');
 const {installCrystalV7Shores}=await import('../../src/world/crystalV7Runtime.js');
 const {relocateCrystalCore}=await import('../../src/world/crystalCorePlacement.js');
 const scene=new T.Scene(),city=buildMoebiusCrystalMetropolis(scene,160,{layout:crystalV7Layout(),useStorage:false,v7:true});
 const swamp=createMoebiusSwampPlacement({scale:.5,seed:7711});placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,-15.8);scene.add(swamp);
 city.v7Shores=installCrystalV7Shores(scene,city,swamp);
 relocateCrystalCore({scene,pack:{moebius:city,bubblePods:new T.Group()},swamp});scene.updateMatrixWorld(true);
 const zone=swamp.userData.inner;let conflicts=0;
 for(const point of zone.userData.gregSpatialPlan.route){
  const world=zone.localToWorld(new T.Vector3(...point)),radius=world.length(),probe=world.clone().setLength(radius+.1);
  const shore=city.v7Shores.userData.sampleGroundRadius(probe),own=zone.userData.sampleGroundRadius(probe);
  if(shore!==null&&Math.abs(shore-own)>.14)conflicts++;
 }
 assert.equal(conflicts,0,'main.js shore-first ordering must not choose a different floor');
});


test('waymark full footprints stand on stone corbels outside the promised two-world-unit walking lane',()=>{
 const markers=inner.getObjectByName('greg-bank-waymarks'),matrix=new T.Matrix4(),ray=new T.Raycaster();
 const route=plan.route.map(a=>new T.Vector3(...a));
 for(let i=0;i<markers.count;i++){
  markers.getMatrixAt(i,matrix);const center=new T.Vector3().setFromMatrixPosition(matrix);
  let nearest=Infinity;
  for(let j=1;j<route.length;j++){
   const a=route[j-1].clone(),b=route[j].clone();
   if(Math.abs((a.y+b.y)/2-(center.y-.28))>1.5)continue;
   a.y=b.y=center.y;
   const closest=a.distanceToSquared(b)<1e-12?a:new T.Line3(a,b).closestPointToPoint(center,true,new T.Vector3());nearest=Math.min(nearest,closest.distanceTo(center));
  }
  assert.ok(nearest-.18>=2,`marker ${i} at ${center.toArray()} clearance ${nearest-.18} must clear the four-local-unit walking slab`);
  for(const [x,z]of [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]]){
   const foot=new T.Vector3(x,-.9,z).applyMatrix4(matrix),up=new T.Vector3(0,1,0).transformDirection(inner.matrixWorld);
   const world=inner.localToWorld(foot);ray.set(world.clone().addScaledVector(up,.1),up.clone().negate());ray.far=.2;
   assert.ok(ray.intersectObjects(plan.walkMeshes,false).some(h=>h.point.distanceTo(world)<.01),'marker footprint needs real corbel support');
  }
 }
});
