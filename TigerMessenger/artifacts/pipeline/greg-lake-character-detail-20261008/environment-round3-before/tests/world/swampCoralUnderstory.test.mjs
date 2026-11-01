import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregUnderstory=0&gregTrunkDetail=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampCoralUnderstory}=await import('../../src/world/swampCoralUnderstory.js');
const {installSwampCoralTrunkDetail}=await import('../../src/world/swampCoralTrunkDetail.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');
const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner,route=structuredClone(inner.userData.gregSpatialPlan.route),protectedParts=[];
inner.traverse(o=>{if(/whale|monkey|tiger|flower|v2-floor-root/.test(o.name))protectedParts.push({o,geometry:o.geometry,position:o.position.toArray(),scale:o.scale.toArray()});});
const bark=installSwampCoralTrunkDetail(inner,{enabled:true}),growth=installSwampCoralUnderstory(inner,{enabled:true});
test('trunk detail keeps end rings and original anchors, adds no draws and preserves shader line detail',()=>{
 assert.ok(bark.changedTrunks>20);assert.equal(bark.extraDrawCalls,0);assert.ok(bark.maxOffset>0&&bark.maxOffset<=.13);
 for(const r of bark.records){
  const p=r.geometry.attributes.position,o=r.originalGeometry.attributes.position,b=r.originalGeometry.boundingBox||(r.originalGeometry.computeBoundingBox(),r.originalGeometry.boundingBox);
  for(let i=0;i<p.count;i++)if(Math.abs(o.getY(i)-b.min.y)<1e-6||Math.abs(o.getY(i)-b.max.y)<1e-6){assert.equal(p.getX(i),o.getX(i));assert.equal(p.getY(i),o.getY(i));assert.equal(p.getZ(i),o.getZ(i));}
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};r.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('fwidth(groove)'));assert.equal(r.material.color.getHexString(),'bd929e');
 }
});
test('lush understory uses four instanced batches within triangle budget, not per-plant mesh draws',()=>{
 assert.ok(growth.ok);assert.equal(growth.drawCalls,4);assert.ok(growth.records.length>=200);assert.ok(growth.triangles<60000,JSON.stringify({counts:growth.counts,triangles:growth.triangles}));
 for(const mesh of growth.root.children){assert.ok(mesh.isInstancedMesh);assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));}
 const constraints=createSwampLivingPathConstraints(inner);for(const r of growth.records)assert.ok(constraints.inspectPlant(r.envelope).allowed);
 assert.ok(growth.rimAngularCoverage>.5,'layered rim clusters cover at least half the angular silhouette');
 console.log('understory statistics',JSON.stringify({plants:growth.records.length,rimPlants:growth.records.filter(r=>r.source==='rim').length,rimAngularCoverage:growth.rimAngularCoverage,vines:growth.vines.length,counts:growth.counts,triangles:growth.triangles,drawCalls:growth.drawCalls,trunks:bark.changedTrunks}));
});
test('all root crowns meet their real rim, rock shoulder, cliff or trunk surface',()=>{
 inner.updateWorldMatrix(true,true);
 for(const r of growth.records){
  const p=new T.Vector3(...r.position);
  if(r.source==='cliff'||r.source==='rim')assert.ok(p.distanceTo(new T.Vector3(...r.surface))<.03);
  else if(r.source==='trunk'){
   const actual=inner.worldToLocal(r.trunk.localToWorld(new T.Vector3(...r.localSurface)));assert.ok(p.distanceTo(actual)<.03);
  }else{
   const ray=new T.Raycaster(inner.localToWorld(p.clone().add(new T.Vector3(0,.15,0))),new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld)),hit=ray.intersectObject(inner.getObjectByName('greg-natural-cliff-rock'),false)[0];assert.ok(hit);assert.ok(Math.abs(inner.worldToLocal(hit.point).y-p.y)<.035);
  }
 }
 assert.deepEqual(inner.userData.gregSpatialPlan.route,route);
 for(const p of protectedParts){assert.equal(p.o.geometry,p.geometry);assert.deepEqual(p.o.position.toArray(),p.position);assert.deepEqual(p.o.scale.toArray(),p.scale);}
});
test('instanced leaf vertices stay below bridge zone and clear the two-world rim ribbon; vine midpoints hug trunks',()=>{
 let maxY=-Infinity;const point=new T.Vector3(),ray=new T.Raycaster();
 for(const r of growth.records){
  const p=growth.root.getObjectByName(`greg-understory-${r.type}`).geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).applyMatrix4(r.matrix);maxY=Math.max(maxY,point.y);assert.ok(point.y>25.1);
   if(r.source==='rim'){const radius=Math.hypot(point.x,point.z);assert.ok(radius<=35.4||radius>=39.4);}
  }
 }
 assert.ok(maxY<55,`new foliage maximum ${maxY}, formal bridge clearance begins above this budget`);
 for(const vine of growth.vines){
  const midpoint=new T.Vector3(...vine.a).lerp(new T.Vector3(...vine.b),.5),mesh=vine.source,local=mesh.worldToLocal(inner.localToWorld(midpoint.clone()));mesh.geometry.computeBoundingBox();
  const centre=mesh.geometry.boundingBox.getCenter(new T.Vector3()).setY(local.y),outward=local.clone().sub(centre).setY(0).normalize(),origin=mesh.localToWorld(centre.addScaledVector(outward,12));
  ray.set(origin,outward.negate().transformDirection(mesh.matrixWorld));ray.far=20;
  const hit=ray.intersectObject(mesh,false)[0];assert.ok(hit);assert.ok(inner.worldToLocal(hit.point.clone()).distanceTo(midpoint)<.12,'vine must follow real bark between attachments');
 }
 console.log('understory maximum inner Y',maxY);
});
test('fissure habitats form unequal attached overlapping trails, not isolated shelf dots',()=>{
 assert.equal(growth.version,3);assert.equal(growth.colonies.length,18);
 let neighbours=0,overlapping=0;const lengths=new Set();
 for(const colony of growth.colonies){
  lengths.add(colony.records.length);
  for(let i=1;i<colony.records.length;i++){
   const a=colony.records[i-1],b=colony.records[i];neighbours++;
   const gap=new T.Vector3(...a.position).distanceTo(new T.Vector3(...b.position));
   if(gap<a.scale+b.scale)overlapping++;
   assert.equal(a.source,'cliff');assert.equal(b.source,'cliff');
  }
 }
 assert.ok(lengths.size>=4,'whole habitats vary in extent');
 assert.ok(neighbours>200);assert.ok(overlapping/neighbours>.8,'leaf crowns overlap along most streams, with deliberate open rock windows');
 const geometry=growth.root.getObjectByName('greg-understory-fern').geometry,p=geometry.attributes.position;
 let width=0;for(let i=0;i<p.count;i++)width=Math.max(width,Math.abs(p.getX(i)));
 assert.ok(width>.8,'fern fans retain a broad silhouette');
 console.log('fissure continuity',JSON.stringify({colonies:growth.colonies.length,neighbours,overlapping,ratio:overlapping/neighbours}));
});

test('post-V7 shortened trees can rebuild attached growth after spherical placement, then dispose restores source resources',()=>{
 growth.dispose();for(const tree of inner.userData.towerTrees||[])if(tree.name==='swamp-towering-tree')tree.scale.y*=.55;
 placeMoebiusSwampOnSphere(placement,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);
 const final=installSwampCoralUnderstory(inner,{enabled:true});assert.ok(final.ok);
 for(const r of final.records.filter(r=>r.source==='trunk'))assert.ok(new T.Vector3(...r.position).distanceTo(inner.worldToLocal(r.trunk.localToWorld(new T.Vector3(...r.localSurface))))<.03);
 let disposals=0;for(const mesh of final.root.children)for(const resource of [mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposals++);
 final.dispose();final.dispose();assert.equal(disposals,8);assert.equal(inner.userData.gregUnderstory,undefined);
 bark.dispose();for(const r of bark.records){assert.equal(r.mesh.geometry,r.originalGeometry);assert.equal(r.mesh.material,r.originalMaterial);}assert.equal(inner.userData.gregTrunkDetail,undefined);
});
