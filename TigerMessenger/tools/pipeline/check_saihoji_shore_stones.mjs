import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__tm?.messenger?.landmarks?.saihojiPhalanx,null,{timeout:180000});
 const report=await page.evaluate(()=>{const t=window.__tm;const scene=t.scene;const old=scene.getObjectByName('saihoji-scree-rocks'),shore=scene.getObjectByName('saihoji-shore-stones');return {passed:!old&&!!shore,oldPresent:!!old,shorePresent:!!shore,meshes:shore?.children.length,colors:shore?.children.map(x=>x.material.color.getHexString())};});
 report.errors=errors;report.passed&&=errors.length===0;
 await writeFile('TigerMessenger/artifacts/pipeline/saihoji-target-integration/shore-web-report.json',JSON.stringify(report,null,2));console.log(report);
 if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
