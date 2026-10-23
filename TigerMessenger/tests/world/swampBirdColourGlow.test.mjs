import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const current=await import('../../src/world/moebiusSwamp.js');
const sourceUrl=new URL('../../src/world/moebiusSwamp.js',import.meta.url);let source=fs.readFileSync(sourceUrl,'utf8');
const old=fs.readFileSync(new URL('../../artifacts/pipeline/greg-lake-character-detail-20261008/before-bird-colour-glow/buildSwampBird.js.txt',import.meta.url),'utf8');
source=source.replace(/function buildSwampBird\([\s\S]*?(?=\n\/\* 玩家入沼交互)/,()=>old).replace(/from\s+(["'])([^"']+)\1/g,(_,q,path)=>`from ${q}${path.startsWith('.')?new URL(path,sourceUrl).href:import.meta.resolve(path)}${q}`);
const previous=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function rng(){let n=7711,calls=0;return{next(){calls++;n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;},get calls(){return calls;},get state(){return n;}};}
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)).digest('hex');
function shapes(root){const out=[];root.traverse(o=>{if(o.isMesh)out.push({name:o.name,position:hash(o.geometry.attributes.position),normal:hash(o.geometry.attributes.normal),p:o.position.toArray(),r:o.rotation.toArray(),s:o.scale.toArray()});});return out;}
function colours(mesh){const a=mesh.geometry.attributes.color;return new Set(Array.from({length:a.count},(_,i)=>new T.Color(a.getX(i),a.getY(i),a.getZ(i)).getHexString()));}

test('bird colour correction preserves every anatomical/outline vertex, pivot and exact five RNG calls',()=>{
 for(const tint of [0xd8ffe0,0xfff0b8]){const a=rng(),b=rng(),before=previous.SWAMP_COMPONENT_BUILDERS.swampBird(()=>a.next(),tint),after=current.SWAMP_COMPONENT_BUILDERS.swampBird(()=>b.next(),tint);assert.deepEqual(shapes(after),shapes(before));assert.equal(a.calls,5);assert.equal(a.calls,b.calls);assert.equal(a.state,b.state);for(const key of ['orbitR','orbitY','dart','speed','phase'])assert.equal(after.userData[key],before.userData[key]);assert.equal(after.userData.wingL.parent,after);assert.equal(after.userData.wingR.parent,after);}
});
test('latest pale-green bird body and feathers survive final local art pass while only head emits pink',()=>{
 const root=current.createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,birds=inner.children.filter(o=>o.name==='swamp-bird');assert.equal(birds.length,4);
 for(const bird of birds){const body=bird.getObjectByName('swamp-bird-anatomy'),c=colours(body);for(const hex of ['d8ffe0','8a7782'])assert.ok(c.has(hex),hex);for(const wing of [bird.userData.wingL,bird.userData.wingR]){assert.deepEqual([...colours(wing)].sort(),['d8ffe0']);assert.equal(wing.material.toneMapped,false);}assert.equal(body.material.toneMapped,false);}
 const resources=birds.map(b=>({halo:b.userData.halo,map:b.userData.halo.material.map,material:b.userData.halo.material,geometry:shapes(b)}));
 for(const t of [0,.4,1.6,8,20]){inner.update(1/60,t,{});for(const [i,b]of birds.entries()){assert.equal(b.userData.halo,resources[i].halo);assert.equal(b.userData.halo.material,resources[i].material);assert.equal(b.userData.halo.material.map,resources[i].map);assert.ok(Math.abs(b.userData.halo.material.opacity-(.38+.26*(.5+.5*Math.sin(t*1.6))))<1e-12);assert.ok(b.userData.halo.material.opacity>=.38&&b.userData.halo.material.opacity<=.64);const flap=Math.sin(t*7+b.userData.phase)*.5;assert.equal(b.userData.wingL.rotation.z,-.5-flap);assert.equal(b.userData.wingR.rotation.z,.5+flap);}}
});
test('head-only internal fluorescence replaces the visible whole-bird aureole without new resources',()=>{
 const birds=Array.from({length:4},()=>current.SWAMP_COMPONENT_BUILDERS.swampBird(()=>.4,0xd8ffe0));
 for(const bird of birds){const body=bird.getObjectByName('swamp-bird-anatomy'),glow=body.material.userData.swampInternalGlow;assert.equal(glow.region,'bird-head');assert.deepEqual(glow.center.toArray(),[0,.14,.43]);assert.equal(glow.color.getHexString(),'f4a5ec');assert.equal(bird.userData.halo.visible,false);assert.equal(bird.userData.wingL.material.userData.swampInternalGlow,undefined);assert.equal(bird.userData.wingR.material.userData.swampInternalGlow,undefined);
  const shader={vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader,uniforms:{}};body.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('mix(diffuseColor.rgb,localGlowColor,glowCore)'));assert.ok(shader.fragmentShader.includes('skinMask'));assert.ok(shader.vertexShader.includes('localGlowP=position'));assert.equal(shader.uniforms.localGlowStrength.value,.95);
  let lights=0;bird.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);
 }
});
test('lizard keeps all green vertex colours and geometry while only torso has internal pink-purple emission',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/greg-lake-character-detail-20261008/animal-ink-before/geometry-contract.json',import.meta.url)));const lizard=current.SWAMP_COMPONENT_BUILDERS.glowLizard(()=>.375),body=lizard.getObjectByName('swamp-lizard-anatomy');
 const meshes=[];lizard.traverse(m=>{if(m.isMesh&&!m.userData.isOutline)meshes.push({name:m.name,position:hash(m.geometry.attributes.position),normal:hash(m.geometry.attributes.normal),color:hash(m.geometry.attributes.color),translation:m.position.toArray(),rotation:m.rotation.toArray(),scale:m.scale.toArray()});});assert.deepEqual(meshes,baseline.glowLizard.meshes);assert.equal(lizard.userData.phase,baseline.glowLizard.phase);assert.equal(lizard.userData.halo.visible,false);
 const glow=body.material.userData.swampInternalGlow;assert.equal(glow.region,'lizard-torso');assert.deepEqual(glow.center.toArray(),[0,.18,0]);assert.deepEqual(glow.radius.toArray(),[.24,.15,.48]);assert.equal(glow.color.getHexString(),'f4a5ec');
 const shader={vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader,uniforms:{}};body.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('mix(diffuseColor.rgb,localGlowColor,glowCore)'));assert.ok(shader.fragmentShader.includes('pow(glowFacing,1.5)'),'tint vanishes at green silhouette');
 const outside=new T.Vector3(0,.1,-1.2).sub(glow.center).divide(glow.radius).length();assert.ok(outside>1.28,'tail and toes are outside torso emission region');
});
