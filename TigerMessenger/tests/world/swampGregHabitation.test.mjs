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
const {installSwampGregHabitation}=await import('../../src/world/swampGregHabitation.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');
function fixture(){
 const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711});
 placeMoebiusSwampOnSphere(wrapper,crystalV7SwampDir(),160,.5,-15.8);
 const q=new T.Quaternion().setFromAxisAngle(getCityFrame().center,-Math.PI/6);
 wrapper.position.applyQuaternion(q);wrapper.quaternion.premultiply(q);wrapper.updateMatrixWorld(true);
 return wrapper.userData.inner;
}

test('actual rotated default factory supports all five shelf corners outside the entire walkway',()=>{
 const swamp=fixture(),original=swamp.userData.shipyard.dock.position.toArray(),sample=swamp.userData.sampleGroundRadius;
 const report=installSwampGregHabitation(swamp);assert.equal(report.ready,true);assert.equal(report.site.support.length,5);
 assert.ok(report.dimensionsWorld.tableTopAbovePath >= .75 && report.dimensionsWorld.tableTopAbovePath <= .95);
 assert.ok(report.dimensionsWorld.roofCenterAbovePath >= 1.9);
 assert.equal(report.renderMeshes,2);assert.equal(report.root.children.length,2);assert.equal(swamp.userData.sampleGroundRadius,sample);
 assert.deepEqual(swamp.userData.shipyard.dock.position.toArray(),original);assert.equal(swamp.userData.tigerWalkSurfaces.length,8);
 assert.equal(createSwampLivingPathConstraints(swamp).inspectPlant(report.site.envelope).allowed,true);
 const center=new T.Vector3(...report.site.position),ray=new T.Raycaster();let count=0;
 for(const plant of swamp.userData.gregEcology.records){
  const gap=Math.hypot(plant.position[0]-center.x,plant.position[2]-center.z)-plant.radius-report.site.envelope.radius;
  assert.ok(gap>0,'rescaled entire tool stand must not overlap existing ecological planting');
 }
 swamp.updateWorldMatrix(true,true);
 for(const point of report.site.support){
  const world=swamp.localToWorld(new T.Vector3(...point)),up=new T.Vector3(0,1,0).transformDirection(swamp.matrixWorld);
  ray.set(world.clone().addScaledVector(up,.1),up.clone().negate());ray.far=.2;
  assert.ok(ray.intersectObjects(swamp.userData.gregSpatialPlan.walkMeshes,false).some(h=>h.point.distanceTo(world)<.01));count++;
 }
 const attributes=report.root.children[0].geometry.attributes.position;let wallHits=0;
 for(let i=0;i<attributes.count;i++){
  const p=new T.Vector3().fromBufferAttribute(attributes,i);
  assert.ok(Math.hypot(p.x-center.x,p.z-center.z)<=report.site.envelope.radius+.0001,'whole prop, not only origin, fits protected envelope');
  assert.ok(p.y>=center.y-.001&&p.y<=center.y+report.site.envelope.height);
  const radial=new T.Vector3(p.x,0,p.z).normalize(),origin=swamp.localToWorld(new T.Vector3(0,p.y,0));
  ray.set(origin,radial.clone().transformDirection(swamp.matrixWorld));ray.far=30;
  const wall=ray.intersectObject(swamp.getObjectByName('swamp-sinkhole-wall'),false)[0];
  if(wall){wallHits++;const boundary=swamp.worldToLocal(wall.point.clone());assert.ok(Math.hypot(p.x,p.z)<Math.hypot(boundary.x,boundary.z)+.02,'rack must remain in front of actual cliff wall');}
 }
 assert.equal(count,5);assert.ok(wallHits>100,'actual cliff rays must not be vacuous');
});

test('missing real corbel support produces no floating replacement and no scene mutation',()=>{
 const swamp=fixture();swamp.userData.gregHabitation?.dispose();const before=swamp.children.length;
 const surfaces=swamp.userData.gregSpatialPlan.walkMeshes;swamp.userData.gregSpatialPlan.walkMeshes=[];
 const result=installSwampGregHabitation(swamp);assert.equal(result.ready,false);assert.equal(swamp.children.length,before);
 assert.ok(result.rejected.some(r=>r.reasons.includes('missing-five-point-support')));
 swamp.userData.gregSpatialPlan.walkMeshes=surfaces;
});

test('installation is idempotent, disabled does nothing, disposal frees both batches and permits reinstall',()=>{
 const swamp=fixture();swamp.userData.gregHabitation?.dispose();const count=swamp.children.length;
 assert.equal(installSwampGregHabitation(swamp,{enabled:false}),null);assert.equal(swamp.children.length,count);
 const a=installSwampGregHabitation(swamp);assert.equal(installSwampGregHabitation(swamp),a);
 let geometries=0,materials=0;
 a.root.traverse(o=>{o.geometry?.addEventListener('dispose',()=>geometries++);o.material?.addEventListener('dispose',()=>materials++);});
 a.dispose();assert.equal(geometries,2);assert.equal(materials,2);assert.equal(swamp.children.length,count);assert.equal(swamp.userData.gregHabitation,undefined);
 assert.equal(installSwampGregHabitation(swamp).ready,true);
});
