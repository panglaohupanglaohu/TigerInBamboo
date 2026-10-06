import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetCityDetailCandidate, applyTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';

// Reproduce the recorded castle chart and frozen r09 mesh in CPU memory. This
// fixture is not a claim that the live renderer has been inspected this turn.
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

test('assembles true models with final triangle evidence without mutating frozen scene', () => {
  const f = frozenScene(), before = f.source.geometry.attributes.position.array.slice(), beforeChildren = [...f.castle.children];
  const c = createTargetCityDetailCandidate({castle: f.castle});
  assert.equal(c.root.parent, null); assert.deepEqual(f.castle.children, beforeChildren);
  assert.deepEqual(f.source.geometry.attributes.position.array, before);
  const main = c.root.getObjectByName('citadel-target-new-city-main');
  assert.equal(c.report.paletteStudy.version,'target-architecture-colour-1');
  assert.equal(c.report.paletteStudy.old.pink,'#ef958f');
  assert.equal(c.report.paletteStudy.new.blue,'#80c8eb');
  for(const name of ['citadel-target-old-city','citadel-target-new-city-main','citadel-target-new-city-stairs'])c.root.getObjectByName(name).traverse(o=>{if(!o.isMesh)return;const data=o.material.userData.targetArchitectureColour;assert.ok(data,name+' material contract');assert.equal(o.material.color.getHexString(),new THREE.Color(data.albedo).getHexString());});
  assert.deepEqual(main.position.toArray(), [74, 12, 33]); assert.ok(Math.abs(main.rotation.y + 55 * Math.PI / 180) < 1e-12);
  assert.equal(c.report.benchTurf.built,true,c.report.benchTurf.reason);assert.ok(c.report.benchTurf.triangles<=120000);
  assert.equal(c.report.waterfall.built, true); assert.equal(c.report.sourceSurfaces.ocean.name, f.ocean.name);
  assert.equal(c.report.waterfall.surfaceSamplingPassed, true);
  assert.ok(c.report.waterfall.maximumSampledEndpointResidual < 1e-4);
  assert.ok(c.report.waterfall.survey.selected.samples.every(v => v.impactTerrain.height < v.sea.height));
  assert.equal(c.report.validation.collisionVerified, false); assert.equal(c.report.validation.visualAccepted, false);
  assert.ok(c.report.newCity.maximumSampledSupportGap > 0, 'unsolved foundation gaps must remain visible in report');
  c.root.traverse(mesh => {
    if (mesh.geometry?.attributes.position) for (const v of mesh.geometry.attributes.position.array) assert.ok(Number.isFinite(v));
  });
  c.dispose(); f.dispose();
});

test('flow remains aligned with sampled curved ocean after animated updates', () => {
  const f = frozenScene(), c = createTargetCityDetailCandidate({castle: f.castle}); f.castle.add(c.root);
  for (const t of [0, 1.3, 4.2]) {
    c.update(t); f.scene.updateMatrixWorld(true);
    const curtain = c.root.getObjectByName('target-waterfall-aqua-three-stream-curtain');
    const position = curtain.geometry.attributes.position, uv = curtain.geometry.attributes.uv;
    const up = new THREE.Vector3(0, 1, 0).transformDirection(f.castle.matrixWorld), ray = new THREE.Raycaster();
    for (let i = 0; i < position.count; i++) if (uv.getY(i) === 1) {
      const endpoint = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(curtain.matrixWorld);
      ray.set(endpoint.clone().addScaledVector(up, 2), up.clone().negate()); ray.far = 4;
      const sea = ray.intersectObject(f.ocean)[0]; assert.ok(sea); assert.ok(endpoint.distanceTo(sea.point) < 1e-4);
    }
  }
  c.dispose(); f.dispose();
});

