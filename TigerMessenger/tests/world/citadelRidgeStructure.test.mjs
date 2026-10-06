import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shapeMountainLandform,ridgeHeight,landformWeight,landformProtection} from '../../src/world/citadel/mountainLandform.js';
function scene(){const c=new THREE.Group(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-34,31,-30,-25,31,-30,-30,25,-20],3));const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.name='citadel-oskar-grid-mountain-surface';c.add(m);c.updateMatrixWorld(true);return {c,m,g};}
test('ridge graph forms a saddle between connected high masses, not a zero-height gap',()=>{
 const h=ridgeHeight(-49,-35);assert.ok(h>20&&h<32);
 assert.ok(ridgeHeight(-72,-39)>h);
 // The former secondary spike is now a lower shoulder above the middle bay saddle.
 const shoulder=ridgeHeight(-28,-29);assert.ok(shoulder>ridgeHeight(-2.7,-18.8)&&shoulder<20);
 assert.equal(landformWeight(0,2,20),0);
});
test('protected source and destination keep terrain fixed; source snapshot stays unchanged',()=>{
 const {c,m,g}=scene(),source=[...g.attributes.position.array];
 const box=new THREE.Box3(new THREE.Vector3(-50,0,-50),new THREE.Vector3(0,50,0));
 const result=shapeMountainLandform(c,{protectedBoxes:[box]});assert.equal(result.changed,0);assert.deepEqual([...g.attributes.position.array],source);assert.notEqual(m.geometry,g);
});
test('oriented foundation bounds work on rotated worlds without freezing distant bare ridges',()=>{
 const c=new THREE.Group();c.rotation.set(.5,.8,.2);const m=new THREE.Mesh(new THREE.BoxGeometry(12,1,2));m.name='harbor-deck';c.add(m);c.updateMatrixWorld(true);
 const [b]=landformProtection(c);assert.equal(b.distanceToPoint(c.localToWorld(new THREE.Vector3(0,0,0))),0);
 assert.ok(b.distanceToPoint(c.localToWorld(new THREE.Vector3(0,0,10)))>8.9);
});

test('rail safety margin and authored sea-skirt bottoms remain immobile',()=>{
 const {c,m}=scene();assert.equal(shapeMountainLandform(c,{rail:[new THREE.Vector3(-30,28,-27)]}).changed,0);
 const other=scene();other.g.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute([1,1,1],1));
 assert.equal(shapeMountainLandform(other.c).changed,0);
});
