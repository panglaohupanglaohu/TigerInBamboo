import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {createTargetFrontBayRailCandidate} from '../../src/world/citadel/targetFrontBayRailCandidate.js';
function fixture(){const castle=new T.Group();castle.position.y=180;return{castle,sampleSea:(x,z)=>x*x+z*z<180*180?Math.sqrt(180*180-x*x-z*z)-180:null,sampleTerrain:(x,z)=>x*x+z*z<180*180?Math.sqrt(180*180-x*x-z*z)-183:null};}
test('spherical real sampler builds arches and constant 3D rail gauge, owned disposal',()=>{const r=createTargetFrontBayRailCandidate(fixture());assert.equal(r.report.status,'built-unaccepted-visual-candidate',JSON.stringify({failures:r.report.failures,clearance:r.report.clearance,promenade:r.report.promenade?.failures}));assert.equal(r.report.accepted,false);assert.equal(r.report.tramConnected,false);assert.equal(r.report.arches,5);assert.ok(r.report.audit.maxGaugeError<1e-8);assert.ok(r.report.audit.maxWorldGrade<.04);assert.ok(r.report.supports.every(s=>s.maximumSampledGap===0));assert.ok(r.worldCurve);let n=0;for(const mesh of r.group.children)mesh.geometry.addEventListener('dispose',()=>n++);const count=r.group.children.length;r.dispose();assert.equal(n,count);r.dispose();assert.equal(n,count);});
test('missing actual sea rejects without fallback or geometry',()=>{const r=createTargetFrontBayRailCandidate({...fixture(),sampleSea:()=>null});assert.equal(r.report.status,'rejected');assert.equal(r.worldCurve,null);assert.equal(r.group.children.length,0);});
test('existing mountain above proposed deck rejects rather than raising terrain/rail',()=>{const r=createTargetFrontBayRailCandidate({...fixture(),sampleTerrain:()=>100});assert.equal(r.report.status,'rejected');assert.equal(r.group.children.length,0);});

test('missing actual seabed rejects even if sea exists',()=>{const r=createTargetFrontBayRailCandidate({...fixture(),sampleTerrain:()=>null});assert.equal(r.report.status,'rejected');assert.equal(r.worldCurve,null);assert.equal(r.group.children.length,0);});

