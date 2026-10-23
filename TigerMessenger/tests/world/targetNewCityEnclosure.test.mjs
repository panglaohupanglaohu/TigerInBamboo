import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetNewCityMain} from '../../src/world/citadel/targetNewCityMain.js';
const build=(opts={})=>createTargetNewCityMain({layout:'walled-court-1',proportion:'expanded-1',courtyardSurfaceHeightAt:()=>-.12,...opts});

test('new layout retains ten identities, dome and entry, adding tapered towers and real gates',()=>{
 const a=build(),r=a.report;a.group.updateMatrixWorld(true);
 assert.equal(r.layout,'walled-court-1');assert.equal(r.courtyard.homes.length,10);assert.equal(r.enclosure.towers.length,4);assert.equal(r.enclosure.gates.length,3);assert.equal(r.enclosure.closedSides,true);
 assert.deepEqual(r.entry.position,[0,1.2,7.370000000000001]);assert.ok(Math.abs(r.bounds.max[1]-29.16)<.1);
 for(const gate of r.enclosure.gates){
  const direction=new T.Vector3(Math.sin(gate.yaw),0,Math.cos(gate.yaw)),side=new T.Vector3(Math.cos(gate.yaw),0,-Math.sin(gate.yaw));
  for(const dx of[-1.7,0,1.7]){const p=new T.Vector3(...gate.center).addScaledVector(side,dx).add(new T.Vector3(0,1.5,0)).addScaledVector(direction,1.5);const ray=new T.Raycaster(p,direction.clone().negate(),0,3);assert.equal(ray.intersectObject(a.group,true).filter(h=>h.object.name===gate.id).length,0);}
  const p=new T.Vector3(...gate.center).addScaledVector(side,2.8).add(new T.Vector3(0,1.5,0)).addScaledVector(direction,1.5);assert.ok(new T.Raycaster(p,direction.clone().negate(),0,3).intersectObject(a.group,true).some(h=>h.object.name===gate.id));
 }
 assert.ok(r.enclosure.walls.every(w=>w.support.every(s=>w.bottom<s.y)));a.dispose();
});

test('real ring floor preserves two supported return paths and excludes fountain center',()=>{
 const a=build(),r=a.report.enclosure,surfaces=[];a.group.updateMatrixWorld(true);a.group.traverse(o=>{if(o.isMesh&&o.userData.newCityPublicWalkable)surfaces.push(o);});
 assert.equal(r.fountain.built,true);assert.ok(r.fountain.sideClearance>=1.8);assert.equal(r.rearExitConnected,true);assert.equal(a.report.courtyard.rearCourt.clearAxis,false);
 const [x,y,z]=r.fountain.center;assert.ok(Math.abs(z+15.51)<1e-5);const ray=new T.Raycaster(new T.Vector3(x,y+.2,z),new T.Vector3(0,-1,0),0,1);assert.equal(ray.intersectObjects(surfaces,false).length,0,'water basin must not retain hidden floor collider');
 let samples=0;for(const route of r.publicRoutes)for(let i=1;i<route.length;i++){
  const A=new T.Vector3(...route[i-1]),B=new T.Vector3(...route[i]),n=Math.ceil(A.distanceTo(B)/.2);
  for(let j=0;j<=n;j++)for(const offset of[-.8,0,.8]){const lateral=B.clone().sub(A).cross(new T.Vector3(0,1,0)).normalize();const p=A.clone().lerp(B,j/n).addScaledVector(lateral,offset);const hits=new T.Raycaster(p.add(new T.Vector3(0,.05,0)),new T.Vector3(0,-1,0),0,.1).intersectObjects(surfaces,false);assert.ok(hits.length,'actual bypass support with lateral foot margin');samples++;}
 }
 assert.ok(samples>80);a.dispose();
});

test('missing or steep terrain refuses walls rather than unsupported foundations',()=>{
 const a=build({courtyardSurfaceHeightAt:(x,z)=>Math.abs(x)>22?null:-.12});assert.ok(a.report.enclosure.rejected.length);assert.equal(a.report.enclosure.closedSides,false);assert.ok(a.report.enclosure.rejected.some(r=>r.reason==='missing-actual-ground'));a.dispose();
 const b=build({courtyardSurfaceHeightAt:(x,z)=>x*3});assert.ok(b.report.enclosure.rejected.some(r=>r.reason==='steep-actual-ground'));b.dispose();
});

test('new owned geometry and materials release exactly once; legacy stays default',()=>{
 const a=build(),geos=new Set(),mats=new Set();a.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);mats.add(o.material);}});let ng=0,nm=0;geos.forEach(g=>g.addEventListener('dispose',()=>ng++));mats.forEach(m=>m.addEventListener('dispose',()=>nm++));a.dispose();a.dispose();assert.equal(ng,geos.size);assert.equal(nm,mats.size);
 const old=createTargetNewCityMain();assert.equal(old.report.layout,'legacy');assert.equal(old.report.enclosure,null);assert.equal(old.report.courtyard.rearCourt.clearAxis,true);old.dispose();
});

