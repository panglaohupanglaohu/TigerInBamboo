import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createSwampGroundRayIndex} from '../../src/world/swampGroundRayIndex.js';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},location,localStorage};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
function compare(ray,meshes,index){const old=ray.intersectObjects(meshes,false),now=index.intersectObjects(ray,meshes);assert.equal(now.length,old.length);for(let i=0;i<old.length;i++){assert.ok(now[i].point.distanceTo(old[i].point)<1e-8);assert.ok(Math.abs(now[i].distance-old[i].distance)<1e-8);assert.equal(now[i].object,old[i].object);assert.equal(now[i].faceIndex,old[i].faceIndex);}return old.length;}
test('actual rotated lake rim and stairs retain all ray hits at dense edge and interior probes',()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;root.position.set(17,21,-11);root.rotation.set(.31,.6,-.2);root.updateMatrixWorld(true);
 const surfaces=[...inner.userData.tigerWalkSurfaces,...inner.userData.gregCoralRim.walkMeshes],index=createSwampGroundRayIndex(),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld);let supported=0;
 for(let i=0;i<720;i++)for(const radius of [31.9,34,35.9,37.4,40.2,45.5,47.2]){const a=i*Math.PI/360,p=inner.localToWorld(new T.Vector3(Math.cos(a)*radius,55,Math.sin(a)*radius));ray.set(p,down);supported+=compare(ray,surfaces,index);}
 assert.ok(supported>1000);assert.ok(index.report.indexedMeshes>1000);assert.ok(index.report.candidateTriangles/index.report.queries<300);console.log('actual support differential',index.report);
});
test('indexed/nonindexed faces, material sides, geometry edits, transforms, layers and tilted fallback match Three',()=>{
 const geo=new T.BoxGeometry(8,1,8),mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));geo.clearGroups();const index=createSwampGroundRayIndex(),ray=new T.Raycaster(new T.Vector3(.3,10,.7),new T.Vector3(0,-1,0));mesh.updateMatrixWorld(true);
 for(const side of [T.FrontSide,T.BackSide,T.DoubleSide]){mesh.material.side=side;compare(ray,[mesh],index);}
 mesh.material.side=T.DoubleSide;geo.attributes.position.setY(0,2);geo.attributes.position.needsUpdate=true;geo.computeBoundingBox();geo.computeBoundingSphere();compare(ray,[mesh],index);assert.equal(index.report.rebuilds,2);
 mesh.position.x=1;mesh.scale.set(-1,2,.5);mesh.updateMatrixWorld(true);compare(ray,[mesh],index);
 mesh.rotation.z=.3;mesh.updateMatrixWorld(true);compare(ray,[mesh],index);assert.ok(index.report.fallbackMeshes>0);
 mesh.layers.set(2);compare(ray,[mesh],index);mesh.layers.set(0);mesh.rotation.z=0;mesh.updateMatrixWorld(true);mesh.geometry=geo.toNonIndexed();compare(ray,[mesh],index);
 mesh.geometry.setDrawRange(0,6);compare(ray,[mesh],index);
});
