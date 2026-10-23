import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {installGateLighting} from '../../src/world/gateLighting.js';import {MOEBIUS_PALETTE as P} from '../../src/world/moebiusPalette.js';
test('late gate binding supplies receiving architecture, budgeted lamps and day/night globes',()=>{
 const seat=new T.Group(),lights=installGateLighting(seat),arch=new T.Group();seat.add(arch);seat.userData.moebiusV10=arch;
 const material=new T.MeshBasicMaterial({color:P.blue}),hook=()=>{};material.onBeforeCompile=hook;
 const wall=new T.Mesh(new T.BoxGeometry(),material);arch.add(wall);
 const globe=new T.Mesh(new T.SphereGeometry(),new T.MeshBasicMaterial({color:P.cream}));globe.name='g30-walk-lamp';arch.add(globe);
 lights.userData.update(.5);assert.ok(wall.material.isMeshStandardMaterial);assert.equal(wall.material.onBeforeCompile,hook);assert.equal(wall.material.color.getHex(),new T.Color(P.blue).getHex());
 lights.userData.update(0);const points=[];lights.traverse(o=>{if(o.isPointLight)points.push(o);});assert.equal(points.length,15);assert.ok(points.filter(o=>o.name.startsWith('sighs-')).every(o=>o.intensity>0&&!o.castShadow));assert.ok(globe.material.emissiveIntensity>0);
 lights.userData.update(.5);assert.ok(points.filter(o=>o.name.startsWith('sighs-')).every(o=>o.intensity===0));assert.equal(globe.material.emissiveIntensity,0);assert.equal(lights.userData.report.practicalLights,12);
});
