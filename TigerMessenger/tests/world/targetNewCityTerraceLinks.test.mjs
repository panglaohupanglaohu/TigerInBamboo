import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetNewCityTerraceLinks} from '../../src/world/citadel/targetNewCityTerraceLinks.js';
function fixture(){const castle=new T.Group(),candidateRoot=new T.Group(),owner=new T.Group();castle.rotation.set(.2,.4,.1);castle.add(candidateRoot);candidateRoot.add(owner);owner.rotation.y=-.4;owner.userData.stairCandidateReport={houses:[]};for(let row=0;row<2;row++){const h=new T.Group();h.name=`new-city-stair-house-${row}-1`;h.position.set(0,5-row,8*row);owner.add(h);owner.userData.stairCandidateReport.houses.push({id:h.name,size:[4,5,4],side:1,row});}return{castle,candidateRoot,owner};}
test('side links have real open bays and preserve actors; own resource rollback',()=>{const f=fixture(),before=f.owner.children.map(o=>o.position.toArray());const c=createTargetNewCityTerraceLinks({...f,sampleTerrain:()=>0});assert.equal(c.report.links.length,1);assert.ok(c.report.links[0].arches.length>0);assert.equal(c.report.accepted,false);assert.equal(c.report.navigation,false);const link=c.report.links[0],arc=link.arches[0],delta=new T.Vector3().fromArray(link.endpoints[1]).sub(new T.Vector3().fromArray(link.endpoints[0])),normal=new T.Vector3(-delta.z,0,delta.x).normalize(),origin=new T.Vector3(...arc.center).add(new T.Vector3(0,arc.openingHeight*.4,0)).addScaledVector(normal,5);c.group.updateMatrixWorld(true);const ray=new T.Raycaster(origin,normal.clone().negate(),0,10);assert.equal(ray.intersectObject(c.group,true).length,0,'arch opening must be actual empty geometry');assert.equal(c.report.drawCalls,1);assert.deepEqual(f.owner.children.map(o=>o.position.toArray()),before);const g=c.group.children[0].geometry;assert.ok([...g.attributes.position.array].every(Number.isFinite));let released=0;g.addEventListener('dispose',()=>released++);f.castle.add(c.group);c.dispose();c.dispose();assert.equal(released,1);assert.equal(c.group.parent,null);});
test('missing terrain or buried deck refuses rather than inventing supports',()=>{for(const sampleTerrain of [()=>null,()=>30]){const c=createTargetNewCityTerraceLinks({...fixture(),sampleTerrain});assert.equal(c.report.built,false);assert.ok(c.report.rejected.length);c.dispose();}});
test('actual stair triangle headroom rejects a crossing',()=>{const f=fixture();const walk=new T.Mesh(new T.BoxGeometry(12,.2,1),new T.MeshBasicMaterial());walk.name='surveyed-route-tread-crossing';walk.position.set(3,4,4);f.owner.add(walk);const c=createTargetNewCityTerraceLinks({...f,sampleTerrain:()=>0});assert.equal(c.report.built,false);assert.ok(c.report.rejected.some(r=>r.reason.includes('walk-clearance')));assert.ok(c.report.triangleChecks>0);c.dispose();walk.geometry.dispose();walk.material.dispose();});
test('rigid castle transform leaves chart geometry and report deterministic',()=>{const f=fixture(),a=createTargetNewCityTerraceLinks({...f,sampleTerrain:()=>0}),b=createTargetNewCityTerraceLinks({...f,sampleTerrain:()=>0});assert.deepEqual(a.report,b.report);assert.deepEqual([...a.group.children[0].geometry.attributes.position.array],[...b.group.children[0].geometry.attributes.position.array]);a.dispose();b.dispose();});

import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetNewCityStairs} from '../../src/world/citadel/targetNewCityStairs.js';
import {createTargetNewCityStairRoute,createTargetStairSurfaceSampler} from '../../src/world/citadel/targetNewCityStairRoute.js';
const THREE=T;
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

test('actual frozen terrain and six-house layout audited without moving originals',()=>{const f=frozenScene(),candidateRoot=new T.Group();f.castle.add(candidateRoot);const sampleTerrain=createTargetStairSurfaceSampler(f.castle,[f.source]),yaw=-55*Math.PI/180;const transform=new T.Matrix4().makeRotationY(yaw).setPosition(74,12,33);const stairs=createTargetNewCityStairs({houseOffsets:{'new-city-stair-house-1--1':[6.5*Math.cos(yaw),6.5*Math.sin(yaw)]},surfaceHeightAt:(x,z)=>{const p=new T.Vector3(x,0,z).applyMatrix4(transform),h=sampleTerrain(p.x,p.z);return h?.height===undefined?(typeof h==='number'?h-12:null):h.height-12;}});for(const c of [...stairs.group.children])if(!/^new-city-stair-house-/.test(c.name))stairs.group.remove(c);stairs.group.position.set(74,12,33);stairs.group.rotation.y=yaw;candidateRoot.add(stairs.group);const p=new T.Vector3(0,0,12.96).applyMatrix4(transform),route=createTargetNewCityStairRoute({sampleSurface:sampleTerrain,start:[p.x,12,p.z],terminalAccess:{from:[72,68],width:2.4}});candidateRoot.add(route.group);const c=createTargetNewCityTerraceLinks({castle:f.castle,candidateRoot,sampleTerrain});console.log(JSON.stringify({links:c.report.links.map(l=>({id:l.id,arches:l.arches.length})),rejected:c.report.rejected,triangles:c.report.triangles}));assert.equal(c.report.links.length+c.report.rejected.length,4);assert.equal(c.report.links.length,2);assert.ok(c.report.links.some(l=>l.arches.length>0));assert.ok(c.report.links.every(l=>l.maxStepRise<=.201));assert.equal(c.report.drawCalls,1);c.dispose();route.dispose();stairs.dispose();f.dispose();});

test('full-depth spandrels join actual deck while keeping arch passage empty',()=>{
 const c=createTargetNewCityTerraceLinks({...fixture(),sampleTerrain:()=>0});c.group.updateMatrixWorld(true);
 for(const link of c.report.links){const axis=new T.Vector3().fromArray(link.endpoints[1]).sub(new T.Vector3().fromArray(link.endpoints[0]));axis.y=0;axis.normalize();const n=new T.Vector3(-axis.z,0,axis.x);
 for(const a of link.arches){assert.equal(a.spandrelToDeck,true);const r=a.openingWidth/2, x=.72*r, outerH=Math.sqrt(1-(x/(r+.22))**2)*(a.openingHeight+.22), top=Math.min(...a.deckUnderside)-a.center[1];assert.ok(top>outerH);
 const stone=new T.Vector3(...a.center).addScaledVector(axis,x);stone.y+=(outerH+top)/2;
 const ray=new T.Raycaster(stone.clone().addScaledVector(n,5),n.clone().negate(),0,10);assert.ok(ray.intersectObject(c.group,true).length>0,'real masonry fills the old gap between curved arch and tread');
 const opening=new T.Vector3(...a.center);opening.y+=a.openingHeight*.3;ray.set(opening.addScaledVector(n,5),n.clone().negate());assert.equal(ray.intersectObject(c.group,true).length,0,'new spandrel never fills the true opening');
 }}c.dispose();
});
