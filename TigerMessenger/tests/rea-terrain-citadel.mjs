// 圣城 REA 地形候选：采样→层化→WorldMesh 替换原地形；轨道净空审计；对照截图。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/rea-terrain-citadel/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const page=await (await browser.newContext({viewport:{width:1600,height:1000}})).newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='citadel'),{},{timeout:90000});
 await page.locator('#scene').selectOption('citadel');
 const frame=page.frames().find(f=>f.url().includes('index.html'));
 await frame.waitForFunction(()=>!!globalThis.__tm?.scene&&!!globalThis.__tm?.camera,{},{timeout:300000});
 // 等圣城场景聚焦完成（scenes.focus 取景到位）
 await page.waitForTimeout(8000);
 // 原地形截图
 await page.locator('#game').screenshot({path:path.join(out,'1-original.png')});
 // 直接调候选模块：probe（采样+净空审计，不换显示）
 const probe=await frame.evaluate(async()=>{const m=await import('./src/world/rea/reaTerrainCandidate.js');const t=Date.now();const r=m.probeReaTerrain({scene:globalThis.__tm.scene,camera:globalThis.__tm.camera,id:'citadel'});return{ms:Date.now()-t,r};});
 report.steps.probe=probe;
 if(!probe.r.ok)throw Error('probe failed: '+probe.r.reason);
 // 预览：藏原地形，显示 REA 层化地形
 const prev=await frame.evaluate(async()=>{const m=await import('./src/world/rea/reaTerrainCandidate.js');return m.previewReaTerrain({scene:globalThis.__tm.scene,camera:globalThis.__tm.camera,id:'citadel'});});
 report.steps.preview={previewing:prev.previewing,hiddenMeshes:prev.hiddenMeshes,ok:prev.ok};
 await page.waitForTimeout(2500);
 await page.locator('#game').screenshot({path:path.join(out,'2-rea-terrain.png')});
 // bridge 路径也过一遍：terrain.rea.state 经 pipeline command
 const bridge=await page.evaluate(()=>new Promise((res,rej)=>{const id='b1';const on=(e)=>{if(e.data?.type==='tm.pipeline.reply'&&e.data.id===id){window.removeEventListener('message',on);res(e.data);}};window.addEventListener('message',on);document.querySelector('#game').contentWindow.postMessage({type:'tm.pipeline.command',id,action:'terrain.rea.state',payload:{}},location.origin);setTimeout(()=>{window.removeEventListener('message',on);rej(new Error('bridge timeout'))},15000);}));
 report.steps.bridgeState=bridge?.result||bridge;
 // 回退
 const rev=await frame.evaluate(async()=>{const m=await import('./src/world/rea/reaTerrainCandidate.js');return m.revertReaTerrain();});
 report.steps.reverted=rev.reverted;
 await page.waitForTimeout(1500);
 await page.locator('#game').screenshot({path:path.join(out,'3-reverted.png')});
 const site=probe.r.site||{};
 report.pass=!!(site.land>0&&report.steps.preview.previewing&&rev.reverted&&(probe.r.clearance?.samples||0)>0);
}catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,1200);
 try{await page.locator('#game').screenshot({path:path.join(out,'fail.png')});}catch{}
}finally{await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,1).slice(0,4000));