test('apply is idempotent and disposal releases only owned resources once', () => {
  const f = frozenScene(), sourceGeometry = f.source.geometry;
  let originalDisposed = 0; sourceGeometry.addEventListener('dispose', () => originalDisposed++);
  const c = applyTargetCityDetailCandidate(f.castle), again = applyTargetCityDetailCandidate(f.castle);
  assert.equal(c, again); assert.equal(c.root.parent, f.castle);
  const geometries = new Set(), materials = new Set();
  c.root.traverse(mesh => {if (mesh.isMesh) {geometries.add(mesh.geometry); materials.add(mesh.material);}});
  let gd = 0, md = 0; for (const g of geometries) g.addEventListener('dispose', () => gd++); for (const m of materials) m.addEventListener('dispose', () => md++);
  c.dispose(); c.dispose(); c.update(10);
  assert.equal(gd, geometries.size); assert.equal(md, materials.size); assert.equal(originalDisposed, 0);
  assert.equal(f.castle.getObjectByName('old-city-preserved'), f.originalBuilding);
  assert.equal(f.source.geometry, sourceGeometry); assert.equal(c.root.children.length, 0); f.dispose();
});

test('missing actual ocean never substitutes a nominal water height', () => {
  const f = frozenScene(); f.ocean.removeFromParent();
  const c = createTargetCityDetailCandidate({castle: f.castle});
  assert.equal(c.report.waterfall.built, false); assert.equal(c.report.waterfall.survey.failures['missing-rendered-ocean'], 1);
  assert.ok(c.root.getObjectByName('citadel-target-new-city-main')); c.dispose(); f.dispose();
  assert.throws(() => createTargetCityDetailCandidate(), TypeError);
});

test('front rail audits actual frozen city surfaces without changing terrain',()=>{const f=frozenScene(),c=createTargetCityDetailCandidate({castle:f.castle,includeFrontRail:true});console.log('FRONT_RAIL_AUDIT',JSON.stringify({status:c.report.frontRail.status,side:c.report.frontRail.sideObstructions,attempts:c.report.frontRail.attempts,failures:c.report.frontRail.failures,audit:c.report.frontRail.audit,supports:c.report.frontRail.supports.length}));assert.equal(c.report.frontRail.accepted,false);assert.equal(c.report.frontRail.tramConnected,false);c.dispose();f.dispose();});


test('integrated roof transaction keeps live candidate ownership and original terrain through solve and rollback',()=>{
 const f=frozenScene(),c=applyTargetCityDetailCandidate(f.castle),before=f.source.geometry.attributes.position.array.slice(),session=c.openRoofSession({targetId:'target-v3-landmarks',terrainVersion:'r17-frozen',factoryVersion:c.report.oldCity.geometry.version}),old=session.currentAsset;
 const result=session.solve({seed:20261006});assert.equal(result.ok,true,JSON.stringify(result));assert.notEqual(session.currentAsset,old);assert.equal(session.currentAsset.group.parent,c.root);assert.equal(old.group.parent,null);assert.equal(c.report.oldCity.geometry,session.currentAsset.report);assert.ok(c.report.forestClearance);assert.deepEqual(f.source.geometry.attributes.position.array,before);
 assert.equal(session.undoRoof().ok,true);assert.equal(session.roofConstraintStatus.source,'authored-or-explicit');assert.equal(session.redoRoof().ok,true);assert.equal(session.roofConstraintStatus.source,'wfc');
 const snapshot=session.exportJSON(),current=session.currentAsset;const fail=session.solve({locks:{'house-0--1-0':'upper-street-cupola','house-0--1-1':'outer-edge-short-tower'}});assert.equal(fail.ok,false);assert.equal(session.currentAsset,current);assert.equal(session.exportJSON(),snapshot);c.dispose();f.dispose();
});

test('cloud refresh rebuilds actual swept field and transfers update/report ownership; rollback retains old bank objects',async()=>{
 const {buildMountainSurfaceIndex}=await import('../../src/world/citadel/mountainSurfaceIndex.js');
 const f=frozenScene(),c=createTargetCityDetailCandidate({castle:f.castle,includeFrontRail:false});f.castle.add(c.root);c.clearForest();f.scene.updateMatrixWorld(true);
 const old=c.root.getObjectByName('target-detail-mountain-cloud-banks'),oldReport=c.report.clouds,oldChildren=[...old.children];old.layers.set(3);old.traverse(o=>{if(o.isMesh)o.layers.set(3);});
 let samples=0;const index=buildMountainSurfaceIndex([f.source]),surfaceIndex={sample(...args){samples++;return index.sample(...args);}},rail=[new THREE.Vector3(1000,1000,1000),new THREE.Vector3(1001,1000,1000)];
 const b=c.prepareCloudRefresh({surfaceIndex,rail});assert.ok(samples>0);assert.equal(c.report.clouds,oldReport);assert.equal(old.parent,c.root);
 c.update(2);const previousTime=oldReport.banks[0].motionEnd.time;b.commit();const current=c.root.getObjectByName('target-detail-mountain-cloud-banks');assert.notEqual(current,old);assert.equal(old.parent,null);assert.equal(current.layers.mask,8);assert.equal(current.children[0].layers.mask,8);assert.equal(c.report.clouds,b.report);
 c.update(7);assert.equal(c.report.clouds.banks[0].motionEnd.time,7);assert.equal(oldReport.banks[0].motionEnd.time,previousTime);
 b.rollback();assert.equal(c.report.clouds,oldReport);assert.equal(old.parent,c.root);assert.deepEqual(old.children,oldChildren);assert.equal(current.parent,null);c.update(11);assert.equal(oldReport.banks[0].motionEnd.time,11);b.rollback();c.dispose();f.dispose();
});

