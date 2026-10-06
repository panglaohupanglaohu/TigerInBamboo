import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import{createTargetOldCity,TARGET_OLD_CITY_PALETTE}from'../../src/world/citadel/targetOldCity.js';
import{createTargetNewCityMain,TARGET_NEW_CITY_MAIN_PALETTE}from'../../src/world/citadel/targetNewCityMain.js';
import{createTargetNewCityStairs}from'../../src/world/citadel/targetNewCityStairs.js';
import{TARGET_ARCHITECTURE_PALETTE as palette}from'../../src/world/citadel/targetArchitecturePalette.js';
import{applyOldTownPalace,applyHolyCityRoofPalette}from'../../src/world/citadel/holyCityStyleV2.js';
import{applyAshleyPalette}from'../../src/world/citadel/ashleyPalette.js';
import{applyHistoricStone}from'../../src/world/citadel/historicStone.js';
import{applyCityColourStudy}from'../../src/world/citadel/cityColourStudy.js';

test('actual building materials use separate target albedo roles without emission, unlit or tone-mapping overrides',()=>{
 const assets=[createTargetOldCity({palette:TARGET_OLD_CITY_PALETTE}),createTargetNewCityMain({palette:TARGET_NEW_CITY_MAIN_PALETTE}),createTargetNewCityStairs({palette:{...TARGET_NEW_CITY_MAIN_PALETTE,rose:palette.rose}})];
 try{for(const a of assets)a.group.traverse(o=>{if(!o.isMesh)return;const m=o.material;assert.equal(m.isMeshStandardMaterial,true);assert.equal(m.toneMapped,true);assert.equal(m.emissive.getHex(),0);assert.equal(m.userData.preserveCitadelMaterial,true);assert.equal(m.color.getHexString(),new T.Color(m.userData.targetArchitectureColour.albedo).getHexString());assert.equal(m.color.getHexString(),new T.Color(a.report.palette[m.userData.targetArchitectureColour.role]).getHexString());});assert.equal(assets[0].group.getObjectByName('house-0--1-0-roof').material.color.getHexString(),'f57b45');assert.equal(assets[1].report.palette.blue,'#80c8eb');assert.equal(assets[2].report.palette.rose,'#ef958f');assert.notEqual(palette.stone,palette.blue);assert.notEqual(palette.trim,palette.stone);}finally{assets.forEach(a=>a.dispose());}
});

test('all legacy style entrypoints preserve target buildings and custom wall colours, including roof-name matching',()=>{
 const prior=globalThis.location;globalThis.location={search:''};const castle=new T.Group();castle.name='castleContainer';castle.userData.holyOldTownPalace={};const assets=[createTargetOldCity({palette:{pink:'#de8890'}}),createTargetNewCityMain(),createTargetNewCityStairs()];const snapshots=[];
 for(const a of assets){castle.add(a.group);a.group.position.set(-55,17,9);a.group.traverse(o=>{if(o.isMesh)snapshots.push({o,material:o.material,geometry:o.geometry,color:o.material.color.getHexString(),hook:o.material.onBeforeCompile});});}
 const ownedRoof=assets[1].group.children.find(o=>o.isMesh&&o.material.userData.targetArchitectureColour.role==='dome');assert.ok(ownedRoof);ownedRoof.material.name='citadel-target-blue-dome';
 const legacy=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:'#224466'}));legacy.material.name='claude-house-roof-regression';castle.add(legacy);const originalLegacy=legacy.material;
 try{for(let i=0;i<2;i++){applyHolyCityRoofPalette(castle);applyOldTownPalace(castle);applyAshleyPalette(castle);applyHistoricStone(castle);applyCityColourStudy(castle);}for(const s of snapshots){assert.equal(s.o.material,s.material,s.o.name);assert.equal(s.o.geometry,s.geometry,s.o.name);assert.equal(s.o.material.color.getHexString(),s.color);assert.equal(s.o.material.onBeforeCompile,s.hook);}assert.notEqual(legacy.material,originalLegacy);assert.equal(legacy.material.color.getHexString(),'bc825e');}finally{assets.forEach(a=>a.dispose());legacy.geometry.dispose();legacy.material.dispose();originalLegacy.dispose();if(prior===undefined)delete globalThis.location;else globalThis.location=prior;}
});
