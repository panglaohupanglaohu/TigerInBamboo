import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from '../../tools/shot/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
function expandedGeometry(g){
 const indices=g.index??Array.from({length:g.attributes.position.values.length/3},(_,i)=>i);
 return {groups:g.groups,attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{itemSize:a.itemSize,normalized:a.normalized,values:indices.flatMap(i=>a.values.slice(i*a.itemSize,(i+1)*a.itemSize))}]))};
}
function shape(d){
 return d.nodes.map(n=>({name:n.name,type:n.type,parent:n.parent,matrix:n.matrix,visible:n.visible,geometry:n.geometry?expandedGeometry(d.geometries[n.geometry]):null,materials:(n.materials??[]).map(id=>{
  const m=d.materials[id];const r={};
  for(const k of ['type','color','emissive','emissiveIntensity','opacity','transparent','side','depthWrite','flatShading','roughness','metalness','vertexColors'])if(k in m)r[k]=m[k];
  for(const k of ['map','gradientMap'])if(m[k]?.textureRef){const t=d.textures[m[k].textureRef];r[k]={png:t.png,data:t.data,repeat:t.repeat,offset:t.offset,colorSpace:t.colorSpace,flipY:t.flipY};}
  return r;
 })}));
}
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8765/TigerMessenger/tools/originals/capture.html');await page.waitForFunction(()=>window.ready);
 for(const id of ['bookshop','messenger','agentMessenger','mossyGround','longWingGlider','moebiusTiger']){
  const before=JSON.parse(await readFile(new URL(`../assets/models/originals/${id}.source.json`,import.meta.url),'utf8'));
  const after=await page.evaluate(id=>window.captureOriginal(id),id);
  assert.deepEqual(JSON.parse(JSON.stringify(shape(after))),JSON.parse(JSON.stringify(shape(before))),`${id}: original geometry/material/hierarchy changed`);
  console.log('ORIGINAL_PARITY_OK',id,after.nodes.length,'nodes');
 }
 // Compare extracted tiger with the actual original Git source, not the new archive.
 const original=execFileSync('git',['show','HEAD:TigerMessenger/src/world/moebiusTiger.js'],{encoding:'utf8'}).replace(/(from\s+["'])(\.[^"']+)(["'])/g,(_,a,b,c)=>a+new URL(b,'http://127.0.0.1:8765/TigerMessenger/src/world/moebiusTiger.js').href+c);
 const tigerPair=await page.evaluate(async code=>{
  const {captureObject}=await import('./capture.js');
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const legacy=await import(url);URL.revokeObjectURL(url);
  const {createMoebiusTiger}=await import('../../src/world/moebiusTiger.js');
  const a=captureObject(legacy.createMoebiusTiger());
  const current=createMoebiusTiger(Math.random,null,{anatomy:false});const b=captureObject(current);window.subject=current;
  return {a,b};
 },original);
 assert.deepEqual(JSON.parse(JSON.stringify(shape(tigerPair.a))),JSON.parse(JSON.stringify(shape(tigerPair.b))),'tiger differs from original Git geometry or texture');
 console.log('GIT_ORIGINAL_TIGER_PARITY_OK');
 const animation=await page.evaluate(()=>{
  const t=window.subject;t.userData._walking=true;t.userData.update(1/60,1);
  return {tailSegments:t.userData.tailSegs.length,tailMoves:t.userData.tailSegs.some(j=>Math.abs(j.rotation.z)>0),scale:t.scale.x};
 });
 assert.equal(animation.tailSegments,8);assert(animation.tailMoves);assert.equal(animation.scale,.4);
 console.log('ORIGINAL_TIGER_ANIMATION_OK');
}finally{await browser.close();}
