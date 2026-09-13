import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const r=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE;let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  const platform=castle.getObjectByName('highland-town-foundation-platform'),original=structuredClone(castle.userData.townSpec);
  const snapshot=()=>JSON.stringify(platform.userData.footprintOutline);
  const before=snapshot(),ring=platform.userData.footprintOutline;
  let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=a[0]*b[1]-b[0]*a[1];}area=Math.abs(area)/2;
  const cells=new Set(),n=original.gridSize||25,c=(n-1)/2;
  for(const terrace of original.terraces)for(const rows of terrace.levels)rows.forEach((row,z)=>[...row].forEach((v,x)=>{if(v!=='.')cells.add([x,z].join(','));}));
  const ray=new T.Raycaster();ray.layers.enableAll();platform.updateWorldMatrix(true,true);
  const down=new T.Vector3(0,-1,0).transformDirection(platform.matrixWorld);let samples=0,missing=0;
  for(const cell of cells){const [ix,iz]=cell.split(',').map(Number);for(const dx of [-1.3,1.3])for(const dz of [-1.3,1.3]){
   ray.set(platform.localToWorld(new T.Vector3((ix-c)*2+dx,1,(iz-c)*2+dz)),down);ray.far=2;samples++;if(!ray.intersectObject(platform,false).length)missing++;
  }}
  const api=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const next=structuredClone(original),row=[...next.terraces[0].levels[0][12]];
  const character=original.terraces.flatMap(a=>a.levels.flat()).join('').split('').find(c=>c!=='.');
  row[24]=character;next.terraces[0].levels[0][12]=row.join('');
  const rebuild=(a,b)=>api.rebuildCitadelTownIncremental(castle,b,[...api.computeCitadelDirtyCells(api.diffCitadelLayouts(a,b))],{animate:false,debounceMs:0});
  rebuild(original,next);const expanded=snapshot()!==before;
  const pad=castle.getObjectByName('contour-step-0');const editorSynced=pad.geometry.userData.outlineKey===snapshot();
  rebuild(next,original);const restored=snapshot()===before;
  return {area,previousArea:2282,reductionPercent:(1-area/2282)*100,cells:cells.size,samples,missing,expanded,editorSynced,restored,passed:missing===0&&expanded&&editorSynced&&restored,scope:'Real source foundation rays under every occupied WFC lot corner; isolated browser add/remove edit. Not full old-city character envelopes or campaign.'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-lot-footprint/footprint-check.json',import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify(r));if(!r.passed)process.exitCode=1;
}finally{await browser.close();}
