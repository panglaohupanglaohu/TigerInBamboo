import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
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
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};r.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('fwidth(groove)'));assert.equal(r.material.color.getHexString(),'b493a2');
 }
});
test('lush understory and rim stones use five instanced batches within triangle budget, not per-plant mesh draws',()=>{
 assert.ok(growth.ok);assert.equal(growth.drawCalls,5);assert.ok(growth.records.length>=200);assert.ok(growth.triangles<60000,JSON.stringify({counts:growth.counts,triangles:growth.triangles}));
 for(const mesh of growth.root.children){assert.ok(mesh.isInstancedMesh);assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));}
 const constraints=createSwampLivingPathConstraints(inner);for(const r of growth.records)assert.ok(constraints.inspectPlant(r.envelope).allowed);
 assert.ok(growth.rimAngularCoverage>.25&&growth.rimAngularCoverage<.65,'separate habitats retain conspicuous bare-rock gaps instead of a continuous hedge');
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
 assert.equal(growth.version,9);assert.equal(growth.colonies.length,18);
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

test('target understory blades keep coherent teal planes with dark roots, soft outer light and restrained midrib contrast',()=>{
 for(const type of ['fern','fan','pendant']){
  const mesh=growth.root.getObjectByName(`greg-understory-${type}`),c=mesh.geometry.attributes.color,uv=mesh.geometry.attributes.uv;
  let lightest=0,rootMax=0;
  for(let i=0;i<c.count;i++){
   const value=Math.max(c.getX(i),c.getY(i),c.getZ(i));lightest=Math.max(lightest,value);
   assert.ok(c.getY(i)>c.getX(i)&&c.getZ(i)>c.getX(i),'cool green/teal range');
   if(uv.getX(i)===0)rootMax=Math.max(rootMax,value);
  }
  assert.ok(lightest>rootMax*1.7,'visible blade light follows length rather than unrelated halves');
  for(let i=0;i<c.count;i+=6)for(const channel of ['getX','getY','getZ'])assert.ok(Math.abs(c[channel](i+2)/c[channel](i)-.93)<1e-6,'same cross section differs only by seven percent');
 }
});

test('erosion revision preserves accepted rock-shoulder anchors; attached wall growth follows the revised surface',()=>{
 const before=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/greg-lake-character-detail-20261008/understory-v6-before/anchors.json',import.meta.url)));
 assert.ok(growth.counts.fan>=before.counts.fan-12);assert.ok(growth.counts.fern>=before.counts.fern-12);
 const anchors=growth.records.map(({type,position,scale,source,surface,localSurface,pocket,colony})=>({type,position,scale,source,surface,localSurface,pocket,colony}));
 assert.deepEqual(JSON.parse(JSON.stringify(anchors.filter(r=>r.source==='shoulder'))),before.records.filter(r=>r.source==='shoulder'));
 // Wall colonies and trunk climbers are reattached to the revised actual surfaces. All actual
 // root contacts and full leaf clearance remain tested above.
 const mesh=growth.root.getObjectByName('greg-understory-pendant'),p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,frondVertices=p.count/5,tips=[];
 for(let f=0;f<5;f++){
  const first=f*frondVertices;assert.deepEqual([p.getX(first),p.getY(first),p.getZ(first)],[0,0,0]);
  let tip=null,widthNearEnd=0;
  for(let j=first;j<first+frondVertices;j++){
   if(uv.getX(j)===1)tip=p.getY(j);
   if(uv.getX(j)>.8&&uv.getX(j)<1)widthNearEnd=Math.max(widthNearEnd,Math.abs(p.getX(j)-p.getX(j+1<p.count?j+1:j)));
  }
  tips.push(tip);assert.ok(widthNearEnd>.035,'leaf remains broad near softly rounded end');
 }
 assert.ok(Math.max(...tips)-Math.min(...tips)>.25,'frond tips end at different heights instead of parallel ropes');
 const vertex=new T.Vector3();
 for(const r of growth.records.filter(r=>r.type==='pendant'))for(let i=0;i<p.count;i++){
  vertex.fromBufferAttribute(p,i).applyMatrix4(r.matrix);assert.ok(vertex.y>=r.envelope.position[1]-1e-5&&vertex.y<=r.envelope.position[1]+r.envelope.height+1e-5);assert.ok(Math.hypot(vertex.x-r.position[0],vertex.z-r.position[2])<=r.envelope.radius);
 }
 console.log('frond tip heights',tips);
});

