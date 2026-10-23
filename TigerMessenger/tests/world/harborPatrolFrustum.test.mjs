import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {configureHarborPatrolFrustum} from '../../src/assets/harborPatrolFrustum.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createHarborPatrolSoldier}=await import('../../src/assets/harbor.js');
const soldier=createHarborPatrolSoldier(),meshes=[];
soldier.traverse(o=>{if(o.isMesh)meshes.push(o);});
const snapshots=meshes.map(o=>({o,geometry:o.geometry,material:o.material,raycast:o.raycast,visible:o.visible,positions:o.geometry.attributes.position.array.slice(),bounds:o.geometry.boundingSphere?.clone(),matrix:o.matrix.clone()}));
const parts=soldier.userData.parts,equipment=soldier.userData.equipment,identity={...soldier.userData};
const report=configureHarborPatrolFrustum(soldier);
test('actual rigid patrol has independent conservative bounds; semantic nodes and shared resources stay intact',()=>{
 assert.equal(T.REVISION,'172');assert.equal(report.meshes,40);assert.equal(report.culledMeshes,40);assert.equal(report.outlines,20);assert.equal(report.skipped,0);
 assert.equal(soldier.userData.parts,parts);assert.equal(soldier.userData.equipment,equipment);assert.deepEqual(soldier.userData,identity);assert.equal(soldier.name,'harbor-patrol-soldier');
 for(const s of snapshots){const o=s.o;assert.equal(o.geometry,s.geometry);assert.equal(o.material,s.material);assert.equal(o.raycast,s.raycast);assert.equal(o.visible,s.visible);assert.deepEqual(o.matrix,s.matrix);assert.deepEqual(o.geometry.attributes.position.array,s.positions);assert.deepEqual(o.geometry.boundingSphere,s.bounds??null);assert.notEqual(o.boundingSphere,o.geometry.boundingSphere);
  const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,point=new T.Vector3();let width=0;
  if(o.userData.isOutline){const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};o.material.onBeforeCompile(shader);width=Number(shader.vertexShader.match(/normal \* \(([\d.]+)/)[1])*1.25;}
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);if(width)point.addScaledVector(new T.Vector3().fromBufferAttribute(n,i),width);assert.ok(point.distanceTo(o.boundingSphere.center)<=o.boundingSphere.radius,'max shader extrusion retained');}
 }
 console.log('patrol bounds',JSON.stringify(report));
});
test('Three object spheres follow current ancestor transforms, including nonuniform scale, and cover outline edges',()=>{
 const geometry=new T.BoxGeometry(1,1,1),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(geometry,material),joint=new T.Group(),root=new T.Group();root.add(joint);joint.add(mesh);configureHarborPatrolFrustum(root);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().makeOrthographic(-1,1,1,-1,.1,10));
 root.position.set(3,0,-2);root.updateMatrixWorld(true);assert.equal(frustum.intersectsObject(mesh),false);
 joint.rotation.z=.7;root.scale.set(2,1,.5);root.position.x=0;root.updateMatrixWorld(true);assert.equal(frustum.intersectsObject(mesh),true);
 // Explicit object sphere, rather than deliberately tiny shared geometry bounds.
 geometry.boundingSphere=new T.Sphere(new T.Vector3(),0);mesh.boundingSphere.radius=1;root.scale.setScalar(1);root.position.x=1.7;root.updateMatrixWorld(true);assert.equal(frustum.intersectsObject(mesh),true);mesh.boundingSphere.radius=.1;assert.equal(frustum.intersectsObject(mesh),false);
});
test('URL rollback restores old forced draw without touching material or actor state',()=>{
 location.search='?harborPatrolFrustum=0';const restored=configureHarborPatrolFrustum(soldier);assert.equal(restored.enabled,false);for(const mesh of meshes)assert.equal(mesh.frustumCulled,false);assert.deepEqual(soldier.userData,identity);location.search='';
});
test('unknown displacement, shader, morph, skin and instances conservatively retain forced draw',()=>{
 const root=new T.Group(),g=new T.BoxGeometry(),unknown=new T.MeshBasicMaterial();unknown.onBeforeCompile=()=>{throw new Error('renderer required');};
 const outline=new T.Mesh(g,unknown);outline.userData.isOutline=true;root.add(outline,new T.Mesh(g,new T.ShaderMaterial()),new T.SkinnedMesh(g,new T.MeshBasicMaterial()),new T.InstancedMesh(g,new T.MeshBasicMaterial(),1));
 const morph=g.clone();morph.morphAttributes.position=[g.attributes.position.clone()];root.add(new T.Mesh(morph,new T.MeshBasicMaterial()));const report=configureHarborPatrolFrustum(root);assert.equal(report.skipped,5);assert.equal(report.culledMeshes,0);root.traverse(o=>{if(o.isMesh)assert.equal(o.frustumCulled,false);});
});
