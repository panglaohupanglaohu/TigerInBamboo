// Actual lake factory construction, no browser or WebGL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCanvas,Image} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js';
const makeImage=()=>{const i=new Image();i.addEventListener=(e,f)=>{i['on'+e]=f;};i.removeEventListener=()=>{};return i;};
const element=()=>({style:{},addEventListener(){},setAttribute(){}});
globalThis.location={search:''};
globalThis.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:t=>t==='canvas'?createCanvas(256,256):element(),createElementNS:(_,t)=>t==='img'?makeImage():element()};
globalThis.window={addEventListener(){},innerWidth:1280,innerHeight:720};
const {createMoebiusSwampZone}=await import('../../../src/world/moebiusSwamp.js');
const zone=createMoebiusSwampZone();
const THREE=await import('three');
const {finishSwampV2Art}=await import('../../../src/world/swampV2Art.js');
const scene=new THREE.Scene();scene.add(zone);const road=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshBasicMaterial());road.name='v7-continuous-swamp-promenade';road.rotation.x=-Math.PI/2;road.position.y=40;scene.add(road);
const materials=new Map();zone.traverse(o=>{if(o.material?.name?.startsWith('greg-lake-'))materials.set(o,o.material);});
finishSwampV2Art({scene,swamp:zone});
for(const [o,m] of materials){assert.equal(o.material,m);assert.equal(o.material.toneMapped,false);}
let meshCount=0,inkCount=0,invalid=0,roles={};
zone.traverse(o=>{if(!o.isMesh)return;meshCount++;if(o.name==='greg-lake-outline')inkCount++;if(o.material?.name?.startsWith('greg-lake-'))roles[o.material.name]=(roles[o.material.name]||0)+1;const p=o.geometry?.attributes.position;if(p)for(const n of p.array)if(!Number.isFinite(n))invalid++;});
assert.equal(invalid,0);assert.ok(inkCount>0);assert.ok(zone.userData.tiger);assert.ok(zone.getObjectByName('swamp-warship-repair'));assert.ok(zone.getObjectByName('swamp-warship-depart'));
const result={kind:'actual-factory CPU construction only; no GPU shader compilation or visual acceptance',ok:true,meshCount,inkCount,invalid,roles,visuals:zone.userData.gregLakeVisuals,spatial:zone.userData.gregSpatialPlan};
fs.writeFileSync(new URL('factory-cpu.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,meshCount,inkCount,invalid,roles}));
