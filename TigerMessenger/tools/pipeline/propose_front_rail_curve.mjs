import * as THREE from 'three';
import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {createTargetStairSurfaceSampler} from '../../src/world/citadel/targetNewCityStairRoute.js';
import {createTargetFrontBayRailCandidate} from '../../src/world/citadel/targetFrontBayRailCandidate.js';
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


const f=frozenScene(),sea0=createTargetStairSurfaceSampler(f.castle,[f.ocean]),land0=createTargetStairSurfaceSampler(f.castle,[f.source]);
const cached=fn=>{const map=new Map();return(x,z)=>{const k=x.toFixed(6)+','+z.toFixed(6);if(!map.has(k))map.set(k,fn(x,z));return map.get(k);};};
const sampleSea=cached(sea0),sampleTerrain=cached(land0),results=[];
for(const z1 of[100,104,108])for(const z2 of[102,106,110])for(const ze of[99,101,103]){
 const xe=83;
 const controls=[[-59,68],[-40,z1],[47,z2],[xe,ze]],r=createTargetFrontBayRailCandidate({castle:f.castle,sampleSea,sampleTerrain,controls});
 const summary={controls,status:r.report.status,failures:r.report.failures.slice(0,3),side:r.report.sideObstructions,footMiss:r.report.footMiss,audit:r.report.audit,supports:r.report.supports.length};results.push(summary);r.dispose();
}
console.log(JSON.stringify({actualFrozenSurfaces:true,results},null,2));f.dispose();
