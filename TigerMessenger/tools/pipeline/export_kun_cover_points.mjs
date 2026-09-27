import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/artifacts/pipeline/kun-roll-model/');
 await page.waitForFunction(()=>window.rollReview?.kun?.userData.saihojiCoverPoints?.length===50,null,{timeout:120000});
 const data=await page.evaluate(()=>({revision:'20260920-moving-cover',coordinates:'leviathan-island local',source:'production arrangeSaihojiPines',points:rollReview.kun.userData.saihojiCoverPoints.map(p=>({id:p.id,localPoint:p.localPoint.toArray(),clearance:p.clearance,pineSeed:p.pine.userData.sourceSeed}))}));
 if(errors.length)throw new Error(errors.join('\n'));
 for(const file of ['TigerMessenger/assets/layouts/saihoji-kun-cover-points.json','TigerMessenger/godot/data/saihoji-kun-cover-points.json'])await writeFile(file,JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({points:data.points.length,errors}));
}finally{await browser.close();}
