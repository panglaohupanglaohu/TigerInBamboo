import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import arrivalData from '../../assets/navigation/citadelRedArrival.js';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/citadelRedArrival.js*',route=>route.fulfill({contentType:'text/javascript',body:'export default '+JSON.stringify({...arrivalData,passed:false,invalidatedReason:'negative control: intentionally invalidated route'})+';'}));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.saihojiPhalanx,null,{timeout:180000});
 const report=await page.evaluate(()=>{
  const t=window.__tm,b=t.messenger.landmarks.saihojiPhalanx;t.P.timeOfDay=.6;t.P.daySpeed=0;b.root.userData.debugSiege();
  const guards=b.root.getObjectByName('citadel-red-garrison'),before=guards.children.map(s=>s.userData.uid);
  for(let i=0;i<40;i++){b.root.traverse(s=>{if(s.userData.siegeEntryRoute){s.userData.dead=true;s.visible=false;}});b.update(1,i);}
  return {route:b.root.userData.redArrivalRoute,before,after:guards.children.filter(s=>s.visible&&!s.userData.dead).map(s=>s.userData.uid),ships:b.root.children.filter(s=>s.userData.kind==='red-reinforce-ship').length};
 });
 report.errors=errors;report.passed=report.route.source==='unavailable-new-front-harbor'&&report.ships===0&&report.before.length===28&&JSON.stringify(report.before)===JSON.stringify(report.after)&&!errors.length;
 report.scope='Negative control with intercepted invalid route data; production route is unchanged. Safety gate only: invalid route receives no new ships; original garrison identity retained. No boarding or campaign completion claim.';
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/red-arrival-unavailable.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
