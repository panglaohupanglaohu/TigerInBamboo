import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTargetNewCityMain,createTargetNewCityApproachSampler } from '../../src/world/citadel/targetNewCityMain.js';

test('new-city main has bounded finite real geometry and target dome height', () => {
  const asset = createTargetNewCityMain({ seed: 194 });
  const { group, report } = asset;
  assert.ok(report.bounds.size[0] <= 32);
  assert.ok(report.bounds.size[2] <= 26);
  assert.ok(Math.abs(report.bounds.max[1] - 24.5) < 1e-5);
  assert.ok(report.performance.triangles < 25000);
  assert.equal(report.validation.gpuIntegrated, false);
  assert.equal(report.validation.visualScore, null);
  group.traverse(o => {
    if (!o.isMesh) return;
    assert.ok(o.material.isMeshStandardMaterial);
    assert.equal(o.userData.preserveCitadelMaterials, true);
    for (const attr of Object.values(o.geometry.attributes)) for (const n of attr.array) assert.ok(Number.isFinite(n), o.name);
    o.geometry.computeBoundingSphere(); assert.ok(Number.isFinite(o.geometry.boundingSphere.radius));
  });
  assert.equal(group.children.filter(o => o.name.startsWith('blue-dome-panel-')).length, 16);
  assert.ok(report.footprints.some(f => f.opening));
  asset.dispose();
});

test('actual entry and rear arch leave a traversable nave, including near its sides', () => {
  const asset = createTargetNewCityMain();
  const { group } = asset; group.updateMatrixWorld(true);
  // Test both sides of every triangle; one-sided materials cannot conceal a plug.
  group.traverse(o => { if (o.isMesh) o.material.side = THREE.DoubleSide; });
  for (const x of [-1.85, -1, 0, 1, 1.85]) for (const y of [1.3, 2, 3, 4.35]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 13.1), new THREE.Vector3(0, 0, -1), 0, 21.2);
    const hits = ray.intersectObject(group, true);
    assert.deepEqual(hits.map(h => h.object.name), [], `blocked corridor at x=${x}, y=${y}`);
  }
  // Rays on the jambs must hit actual masonry, so an absent facade cannot pass.
  for (const x of [-2.8, 2.8]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 3, 8), new THREE.Vector3(0, 0, -1), 0, 3);
    assert.ok(ray.intersectObject(group, true).some(h => h.object.name === 'main-entry-real-arch'));
  }
  // Stair tread centres are monotonically connected to the threshold elevation.
  const ys = [];
  for (const z of [12.3, 11, 9.7, 8.4, 7.1, 6.1]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, z), new THREE.Vector3(0, -1, 0), 0, 3);
    const hit = ray.intersectObject(group, true)[0]; assert.ok(hit); ys.push(hit.point.y);
  }
  for (let i = 1; i < ys.length; i++) { assert.ok(ys[i] >= ys[i - 1] - 1e-5); assert.ok(ys[i] - ys[i - 1] <= .301); }
  assert.ok(Math.abs(ys.at(-1) - 1.2) < 1e-5);
  asset.dispose();
});

test('every owned geometry/material disposes exactly once and detaches only this asset', () => {
  const asset = createTargetNewCityMain(), parent = new THREE.Group(), sibling = new THREE.Group();
  parent.add(asset.group, sibling);
  const geometries = new Set(), materials = new Set();
  asset.group.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
  let gd = 0, md = 0;
  for (const g of geometries) g.addEventListener('dispose', () => gd++);
  for (const m of materials) m.addEventListener('dispose', () => md++);
  asset.dispose(); asset.dispose();
  assert.equal(gd, geometries.size); assert.equal(md, materials.size);
  assert.deepEqual(parent.children, [sibling]); assert.equal(asset.group.children.length, 0);
});

