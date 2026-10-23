import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createCitadelGuardianAtmosphere} from '../../src/world/citadel/citadelGuardianAtmosphere.js';
test('storm darkens nearby rendered sky, flashes, and restores without accumulating',()=>{
 const scene=new T.Scene();scene.background=new T.Color(0x88bbee);scene.fog=new T.Fog(0x8899aa,1,100);
 const sun=new T.DirectionalLight(0xffffff,2),hemi=new T.HemisphereLight(0xffffff,0xffffff,.7);scene.add(sun,hemi);
 const camera=new T.PerspectiveCamera(),skyMat={uniforms:{topColor:{value:new T.Color(0x88bbee)}}};
 const guardian={stormState:{intensity:1,flash:0},storm:{group:{position:new T.Vector3()}}};
 const overlay=createCitadelGuardianAtmosphere({scene,camera,skyMat,getGuardian:()=>guardian}),before=scene.background.clone(),sky=skyMat.uniforms.topColor.value.clone();
 for(let i=0;i<200;i++){const undo=overlay.apply();assert.ok(sun.intensity<2);assert.ok(!scene.background.equals(before));undo();assert.equal(sun.intensity,2);assert.equal(hemi.intensity,.7);assert.ok(scene.background.equals(before));assert.ok(skyMat.uniforms.topColor.value.equals(sky));}
 guardian.stormState.flash=1;const undo=overlay.apply();assert.ok(sun.intensity>1);undo();
 camera.position.set(0,0,300);overlay.apply()();assert.equal(sun.intensity,2);assert.ok(scene.background.equals(before));
});