test('uncommitted cloud refresh and committed replacement are reclaimed on candidate teardown; failed preparation preserves live owner',async()=>{
 const {buildMountainSurfaceIndex}=await import('../../src/world/citadel/mountainSurfaceIndex.js');
 const f=frozenScene(),c=createTargetCityDetailCandidate({castle:f.castle,includeFrontRail:false});f.castle.add(c.root);const old=c.report.clouds,index=buildMountainSurfaceIndex([f.source]);
 const rail=[new THREE.Vector3(1000,1000,1000),new THREE.Vector3(1001,1000,1000)];
 assert.throws(()=>c.prepareCloudRefresh({surfaceIndex:index}),/actual rail/);
 assert.throws(()=>c.prepareCloudRefresh({surfaceIndex:{sample(){throw Error('index rejected');}},rail}),/index rejected/);assert.equal(c.report.clouds,old);
 const first=c.prepareCloudRefresh({surfaceIndex:index,rail});first.commit();const second=c.prepareCloudRefresh({surfaceIndex:index,rail});c.dispose();assert.equal(first.report.disposed,true);assert.equal(second.report.disposed,true);assert.equal(old.disposed,true);f.dispose();
});

test('surface sampler transaction invalidates cached land/foundation and restores pre-edit query snapshots',()=>{
 const f=frozenScene(),c=createTargetCityDetailCandidate({castle:f.castle,includeFrontRail:false});f.castle.add(c.root);
 const readers=c.getSurfaceSamplers(),q=[74,33],before=readers.terrain(...q),foundation=readers.foundationTerrain(...q),sea=readers.sea(...q),sources=c.report.sourceSurfaces;
 assert.ok(before);const tx=c.prepareSurfaceSamplingRefresh(),original=f.source.geometry,next=original.clone();next.translate(0,-2,0);f.source.geometry=next;
 assert.deepEqual(readers.terrain(...q),before);tx.commit();assert.ok(Math.abs(readers.terrain(...q).height-(before.height-2))<1e-4);assert.ok(Math.abs(readers.foundationTerrain(...q).height-(foundation.height-2))<1e-4);assert.deepEqual(readers.sea(...q),sea);assert.equal(c.report.sourceSurfaces.terrain[0].geometry,next.uuid);
 tx.rollback();assert.equal(f.source.geometry,next);assert.deepEqual(readers.terrain(...q),before);assert.deepEqual(readers.foundationTerrain(...q),foundation);assert.equal(c.report.sourceSurfaces,sources);
 f.source.geometry=original;next.dispose();c.dispose();f.dispose();
});

test('startup cloud sweep consumes the actual installed rail curves',()=>{
 const f=frozenScene();
 const curve=new THREE.LineCurve3(new THREE.Vector3(1000,1000,1000),new THREE.Vector3(1010,1000,1000));
 let samples=0;const actual=curve.getSpacedPoints.bind(curve);curve.getSpacedPoints=n=>{samples++;return actual(n);};
 const c=createTargetCityDetailCandidate({castle:f.castle,includeFrontRail:false,cloudRailCurves:{red:curve,blue:curve}});
 assert.equal(samples,2);assert.equal(c.report.clouds.actualRailSampleCount,22);
 assert.equal(c.report.validation.visualAccepted,false);
 c.dispose();f.dispose();
});