test('v2 expanded front and rear arches match masonry, voussoirs and reported opening without raising the hall',()=>{
 const a=createTargetNewCityMain(),g=a.group;g.traverse(o=>{if(o.isMesh)o.material.side=THREE.DoubleSide;});g.updateMatrixWorld(true);const opening=a.report.footprints.find(f=>f.id==='main-hall').opening;
 assert.deepEqual(opening,{minX:-2.5,maxX:2.5,floorY:1.2,springY:6.3,crownY:8.8,frontZ:6.65,rearZ:-7.8});assert.equal(a.report.entry.clearWidth,5);assert.equal(a.report.entry.clearHeightAtCentre,7.6);assert.equal(a.report.passage.rectangularClearHeight,5.1);
 const probes=[];for(const x of[-2.47,-2.35,-1,0,1,2.35,2.47])for(const y of[1.3,3,5.5,6.25])probes.push([x,y]);probes.push([0,8.75],[-1,8.5],[1,8.5],[-2,7.7],[2,7.7]);
 for(const[x,y]of probes)for(const dir of[-1,1]){const ray=new THREE.Raycaster(new THREE.Vector3(x,y,dir<0?7:-8.1),new THREE.Vector3(0,0,dir),0,15.2);assert.deepEqual(ray.intersectObject(g,true).map(h=>h.object.name),[],`${x}/${y}/${dir} arch trim or rear plug`);}
 for(const dir of[-1,1])for(const[x,y]of[[2.6,4],[-2.6,4],[0,8.95],[1.9,8.3]]){const ray=new THREE.Raycaster(new THREE.Vector3(x,y,dir<0?7:-8.1),new THREE.Vector3(0,0,dir),0,2);assert.ok(ray.intersectObject(g,true).some(h=>h.object.name===(dir<0?'main-entry-real-arch':'main-hall-rear-real-arch')));}
 const wall=g.getObjectByName('main-entry-real-arch');wall.geometry.computeBoundingBox();assert.equal(wall.geometry.boundingBox.max.y,Math.fround(11.2));assert.equal(g.children.filter(o=>o.name.startsWith('entry-arch-stone-')).length,17);for(const pier of g.children.filter(o=>o.name==='entry-arch-pier')){const b=new THREE.Box3().setFromObject(pier);assert.ok(Math.min(Math.abs(b.min.x),Math.abs(b.max.x))>=2.5299);assert.ok(Math.abs(b.min.y-1.2)<1e-5&&Math.abs(b.max.y-6.3)<1e-5);}a.dispose();
});

test('v2 keeps r38 footprints, entrance/step endpoints and dome height while using square pale-framed windows',async()=>{
 const fs=await import('node:fs'),prior=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r38-full-wfc-rail-landmarks-new-city-detail-plants-terrain.json',import.meta.url),'utf8')).cityDetail.newCity.geometry,a=createTargetNewCityMain({seed:prior.seed});
 for(const f of a.report.footprints){const {opening,...geometry}=f,{opening:oldOpening,...oldGeometry}=prior.footprints.find(p=>p.id===f.id);assert.deepEqual(geometry,oldGeometry);}
 assert.deepEqual(a.report.stairs,prior.stairs);assert.deepEqual(a.report.entry.position,prior.entry.position);assert.deepEqual(a.report.passage.from,prior.passage.from);assert.deepEqual(a.report.passage.to,prior.passage.to);assert.deepEqual(a.report.bounds,prior.bounds);assert.equal(a.report.version,'target-new-city-main-v2');assert.equal(a.report.palette.blue,'#80c8eb');assert.equal(a.report.palette.blueShade,'#73bee3');
 for(const prefix of['blue-front-','wing-front-','drum-window-'])for(const window of a.group.children.filter(o=>o.isGroup&&o.name.startsWith(prefix))){const pane=window.getObjectByName(window.name+'-recess');assert.ok(pane.geometry.parameters.height/pane.geometry.parameters.width<=1.2);assert.ok(window.getObjectByName(window.name+'-sill'));}a.dispose();
});

test('expanded-1 cuts threshold-crossing faces, preserves step elevations and updates real ports',()=>{
 const a=createTargetNewCityMain({proportion:'expanded-1'}),g=a.group,r=a.report;g.updateMatrixWorld(true);assert.ok(r.scaleContract.splitTriangles>0);assert.equal(r.entry.position[1],1.2);assert.equal(r.stairs.maxRise,.3);assert.ok(Math.abs(r.stairs.bottom[2]-14.75)<1e-10);assert.ok(Math.abs(r.entry.position[2]-7.37)<1e-10);assert.ok(Math.abs(r.bounds.max[1]-(1.2+(24.5-1.2)*1.2))<1e-5);assert.equal(r.entry.clearWidth,5.5);
 g.traverse(o=>{if(!o.isMesh)return;o.material.side=THREE.DoubleSide;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const ys=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(o.matrixWorld).y);assert.ok(!(Math.min(...ys)<1.2-1e-5&&Math.max(...ys)>1.2+1e-5),o.name+' crosses deformation discontinuity');}for(const at of Object.values(o.geometry.attributes))assert.ok([...at.array].every(Number.isFinite));});
 const heights=[];for(const z of[12.3,11,9.7,8.4,7.1,6.1]){const ray=new THREE.Raycaster(new THREE.Vector3(0,2,z*1.1),new THREE.Vector3(0,-1,0),0,3);heights.push(ray.intersectObject(g,true)[0].point.y);}for(let i=0;i<4;i++)assert.ok(Math.abs(heights[i]-(i+1)*.3)<1e-5);assert.ok(Math.abs(heights.at(-1)-1.2)<1e-5);
 for(const x of[-2.45,-1,0,1,2.45])for(const y of[1.3,3,5.5,6.2]){const ray=new THREE.Raycaster(new THREE.Vector3(x*1.1,1.2+(y-1.2)*1.2,7.7),new THREE.Vector3(0,0,-1),0,16.6);assert.equal(ray.intersectObject(g,true).length,0);}
 let disposed=0;const n=g.children.length;g.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposed++);});a.dispose();assert.ok(disposed>n);assert.throws(()=>createTargetNewCityMain({proportion:'unbounded'}),/proportion/);
});

