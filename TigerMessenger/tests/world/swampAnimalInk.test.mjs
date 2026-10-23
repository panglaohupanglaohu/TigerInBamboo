import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,createElement:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},location,localStorage};
const {SWAMP_COMPONENT_BUILDERS:b}=await import('../../src/world/moebiusSwamp.js');
const before=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/greg-lake-character-detail-20261008/animal-ink-before/geometry-contract.json',import.meta.url)));
const roots=Object.fromEntries(['swampBird','longTailMonkey','glowLizard'].map(key=>[key,b[key](()=>.375,0xd8ffe0)]));
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.array.buffer)).digest('hex');
function shells(root){const list=[];root.traverse(o=>{if(o.userData.isOutline)list.push(o)});return list;}
test('fine ink keeps bird/lizard surfaces and all animal pivots and behaviour references; monkey shape is separately approved',()=>{
 for(const [key,root]of Object.entries(roots)){
  const meshes=[];root.traverse(m=>{if(m.isMesh&&!m.userData.isOutline)meshes.push({name:m.name,position:hash(m.geometry.attributes.position),normal:hash(m.geometry.attributes.normal),color:hash(m.geometry.attributes.color),translation:m.position.toArray(),rotation:m.rotation.toArray(),scale:m.scale.toArray()})});
  if(key==='swampBird')assert.deepEqual(meshes.map(({color,...shape})=>shape),before[key].meshes.map(({color,...shape})=>shape));
  else if(key!=='longTailMonkey')assert.deepEqual(meshes,before[key].meshes);
  else for(let i=0;i<meshes.length;i++){assert.equal(meshes[i].name,before[key].meshes[i].name);for(const k of ['translation','rotation','scale'])assert.deepEqual(meshes[i][k],before[key].meshes[i][k]);}
  assert.deepEqual(Object.keys(root.userData).filter(k=>k!=='monkeyTail').sort(),before[key].keys);assert.equal(root.userData.phase,before[key].phase);
 }
 assert.equal(roots.swampBird.userData.wingL.parent,roots.swampBird);assert.equal(roots.longTailMonkey.userData.armL.parent,roots.longTailMonkey);
 assert.deepEqual(Object.values(roots).map(o=>shells(o).length),[3,3,1]);
});
test('fine shells weld coincident contour normals and cap toes, wings and tail tips by their actual thickness',()=>{
 for(const root of Object.values(roots))for(const shell of shells(root)){
  assert.equal(shell.material.color.getHexString(),'435968');assert.equal(shell.material.side,THREE.BackSide);
  const p=shell.geometry.attributes.position,n=shell.geometry.attributes.normal,w=shell.geometry.attributes.coralInkLimit,byPosition=new Map();
  for(let i=0;i<p.count;i++){
   assert.ok(w.getX(i)>0&&w.getX(i)<=.006001);const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
   const normal=[n.getX(i),n.getY(i),n.getZ(i)];assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-5);
   if(byPosition.has(key))assert.deepEqual(normal,byPosition.get(key));else byPosition.set(key,normal);
  }
 }
 const wing=shells(roots.swampBird).find(o=>o.parent.name==='swamp-bird-wing').geometry.attributes.coralInkLimit;
 assert.ok(Math.max(...wing.array)<.0034,'thin wing hull stays well below body expansion');
 const lizard=shells(roots.glowLizard)[0].geometry.attributes.coralInkLimit;
 assert.ok(Math.min(...lizard.array)<.0005,'tiny tail cap never receives body-sized contour');
 assert.ok(Math.max(...lizard.array)/Math.min(...lizard.array)>10);
});
test('contour is stable at device scale, screen-capped and independent of shared brush-noise shader',()=>{
 for(const root of Object.values(roots))for(const shell of shells(root)){
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>',fragmentShader:''};shell.material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('min(coralInkWidth, availablePixels)'));assert.ok(!/tmHash|discard|sin\(/.test(shader.vertexShader));
  for(const dpr of [1,2,3]){
   shell.onBeforeRender({getDrawingBufferSize:v=>v.set(960*dpr,720*dpr),getPixelRatio:()=>dpr});
   assert.equal(shader.uniforms.coralInkWidth.value/dpr,.85);assert.equal(shader.uniforms.coralInkResolution.value.x,960*dpr);
  }
 }
 const whale=b.whale(()=>.375),legacy=[];whale.traverse(o=>{if(o.userData.isOutline)legacy.push(o)});assert.ok(legacy.length>0);assert.ok(legacy.every(o=>!o.userData.fineAnimalInk),'other creatures are outside this change');
});