import {createTargetNewCityPlacement} from '../../src/world/citadel/targetNewCityPlacement.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
function radialTerrainScene() {
  const scene = new T.Group(), castle = new T.Group(); scene.add(castle);
  castle.matrixAutoUpdate = false;
  castle.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
  const source = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial({side: T.DoubleSide}));
  source.name = 'citadel-oskar-grid-mountain-surface'; castle.add(source);
  const previous = globalThis.location;
  globalThis.location = {search: '?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
  try {const obsolete = source.geometry; applyTargetTerrainCandidate(castle); obsolete.dispose();}
  finally {if (previous === undefined) delete globalThis.location; else globalThis.location = previous;}
  const compiled = compileOfficialOcean().ocean, geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(compiled.positions, 3));
  geometry.setIndex(new T.BufferAttribute(compiled.indices, 1)); geometry.computeVertexNormals();
  const ocean = new T.Mesh(geometry, new T.MeshBasicMaterial({side: T.DoubleSide})); ocean.name = 'planet-v8-curved-ocean'; scene.add(ocean);
  const originalBuilding = new T.Group(); originalBuilding.name = 'old-city-preserved'; castle.add(originalBuilding);
  scene.updateMatrixWorld(true);
  return {scene, castle, source, ocean, originalBuilding, dispose() {for (const m of [source, ocean]) {m.geometry.dispose(); m.material.dispose();}}};
}

test('actual radial terrain supports the proposed enclosure and fountain court',()=>{
 const f=radialTerrainScene(),placement=createTargetNewCityPlacement(f.castle.matrixWorld),world=f.castle.matrixWorld.clone().multiply(placement.matrix),inverse=world.clone().invert(),index=buildMountainSurfaceIndex([f.source]),down=new T.Vector3(0,-1,0).transformDirection(world);
 const sample=(x,z)=>{const hit=index.sample(new T.Ray(new T.Vector3(x,180,z).applyMatrix4(world),down),0,400);return hit?hit.point.clone().applyMatrix4(inverse).y:null;};
 const a=build({courtyardSurfaceHeightAt:sample});console.log('actual enclosure',JSON.stringify({homes:a.report.courtyard.homes.length,walls:a.report.enclosure.walls.length,towers:a.report.enclosure.towers.length,gates:a.report.enclosure.gates.length,rejected:a.report.enclosure.rejected.map(r=>[r.id,r.reason]),fountain:a.report.enclosure.fountain}));
 assert.equal(a.report.courtyard.homes.length,10);assert.equal(a.report.enclosure.fountain.built,true);
 assert.equal(a.report.enclosure.closedSides,true,'actual approved wall path must be fully supported');a.dispose();f.dispose();
});


test('rearranged homes do not collide with each other, the nave, walls or towers',()=>{
 const a=build(),homes=a.report.footprints.filter(f=>f.courtyard),all=a.report.footprints.filter(f=>f.courtyard||f.enclosure||/^(main-hall$|blue-tower-[-1]|cream-wing-)/.test(f.id));
 const bounds=f=>({x:f.polygon.map(p=>p[0]),z:f.polygon.map(p=>p[1])});
 for(const h of homes)for(const other of all){if(h===other)continue;const A=bounds(h),B=bounds(other),dx=Math.min(Math.max(...A.x),Math.max(...B.x))-Math.max(Math.min(...A.x),Math.min(...B.x)),dz=Math.min(Math.max(...A.z),Math.max(...B.z))-Math.max(Math.min(...A.z),Math.min(...B.z));assert.ok(dx<=.001||dz<=.001,h.id+' overlaps '+other.id);}
 a.dispose();
});

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('legacy factory is byte-equivalent to this change source-before for all geometry and window modes',async()=>{
 let source=readFileSync(new URL('../../artifacts/pipeline/new-city-walled-layout-20261007/source-before/targetNewCityMain.js',import.meta.url),'utf8');
 source=source.replace(/from 'three'/g,`from '${import.meta.resolve('three')}'`).replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL('../../src/world/citadel/'+p.slice(2),import.meta.url).href}'`);
 const before=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createTargetNewCityMain;
 const fingerprint=a=>{const h=createHash('sha256');a.group.updateMatrixWorld(true);a.group.traverse(o=>{if(!o.isMesh)return;h.update(o.name);h.update(JSON.stringify(o.matrixWorld.elements));for(const[k,v]of Object.entries(o.geometry.attributes)){h.update(k);h.update(Buffer.from(v.array.buffer,v.array.byteOffset,v.array.byteLength));}if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));h.update(o.material.color.getHexString());});return h.digest('hex');};
 for(const proportion of['original','expanded-1'])for(const batchWindowDetails of[false,true]){const a=before({proportion,batchWindowDetails}),b=createTargetNewCityMain({proportion,batchWindowDetails});assert.equal(fingerprint(a),fingerprint(b));assert.deepEqual(a.report.footprints,b.report.footprints);a.dispose();b.dispose();}
});