import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetStairSurfaceSampler,createTargetNewCityStairRoute} from '../../src/world/citadel/targetNewCityStairRoute.js';
function frozenScene() {
  const scene = new THREE.Group(), castle = new THREE.Group(); scene.add(castle);
  castle.matrixAutoUpdate = false;
  castle.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
  const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  source.name = 'citadel-oskar-grid-mountain-surface'; castle.add(source);
  const previous = globalThis.location;
  globalThis.location = {search: '?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
  try {const obsolete = source.geometry; applyTargetTerrainCandidate(castle); obsolete.dispose();}
  finally {if (previous === undefined) delete globalThis.location; else globalThis.location = previous;}
  const compiled = compileOfficialOcean().ocean, geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(compiled.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(compiled.indices, 1)); geometry.computeVertexNormals();
  const ocean = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide})); ocean.name = 'planet-v8-curved-ocean'; scene.add(ocean);
  const originalBuilding = new THREE.Group(); originalBuilding.name = 'old-city-preserved'; castle.add(originalBuilding);
  scene.updateMatrixWorld(true);
  return {scene, castle, source, ocean, originalBuilding, dispose() {for (const m of [source, ocean]) {m.geometry.dispose(); m.material.dispose();}}};
}

test('expanded actual footprints retain sampled frozen-r17 support',()=>{const f=frozenScene(),sample=createTargetStairSurfaceSampler(f.castle,[f.source]),a=createTargetNewCityMain({proportion:'expanded-1'}),m=new THREE.Matrix4().makeRotationY(-55*Math.PI/180).setPosition(74,12,33);let probes=0,maxGap=-Infinity;for(const foot of a.report.footprints.filter(f=>f.support||(!f.elevated&&!f.supportedBy&&f.floorY<=.01))){const xs=foot.polygon.map(p=>p[0]),zs=foot.polygon.map(p=>p[1]);for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){const p=new THREE.Vector3(THREE.MathUtils.lerp(Math.min(...xs),Math.max(...xs),i/8),foot.floorY,THREE.MathUtils.lerp(Math.min(...zs),Math.max(...zs),j/8)).applyMatrix4(m),hit=sample(p.x,p.z);assert.ok(hit);const gap=p.y-hit.height;assert.ok(gap<=.3&&gap>=-.35);maxGap=Math.max(maxGap,gap);probes++;}}assert.equal(probes,891);console.log({expandedSupportProbes:probes,maxGap,entry:a.report.entry.position,approach:a.report.stairs.bottom});a.dispose();f.dispose();});

test('expanded landing and real four-step path pass unchanged transverse .3 and vertical .42 gates',()=>{
 const f=frozenScene(),a=createTargetNewCityMain({proportion:'expanded-1'});a.group.position.set(74,12,33);a.group.rotation.y=-55*Math.PI/180;f.castle.add(a.group);f.scene.updateMatrixWorld(true);const matrix=a.group.matrix.clone(),convert=p=>new THREE.Vector3(...p).applyMatrix4(matrix),terrainSample=createTargetStairSurfaceSampler(f.castle,[f.source]),start=convert(a.report.stairs.bottom).toArray(),approach=createTargetNewCityApproachSampler({main:a,sampleTerrain:terrainSample}),route=createTargetNewCityStairRoute({sampleSurface:approach.sampleSurface,start,terminalAccess:{from:[72,68],width:2.4}});assert.ok(route.report.selected);f.castle.add(route.group);const surfaces=[f.source];a.group.traverse(o=>{if(o.isMesh&&/^(entrance-stair-|entrance-landing)/.test(o.name))surfaces.push(o);});route.group.traverse(o=>{if(o.isMesh&&/^surveyed-route-(tread-|entry|turn-platform)/.test(o.name))surfaces.push(o);});const sample=createTargetStairSurfaceSampler(f.castle,surfaces),path=[...route.report.selected.walkPath.slice().reverse().map(p=>new THREE.Vector3(...p)),...a.report.stairs.walkPath.map(convert)];let maxTransverse=0,maxVertical=0;for(let i=1;i<path.length;i++){const p=path[i-1],q=path[i],dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(len/.5));for(let j=0;j<=steps;j++){const v=p.clone().lerp(q,j/steps),ys=[-.45,0,.45].map(side=>sample(v.x-dz/(len||1)*side,v.z+dx/(len||1)*side)?.height);assert.ok(ys.every(Number.isFinite));const transverse=Math.max(...ys)-Math.min(...ys),vertical=Math.abs(Math.max(...ys)-v.y);maxTransverse=Math.max(maxTransverse,transverse);maxVertical=Math.max(maxVertical,vertical);assert.ok(transverse<=.3,JSON.stringify({v,ys,transverse}));assert.ok(vertical<=.42,JSON.stringify({v,ys,vertical}));}}console.log({expandedJointStart:start,maxTransverse,maxVertical});approach.dispose();route.dispose();a.dispose();f.dispose();
});
