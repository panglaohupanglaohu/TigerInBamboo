// 山形管线端到端：系统工坊 · 高山圣城 · 实景采样 → Worker 山形 → 验证 → low poly 预览 → 对照 → 采用。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/mountain-citadel-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[]},COMMIT=process.env.COMMIT!=='0';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const page=await (await browser.newContext({viewport:{width:1600,height:1000}})).newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
const W='#mountain-workshop',note=()=>page.locator(W+' .agent-note').textContent();
const cmd=(action,payload={})=>page.evaluate(([action,payload])=>new Promise((res,rej)=>{const id='t'+Math.random();const on=e=>{if(e.data?.type==='tm.pipeline.reply'&&e.data.id===id){removeEventListener('message',on);e.data.error?rej(Error(e.data.error)):res(e.data.result);}};addEventListener('message',on);document.querySelector('#game').contentWindow.postMessage({type:'tm.pipeline.command',id,action,payload},location.origin);setTimeout(()=>rej(Error('timeout '+action)),60000);}),[action,payload]);
const shot=async(name)=>{await page.waitForTimeout(1500);await page.locator('#game').screenshot({path:path.join(out,name)});};
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html?learningView=tree#learning');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='citadel'),{},{timeout:90000});
 // 学习工坊 · 能力树：目标路径「圣城山形」→ 一键送进系统工坊
 await page.waitForSelector('.ctree .ctree-goal[data-goal="mountain"]',{timeout:120000});
 report.steps.tree=await page.evaluate(()=>({...document.querySelector('.ctree').dataset,needs:[...document.querySelectorAll('.ctree-goal[data-goal="mountain"] .ctree-chain li b')].map(b=>b.textContent),branches:[...document.querySelectorAll('.ctree-branch header b')].map(b=>b.textContent)}));
 await page.locator('.ctree-line[data-line="terrain"]').click();await page.waitForTimeout(400);
 await page.screenshot({path:path.join(out,'L-capability-tree.png')});
 report.steps.terrainDrawer=await page.locator('.ctree-drawer').innerText().then(t=>t.slice(0,400));
 await page.locator('.ctree-goal[data-goal="mountain"] .ctree-go').click();
 const frame=page.frames().find(f=>f.url().includes('index.html'));
 await frame.waitForFunction(()=>!!globalThis.__tm?.scene,{},{timeout:300000});
 await page.waitForFunction(()=>document.querySelectorAll('#mountain-workshop .tier-node').length>=5,{},{timeout:120000});
 report.steps.sceneAfterGoal=await page.evaluate(()=>({scene:window.__tmCurrentScene,hash:location.hash,status:document.querySelector('#status')?.textContent}));
 await page.waitForFunction(()=>/扫描完成|扫描失败/.test(document.querySelector('#mountain-workshop .agent-note')?.textContent||''),{},{timeout:240000});
 report.steps.scan=await note();if(report.steps.scan.includes('失败'))throw Error(report.steps.scan);
 report.steps.site=await page.locator('.mountain-side p').nth(0).textContent();
 report.steps.nodes=await page.locator(W+' .tier-node').count();
 // 机位：几个固定视角，原样先拍
 const views=JSON.parse(process.env.VIEWS||'[{"yaw":0.6,"pitch":0.5,"distance":330},{"yaw":2.4,"pitch":0.35,"distance":300}]');
 report.steps.cam=await frame.evaluate(()=>Object.keys(globalThis.__tm||{}).filter(k=>/cam|view/i.test(k)));
 const box=await page.locator('#game').boundingBox();await page.locator('#game').scrollIntoViewIfNeeded();const b2=await page.locator('#game').boundingBox();await page.mouse.move(b2.x+b2.width/2,b2.y+b2.height/2);for(let i=0;i<Number(process.env.ZOOM||6);i++){await page.mouse.wheel(0,400);await page.waitForTimeout(150);}
 await shot('0-original.png');
 await page.locator(W+' .tier-head-actions .primary').click();
 await page.waitForFunction(()=>/候选/.test(document.querySelector('#mountain-workshop .agent-result h4')?.textContent||'')||/执行失败/.test(document.querySelector('#mountain-workshop .agent-note')?.textContent||''),{},{timeout:240000});
 report.steps.note=await note();
 report.steps.candidate=await page.locator(W+' .agent-result h4').textContent().catch(()=>null);
 report.steps.report=await page.locator(W+' .agent-result ul').first().locator('li').allTextContents().catch(()=>[]);
 report.steps.checks=await page.locator(W+' .verify-checks li').allTextContents();
 report.steps.shape=await page.locator('.mountain-side p').nth(1).textContent();
 report.steps.state=await cmd('mountain.state');
 await page.locator('#game').scrollIntoViewIfNeeded();await shot('1-mountain.png');
 await page.locator(W+' button',{hasText:'对照原样'}).click();await shot('2-compare-original.png');
 report.steps.compare=await cmd('mountain.state');
 await page.locator(W+' button',{hasText:'看候选'}).click();
 await page.screenshot({path:path.join(out,'3-workshop-page.png')});
 if(COMMIT){await page.locator(W+' button',{hasText:'采用山形'}).click();await page.waitForTimeout(1500);report.steps.adopted=await frame.evaluate(()=>!!localStorage.getItem('tm.mountain.adopted.v1:citadel'));}
 report.pass=!!(report.steps.state?.previewing&&report.steps.state.triangles>1000&&/验证通过|需留意/.test(report.steps.candidate||'')&&report.steps.compare?.comparing&&!report.errors.length);
}catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,1200);try{report.note=await note();await page.screenshot({path:path.join(out,'fail-page.png')});}catch{}}
finally{await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,1).slice(0,5000));
