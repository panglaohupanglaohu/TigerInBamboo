import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createMountainCirculatingCloudBanks} from '../../src/world/citadel/mountainCirculatingCloudBanks.js';
import {canopyClearOfConstraints} from '../../src/world/citadel/mountainCanopyCandidate.js';
function fixture(options={}){const castle=new T.Group();castle.position.y=160;castle.updateMatrixWorld(true);const plane=new T.Plane(new T.Vector3(0,1,0),-160);return{castle,clouds:createMountainCirculatingCloudBanks(castle,{surfaceIndex:{sample(ray){const point=ray.intersectPlane(plane,new T.Vector3());return point?{point}:null;}},sampleSea:()=>0,...options})};}
test('clouds complete front and rear circuits and morph inside their full audited envelope',()=>{
 const {clouds:c}=fixture();assert.equal(c.report.count,6);assert.equal(c.report.routes.length,2);for(const r of c.report.routes){assert.ok(r.frontStationCount>20);assert.ok(r.minimumSampledTerrainClearance>=2-1e-8);assert.ok(r.maximumAltitude<6);}
 const mesh=c.group.children[0],first=[...mesh.geometry.attributes.position.array];c.update(31);assert.notDeepEqual([...mesh.geometry.attributes.position.array],first);
 for(const t of[0,70,140,210,279.99,280]){c.update(t);for(const m of c.group.children){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getX(i))<=7.5);assert.ok(Math.abs(p.getY(i))<=3.6);assert.ok(Math.abs(p.getZ(i))<=4);}}}
 c.update(70);assert.ok(c.group.children[0].position.z>50);c.update(210);assert.ok(c.group.children[0].position.z< -30);c.update(279.999);const before=c.group.children[0].position.clone();c.update(280.001);assert.ok(before.distanceTo(c.group.children[0].position)<.01);c.dispose();
});
test('every motion segment protects solid buildings and rail, not just cloud anchors',()=>{
 const boxes=[new T.Box3(new T.Vector3(-66,160,51),new T.Vector3(-43,174,65))],rail=[new T.Vector3(105,163,64),new T.Vector3(120,163,72)],{castle,clouds:c}=fixture({protectedBoxes:boxes,rail});assert.equal(c.report.routes.length,2);
 for(const route of c.report.routes){const points=route.points.map(p=>new T.Vector3(...p));for(let i=0;i<points.length;i++){const swept=new T.Box3().setFromPoints([points[i],points[(i+1)%points.length]]).expandByVector(new T.Vector3(7.5,3.6,4)).applyMatrix4(castle.matrixWorld);assert.ok(canopyClearOfConstraints(swept,boxes,rail,1.5,6));}}
 c.dispose();
});
test('six solid cloud silhouettes have independent shapes and morph timing',()=>{
 const {clouds:c}=fixture();const signatures=c.group.children.map(m=>Array.from(m.geometry.attributes.position.array).join(','));assert.equal(new Set(signatures).size,6);
 assert.equal(new Set(c.report.banks.map(b=>b.shapeRate)).size,6);assert.equal(new Set(c.report.banks.map(b=>b.shapePhase)).size,6);
 for(const mesh of c.group.children){assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.depthWrite,true);assert.equal(mesh.material.opacity,1);}
 c.update(30);for(let i=0;i<6;i++){const mesh=c.group.children[i];assert.notEqual(Array.from(mesh.geometry.attributes.position.array).join(','),signatures[i]);assert.ok(mesh.geometry.boundingBox.min.y> -1);assert.ok(mesh.geometry.boundingBox.max.y<3.6);}
 c.dispose();
});
