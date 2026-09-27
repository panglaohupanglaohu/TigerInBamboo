import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(/applyOldTownPalace|跳过/.test(m.text()))errs.push(m.text().slice(0,200));});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(6500);
console.log(JSON.stringify({report:await p.evaluate(()=>window.__tm.scene.getObjectByName('castleContainer')?.userData.holyOldTownPalace||null),errs}));}finally{await b.close();}
