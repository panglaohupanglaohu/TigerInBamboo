import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out=new URL('../../assets/models/originals/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8765/TigerMessenger/tools/originals/capture.html');
 await page.waitForFunction(()=>window.ready);
 const catalog=await page.evaluate(()=>window.catalog);
 await writeFile(new URL('catalog.json',out),JSON.stringify(catalog,null,2));
 const selected=process.argv.slice(2);
 const report=[];
 for(const entry of catalog.filter(e=>!selected.length||selected.includes(e.id))){
   try{
    const data=await page.evaluate(id=>window.captureOriginal(id),entry.id);
    const text=JSON.stringify(data);
    const path=new URL(`${entry.id}.source.json`,out);
    // This is a snapshot, not a regeneration overwrite command.
    try{await writeFile(path,text,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
    const saved=JSON.parse(await readFile(path,'utf8'));
    const row={id:entry.id,label:entry.label,nodes:saved.nodes.length,geometries:Object.keys(saved.geometries).length,materials:Object.keys(saved.materials).length,textures:Object.keys(saved.textures).length,warnings:saved.warnings,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),status:'original factory snapshot; optimization pending'};
    report.push(row);console.log('CAPTURE_OK',entry.id,row.nodes,row.geometries);
   }catch(e){report.push({id:entry.id,error:e.message});console.log('CAPTURE_FAILED',entry.id,e.message);}
 }
 await writeFile(new URL('capture-report.json',out),JSON.stringify(report,null,2));
}finally{await browser.close();}
