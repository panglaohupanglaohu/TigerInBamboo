import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHarborBroadleafTree} from '../../src/assets/harborBroadleafTree.js';
import {fitHarborTreesOutsideRail,buildHarborRailEnvelopes,harborTreeIntersectsRail} from '../../src/world/citadel/harborTreeRailClearance.js';

test('port trees have connected branches and full volume muted crowns in four draw calls',()=>{
 const t=createHarborBroadleafTree({seed:9901});const bounds=new THREE.Box3().setFromObject(t),size=bounds.getSize(new THREE.Vector3());
 assert.ok(size.y>7&&size.y<10);assert.ok(size.x>5&&size.z>4);assert.equal(t.userData.branchCount,17);assert.equal(t.userData.crownCount,21);
 let meshes=0;t.traverse(o=>{if(o.isMesh){meshes++;assert.equal(o.userData.skipInk,true);assert.ok(o.material.roughness>.8);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});assert.equal(meshes,4);
});

test('whole canopy is kept out of finite train envelope, preserving root at final rotated harbor',()=>{
 const world=new THREE.Group(),harbor=new THREE.Group();world.add(harbor);harbor.position.set(0,150,0);harbor.rotation.z=.32;
 const t=createHarborBroadleafTree();harbor.add(t);world.updateMatrixWorld(true);const original=t.getWorldPosition(new THREE.Vector3());
 const a=new THREE.Vector3(-30,5.5,0),b=new THREE.Vector3(30,5.5,0);harbor.localToWorld(a);harbor.localToWorld(b);const c=new THREE.LineCurve3(a,b);
 const report=fitHarborTreesOutsideRail([t],{red:c});assert.equal(report.verified,true);assert.ok(report.trees[0].scale<1);assert.equal(report.trees[0].rootUnmoved,true);assert.deepEqual(t.getWorldPosition(new THREE.Vector3()).toArray(),original.toArray());
 const box=new THREE.Box3().setFromObject(t,true);assert.ok(buildHarborRailEnvelopes({red:c}).every(b=>!harborTreeIntersectsRail(t,b)));
});

test('clear trees retain their size; missing railway is reported unverified',()=>{
 const t=createHarborBroadleafTree();t.position.set(20,150,0);const curve=new THREE.LineCurve3(new THREE.Vector3(0,150,-30),new THREE.Vector3(0,150,30));
 const report=fitHarborTreesOutsideRail([t],{red:curve,blue:curve});assert.equal(report.verified,true);assert.equal(report.trees[0].scale,1);assert.equal(fitHarborTreesOutsideRail([t],{}).verified,false);
});

test('an impossible root location remains explicitly unresolved rather than hiding the tree or moving railway',()=>{
 const t=createHarborBroadleafTree();t.position.set(0,150,0);const curve=new THREE.LineCurve3(new THREE.Vector3(-20,150,0),new THREE.Vector3(20,150,0));
 const report=fitHarborTreesOutsideRail([t],{red:curve});assert.equal(report.verified,false);assert.ok(report.trees[0].intersections>0);assert.equal(t.visible,true);assert.equal(report.trees[0].rootUnmoved,true);
});
