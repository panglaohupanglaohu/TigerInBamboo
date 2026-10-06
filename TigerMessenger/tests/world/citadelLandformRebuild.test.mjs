import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {shapeMountainLandform,ridgeHeight} from '../../src/world/citadel/mountainLandform.js';
import {buildNewCityBackdrop} from '../../src/world/citadel/newCityBackdrop.js';
const make=()=>{const castle=new THREE.Group(),g=new THREE.PlaneGeometry(180,80,18,8);g.rotateX(-Math.PI/2);g.translate(-15,20,-25);const mesh=new THREE.Mesh(g);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);return {castle,mesh};};
test('massif rebuild is finite, idempotent, preserves protected samples and fixed coast',()=>{
 const {castle,mesh}=make(),box=new THREE.Box3(new THREE.Vector3(-76,10,-51),new THREE.Vector3(-54,50,-29)),rail=[new THREE.Vector3(15,20,-25)];
 const source=mesh.geometry.attributes.position.clone(),boundary=new Float32Array(source.count);
 for(let i=0;i<source.count;i++)if(source.getZ(i)>10)boundary[i]=1;
 mesh.geometry.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute(boundary,1));
 const report=shapeMountainLandform(castle,{rail,protectedBoxes:[box]});assert.ok(report.changed>0);assert.ok(report.protectedVertices>0);
 const output=mesh.geometry.attributes.position,array=Float32Array.from(output.array);
 for(const n of array)assert.ok(Number.isFinite(n));
 const outputSet=new Set();for(let i=0;i<output.count;i++)outputSet.add([output.getX(i),output.getY(i),output.getZ(i)].map(v=>v.toFixed(4)).join(','));
 for(let i=0;i<source.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(source,i);
  if(box.distanceToPoint(p)<=3||p.distanceTo(rail[0])<20||boundary[i])assert.ok(outputSet.has(p.toArray().map(v=>v.toFixed(4)).join(',')),`fixed ${i}`);
 }
 shapeMountainLandform(castle,{rail,protectedBoxes:[box]});assert.deepEqual(mesh.geometry.attributes.position.array,array);
 assert.ok(ridgeHeight(-73,-41)>ridgeHeight(-5,-34)+10);
});
test('legacy flag selects prior branch and backdrop remains finite with stable footprint',()=>{
 const previous=globalThis.location;globalThis.location={search:'?citadelLandform=0'};
 const old=make();assert.equal(shapeMountainLandform(old.castle).version,1);const a=buildNewCityBackdrop();
 globalThis.location={search:''};const b=buildNewCityBackdrop();
 for(let k=0;k<a.children.length;k++){
  const oldMesh=a.children[k],newMesh=b.children[k];if(oldMesh.isInstancedMesh)continue;
  const p=oldMesh.geometry.attributes.position,q=newMesh.geometry.attributes.position;assert.equal(p.count,q.count);let changes=0;
  for(let i=0;i<p.count;i++){assert.equal(p.getX(i),q.getX(i));assert.equal(p.getZ(i),q.getZ(i));assert.ok(Number.isFinite(q.getY(i)));if(p.getY(i)!==q.getY(i))changes++;}
  assert.ok(changes>0);
 }
 globalThis.location=previous;
});
test('descending shoulder uses a safe partial move instead of freezing an outside vertex',()=>{
 const castle=new THREE.Group(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-3,20,-19,-2,20,-19,-3,20,-18],3));
 const mesh=new THREE.Mesh(g);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);
 const box=new THREE.Box3(new THREE.Vector3(-5,0,-22),new THREE.Vector3(0,7,-16));
 const report=shapeMountainLandform(castle,{protectedBoxes:[box]});assert.ok(report.partial>0);assert.equal(report.blockedBox,0);
 const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(p.getY(i)<20);assert.ok(p.getY(i)>=10);assert.ok(box.distanceToPoint(new THREE.Vector3().fromBufferAttribute(p,i))>=3);}
});
