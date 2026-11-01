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
const topside=new T.Color(0x29434b),red=new T.Color(0x87483b),colors=hull.geometry.attributes.color,positions=hull.geometry.attributes.position;
const checkColors=()=>{ship.updateWorldMatrix(true,true);let error=0,blendCount=0,above=0,below=0,minDelta=Infinity,maxDelta=-Infinity,transition=[];
 for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i),h=height(v),mix=1-T.MathUtils.smoothstep(h.analyticHeight,-.35,.15),expected=topside.clone().lerp(red,mix),actual=new T.Color().fromBufferAttribute(colors,i);error=Math.max(error,Math.abs(actual.r-expected.r),Math.abs(actual.g-expected.g),Math.abs(actual.b-expected.b));if(mix===0)above++;else if(mix===1)below++;else{blendCount++;const delta=h.meshHeight-h.analyticHeight;minDelta=Math.min(minDelta,delta);maxDelta=Math.max(maxDelta,delta);transition.push({index:i,local:v.toArray(),analyticHeight:h.analyticHeight,meshHeight:h.meshHeight,redBlend:mix});}}
 return {error,above,below,blendCount,minTriangleMinusAuthority:minDelta,maxTriangleMinusAuthority:maxDelta,transition};};
const initial=checkColors();assert.ok(initial.error<1e-6&&initial.above>0&&initial.below>0);
const otherMaterials=new Map();root.traverse(o=>{if(o.isMesh&&o!==hull)for(const m of(Array.isArray(o.material)?o.material:[o.material]))otherMaterials.set(m.uuid,{color:m.color?.getHex(),vertexColors:m.vertexColors});});
assert.ok(!otherMaterials.has(hull.material.uuid),'hull clone does not share global iron material');
// Diagnostic late-parent-placement fixture: external placement changes before
// first animation update, as the finalization callback promises to support.
const oldRoot=root.position.clone();root.position.addScaledVector(pose.up,1.25);root.updateWorldMatrix(true,true);const beforeFirst=checkColors();assert.ok(beforeFirst.error>.01);
root.userData.update(.1,0);const afterFirst=checkColors();assert.ok(afterFirst.error<1e-6,'first update applies new final parent transform');
const finalizedColors=Array.from(colors.array),snapshots=[];
for(const t of[1,5,10,20]){root.userData.update(.1,t);assert.deepEqual(Array.from(colors.array),finalizedColors,'bob does not repaint per-frame');snapshots.push({t,paletteMismatchFromBob:checkColors().error});}
let unchangedMaterials=0;root.traverse(o=>{if(o.isMesh&&o!==hull)for(const m of(Array.isArray(o.material)?o.material:[o.material])){const before=otherMaterials.get(m.uuid);assert.equal(m.color?.getHex(),before.color);assert.equal(m.vertexColors,before.vertexColors);unchangedMaterials++;}});
// Further parent movement after finalization intentionally is not supported by
// a one-shot palette. Measure rather than implying it automatically follows.
root.position.addScaledVector(pose.up,1.25);root.updateWorldMatrix(true,true);const afterLaterPlacement=checkColors();
console.log(JSON.stringify({authority:'runtime official compileOfficialOcean triangle shell; officialOceanLevelAt continuous sphere/canyon radius',seaLevel:SEA_LEVEL,seaRadius:seaRadius(160),initial,lateParentFixture:{translationWorld:1.25,beforeFirstError:beforeFirst.error,afterFirstError:afterFirst.error,afterLaterPlacementError:afterLaterPlacement.error,scope:'placement BEFORE first update supported; AFTER first update not automatically repainted'},unchangedMaterials,snapshots,GPU:'not checked; no source changes'},null,2));
