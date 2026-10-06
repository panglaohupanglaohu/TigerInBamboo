import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {solveStackWfc,sampleStackProfile} from '../../src/world/seaStackWfc.js';
import {standSeaStackOnOcean} from '../../src/world/gateSeaStacks.js';
test('WFC assembles reproducible, varied stacks with compatible interfaces and semantic layers',()=>{
 const variants=new Set();for(let seed=0;seed<100;seed++){
  const a=solveStackWfc(seed),b=solveStackWfc(seed);assert.deepEqual(a,b);assert.equal(a.socketMismatches,0);assert.equal(a.modules[0].role,'foot');assert.equal(a.modules[1].role,'shore');assert.equal(a.modules.at(-1).role,'crown');assert.ok(a.decisions>0);
  for(let i=1;i<a.modules.length;i++)assert.ok(Math.abs(sampleStackProfile(a.modules,i/a.modules.length-1e-8)-sampleStackProfile(a.modules,i/a.modules.length+1e-8))<1e-5);
  variants.add(a.modules.map(m=>m.id).join(','));
 }assert.ok(variants.size>30);
});
test('stack Y axis follows its own ocean normal through rotated parents; foot stays buried',()=>{
 const site=new THREE.Group();site.position.set(0,160,0);site.rotation.z=.35;const parent=new THREE.Group();parent.rotation.y=.2;site.add(parent);
 const rock=new THREE.Mesh(new THREE.BoxGeometry());rock.userData.seaStack={height:40};parent.add(rock);site.updateMatrixWorld(true);
 standSeaStackOnOcean(rock,site,45,20,40,()=>-10,.7);site.updateMatrixWorld(true);
 const axis=new THREE.Vector3(0,1,0).transformDirection(rock.matrixWorld),sea=new THREE.Vector3(...rock.userData.seaStack.seaAnchor);
 assert.ok(axis.angleTo(sea.clone().normalize())<1e-7);
 const foot=new THREE.Vector3(0,-20,0).applyMatrix4(rock.matrixWorld);assert.ok(Math.abs(sea.length()-foot.length()-6)<1e-7);
});
