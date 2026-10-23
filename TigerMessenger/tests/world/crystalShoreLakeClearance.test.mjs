import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {clipCrystalShoreFromLake} from '../../src/world/clipCrystalShoreFromLake.js';
const swamp=new T.Group();swamp.userData.inner=swamp;
const make=vertices=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(vertices.map((_,i)=>i%3===0?1:0),3));return g;};
test('outside shore triangles retain the original geometry; wholly intruding faces are subtracted',()=>{
 const outside=make([80,30,0,80,31,0,80,30,1]),a=clipCrystalShoreFromLake(outside,swamp);assert.equal(a.geometry,outside);assert.equal(a.changed,false);
 const inside=make([0,30,0,1,30,0,0,30,1]),b=clipCrystalShoreFromLake(inside,swamp);assert.equal(b.changed,true);assert.equal(b.geometry.attributes.position.count,0);assert.equal(b.removedTriangles,1);
});
test('crossing triangles are clipped at the lake wall, not discarded wholesale, preserving colour interpolation',()=>{
 const g=make([20,30,0,40,30,0,40,30,3]),cut=clipCrystalShoreFromLake(g,swamp);assert.equal(cut.changed,true);assert.ok(cut.geometry.attributes.position.count>=3);
 const p=cut.geometry.attributes.position,c=cut.geometry.attributes.color;
 for(let i=0;i<p.count;i++){assert.ok(Math.hypot(p.getX(i),p.getZ(i))>=28.19);assert.ok(c.getX(i)===1&&c.getY(i)===0&&c.getZ(i)===0);}
 assert.deepEqual(Array.from(g.attributes.position.array),[20,30,0,40,30,0,40,30,3]);
});
test('clipping respects the actual spherical placement matrix and leaves above-rim surfaces intact',()=>{
 swamp.position.set(20,60,-30);swamp.scale.setScalar(.5);swamp.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),.8);swamp.updateMatrixWorld(true);
 const transform=a=>new T.Vector3(...a).applyMatrix4(swamp.matrixWorld).toArray(),g=make([[0,30,0],[1,30,0],[0,30,1]].flatMap(transform));assert.equal(clipCrystalShoreFromLake(g,swamp).geometry.attributes.position.count,0);
 const high=make([[0,50,0],[1,50,0],[0,50,1]].flatMap(transform));assert.equal(clipCrystalShoreFromLake(high,swamp).geometry,high);
});
