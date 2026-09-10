import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8765/TigerMessenger/tools/originals/capture_supplemental.html');
 const data=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {buildChristchurchTramSystem}=await import('../../src/world/tramSystem.js');
  const {P}=await import('../../src/core/params.js');
  const system=buildChristchurchTramSystem(new THREE.Scene(),160);
  return {source:'src/world/tramSystem.js',speed:P.tramSpeed,routes:[system.curves.red,system.curves.blue].map((curve,index)=>({index,direction:index===0?1:-1,length:curve.getLength(),points:Array.from({length:4096},(_,i)=>curve.getPointAt(i/4096).toArray())}))};
 });
 data.sourceSha256=createHash('sha256').update(await readFile(new URL('../../src/world/tramSystem.js',import.meta.url))).digest('hex');
 await writeFile(new URL('../../godot/data/saihoji-tram-routes.json',import.meta.url),JSON.stringify(data));
 console.log(JSON.stringify({speed:data.speed,routes:data.routes.map(x=>({index:x.index,length:x.length,count:x.points.length}))}));
} finally {await browser.close();}
