import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRidgeCloudField} from '../../src/world/citadel/ridgeCloudField.js';
import {refreshRidgeFlowClouds,ridgeCloudFrameMatrix} from '../../src/world/citadel/ridgeFlowClouds.js';
import * as THREE from 'three';
test('cache interpolates final heights without querying during animation and rejects incomplete cells',()=>{
 let calls=0;const f=buildRidgeCloudField((x,z)=>{calls++;return {height:10+x*.2+z*.1,allowed:x<16};},{minX:0,maxX:32,minZ:0,maxZ:32,step:4});
 const built=calls;assert.ok(f.clearanceHeight(6,6)>=f.height(6,6));assert.ok(Number.isNaN(f.clearanceHeight(14,6)));assert.ok(Math.abs(f.height(6,6)-11.8)<1e-5);assert.ok(Math.abs(f.grad(6,6)[0]-.2)<1e-5);
 assert.equal(f.kind(14,6),0);assert.ok(Number.isNaN(f.height(14,6)));assert.equal(f.kind(-1,4),0);
 for(let i=0;i<100;i++){f.height(6,6);f.grad(6,6);}assert.equal(calls,built);assert.ok(f.crests.length>0);
});
test('field regeneration uses current mesh not obsolete baked heights',()=>{
 const castle=new THREE.Group();castle.position.y=160;
 const g=new THREE.PlaneGeometry(160,120);g.rotateX(-Math.PI/2);g.translate(0,10,0);const rock=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));castle.add(rock);
 let field;castle.userData.ridgeFlowClouds={userData:{refresh:f=>field=f}};
 refreshRidgeFlowClouds(castle,{surfaces:[rock],radius:160});assert.ok(Math.abs(field.height(0,0)-10)<1e-5);
 rock.geometry.translate(0,7,0);rock.geometry.computeBoundingSphere();refreshRidgeFlowClouds(castle,{surfaces:[rock],radius:160});assert.ok(Math.abs(field.height(0,0)-17)<1e-5);
 const p=new THREE.Vector3(0,177,0);refreshRidgeFlowClouds(castle,{surfaces:[rock],radius:160,rail:[p]});assert.equal(field.kind(0,0),0);
});

test('composition-shifted cloud mesh preserves final castle-frame particle positions',()=>{
 const castle=new THREE.Group(),mesh=new THREE.Mesh();castle.position.set(10,160,20);castle.rotation.z=.32;mesh.position.x=-52;castle.add(mesh);
 const point=new THREE.Vector3(25,2,-23),converted=point.clone().applyMatrix4(ridgeCloudFrameMatrix(castle,mesh));
 assert.ok(mesh.localToWorld(converted).distanceTo(castle.localToWorld(point.clone()))<1e-8);
});
