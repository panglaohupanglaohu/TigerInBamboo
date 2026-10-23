import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createSwampLivingPathConstraints,auditSwampLivingPlants} from '../../src/world/swampGregLivingPaths.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {getCityFrame}=await import('../../src/world/crystalCityLayout.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
const before=createSwampLivingPathConstraints(inner);
placeMoebiusSwampOnSphere(wrapper,crystalV7SwampDir(),160,.5,-15.8);
const rotation=new T.Quaternion().setFromAxisAngle(getCityFrame().center,-Math.PI/6);
wrapper.position.applyQuaternion(rotation);wrapper.quaternion.premultiply(rotation);wrapper.updateMatrixWorld(true);
const guard=createSwampLivingPathConstraints(inner);

test('full two-world-unit route and its headroom reject plant roots and crowns',()=>{
 assert.equal(guard.clearWidthWorld,2);assert.equal(guard.headroomWorld,2);
 let checked=0;
 for(let i=1;i<guard.route.length;i++){
  const a=new T.Vector3(...guard.route[i-1]),b=new T.Vector3(...guard.route[i]);
  const tangent=b.clone().sub(a);tangent.y=0;
  const side=new T.Vector3(-tangent.z,0,tangent.x).normalize();
  for(const f of [0,.25,.5,.75,1])for(const offset of [-1.95,0,1.95]){
   const position=a.clone().lerp(b,f).addScaledVector(side,offset);
   const result=guard.inspectPlant({position,radius:.3,height:1.45});
   assert.ok(result.reasons.includes('walking-clearance'));checked++;
   position.y+=2;
   assert.ok(guard.inspectPlant({position,radius:.6,height:1}).reasons.includes('walking-clearance'),'hanging crown also blocks headroom');
  }
 }
 assert.ok(checked>1000);
});

test('protects authored tiger stairs, actual worksite, living roots and full ship-whale transit',()=>{
 for(const type of ['tiger-route','repair-worksite','existing-root']){
  const zones=guard.zones.filter(z=>z.type===type);assert.ok(zones.length>0,type);
  for(const z of zones){
   const position=z.min.map((v,i)=>(v+z.max[i])/2);
   assert.ok(guard.inspectPlant({position,radius:.2,height:.8}).reasons.includes(type));
  }
 }
 assert.equal(guard.zones.filter(z=>z.type==='tiger-route').length,8);
 for(const point of guard.waterRoute){
  const result=guard.inspectPlant({position:point,radius:.2,height:.8});
  assert.ok(result.reasons.includes('boat-whale-corridor'));
 }
});

test('three-level landmark lines reject tall obstruction but permit low foliage below the view',()=>{
 assert.equal(guard.views.length,3);
 for(const view of guard.views){
  const p=new T.Vector3(...view.from).lerp(new T.Vector3(...view.to),.5);
  assert.ok(guard.inspectPlant({position:p,radius:.4,height:2}).reasons.includes('tree-landmark-sightline'));
  p.y-=4;
  assert.ok(!guard.inspectPlant({position:p,radius:.4,height:1}).reasons.includes('tree-landmark-sightline'));
 }
});

test('sphere transforms do not change the local guards or mutate any actor or add meshes',()=>{
 // The placement legitimately bends rim trees; compare invariant dock/stairs/root
 // bodies that are not altered by the placement operation, not tower-tree roots.
 for(const zone of before.zones.filter(z=>z.type!=='existing-root')){
  const after=guard.zones.find(z=>z.id===zone.id);assert.ok(after);
  for(const key of ['min','max'])for(let i=0;i<3;i++)assert.ok(Math.abs(zone[key][i]-after[key][i])<1e-8);
 }
 const snapshot=[];inner.traverse(o=>snapshot.push([o.uuid,o.position.toArray(),o.quaternion.toArray(),o.visible]));
 const report=auditSwampLivingPlants(inner,[{id:'bad-path',position:guard.route[10],radius:.4,height:1},{id:'bad-value',position:[NaN,0,0],radius:1,height:1}]);
 assert.equal(report.checked,2);assert.equal(report.rejected.length,2);assert.equal(report.passed,false);
 const after=[];inner.traverse(o=>after.push([o.uuid,o.position.toArray(),o.quaternion.toArray(),o.visible]));assert.deepEqual(after,snapshot);
 assert.equal(createSwampLivingPathConstraints(new T.Group()),null);
});

test('post-placement translation, rotation and uniform scale preserve all zones and candidate decisions',()=>{
 const position=wrapper.position.clone(),quaternion=wrapper.quaternion.clone(),scale=wrapper.scale.clone();
 try {
  wrapper.position.add(new T.Vector3(91,-34,17));wrapper.quaternion.premultiply(new T.Quaternion().setFromEuler(new T.Euler(.7,-1.1,.4)));wrapper.scale.multiplyScalar(1.7);wrapper.updateMatrixWorld(true);
  const moved=createSwampLivingPathConstraints(inner);
  assert.equal(moved.zones.length,guard.zones.length);
  for(const z of guard.zones){const m=moved.zones.find(a=>a.id===z.id);for(const key of ['min','max'])for(let i=0;i<3;i++)assert.ok(Math.abs(z[key][i]-m[key][i])<1e-8);}
  let candidates=0;
  for(const y of [10.5,26.8,30.8,34.8,40])for(let x=-36;x<=36;x+=3)for(let z=-36;z<=36;z+=3){
   const p={position:[x,y,z],radius:.42,height:1.45};
   assert.deepEqual(moved.inspectPlant(p),guard.inspectPlant(p));candidates++;
  }
  assert.equal(candidates,3125);
 } finally {wrapper.position.copy(position);wrapper.quaternion.copy(quaternion);wrapper.scale.copy(scale);wrapper.updateMatrixWorld(true);}
});
