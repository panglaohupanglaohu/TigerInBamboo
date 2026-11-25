// 快速诊断：battle.probe 在游戏里走一遍的真实耗时与结果
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const page=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage();
page.on('pageerror',e=>console.log('PAGEERR',e.message));
page.on('console',m=>{if(m.type()==='error'||m.text().includes('sceneBattle'))console.log(m.type(),m.text().slice(0,300));});
await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:240000});
await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles'),{},{timeout:90000});
await page.locator('#scene').selectOption('apostles');
await page.waitForTimeout(2500);
const frame=page.frames().find(f=>f.url().includes('index.html'));
const t0=Date.now();
const probe=await frame.evaluate(async()=>{const t=Date.now();try{const m=await import('./src/world/rea/sceneBattle.js');const r=m.probeSceneBattle({scene:globalThis.__tm.scene,camera:globalThis.__tm.camera,id:'apostles'});return{ms:Date.now()-t,r:{...r,site:r.site?{cells:r.site.cells,land:r.site.land,houses:r.site.houses,maxLevel:r.site.maxLevel}:null}};}catch(e){return{ms:Date.now()-t,err:String(e.stack||e).slice(0,500)};}});
console.log('probe:',JSON.stringify(probe),'total',Date.now()-t0);
const snap=await frame.evaluate(()=>{const m=import('./src/world/rea/sceneBattle.js');return m.then(x=>x.battleSnapshot());});
console.log('snapshot:',JSON.stringify(snap));
await browser.close();
