import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bayRotation,bayWeight,BAY_SEPARATION_METRES} from '../../src/world/citadel/bayLayoutMath.js';
import {citadelCoastalFrame,inCitadelTramTunnel,citadelCoastalTramPoints} from '../../src/world/citadel/coastalTramRoute.js';
test('relocated waterfront and local vertical remain on the same spherical altitude',()=>{
 const f=citadelCoastalFrame(),q=bayRotation(f,160),p=new THREE.Vector3(8,4,71.5).applyMatrix4(f),up=p.clone().normalize(),moved=p.clone().applyQuaternion(q);
 assert(Math.abs(moved.length()-p.length())<1e-10);
 assert(up.applyQuaternion(q).distanceTo(moved.clone().normalize())<1e-10);
 assert(Math.abs(q.angleTo(new THREE.Quaternion())*160-BAY_SEPARATION_METRES)<1e-9);
});
test('old pedestrian landing and old crown remain fixed; new shore follows full relocation',()=>{
 assert.equal(bayWeight(-22.2113,5.8955),0);assert.equal(bayWeight(-30,-38),0);assert.equal(bayWeight(12,71),1);
});
test('approved coastal line has no forced new-city tunnel and all controls are finite',()=>{
 const f=citadelCoastalFrame();assert.equal(inCitadelTramTunnel(new THREE.Vector3(30,0,43).applyMatrix4(f)),false);
 const points=citadelCoastalTramPoints(160);assert(points.length>20);for(const p of points){assert(p.toArray().every(Number.isFinite));assert(p.length()>160);}
});
