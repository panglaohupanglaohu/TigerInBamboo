import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,GlobalFonts}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Songti.ttc','Songti SC');
const element=name=>{const c=createCanvas(1024,1024);c.style={};c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;};
globalThis.document={createElement:element,createElementNS:element,getElementById:()=>null,querySelector:()=>null};globalThis.location={search:''};globalThis.window={location,addEventListener(){}};
const {createBookshopFreighterHull,createLeeBaiNameTexture}=await import('../../src/world/bookshopFreighterHull.js');
const {buildBookshopFactoryBase}=await import('../../src/world/bookshopFactoryBase.js');
const {bookshopTownPose}=await import('../../src/world/bookshopTownSite.js');
const {compileOfficialOcean,officialOceanLevelAt}=await import('../../src/world/waterV8/officialOcean.js');
const {seaRadius,SEA_LEVEL}=await import('../../src/world/seaLevel.js');
const {createBufferGeometryFromMesh}=await import('../../src/procgen/three/bufferGeometryAdapter.js');
const oceanCompiled=compileOfficialOcean({radius:160});
const oceanGeometry=new T.BufferGeometry();oceanGeometry.setAttribute('position',new T.BufferAttribute(oceanCompiled.ocean.positions,3));oceanGeometry.setIndex(new T.BufferAttribute(oceanCompiled.ocean.indices,1));oceanGeometry.computeVertexNormals();
const ocean=new T.Mesh(oceanGeometry,new T.MeshBasicMaterial({side:T.DoubleSide}));ocean.updateMatrixWorld();
const root=new T.Group(),pose=bookshopTownPose(160);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);buildBookshopFactoryBase({root,districts:[],R:160,colliders:[]});
const ship=root.getObjectByName('bookshop-steam-parts-freighter'),hull=ship.getObjectByName('freighter-solid-deep-hull');ship.updateWorldMatrix(true,true);
const shell=new T.Mesh(hull.geometry,new T.MeshBasicMaterial());shell.updateMatrixWorld();const ray=new T.Raycaster();
const height=v=>{const w=v.clone().applyMatrix4(ship.matrixWorld),dir=w.clone().normalize();ray.set(dir.clone().multiplyScalar(220),dir.clone().negate());const hit=ray.intersectObject(ocean,false)[0];assert.ok(hit);const analyticRadius=160+officialOceanLevelAt(dir,SEA_LEVEL);return{world:w.toArray(),radius:w.length(),analyticRadius,analyticHeight:w.length()-analyticRadius,meshRadius:hit.point.length(),meshHeight:w.length()-hit.point.length()};};
const surface=(side,y,z)=>{ray.set(new T.Vector3(side*10,y,z),new T.Vector3(-side,0,0));return ray.intersectObject(shell,false)[0]?.point.clone()||null;};
const waterline=[];
for(const side of[-1,1])for(const z of[-7,-6,-4,-2,0,2,4,6,8,9,9.5,10]){
 const samples=[];for(let j=0;j<=136;j++){const y=.02-j*3.42/136,v=surface(side,y,z);if(v)samples.push({v,h:height(v)});}
 const crossings={};for(const kind of['analyticHeight','meshHeight'])for(let j=1;j<samples.length;j++){
  const a=samples[j-1],b=samples[j];if(a.h[kind]*b.h[kind]>0)continue;
  let lo=a.v.y,hi=b.v.y;for(let k=0;k<25;k++){const mid=(lo+hi)/2,v=surface(side,mid,z);if(height(v)[kind]>0)lo=mid;else hi=mid;}
  const y=(lo+hi)/2,v=surface(side,y,z);crossings[kind]={local:v.toArray(),...height(v)};break;
 }
 waterline.push({side,z,crossings});
}
const marks=[];for(const z of[-6,0,6,8,9,9.5])for(const depthRatio of[.46,.49,.52]){const v=surface(1,-3.4*depthRatio,z);if(v)marks.push({z,depthRatio,local:v.toArray(),...height(v)});}
const p=hull.geometry.attributes.position,nose=[];for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);if(v.x===0&&v.z>9.3)nose.push({local:v.toArray(),...height(v)});}
assert.equal(oceanCompiled.radius,seaRadius(160));assert.deepEqual(ship.scale.toArray(),[5,5,5]);
console.log(JSON.stringify({authority:{runtime:'planetV8/runtime.js official ocean branch',source:'waterV8/officialOcean.js compileOfficialOcean / officialOceanLevelAt',seaLevel:SEA_LEVEL,nominalSeaRadius:seaRadius(160),actualOceanTriangles:oceanCompiled.ocean.indices.length/3,waterShaderGeometry:'actual CPU triangle shell; vertex shader radial wave bounded ±0.067 world units, time waves not rasterized'},rootMatrix:root.matrixWorld.toArray(),shipMatrix:ship.matrixWorld.toArray(),waterline,marks,nose,GPU:'not checked; geometry and actual production placement CPU only'},null,2));
