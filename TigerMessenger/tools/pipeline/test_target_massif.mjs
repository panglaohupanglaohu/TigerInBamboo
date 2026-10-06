import assert from 'node:assert/strict';
import {register} from 'node:module';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import('three');
const {ridgeHeight,shapeMountainLandform}=await import('../../src/world/citadel/mountainLandform.js');
globalThis.location={search:'?citadelRidgePass=7'};
// Wide mountain patch with a protected foundation in its center.
const castle=new T.Group(),g=new T.PlaneGeometry(160,70,64,28);g.rotateX(-Math.PI/2);g.translate(-25,10,-32);
const mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);castle.updateMatrixWorld(true);
const box=new T.Box3(new T.Vector3(-43,8,-41),new T.Vector3(-35,13,-33));
const result=shapeMountainLandform(castle,{protectedBoxes:[box]});
assert.equal(result.candidatePass,7);assert.ok(result.targetMacro.changed>100);assert.equal(result.targetMacro.invalidFaces,0);assert.ok(result.protectedVertices>0);
let protectedCount=0;const p=mesh.geometry.attributes.position;
for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);assert.ok(v.toArray().every(Number.isFinite));if(v.x>=-43&&v.x<=-35&&v.z>=-41&&v.z<=-33){assert.equal(v.y,10);protectedCount++;}}
assert.ok(protectedCount>0);
const before=Array.from(p.array);shapeMountainLandform(castle,{protectedBoxes:[box]});assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),before);
assert.ok(ridgeHeight(-73,-39,7)>ridgeHeight(-3,-32,7)+10,'main crest remains higher than connecting saddle');
assert.ok(Math.abs(ridgeHeight(-73,-39,7)-ridgeHeight(-73,-34,7))<1.5,'crest is a broad bench');
console.log(JSON.stringify({pass:true,protectedCount,candidatePass:result.candidatePass,targetMacro:result.targetMacro,repeatDeterministic:true},null,2));
