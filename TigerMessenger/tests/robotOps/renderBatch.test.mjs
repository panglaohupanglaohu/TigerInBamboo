import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createRobotRenderBatch} from '../../src/gameplay/robotOps/renderBatch.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?robotRenderBatch=1'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createLocustRobot,createAntRobot,createBeetleRobot}=await import('../../src/assets/bookshopRobots.js');
const {animateArticulatedRobot}=await import('../../src/assets/robotArticulation.js');
test('actual three factory clones retain authored triangles and every animated world matrix',()=>{
 const scene=new T.Scene(),models=new T.Group();scene.add(models);const actors=[];
 for(const factory of[createLocustRobot,createAntRobot,createBeetleRobot]){const template=factory({rigged:true});for(let i=0;i<3;i++){const m=template.clone(true);m.name='robot-unit-'+actors.length;m.position.set(i*8,2,actors.length*3);models.add(m);actors.push(m);}}
 const original=[];models.traverse(o=>{if(o.isMesh)original.push({o,geometry:o.geometry,material:o.material,raycast:o.raycast,visible:o.visible});});
 const system=createRobotRenderBatch(models);system.update();assert.ok(system.report.sourceMeshes>200);assert.ok(system.report.batches<system.report.sourceMeshes/2);console.log('robot batch fixture',system.report);
 for(const phase of[0,1.2,2.4]){
  actors.forEach((a,i)=>animateArticulatedRobot(a,{time:phase,speed:2,state:i%2?'transport':'move',aim:.2}));system.update();
  for(const batch of system.root.children){const matching=original.filter(s=>s.geometry===batch.geometry&&s.material===batch.material&&s.o.visible===false);assert.equal(batch.count,matching.length);
   matching.forEach((s,i)=>{const actual=new T.Matrix4();batch.getMatrixAt(i,actual);actual.premultiply(batch.matrixWorld);const expected=s.o.matrixWorld;actual.elements.forEach((n,j)=>assert.ok(Math.abs(n-expected.elements[j])<2e-5));assert.equal(s.o.geometry,s.geometry);assert.equal(s.o.raycast,s.raycast);assert.equal(s.o.material,s.material);assert.equal(s.o.visible,false);});
  }
 }
 actors[0].visible=false;system.update();const count=system.report.instances;actors[0].visible=true;system.update();assert.ok(system.report.instances>count);
 models.remove(actors[0]);system.update();assert.ok(!system.root.children.some(b=>b.count>9));system.dispose();assert.equal(system.root.parent,null);for(const s of original){assert.equal(s.o.material,s.material);assert.equal(s.o.visible,s.visible);}
});
test('original raycast still hits masked mesh; batch cannot duplicate collision',()=>{
 const scene=new T.Scene(),models=new T.Group();scene.add(models);const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();const a=new T.Mesh(geometry,material),b=a.clone();a.position.z=b.position.z=-4;b.position.x=3;models.add(a,b);const system=createRobotRenderBatch(models);system.update();scene.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,0,-1));assert.ok(ray.intersectObject(a).length);assert.equal(ray.intersectObjects(system.root.children).length,0);system.dispose();assert.equal(a.material,material);
});
test('opt out and unknown deforming shaders never change render materials',()=>{
 const scene=new T.Scene(),models=new T.Group();scene.add(models);const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();models.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material));const off=createRobotRenderBatch(models,{enabled:false});off.update();assert.equal(off.report.sourceMeshes,0);models.children.forEach(m=>assert.equal(m.material,material));off.dispose();material.onBeforeCompile=()=>{};const on=createRobotRenderBatch(models);on.update();assert.equal(on.report.sourceMeshes,0);on.dispose();
});
test('trio bounds prevent one near robot from pulling in a distant legion',()=>{
 const scene=new T.Scene(),models=new T.Group();scene.add(models);const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();
 for(let i=0;i<9;i++){const actor=new T.Group();actor.userData.robotType='locust';actor.position.set(Math.floor(i/3)*100,0,-4);actor.add(new T.Mesh(geometry,material));models.add(actor);}
 const system=createRobotRenderBatch(models);system.update();scene.updateMatrixWorld(true);assert.equal(system.report.batches,3);system.root.children.forEach(b=>assert.equal(b.count,3));
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().makeOrthographic(-2,2,2,-2,.1,10));assert.equal(system.root.children.filter(b=>frustum.intersectsObject(b)).length,1);system.dispose();
});
