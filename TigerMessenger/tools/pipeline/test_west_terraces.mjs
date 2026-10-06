import assert from 'node:assert/strict';
import {register} from 'node:module';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import('three');
const {replaceWestWallWithTerraces,westTerraceHeight}=await import('../../src/world/citadel/mountainTerraceIntegration.js');
const {buildWestMassifGeometry}=await import('../../src/world/citadel/westMassifBlender.js');
for(const y of [-5,0,4,11,14,20,23,31])assert.ok(Math.abs(westTerraceHeight(y+1e-7)-westTerraceHeight(y-1e-7))<1e-5,'continuous at '+y);
assert.ok(westTerraceHeight(10)-westTerraceHeight(5)<.3);
const castle=new T.Group(),wall=new T.Mesh(buildWestMassifGeometry(),new T.MeshBasicMaterial());wall.name='highland-ravine-wall-west';castle.add(wall);castle.updateMatrixWorld(true);
globalThis.location={search:''};const original=wall.geometry;assert.equal(replaceWestWallWithTerraces(castle),null);assert.equal(wall.geometry,original);
globalThis.location={search:'?citadelBroadTerraces=1&citadelTerrainFirst=1'};
const r=replaceWestWallWithTerraces(castle);assert.ok(r.changed>100);assert.equal(r.invalidFaces,0);assert.equal(r.terrainFirst,true);
const p=wall.geometry.attributes.position;assert.ok(Array.from(p.array).every(Number.isFinite));
const originalFoot=new Set();for(let i=0;i<original.attributes.position.count;i++){const q=new T.Vector3().fromBufferAttribute(original.attributes.position,i);if(q.y<=0)originalFoot.add(q.toArray().join(','));}
const newFoot=new Set();for(let i=0;i<p.count;i++){const q=new T.Vector3().fromBufferAttribute(p,i);if(q.y<=0)newFoot.add(q.toArray().join(','));}for(const key of originalFoot)assert.ok(newFoot.has(key),'coast vertex unchanged');
const first=Array.from(p.array);replaceWestWallWithTerraces(castle);assert.deepEqual(Array.from(wall.geometry.attributes.position.array),first);
console.log(JSON.stringify({pass:true,report:r,coastVerticesPreserved:originalFoot.size,repeatDeterministic:true}));
