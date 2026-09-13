import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-ship-ground-separation/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>!!window.__tm?.messenger?.landmarks?.saihojiPhalanx,null,{timeout:180000});
 const report=await page.evaluate(()=>{
  const tm=window.__tm,battle=tm.messenger.landmarks.saihojiPhalanx;
  tm.P.timeOfDay=.6;tm.P.daySpeed=0;
  battle.root.userData.debugSiege();
  const read=()=>{const rows=[];battle.root.traverse(o=>{if(/^saihoji-troopship-/.test(o.name))rows.push({name:o.name,radius:o.position.length(),visible:o.visible});});return rows;};
  const initial=read();
  for(let i=0;i<2400;i++)battle.update(1/60,i/60);
  const after=read();
  return {initial,after,phase:battle.root.userData.phase,passed:initial.length===2&&initial.every(o=>Math.abs(o.radius-160.18)<1e-6)&&after.some(o=>o.name==='saihoji-troopship-200')&&after.filter(o=>o.visible).every(o=>Math.abs(o.radius-160.18)<1e-6)};
 });
 report.errors=errors;report.passed&&=errors.length===0;
 report.scope='Actual 8931 combat module: debug siege start plus 40 simulated seconds covering blue reinforcements. Verifies ships stay on legacy water placement rather than infantry paving; NOT verified docking, full natural campaign, or new-city assembly migration.';
 await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
