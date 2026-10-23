import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as T from 'three';
import {buildHumanCourier} from '../../src/assets/characters/humanCourier.js';
const baseline=JSON.parse(fs.readFileSync(new URL('../fixtures/courierHeadV5Unchanged.json',import.meta.url)));
const root=buildHumanCourier(),u=root.userData;root.updateMatrixWorld(true);
test('head refinement preserves every non-head geometry and rig transform',()=>{
 const rig={},meshes=[];for(const key of Object.keys(baseline.rig))rig[key]={position:u[key].position.toArray(),scale:u[key].scale.toArray(),rotation:u[key].rotation.toArray()};assert.deepEqual(JSON.parse(JSON.stringify(rig)),baseline.rig);
 root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===u.head)return;const hash=crypto.createHash('sha256');for(const a of Object.values(o.geometry.attributes))hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(o.geometry.index)hash.update(new Uint8Array(o.geometry.index.array.buffer));meshes.push({name:o.name,hash:hash.digest('hex'),matrix:o.matrixWorld.toArray()});});
 assert.deepEqual(meshes.map(m=>({name:m.name,hash:m.hash})),baseline.meshes.map(m=>({name:m.name,hash:m.hash})));
 for(let i=0;i<meshes.length;i++)for(let j=0;j<16;j++)assert.ok(Math.abs(meshes[i].matrix[j]-baseline.meshes[i].matrix[j])<1e-7,'unchanged body fit and bone placement');
});
test('small side eyes remain on the real face surface after merging',()=>{
 const surfaces=[];u.head.traverse(o=>{if(o.isMesh&&!o.userData.isOutline)surfaces.push(o);});const ink=new T.Color(u.palette.ink);
 for(const e of u.courierFace.eyeSamples){
  const from=u.head.localToWorld(new T.Vector3(e.x,e.y,.3)),toward=u.head.localToWorld(new T.Vector3(e.x,e.y,0)).sub(from).normalize();
  const hits=new T.Raycaster(from,toward,0,1).intersectObjects(surfaces,false);assert.ok(hits.length);const hit=hits[0],c=hit.object.geometry.attributes.color,i=hit.face.a;
  assert.ok(Math.abs(c.getX(i)-ink.r)<1e-5&&Math.abs(c.getY(i)-ink.g)<1e-5,'first visible surface is a small pupil');
  const z=u.head.worldToLocal(hit.point.clone()).z;assert.ok(z-e.skinZ>.002&&z-e.skinZ<.005,'eye is seated, not floating or buried');
 }
 assert.equal(u.courierFace.napeRevision,5);assert.equal(u.courierFace.version,6);assert.ok(u.courierFace.browRadius<.0012);
});

test('hair v7 uses only six attached light arcs and preserves the original highest fit datum',()=>{
 assert.equal(u.geometryRevision,'reedbank-hair-7');assert.equal(u.courierHair.napeRevision,5);assert.equal(u.courierHair.crownLocks,9);assert.equal(u.courierHair.surfaceArcs,6);
 const surfaces=[];u.head.traverse(o=>{if(o.isMesh&&!o.userData.isOutline)surfaces.push(o);});let highest=-Infinity;
 for(const mesh of surfaces){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);highest=Math.max(highest,u.head.worldToLocal(v).y);}}
 assert.ok(Math.abs(highest-u.courierHair.highestY)<1e-7);
 const light=new T.Color(u.palette.hairLight);let tested=0;
 const samples=u.courierHair.surfaceSamples;
 for(let i=2;i<samples.length-2;i+=2){
  const a=samples[i],b=samples[i+1];if(!b)continue;assert.ok(Math.abs(a.z-a.skinZ-.0013)<1e-9);
  const x=(a.x+b.x)/2,y=a.y,from=u.head.localToWorld(new T.Vector3(x,y,.4)),toward=u.head.localToWorld(new T.Vector3(x,y,0)).sub(from).normalize();
  const hit=new T.Raycaster(from,toward,0,1).intersectObjects(surfaces,false)[0];if(!hit)continue;
  const c=hit.object.geometry.attributes.color,j=hit.face.a;
  if(Math.abs(c.getX(j)-light.r)<1e-5&&Math.abs(c.getY(j)-light.g)<1e-5){const z=u.head.worldToLocal(hit.point.clone()).z;assert.ok(Math.abs(z-(a.z+b.z)/2)<.00015);tested++;}
 }
 assert.ok(tested>=24,'surface rays actually see the six thin attached arcs');
});
