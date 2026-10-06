import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCitadelGarden,buildCitadelCypress} from '../../src/world/citadel/citadelGarden.js';
import {buildCitadelPlazaStatue} from '../../src/world/citadel/plazaStatue.js';
import {applyAshleyPalette} from '../../src/world/citadel/ashleyPalette.js';
import {applyHistoricStone} from '../../src/world/citadel/historicStone.js';
import {applyCityColourStudy} from '../../src/world/citadel/cityColourStudy.js';
import {mergeStaticGroup} from '../../src/world/geometryMerge.js';
globalThis.location={search:''};
const castle=new T.Group(),city=new T.Group();castle.name='castleContainer';city.name='highland-west-city';castle.add(city);
const garden=buildCitadelGarden(),statue=buildCitadelPlazaStatue();city.add(garden,statue);
// Rebatching can erase all ancestor names: the asset material must still own its identity.
const rebatch=new T.Group();rebatch.name='anonymous-prop-batch';rebatch.add(buildCitadelCypress());mergeStaticGroup(rebatch,{mergedTag:'anonymous'});city.add(rebatch);
const wall=new T.Mesh(new T.BoxGeometry(2,3,1),new T.MeshStandardMaterial({color:0xc7c1b1}));wall.name='city-wall';city.add(wall);
const originals=[];
for(const group of [garden,statue,rebatch])group.traverse(o=>{if(o.isMesh&&!o.userData.isOutline)originals.push({o,material:o.material,geometry:o.geometry,position:Array.from(o.geometry.attributes.position.array),color:o.material.color.toArray(),roughness:o.material.roughness,metalness:o.material.metalness});});
// Production order includes palettes both before and after the historic finish.
applyAshleyPalette(city);applyAshleyPalette(castle);applyHistoricStone(castle,50);applyCityColourStudy(castle);applyHistoricStone(castle,50);
const violations=[];
for(const b of originals){const m=b.o.material;if(m!==b.material||m.userData.historicStone||m.userData.cityColourStudy||JSON.stringify(m.color.toArray())!==JSON.stringify(b.color)||m.roughness!==b.roughness||m.metalness!==b.metalness)violations.push({name:b.o.name,history:!!m.userData.historicStone,colour:m.userData.cityColourStudy||null});assert.equal(b.o.geometry,b.geometry);assert.deepEqual(Array.from(b.o.geometry.attributes.position.array),b.position);}
assert.equal(wall.material.userData.historicStone,true,'real wall must retain stone weathering');
assert.equal(wall.material.userData.cityColourStudy.role,'stone','real wall must retain city palette');
console.log(JSON.stringify({protectedMeshes:originals.length,violations,wallRetained:true},null,2));
assert.equal(violations.length,0,'plant and statue materials must survive the whole production material pipeline');
