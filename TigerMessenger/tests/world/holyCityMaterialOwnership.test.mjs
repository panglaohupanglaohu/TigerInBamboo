import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {applyOldTownPalace} from '../../src/world/citadel/holyCityStyleV2.js';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';

function environment(run){
 const location=Object.getOwnPropertyDescriptor(globalThis,'location'),timer=globalThis.setTimeout,scheduled=[];
 Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?ashleyPalette=0&citadelHistory=0'}});
 globalThis.setTimeout=(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;};
 try{return run(scheduled);}finally{globalThis.setTimeout=timer;if(location)Object.defineProperty(globalThis,'location',location);else delete globalThis.location;}
}
function state(root){const rows=[];root.traverse(mesh=>{if(mesh.isMesh)rows.push({mesh,geometry:mesh.geometry,material:mesh.material,colors:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.color.getHexString()),vertices:mesh.geometry.attributes.color?.array.slice()});});return rows;}
function unchanged(rows){for(const row of rows){assert.equal(row.mesh.material,row.material,row.mesh.name);assert.equal(row.mesh.geometry,row.geometry,row.mesh.name);assert.deepEqual((Array.isArray(row.mesh.material)?row.mesh.material:[row.mesh.material]).map(m=>m.color.getHexString()),row.colors);assert.deepEqual(row.mesh.geometry.attributes.color?.array,row.vertices);}}

test('authored old city retains palette through initial and scheduled 1.5/5s palace sweeps',()=>environment(scheduled=>{
 const castle=new T.Group(),asset=createTargetOldCity({seed:20261005,palette:{roof:'#ff894f',pink:'#f5a1ac'}});
 asset.group.position.set(-55,17,9);asset.group.rotation.y=Math.PI/4;castle.add(asset.group);const original=state(asset.group);
 try{
  applyOldTownPalace(castle);assert.deepEqual(scheduled.map(t=>t.ms),[1500,5000]);unchanged(original);
  // A second factory result installed after the first pass reproduces the main
  // runtime ordering; late sweeps must also protect newly generated/rebuilt houses.
  const late=createTargetOldCity({seed:20261005});late.group.position.copy(asset.group.position);late.group.rotation.copy(asset.group.rotation);castle.add(late.group);const lateState=state(late.group);
  try{for(const {fn}of scheduled){fn();unchanged(original);unchanged(lateState);}assert.equal(castle.userData.holyOldTownPalace.latePasses,2);assert.equal(castle.userData.holyOldTownPalace.lateRecoloured,0);assert.equal(asset.group.getObjectByName('house-0--1-0-roof').material.color.getHexString(),'ff894f');}finally{late.dispose();}
 }finally{asset.dispose();}
}));

test('material, own-object and ancestor ownership protect shared vertex buffers; unprotected legacy still recolours',()=>environment(()=>{
 const castle=new T.Group();castle.userData.holyOldTownPalace={};const owned=[],resources=new Set();
 function mesh(name,x=-55){const g=new T.BoxGeometry(2,2,2),m=new T.MeshStandardMaterial({color:'#ff894f',vertexColors:true});g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(.3),3));const o=new T.Mesh(g,m);o.name=name;o.position.set(x,10,0);castle.add(o);resources.add(g);resources.add(m);return o;}
 const material=mesh('material-owned');material.material.userData.preserveCitadelMaterial=true;owned.push(material);
 const own=mesh('object-owned');own.userData.preserveCitadelMaterials=true;owned.push(own);
 const inherited=mesh('ancestor-owned'),parent=new T.Group(),ancestor=new T.Group();ancestor.userData.preserveCitadelMaterials=true;castle.add(ancestor);ancestor.add(parent);parent.add(inherited);owned.push(inherited);
 // straddles the old region: ownership must also bypass holySplitRecolour.
 const edge=mesh('owned-region-edge',-18);edge.material.userData.preserveCitadelMaterial=true;owned.push(edge);
 const mixed=mesh('mixed-material');const unprotected=mixed.material,protectedMat=unprotected.clone();protectedMat.userData.preserveCitadelMaterial=true;mixed.material=[unprotected,protectedMat];resources.add(protectedMat);owned.push(mixed);
 const legacy=mesh('legacy-unprotected'),beforeLegacy=legacy.material,legacyColor=beforeLegacy.color.getHexString();const snapshots=owned.flatMap(state);
 try{applyOldTownPalace(castle);unchanged(snapshots);assert.notEqual(legacy.material,beforeLegacy);assert.notEqual(legacy.material.color.getHexString(),legacyColor);assert.equal(legacy.userData.holyOldTownDone,true);assert.ok(castle.userData.holyOldTownPalace.lateRecoloured>0);}finally{castle.traverse(m=>{if(m.isMesh){resources.add(m.geometry);for(const v of Array.isArray(m.material)?m.material:[m.material])resources.add(v);}});resources.forEach(r=>r.dispose());}
}));
