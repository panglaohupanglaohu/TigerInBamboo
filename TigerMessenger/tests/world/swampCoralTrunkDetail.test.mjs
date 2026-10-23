import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregTrunkShape=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const old=createMoebiusSwampPlacement({seed:7711,scale:.5});
globalThis.location.search='';const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,report=inner.userData.gregTrunkDetail;
const leaves=o=>{const list=[];o.traverse(n=>{if(n.isMesh)list.push(n);});return list;};

test('organic shape changes real centreline without any extra triangles or draw surfaces',()=>{
 assert.equal(report.version,3);assert.ok(report.changedTrunks>20);assert.ok(report.changedBranches>10);assert.equal(report.extraDrawCalls,0);
 assert.ok(report.maxOrganicOffset>.25&&report.maxOrganicOffset<1.2);
 assert.ok(report.maxNoduleOffset>.10&&report.maxNoduleOffset<.45,'old limb/root swelling changes the existing wood surface, not an added ball');
 assert.equal(leaves(root).length,leaves(old).length);
 let moved=0;for(const r of report.records){assert.equal(r.geometry.attributes.position.count,r.originalGeometry.attributes.position.count);assert.equal(r.geometry.index?.count,r.originalGeometry.index?.count);moved+=r.changedVertices;assert.ok(Array.from(r.geometry.attributes.position.array).every(Number.isFinite));}
 assert.ok(moved>2000);console.log('organic bark',JSON.stringify({trunks:report.changedTrunks,branches:report.changedBranches,deformedTrunks:report.records.filter(r=>r.kind==='trunk'&&r.changedVertices).length,deformedBranches:report.records.filter(r=>r.kind==='branch'&&r.changedVertices).length,moved,maxOrganicOffset:report.maxOrganicOffset}));
});
test('all structural end rings, real perch anchors, under-water roots and transforms stay fixed',()=>{
 for(const r of report.records){const a=r.originalGeometry.attributes.position,b=r.geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<a.count;i++){min=Math.min(min,a.getY(i));max=Math.max(max,a.getY(i));}
  const ring=(r.originalGeometry.parameters?.radialSegments||0)+1;
  for(let i=0;i<a.count;i++)if(Math.abs(a.getY(i)-min)<1e-6||Math.abs(a.getY(i)-max)<1e-6||(r.originalGeometry.type==='TubeGeometry'&&(i<ring||i>=a.count-ring)))for(let axis=0;axis<3;axis++)assert.equal(b.array[i*3+axis],a.array[i*3+axis]);
 }
 const A=inner.userData.gregCoralPerches.records,B=old.userData.inner.userData.gregCoralPerches.records;assert.equal(A.length,B.length);
 for(let i=0;i<A.length;i++)for(const key of['point','root','surface'])assert.ok(new T.Vector3(...A[i][key]).distanceTo(new T.Vector3(...B[i][key]))<1e-6,`${key} anchor ${i}`);
 const before=leaves(old),after=leaves(root);for(let i=0;i<before.length;i++){assert.deepEqual(after[i].position.toArray(),before[i].position.toArray());assert.deepEqual(after[i].quaternion.toArray(),before[i].quaternion.toArray());assert.deepEqual(after[i].scale.toArray(),before[i].scale.toArray());if(before[i].name==='v2-floor-root')assert.deepEqual(after[i].geometry.attributes.position.array,before[i].geometry.attributes.position.array);}
});
test('walk/bridge attachment band stays unchanged and recomputed boxes remain valid after placement',()=>{
 root.updateMatrixWorld(true);const inverse=inner.matrixWorld.clone().invert(),v=new T.Vector3();let fixed=0;
 for(const r of report.records){const a=r.baselinePositions,b=r.geometry.attributes.position,m=inverse.clone().multiply(r.mesh.matrixWorld);
  for(let i=0;i<b.count;i++){v.fromArray(a,i*3).applyMatrix4(m);if(v.y>=38&&v.y<=62){for(let axis=0;axis<3;axis++)assert.equal(b.array[i*3+axis],a[i*3+axis]);fixed++;}}
  r.geometry.computeBoundingBox();const center=r.geometry.boundingBox.getCenter(new T.Vector3());assert.ok(center.distanceTo(r.baselineBox.getCenter(new T.Vector3()))<1e-9);
  for(let i=0;i<b.count;i++)assert.ok(r.geometry.boundingBox.containsPoint(v.fromBufferAttribute(b,i)));
 }
 assert.ok(fixed>1000);
 placeMoebiusSwampOnSphere(root,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);root.updateMatrixWorld(true);
 for(const record of inner.userData.gregCoralPerches.records){const source=record.sourceTrunk,origin=new T.Vector3(...record.point).setY(record.root[1]),dir=new T.Vector3(...record.root).sub(origin).normalize();const ray=new T.Raycaster(inner.localToWorld(origin),dir.transformDirection(inner.matrixWorld));assert.ok(ray.intersectObject(source,false).length,'perch still reaches real deformed tree after placement');}
});

test('branch bases that were embedded in wood remain attached to actual closed surfaces',()=>{
 root.updateMatrixWorld(true);old.updateMatrixWorld(true);
 const oldRecords=old.userData.inner.userData.gregTrunkDetail.records;
 function inside(world,mesh){
  const point=mesh.worldToLocal(world.clone()),g=mesh.geometry,p=g.attributes.position;
  if(!g.boundingBox.containsPoint(point))return false;
  const ray=new T.Ray(point,new T.Vector3(.31,.47,.83).normalize()),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3(),distances=[];
  const count=g.index?g.index.count:p.count;
  for(let j=0;j<count;j+=3){const index=k=>g.index?g.index.getX(k):k;a.fromBufferAttribute(p,index(j));b.fromBufferAttribute(p,index(j+1));c.fromBufferAttribute(p,index(j+2));
   if(ray.intersectTriangle(a,b,c,false,hit)){const d=hit.distanceTo(point);if(d<1e-5)return true;if(!distances.some(n=>Math.abs(n-d)<1e-5))distances.push(d);}
  }return distances.length%2===1;
 }
 let checked=0;
 for(let i=0;i<report.records.length;i++){
  const r=report.records[i];if(r.kind!=='branch'||r.originalGeometry.type!=='CylinderGeometry')continue;
  const bottom=-r.originalGeometry.parameters.height/2,point=r.mesh.localToWorld(new T.Vector3(0,bottom,0));
  const beforePoint=oldRecords[i].mesh.localToWorld(new T.Vector3(0,bottom,0));
  const sources=report.records.map((s,j)=>({s,j})).filter(({s,j})=>j!==i&&s.mesh.parent===r.mesh.parent);
  if(!sources.some(({j})=>inside(beforePoint,oldRecords[j].mesh)))continue;
  assert.ok(sources.some(({s})=>inside(point,s.mesh)),`branch ${i} lost its original embedded base`);checked++;
 }
 assert.ok(checked>50);console.log('actual embedded branch bases preserved',checked);
});