test('rim foliage uses fewer unequal habitats with large upright fans and low fern mats',()=>{
 const rim=growth.records.filter(r=>r.source==='rim'),clusters=new Set(rim.map(r=>r.cluster)),heights=rim.map(r=>r.envelope.height);
 assert.ok(clusters.size>=5&&clusters.size<=7);assert.ok(rim.length<120,'break repetition by composition, not another density increase');
 assert.ok(rim.some(r=>r.hero&&r.type==='fan'&&r.scale>3));
 const outer=rim.filter(r=>r.rimSide==='outer');
 assert.equal(new Set(outer.map(r=>r.cluster)).size,7,'all seven unequal habitats have actual supported outer-lip crowns');
 assert.ok(outer.filter(r=>r.hero).length>=7);assert.ok(outer.some(r=>r.envelope.height>3));
 for(const r of outer)assert.ok(Math.hypot(r.position[0],r.position[2])>=39.4&&Math.hypot(r.position[0],r.position[2])<=40.8);
 assert.ok(Math.max(...heights)/Math.min(...heights)>4,'upright accents and low fern mats must differ substantially');
 for(const r of rim){
  const p=growth.root.getObjectByName(`greg-understory-${r.type}`).geometry.attributes.position,v=new T.Vector3();
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(r.matrix);assert.ok(v.y>=r.envelope.position[1]&&v.y<=r.envelope.position[1]+r.envelope.height);
   assert.ok(Math.hypot(v.x-r.position[0],v.z-r.position[2])<=r.envelope.radius);
  }
 }
 console.log('irregular rim habitats',JSON.stringify({plants:rim.length,clusters:clusters.size,heroes:rim.filter(r=>r.hero).length,heightRange:[Math.min(...heights),Math.max(...heights)]}));
});

test('upright rim accents grow only vertically at existing rooted points with low fern skirts retained',()=>{
 const changed=growth.records.filter(r=>r.verticalGrowth);assert.ok(changed.length>=20);
 const v=new T.Vector3(),old=new T.Vector3();let tall=0,low=0;
 for(const r of growth.records.filter(r=>r.source==='rim')){
  if(r.envelope.height>7.5)tall++;if(r.type==='fern'&&r.envelope.height<2.5)low++;
  if(!r.verticalGrowth)continue;const {originalMatrix,originalEnvelope}=r.verticalGrowth;
  for(const i of [0,2,3,4,6,7,8,10,11,12,13,14,15])assert.equal(r.matrix.elements[i],originalMatrix.elements[i]);
  const p=growth.root.getObjectByName(`greg-understory-${r.type}`).geometry.attributes.position;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(r.matrix);old.fromBufferAttribute(p,i).applyMatrix4(originalMatrix);assert.equal(v.x,old.x);assert.equal(v.z,old.z);assert.ok(v.y<51);}
  assert.deepEqual(new T.Vector3().setFromMatrixPosition(r.matrix).toArray(),r.position);assert.ok(r.envelope.height>originalEnvelope.height);
 }
 assert.ok(tall>=6,`six or more safely rooted standing accents, actual${tall}; protected clusters may retain their lower height`);assert.ok(low>35,'low fern ground layer remains');
 console.log('vertical rim accents',JSON.stringify({changed:changed.length,tall,low,requested:growth.verticalGrowth.length,unchangedForSafety:growth.verticalGrowth.filter(r=>r.factor===1).length}));
});

test('rim habitat stones are actual supported low shoulders outside the patrol ribbon',()=>{
 const mesh=growth.root.getObjectByName('greg-understory-rim-rocks'),p=mesh.geometry.attributes.position,point=new T.Vector3();
 assert.ok(growth.rimRocks.length>=10);assert.ok(growth.rimRocks.length<60);
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld),rim=inner.userData.gregCoralRim.walkMeshes[0];
 for(const r of growth.rimRocks)for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i).applyMatrix4(r.matrix);const radius=Math.hypot(point.x,point.z);
  assert.ok(radius<=35.4||radius>=39.4);assert.ok(point.y>40&&point.y<41.2);
  ray.set(inner.localToWorld(point.clone().setY(42)),down);ray.far=3;assert.ok(ray.intersectObject(rim,false).length);
 }
 console.log('supported rim habitat stones',growth.rimRocks.length);
});

test('post-V7 shortened trees can rebuild attached growth after spherical placement, then dispose restores source resources',()=>{
 growth.dispose();for(const tree of inner.userData.towerTrees||[])if(tree.name==='swamp-towering-tree')tree.scale.y*=.55;
 placeMoebiusSwampOnSphere(placement,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);
 const final=installSwampCoralUnderstory(inner,{enabled:true});assert.ok(final.ok);
 for(const r of final.records.filter(r=>r.source==='trunk'))assert.ok(new T.Vector3(...r.position).distanceTo(inner.worldToLocal(r.trunk.localToWorld(new T.Vector3(...r.localSurface))))<.03);
 let disposals=0;for(const mesh of final.root.children)for(const resource of [mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposals++);
 final.dispose();final.dispose();assert.equal(disposals,10);assert.equal(inner.userData.gregUnderstory,undefined);
 bark.dispose();for(const r of bark.records){assert.equal(r.mesh.geometry,r.originalGeometry);assert.equal(r.mesh.material,r.originalMaterial);}assert.equal(inner.userData.gregTrunkDetail,undefined);
});
