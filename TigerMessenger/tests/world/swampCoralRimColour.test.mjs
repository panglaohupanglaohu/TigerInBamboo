import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import * as T from 'three';
import {installSwampCoralRim} from '../../src/world/swampCoralRim.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregLakeRim=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');const baseline=JSON.parse(fs.readFileSync(new URL('../fixtures/swampRimColourGeometry.json',import.meta.url)));
const hash=a=>crypto.createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
let randomCalls=0;const oldRandom=Math.random;Math.random=()=>{randomCalls++;return .5;};let report;try{report=installSwampCoralRim(inner,{enabled:true});}finally{Math.random=oldRandom;}
const mesh=report.walkMeshes[0],p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color;
test('rim colour-only change preserves all geometry, exterior geology and random state',()=>{
 assert.equal(randomCalls,baseline.uuidRandomCalls,'only unchanged Three.js UUID allocation consumes randomness');assert.equal(hash(p.array),baseline.positions);assert.equal(hash(mesh.geometry.attributes.normal.array),baseline.normals);assert.equal(p.count,baseline.count);assert.equal(report.renderMeshes,baseline.renderMeshes);assert.equal(report.triangles,baseline.triangles);
 const outer=[];inner.getObjectByName('greg-coral-outer-cliff').traverse(o=>{if(o.geometry)outer.push({name:o.name,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,v])=>[k,hash(v.array)]))});});assert.deepEqual(outer,baseline.outer);
});
test('shared top colours form smooth warm-to-cool gradients without repeated five-sector bands',()=>{
 const vertices=new Map(),innerColours=[],outerColours=[];
 for(let i=0;i<p.count;i+=3){if([0,1,2].some(j=>Math.abs(p.getY(i+j)-40)>1e-5))continue;
  for(let j=0;j<3;j++){const k=i+j,key=[p.getX(k),p.getY(k),p.getZ(k)].join(','),rgb=[c.getX(k),c.getY(k),c.getZ(k)];if(vertices.has(key))assert.deepEqual(rgb,vertices.get(key));else{vertices.set(key,rgb);const item={angle:Math.atan2(p.getZ(k),p.getX(k)),rgb};(Math.hypot(p.getX(k),p.getZ(k))<36?innerColours:outerColours).push(item);}}
 }
 assert.equal(vertices.size,386);assert.equal(innerColours.length,193);assert.equal(outerColours.length,193);
 for(const ring of [innerColours,outerColours]){
  ring.sort((a,b)=>a.angle-b.angle);assert.ok(new Set(ring.map(v=>v.rgb.map(n=>n.toFixed(6)).join(','))).size>185);
  for(let i=1;i<ring.length;i++){if(ring[i].angle-ring[i-1].angle>.1)continue;assert.ok(Math.max(...ring[i].rgb.map((n,j)=>Math.abs(n-ring[i-1].rgb[j])))<.055,'no hard sector band boundary');}
  for(const offset of [5,7,35]){let equal=0;for(let i=offset;i<ring.length;i++)if(ring[i].rgb.every((n,j)=>Math.abs(n-ring[i-offset].rgb[j])<1e-6))equal++;assert.equal(equal,0,'no repeating block-colour period');}
 }
 const mean=ring=>ring.reduce((s,v)=>s+v.rgb[0]-v.rgb[2],0)/ring.length;assert.ok(mean(outerColours)-mean(innerColours)>.20,'outer soil stays coral, inner edge trends toward cold rock');
});
