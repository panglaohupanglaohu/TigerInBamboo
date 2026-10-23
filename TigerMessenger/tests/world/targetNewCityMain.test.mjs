import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetNewCityPlacement} from '../../src/world/citadel/targetNewCityPlacement.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import { createTargetNewCityMain } from '../../src/world/citadel/targetNewCityMain.js';

test('new-city main has bounded finite real geometry and target dome height', () => {
  const asset = createTargetNewCityMain({ seed: 194 });
  const { group, report } = asset;
  assert.ok(report.bounds.size[0] <= 44, 'ten surrounding homes remain within the 44m court envelope');
  assert.ok(report.bounds.size[2] <= 34);
  assert.equal(report.courtyard.homes.length,10);
  assert.equal(report.courtyard.rearCourt.built,true);
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

test('courtyard extension retains r38 core footprints, entry/steps and dome height with real open rear court',async()=>{
 const fs=await import('node:fs'),prior=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r38-full-wfc-rail-landmarks-new-city-detail-plants-terrain.json',import.meta.url),'utf8')).cityDetail.newCity.geometry,a=createTargetNewCityMain({seed:prior.seed});
 for(const old of prior.footprints){const f=a.report.footprints.find(p=>p.id===old.id);assert.ok(f,'preserved core '+old.id);const {opening,...geometry}=f,{opening:oldOpening,...oldGeometry}=old;assert.deepEqual(geometry,oldGeometry);}assert.equal(a.report.footprints.filter(f=>f.courtyard).length,10);assert.ok(a.report.footprints.find(f=>f.id==='rear-court-stone-floor').walkable);
 assert.deepEqual(a.report.stairs,prior.stairs);assert.deepEqual(a.report.entry.position,prior.entry.position);assert.deepEqual(a.report.passage.from,prior.passage.from);assert.deepEqual(a.report.passage.to,prior.passage.to);assert.ok(Math.abs(a.report.bounds.max[1]-prior.bounds.max[1])<1e-6);assert.equal(a.report.version,'target-new-city-main-v2');assert.equal(a.report.palette.blue,'#80c8eb');assert.equal(a.report.palette.blueShade,'#73bee3');
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
function radialTerrainScene() {
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

function radialAsset(f){
 const placement=createTargetNewCityPlacement(f.castle.matrixWorld),world=f.castle.matrixWorld.clone().multiply(placement.matrix),inverse=world.clone().invert(),index=buildMountainSurfaceIndex([f.source]),down=new THREE.Vector3(0,-1,0).transformDirection(world);
 const sample=(x,z)=>{const hit=index.sample(new THREE.Ray(new THREE.Vector3(x,180,z).applyMatrix4(world),down),0,400);return hit?hit.point.clone().applyMatrix4(inverse).y:null;};
 const asset=createTargetNewCityMain({proportion:'expanded-1',courtyardSurfaceHeightAt:sample});placement.matrix.decompose(asset.group.position,asset.group.quaternion,asset.group.scale);f.castle.add(asset.group);f.scene.updateMatrixWorld(true);return{asset,placement,world,sample};
}

test('radial surrounding houses and rear court have actual terrain seated foundations',()=>{
 const f=radialTerrainScene(),{asset:a,world,sample}=radialAsset(f);let probes=0,foundationRays=0;
 assert.equal(a.report.courtyard.homes.length,10);assert.equal(a.report.courtyard.rearCourt.built,true);
 for(const foot of a.report.footprints.filter(p=>p.courtyard||p.id==='rear-court-stone-floor')){
  const centre=foot.polygon.reduce((p,q)=>[p[0]+q[0]/foot.polygon.length,p[1]+q[1]/foot.polygon.length],[0,0]);
  for(const [x,z] of [...foot.polygon,centre]){const y=sample(x,z);assert.ok(Number.isFinite(y),foot.id+' terrain missing');assert.ok(foot.floorY<=y+.03,foot.id+' foundation floats');probes++;}
  const h=a.report.courtyard.homes.find(h=>h.id===foot.id),top=h?.position[1]??a.report.courtyard.rearCourt.top;
  const xs=foot.polygon.map(p=>p[0]),zs=foot.polygon.map(p=>p[1]);
  for(const u of[-.35,0,.35])for(const v of[-.35,0,.35]){const point=new THREE.Vector3(centre[0]+u*(Math.max(...xs)-Math.min(...xs)),top+.01,centre[1]+v*(Math.max(...zs)-Math.min(...zs))).applyMatrix4(world),down=new THREE.Vector3(0,-1,0).transformDirection(world),hits=new THREE.Raycaster(point,down,0,.04).intersectObject(a.group,true);
   assert.ok(hits.some(hit=>hit.object.name===foot.id+'-foundation'||hit.object.name===foot.id),foot.id+' actual foundation top missing');foundationRays++;
  }
 }
 assert.equal(probes,55);assert.equal(foundationRays,99);a.dispose();f.dispose();
});

test('rear court keeps a real open axis and gate, solid side boundaries and supported access steps',()=>{
 const a=createTargetNewCityMain({proportion:'expanded-1',courtyardSurfaceHeightAt:()=>-.12}),g=a.group;g.updateMatrixWorld(true);g.traverse(o=>{if(o.isMesh)o.material.side=THREE.DoubleSide;});
 for(const x of[-.85,0,.85])for(const y of[.6,1.3,1.8]){const ray=new THREE.Raycaster(new THREE.Vector3(x,y,-11.8),new THREE.Vector3(0,0,-1),0,8);assert.deepEqual(ray.intersectObject(g,true).map(h=>h.object.name),[],`rear gate/axis blocked at ${x},${y}`);}
 for(const x of[-2.9,2.9]){const ray=new THREE.Raycaster(new THREE.Vector3(x,.6,-18),new THREE.Vector3(0,0,-1),0,2);assert.ok(ray.intersectObject(g,true).some(h=>h.object.name.startsWith('rear-court-rear-wall')));}
 for(const [x,y,z] of a.report.courtyard.rearCourt.steps){const hit=new THREE.Raycaster(new THREE.Vector3(x,y+.02,z),new THREE.Vector3(0,-1,0),0,.04).intersectObject(g,true)[0];assert.ok(hit?.object.userData.targetWalkable);assert.ok(Math.abs(hit.point.y-y)<1e-5);}
 a.dispose();
});

test('actual radial entrance walk keeps three-foot .3 spread and .42 vertical support gates',()=>{
 const f=radialTerrainScene(),{asset:a,world}=radialAsset(f),surfaces=[f.source];a.group.traverse(o=>{if(o.isMesh&&/^(entrance-stair-|entrance-landing)/.test(o.name))surfaces.push(o);});const index=buildMountainSurfaceIndex(surfaces),path=a.report.stairs.walkPath.map(p=>new THREE.Vector3(...p).applyMatrix4(world));let count=0;
 for(let i=1;i<path.length;i++){const A=path[i-1],B=path[i],n=Math.max(1,Math.ceil(A.distanceTo(B)/.5));for(let k=0;k<=n;k++){const p=A.clone().lerp(B,k/n),up=p.clone().normalize(),side=new THREE.Vector3().crossVectors(B.clone().sub(A),up).normalize(),offsets=[];for(const lateral of[-.45,0,.45]){const q=p.clone().addScaledVector(side,lateral),origin=q.clone().addScaledVector(up,.6),hit=index.sample(new THREE.Ray(origin,up.clone().negate()),0,1.2);assert.ok(hit,'actual foot support missing');offsets.push(hit.point.clone().sub(q).dot(up));count++;}assert.ok(Math.max(...offsets)-Math.min(...offsets)<=.3);assert.ok(offsets.every(y=>Math.abs(y)<=.42));}}
 assert.ok(count>30);a.dispose();f.dispose();
});
