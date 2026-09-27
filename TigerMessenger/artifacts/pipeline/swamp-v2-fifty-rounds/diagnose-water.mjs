import {chromium} from '../../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebiusSwamp,null,{timeout:180000});
 const report=await page.evaluate(()=>{
 const wrap=window.__tm.messenger.landmarks.moebiusSwamp,s=wrap.userData.inner||wrap,y=s.userData.shipyard;
 const items=[];s.traverse(o=>{if(o.isMesh&&(/water|haze|depth|volume/i.test(o.name)||o.material?.transparent))items.push({name:o.name,type:o.geometry.type,position:o.position.toArray(),material:o.material.type,opacity:o.material.opacity,color:o.material.color?.getHexString(),visible:o.visible,renderOrder:o.renderOrder,depthWrite:o.material.depthWrite,depthTest:o.material.depthTest});});return {items};
 });
 report.pageErrors=errors;
 await writeFile('TigerMessenger/artifacts/pipeline/swamp-v2-fifty-rounds/'+(process.argv[2]||'r02')+'/water-materials.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} finally {await browser.close();}
