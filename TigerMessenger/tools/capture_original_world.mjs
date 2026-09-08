import {chromium} from '../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,open} from 'node:fs/promises';
const dir='TigerMessenger/godot/assets/world-source';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1280,height:800}});await page.addInitScript(()=>{let seed=20260908;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto('http://127.0.0.1:8767/TigerMessenger/?autostart=1&timeOfDay=0.38',{timeout:120000});await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.bookshop,null,{timeout:120000});
 const manifest=await page.evaluate(async()=>{const {exportWorldGLB}=await import('./tools/world/export_world_glb.js');const result=exportWorldGLB(__tm.scene,__tm.THREE,__tm.messenger.landmarks);window.__worldGlb=result.bytes;return result.manifest;});
 const f=await open(dir+'/original-world-v1.glb','wx');try{for(let start=0;start<manifest.bytes;start+=1048576){const str=await page.evaluate(start=>{const chunk=window.__worldGlb.subarray(start,start+1048576);let s='';for(let i=0;i<chunk.length;i+=8192)s+=String.fromCharCode(...chunk.subarray(i,i+8192));return btoa(s);},start);await f.write(Buffer.from(str,'base64'));}}finally{await f.close();}
 await writeFile('TigerMessenger/godot/data/original-world-manifest.json',JSON.stringify({...manifest,seed:20260908},null,2));console.log('WORLD_CAPTURED',JSON.stringify({nodes:manifest.nodes,meshes:manifest.meshes,bytes:manifest.bytes,landmarks:Object.keys(manifest.landmarks),warnings:manifest.warnings}));
}finally{await browser.close();}
