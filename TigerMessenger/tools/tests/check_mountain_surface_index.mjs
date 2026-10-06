import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as THREE from '../../vendor/three.module.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
const snapshots=meshes=>JSON.stringify(meshes.map(m=>({p:Array.from(m.geometry.attributes.position.array),index:m.geometry.index&&Array.from(m.geometry.index.array),matrix:m.matrix.toArray(),world:m.matrixWorld.toArray(),instance:m.instanceMatrix&&Array.from(m.instanceMatrix.array),range:m.geometry.drawRange,groups:m.geometry.groups,side:(Array.isArray(m.material)?m.material:[m.material]).map(x=>x.side)})));
let tests=0,maxDistanceError=0,maxNormalError=0,buildMs=0,fastMs=0,referenceMs=0;
for(const side of [THREE.FrontSide,THREE.BackSide,THREE.DoubleSide])for(const mirror of[1,-1]){
 const g=new THREE.SphereGeometry(5,32,20),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side}));mesh.position.set(.3,-.2,.1);mesh.rotation.set(.2,.5,.1);mesh.scale.set(mirror,1.3,.7);mesh.updateMatrixWorld(true);
 const multi=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),[new THREE.MeshBasicMaterial({side}),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),new THREE.MeshBasicMaterial({side:THREE.BackSide}),new THREE.MeshBasicMaterial({side}),new THREE.MeshBasicMaterial({side}),new THREE.MeshBasicMaterial({side})]);multi.position.set(8,0,0);multi.geometry.setDrawRange(3,27);multi.updateMatrixWorld(true);
 const instance=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({side}),2);instance.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-7,0,0));instance.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-7,3,0));instance.updateMatrixWorld(true);
 const meshes=[mesh,multi,instance],before=snapshots(meshes),start=performance.now(),index=buildMountainSurfaceIndex(meshes);buildMs+=performance.now()-start;
 for(let i=0;i<900;i++){const a=i*2.399,z=1-2*(i+.5)/900,r=Math.sqrt(1-z*z),d=new THREE.Vector3(Math.cos(a)*r,z,Math.sin(a)*r),origin=d.clone().multiplyScalar(i%2?20:0),direction=i%2?d.clone().negate():d;const ray=new THREE.Raycaster(origin,direction,i%5===0?1:0,i%7===0?10:40);let at=performance.now();const ref=ray.intersectObjects(meshes,false)[0];referenceMs+=performance.now()-at;at=performance.now();const hit=index.sample(ray.ray,ray.near,ray.far);fastMs+=performance.now()-at;assert.equal(!!hit,!!ref);if(ref){assert.equal(hit.object,ref.object);assert.equal(hit.instanceId,ref.instanceId);const error=Math.abs(hit.distance-ref.distance),nerror=hit.face.normal.distanceTo(ref.face.normal);maxDistanceError=Math.max(maxDistanceError,error);maxNormalError=Math.max(maxNormalError,nerror);assert.ok(error<1e-5);assert.ok(nerror<1e-8);assert.equal(hit.faceIndex,ref.faceIndex);}tests++;}
 assert.equal(snapshots(meshes),before,'source data mutated');
}
// Approximately the recorded actual-scene triangle budget, but synthetic mesh.
const dense=new THREE.Mesh(new THREE.SphereGeometry(10,256,244),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));dense.updateMatrixWorld(true);const begin=performance.now(),index=buildMountainSurfaceIndex([dense]),denseBuildMs=performance.now()-begin;let at=performance.now();for(let i=0;i<10000;i++){const a=i*2.399,z=1-2*(i+.5)/10000,r=Math.sqrt(1-z*z),d=new THREE.Vector3(Math.cos(a)*r,z,Math.sin(a)*r);index.sample(new THREE.Ray(d.clone().multiplyScalar(30),d.negate()),0,100);}const dense10kRayMs=performance.now()-at;
console.log(JSON.stringify({status:'pass',tests,maxDistanceError,maxNormalError,sourceUnchanged:true,buildMs,fastMs,referenceMs,syntheticBenchmark:{triangles:index.stats.triangles,buildMs:denseBuildMs,rays:10000,rayMs:dense10kRayMs,note:'Synthetic sphere on this machine; not measured actual game loading performance'}},null,2));
// A filtered first hit must not prune a farther valid surface. Navigation uses
// this to skip floor triangles while querying an actual vertical wall.
{
 const nearMesh=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));nearMesh.position.z=5;nearMesh.updateMatrixWorld(true);
 const farMesh=new THREE.Mesh(new THREE.PlaneGeometry(10,10),nearMesh.material);farMesh.position.z=0;farMesh.updateMatrixWorld(true);
 const idx=buildMountainSurfaceIndex([nearMesh,farMesh]);const ray=new THREE.Ray(new THREE.Vector3(0,0,10),new THREE.Vector3(0,0,-1));
 assert.equal(idx.sample(ray,0,20).object,nearMesh);assert.equal(idx.sample(ray,0,20,h=>h.object===farMesh).object,farMesh);assert.equal(idx.sample(ray,0,20,()=>false),null);
 console.log('Predicate filtering preserves nearest accepted hit and complete rejection.');
}
