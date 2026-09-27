import * as T from '../../vendor/three.module.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const src=new URL('../../src/world/terrainRayIndex.js',import.meta.url);
const code=(await readFile(src,'utf8')).replace("'three'",JSON.stringify(new URL('../../vendor/three.module.js',import.meta.url).href));
const {intersectTerrainSet}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const data=JSON.parse(await readFile(new URL('../../godot/data/saihoji-target-garden-20260919.json',import.meta.url)));
const meshes=data.meshes.filter(m=>m.name==='leviathan-crust-plate'||m.name.startsWith('leviathan-moss-bed')).map(m=>{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(m.positions,3));if(m.indices?.length)g.setIndex(m.indices);
 return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));
});
// Include an indexed high-density mesh, material groups, nonuniform scaling,
// drawRange and changed vertices, in addition to the real target garden.
meshes.push(new T.Mesh(new T.SphereGeometry(7,80,40),new T.MeshBasicMaterial()));
let cases=0,maxError=0,referenceMs=0,indexedMs=0;
let seed=1234567;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const ray=new T.Raycaster();ray.far=200;
for(const side of [T.FrontSide,T.BackSide,T.DoubleSide])for(const angle of [0,.7,Math.PI,5.5]){
 const parent=new T.Group();parent.position.set(14,160,-8);parent.rotation.set(.2,.4,angle);parent.scale.set(.5,.8,.6);
 for(const m of meshes){m.material.side=side;parent.add(m);}parent.updateMatrixWorld(true);
 for(let i=0;i<150;i++){
  const target=new T.Vector3((random()-.5)*38,0,(random()-.5)*20),origin=target.clone().add(new T.Vector3((random()-.5)*8,40,(random()-.5)*8));
  parent.localToWorld(origin);parent.localToWorld(target);ray.set(origin,target.sub(origin).normalize());
  const before=performance.now(),expected=ray.intersectObjects(meshes,false);referenceMs+=performance.now()-before;
  const start=performance.now(),actual=intersectTerrainSet(meshes,ray,[]);indexedMs+=performance.now()-start;
  assert.equal(!!actual.length,!!expected.length,`hit mismatch at ${cases}`);
  if(actual.length){const e=Math.abs(actual[0].distance-expected[0].distance);maxError=Math.max(maxError,e);assert.ok(e<1e-7,`distance error ${e}`);}
  cases++;
 }
}
const box=new T.Mesh(new T.BoxGeometry(2,2,2),[0,1,2,3,4,5].map((_,i)=>new T.MeshBasicMaterial({side:i%3})));box.updateMatrixWorld(true);
for(const range of [[0,Infinity],[6,12]]){box.geometry.setDrawRange(...range);for(let i=0;i<50;i++){ray.set(new T.Vector3(6,6,6),new T.Vector3(-1,-1,-1).normalize());const x=ray.intersectObject(box),y=intersectTerrainSet([box],ray,[]);assert.equal(!!x.length,!!y.length);if(x.length)assert.ok(Math.abs(x[0].distance-y[0].distance)<1e-7);cases++;}}
box.geometry.attributes.position.setXYZ(0,5,5,5);box.geometry.attributes.position.needsUpdate=true;box.geometry.computeBoundingSphere();box.geometry.setDrawRange(0,Infinity);
const x=ray.intersectObject(box),y=intersectTerrainSet([box],ray,[]);assert.equal(!!x.length,!!y.length);if(x.length)assert.ok(Math.abs(x[0].distance-y[0].distance)<1e-7);
cases++;
const buffer=new T.InterleavedBuffer(new Float32Array([-2,0,-2,9, 2,0,-2,9, 0,0,2,9]),4),geo=new T.BufferGeometry();geo.setAttribute('position',new T.InterleavedBufferAttribute(buffer,3,0));
const interleaved=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));interleaved.updateMatrixWorld(true);ray.set(new T.Vector3(0,10,0),new T.Vector3(0,-1,0));
for(const height of [0,3]){for(let i=0;i<3;i++)geo.attributes.position.setY(i,height);buffer.needsUpdate=true;geo.computeBoundingSphere();const a=ray.intersectObject(interleaved),b=intersectTerrainSet([interleaved],ray,[]);assert.equal(a[0].distance,b[0].distance);cases++;}
const instanced=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),1);instanced.setMatrixAt(0,new T.Matrix4());instanced.layers.set(2);instanced.updateMatrixWorld(true);assert.equal(intersectTerrainSet([instanced],ray,[]).length,0);cases++;
box.geometry.setDrawRange(1,8);box.material=new T.MeshBasicMaterial({side:T.DoubleSide});const rangeA=ray.intersectObject(box),rangeB=intersectTerrainSet([box],ray,[]);assert.equal(!!rangeA.length,!!rangeB.length);if(rangeA.length)assert.equal(rangeA[0].distance,rangeB[0].distance);cases++;
box.raycast=()=>{};assert.equal(intersectTerrainSet([box],ray,[]).length,0);cases++;
const report={passed:true,cases,maxError,referenceMs,indexedMs,speedup:referenceMs/indexedMs,scope:'Exact nearest-hit comparison: exported ground, indexed sphere, 3 sides, 4 moving transforms, groups/drawRange, vertex/interleaved revisions, excluded fallback layers'};
const out=new URL('../../artifacts/pipeline/saihoji-runtime-performance/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('terrain-index-test.json',out),JSON.stringify(report,null,2));console.log(report);
