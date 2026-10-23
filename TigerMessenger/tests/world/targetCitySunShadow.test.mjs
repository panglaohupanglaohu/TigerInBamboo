import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {fitTargetCitySunShadow} from '../../src/world/citadel/targetCitySunShadow.js';
test('shadow fit keeps sun direction and daylight power, reversibly covers city',()=>{const scene=new THREE.Scene(),castle=new THREE.Group(),sun=new THREE.DirectionalLight('#fff6e0',1.6);sun.position.set(20,28,16);sun.castShadow=true;scene.add(sun,castle);castle.position.set(125,75,95);const before=sun.position.clone(),dir=before.clone().normalize(),far=sun.shadow.camera.far;const h=fitTargetCitySunShadow(scene,castle);assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(dir)<1e-12);assert.equal(sun.intensity,1.6);assert.equal(h.report.applied,true);h.dispose();assert.deepEqual(sun.position,before);assert.equal(sun.shadow.camera.far,far);});

test('authored local oblique sun transforms with castle and restores original light',()=>{const scene=new THREE.Scene(),castle=new THREE.Group(),sun=new THREE.DirectionalLight();sun.castShadow=true;sun.position.set(20,28,16);castle.rotation.set(.4,.7,.2);scene.add(sun,castle);scene.updateMatrixWorld(true);const before=sun.position.clone(),expected=new THREE.Vector3(-.45,.82,.36).normalize().transformDirection(castle.matrixWorld);const h=fitTargetCitySunShadow(scene,castle,{directionLocal:[-.45,.82,.36]});const actual=sun.position.clone().sub(sun.target.position).normalize();assert.ok(actual.distanceTo(expected)<1e-12);h.dispose();assert.deepEqual(sun.position,before);});

test('shadow filter is changed only with supplied renderer and restored on close',()=>{const scene=new THREE.Scene(),castle=new THREE.Group(),sun=new THREE.DirectionalLight();sun.castShadow=true;sun.position.set(20,28,16);scene.add(sun,castle);const renderer={shadowMap:{type:THREE.BasicShadowMap,needsUpdate:false}};const h=fitTargetCitySunShadow(scene,castle,{renderer,softShadows:true});assert.equal(renderer.shadowMap.type,THREE.PCFSoftShadowMap);assert.equal(renderer.shadowMap.needsUpdate,true);h.dispose();assert.equal(renderer.shadowMap.type,THREE.BasicShadowMap);});

test('sun shadow box follows the player with a fixed local elevation and restores on dispose', async () => {
  const {fitTargetCitySunShadow} = await import('../../src/world/citadel/targetCitySunShadow.js');
  const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; scene.add(sun, sun.target);
  const castle = new THREE.Group(); castle.position.set(0, 160, 0); scene.add(castle); scene.updateMatrixWorld(true);
  const widthBefore = sun.shadow.camera.right - sun.shadow.camera.left;
  const handle = fitTargetCitySunShadow(scene, castle, {directionLocal: [-.45, .82, .36]});
  assert.equal(scene.userData.sunShadowFollow?.follow, handle.follow);
  const player = new THREE.Vector3(0, 0, 160);            // a quarter of the planet away from the citadel
  assert.equal(handle.follow(player), true);
  const cam = sun.shadow.camera;
  assert.equal(cam.right - cam.left, 90); assert.equal(cam.top - cam.bottom, 90);
  const target = sun.target.getWorldPosition(new THREE.Vector3());
  assert.ok(target.distanceTo(player) < 1, 'box centred on the player');
  const toLight = sun.getWorldPosition(new THREE.Vector3()).sub(target).normalize();
  const elevation = Math.asin(toLight.dot(player.clone().normalize())) * 180 / Math.PI;
  assert.ok(elevation > 50 && elevation < 60, 'sun ~55 deg above the local ground, got ' + elevation);
  handle.dispose();
  assert.equal(scene.userData.sunShadowFollow, undefined);
  assert.equal(cam.right - cam.left, widthBefore);         // original box restored
});