import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetStairSurfaceSampler} from '../../src/world/citadel/targetNewCityStairRoute.js';
function frozenScene() {
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


test('revised arc has actual frozen terrain support at all six piers',()=>{const f=frozenScene(),sampleSea=createTargetStairSurfaceSampler(f.castle,[f.ocean]),sampleTerrain=createTargetStairSurfaceSampler(f.castle,[f.source]),before=f.source.geometry.attributes.position.array.slice(),r=createTargetFrontBayRailCandidate({castle:f.castle,sampleSea,sampleTerrain});assert.equal(r.report.status,'built-unaccepted-visual-candidate',JSON.stringify(r.report.failures));assert.equal(r.report.supports.length,6);assert.ok(r.report.supports.every(s=>s.footprint.length===9&&s.footprint.every(p=>Number.isFinite(p.ground)&&s.bottom<=p.ground&&s.top>=p.ground)));assert.ok(r.report.audit.minWorldCurvatureRadius>37);assert.deepEqual(f.source.geometry.attributes.position.array,before);console.log('FROZEN_FRONT_RAIL',JSON.stringify({controls:r.report.actualControls,audit:r.report.audit,foundations:r.report.supports.map(s=>({index:s.index,bottom:s.bottom,top:s.top}))}));r.dispose();f.dispose();});

test('v3 promenade has five real canopies, instanced warm lamps, open ends and finite supported 2.4 m passage',()=>{
 const f=fixture(),r=createTargetFrontBayRailCandidate(f),p=r.report.promenade,c=r.report.clearance;assert.equal(r.report.version,'target-front-bay-rail-3-promenade');assert.equal(r.report.furniture.canopies.length,5);assert.ok(r.report.furniture.warmLamps>=10);assert.equal(r.report.furniture.transverseEndRails,0);assert.ok(r.group.getObjectByName('front-bay-blue-station-canopies').isInstancedMesh);assert.equal(r.group.getObjectByName('front-bay-blue-station-canopies').count,5);assert.ok(r.group.getObjectByName('front-bay-warm-lamp-glass').material.emissiveIntensity>0);assert.equal(r.group.children.some(o=>o.isLight),false);
 assert.equal(p.originalPierBoundaryChanged,undefined);assert.equal(p.brackets.originalPierBoundaryChanged,false);assert.ok(p.brackets.innerBearingOverlap>0);assert.ok(p.brackets.count>20);assert.equal(p.clearWidth,2.4);assert.equal(c.body.failures.length,0);assert.equal(c.track.failures.length,0);assert.equal(c.support.failures.length,0);assert.ok(c.body.rays>2000&&c.support.rays>900);assert.equal(c.track.tramVehicleValidated,false);
 f.castle.add(r.group);f.castle.updateWorldMatrix(true,true);const surface=r.group.getObjectByName('front-bay-promenade-stone-deck');assert.equal(surface.userData.targetWalkable,true);const route=r.report.walkSurfaces[0],normalMatrix=new T.Matrix3().getNormalMatrix(surface.matrixWorld);
 for(const i of[0,Math.floor(route.centres.length/2),route.centres.length-1]){const q=new T.Vector3(...route.centres[i]).applyMatrix4(f.castle.matrixWorld),up=new T.Vector3(...route.up[i]).transformDirection(f.castle.matrixWorld),hit=new T.Raycaster(q.clone().addScaledVector(up,.15),up.clone().negate(),0,.25).intersectObject(surface,false)[0];assert.ok(hit,'top must face outward, not only pass double-sided queries');assert.ok(hit.face.normal.clone().applyMatrix3(normalMatrix).dot(up)>.9);}
 // Rays start inside each endpoint and leave outward; longitudinal rails must
 // not contain an unnoticed transverse cap across the pedestrian route.
 for(const edge of[0,route.centres.length-1]){const neighbour=edge===0?1:edge-1,centre=new T.Vector3(...route.centres[edge]),out=centre.clone().sub(new T.Vector3(...route.centres[neighbour])).normalize(),up=new T.Vector3(...route.up[edge]);for(const h of[.55,1.2,1.8]){const origin=centre.clone().addScaledVector(out,-.5).addScaledVector(up,h).applyMatrix4(f.castle.matrixWorld),direction=out.clone().transformDirection(f.castle.matrixWorld);assert.equal(new T.Raycaster(origin,direction,0,1.1).intersectObject(r.group,true).length,0);}}
 let instanceDisposals=0;for(const mesh of r.group.children.filter(o=>o.isInstancedMesh))mesh.addEventListener('dispose',()=>instanceDisposals++);const instances=r.group.children.filter(o=>o.isInstancedMesh).length;r.dispose();assert.equal(instanceDisposals,instances);r.dispose();assert.equal(instanceDisposals,instances);
});

test('v3 preserves r39 plan/gauge and frozen-sampler original-pier baseline while choosing the unobstructed side honestly',async()=>{
 const fs=await import('node:fs'),before=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r39-arcades-clouds-paving-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail.frontRail,f=frozenScene(),r=createTargetFrontBayRailCandidate({castle:f.castle,sampleSea:createTargetStairSurfaceSampler(f.castle,[f.ocean]),sampleTerrain:createTargetStairSurfaceSampler(f.castle,[f.source])});
 assert.equal(r.report.status,'built-unaccepted-visual-candidate');assert.deepEqual(r.report.actualControls,before.actualControls);assert.equal(r.report.arches,before.arches);assert.equal(r.report.audit.gauge,before.audit.gauge);assert.equal(r.report.audit.samples,before.audit.samples);
 // r39's rendered water has a different height than this unmodified official
 // ocean fixture. Compare identical plan inputs and the ORIGINAL frozen-sampler
 // piers; do not claim unlike sea callbacks produce identical world elevations.
 const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),curve=new T.CubicBezierCurve3(...r.report.actualControls.map(p=>new T.Vector3(p[0],0,p[1]))),inverse=f.castle.matrixWorld.clone().invert();
 for(let i=0;i<r.report.rails.left.length;i++){const left=new T.Vector3(...r.report.rails.left[i]),right=new T.Vector3(...r.report.rails.right[i]),centre=left.clone().add(right).multiplyScalar(.5),plan=curve.getPoint(i/(r.report.rails.left.length-1));near(left.distanceTo(right),1.75);near(centre.length(),r.report.heightFit.railRadius);centre.applyMatrix4(inverse);near(centre.x,plan.x);near(centre.z,plan.z);}
 const originalSupports=[[-12.100175127488988,-8.165243310081523],[-10.040666062486274,-6.190068013104551],[-9.739669699870454,-5.890903143145679],[-14.895080459757073,-10.850767660912753],[-26.842144683756448,-22.532979907998126],[-42.545166672804186,-37.941151385265194]];
 assert.equal(r.report.supports.length,6);for(let i=0;i<6;i++){const support=r.report.supports[i],mesh=r.group.getObjectByName('front-bay-seabed-pier-'+i),plan=curve.getPoint(Math.round(i/5*(r.report.audit.samples-1))/(r.report.audit.samples-1));near(support.bottom,originalSupports[i][0]);near(support.top,originalSupports[i][1]);near(support.footprint[4].x,plan.x);near(support.footprint[4].z,plan.z);assert.equal(mesh.geometry.parameters.width,4.2);assert.equal(mesh.geometry.parameters.depth,1.7);assert.equal(support.footprint.length,9);}
 assert.equal(r.report.promenade.sideSign,-1);assert.equal(r.report.promenade.failures.length,0);assert.equal(r.report.promenade.guardrailTerrain.knownObstructions.length,0);assert.ok(r.report.promenade.sideTrials.find(t=>t.sideSign===1).knownObstructions>0);assert.ok(r.report.promenade.missingTerrainSamples>0);assert.equal(r.report.promenade.terrainSamplesComplete,false);assert.equal(r.report.accepted,false);assert.equal(r.report.tramConnected,false);assert.equal(r.report.promenade.continuousStructuralProof,false);assert.equal(r.report.clearance.body.failures.length,0);assert.equal(r.report.clearance.track.failures.length,0);assert.equal(r.report.clearance.support.failures.length,0);r.dispose();f.dispose();
});

test('known terrain conflicts on both extension sides reject rather than being mislabeled unknown',()=>{
 const f=fixture(),curve=new T.CubicBezierCurve3(...[[-59,68],[-40,108],[47,106],[83,101]].map(p=>new T.Vector3(p[0],0,p[1]))),centres=curve.getPoints(500),sampleTerrain=(x,z)=>Math.min(...centres.map(p=>Math.hypot(p.x-x,p.z-z)))>2.8?100:f.sampleTerrain(x,z),r=createTargetFrontBayRailCandidate({...f,sampleTerrain});
 assert.equal(r.report.status,'rejected');assert.ok(r.report.failures.includes('promenade-surface-rejected'));assert.ok(r.report.promenade.sideTrials.every(t=>t.knownObstructions>0));assert.equal(r.group.children.length,0);assert.equal(r.worldCurve,null);r.dispose();
});
