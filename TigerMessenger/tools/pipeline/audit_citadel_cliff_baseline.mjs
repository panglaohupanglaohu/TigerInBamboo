import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../../artifacts/pipeline/citadel-cliff-baseline-audit/', import.meta.url);
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page = await browser.newPage();
 await page.route('**/citadel/cliffBlenderRefinement.js*',r=>r.fulfill({contentType:'application/javascript',body:'export function applyCliffBlenderRefinement(){}'}));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE;
  const {default:data}=await import('/TigerMessenger/assets/models/optimized/citadel-cliff/citadelCliffData.js');
  const terrain=t.scene.getObjectByName('citadel-oskar-grid-mountain-surface');
  let castle; t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  t.scene.updateMatrixWorld(true);
  const p=terrain.geometry.attributes.position,key=v=>v.map(n=>Math.round(n*1e4)).join(',');
  const verts=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)]);
  const keys=new Set(verts.map(key));
  const missing=data.changes.filter(r=>!keys.has(key(r.slice(0,3)))).map(r=>{
   let best=null,distance=Infinity;
   for(const v of verts){const d=Math.hypot(...v.map((n,i)=>n-r[i]));if(d<distance){best=v;distance=d;}}
   return {original:r.slice(0,3),delta:r.slice(3),nearest:best,distance,castleLocal:castle.worldToLocal(terrain.localToWorld(new T.Vector3(...r.slice(0,3)))).toArray()};
  });
  const harbors=[];t.scene.traverse(o=>{if(o.userData.compositionPlacement?.role==='old-city-left-harbor')harbors.push({name:o.name,placement:o.userData.compositionPlacement,actual:castle.worldToLocal(o.getWorldPosition(new T.Vector3())).toArray()});});
  return {source:data.source,vertexCount:p.count,deltaCount:data.changes.length,matched:data.changes.length-missing.length,missing,harbors,compositionOffset:castle.userData.compositionOffset};
 });
 await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
