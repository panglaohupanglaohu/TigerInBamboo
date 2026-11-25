// 表现层管线端到端：系统工坊 · 场景层 · 十二门徒。
//   选场景 → 表现层面板自动扫描（复用 battle.probe 舞台格网）→ 五个能力进管线
//   → ▶ 执行 → 验证 Worker → 画布候选（分区/前线/镜头/尾迹）→ 对照 → 存本机草稿。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('artifacts/fx-apostles-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[],capabilities:['fx.campaign','fx.camera','fx.wake','fx.ornament','fx.fire','fx.hallway','fx.sediment','fx.projectiles','fx.replay'].map(id=>({id}))};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const ctx=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
const note=()=>page.locator('#fx-workshop .agent-note').textContent();
const canvasColors=()=>page.evaluate(()=>{const cv=document.querySelector('.fx-map');if(!cv)return 0;const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data,s=new Set();for(let i=0;i<d.length;i+=40)s.add(d[i]+','+d[i+1]+','+d[i+2]);return s.size;});
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles'),{},{timeout:90000});
 await page.locator('#scene').selectOption('apostles');
 await page.waitForFunction(()=>document.body.dataset.sceneBattle==='1',{},{timeout:30000});
 const frame0=page.frames().find(f=>f.url().includes('index.html'));
 await frame0.waitForFunction(()=>!!globalThis.__tm?.scene&&!!globalThis.__tm?.camera,{},{timeout:300000});
 report.steps.tmReady='ok';
 await page.waitForFunction(()=>document.querySelector('#fx-workshop .tier-lane'),{},{timeout:60000});
 report.steps.mount='ok';
 await page.waitForFunction(()=>/扫描完成|扫描失败|没有可作用/.test(document.querySelector('#fx-workshop .agent-note')?.textContent||''),{},{timeout:240000});
 report.steps.scan=await note();
 if((report.steps.scan||'').includes('扫描失败'))throw Error('probe scan failed: '+report.steps.scan);
 report.steps.siteInfo=await page.locator('.fx-side p').nth(0).textContent();
 report.steps.baseColors=await canvasColors();
 // 五个能力进管线：侧栏「工坊分区」视图双击卡片
 await page.locator('#capability-sidebar button',{hasText:'工坊分区'}).click();
 await page.waitForTimeout(500);
 for(const id of['fx.campaign','fx.camera','fx.wake','fx.ornament','fx.replay']){
   const card=page.locator(`#capability-sidebar .cap-item[data-capability-id="${id}"]`);
   await card.scrollIntoViewIfNeeded();await card.dblclick();await page.waitForTimeout(300);
 }
 report.steps.pipelineNodes=await page.locator('#fx-workshop .tier-node').count();
 await page.screenshot({path:path.join(out,'1-pipeline.png')});
 await page.locator('#fx-workshop .tier-head-actions .primary').click();
 await page.waitForFunction(()=>{const res=document.querySelector('#fx-workshop .agent-result h4');return res&&/候选/.test(res.textContent);},{},{timeout:180000});
 report.steps.candidate=await page.locator('#fx-workshop .agent-result h4').textContent();
 report.steps.checks=await page.locator('#fx-workshop .verify-checks li').allTextContents();
 await page.waitForTimeout(1500); // 候选画布
 report.steps.candColors=await canvasColors();
 // 节点回放：fx.replay 产出 plan.replay → 侧栏 .fx-replay-map 应画出节点图
 report.steps.replayVisible=await page.locator('.fx-replay-map').isVisible();
 report.steps.replayColors=await page.evaluate(()=>{const cv=document.querySelector('.fx-replay-map');if(!cv)return 0;const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=40)if(d[i])n++;return n;});
 await page.screenshot({path:path.join(out,'2-candidate.png'),clip:{x:0,y:0,width:1600,height:1000}});
 // 实景叠加：候选预览时 fx.preview 应把前线/镜头/尾迹画进游戏场景（命令由父页发给游戏 iframe）
 const gameCmd=(action,payload={})=>page.evaluate(([a,pl])=>new Promise(res=>{const id=Math.random().toString(36).slice(2);const h=e=>{if(e.data?.type==='tm.pipeline.reply'&&e.data.id===id){removeEventListener('message',h);res(e.data.error?{error:e.data.error}:e.data.result);}};addEventListener('message',h);document.querySelector('iframe').contentWindow.postMessage({type:'tm.pipeline.command',id,action:a,payload:pl},location.origin);setTimeout(()=>res({timeout:true}),20000);}),[action,payload]);
 report.steps.overlay=await gameCmd('fx.state');
 report.steps.liveState=await gameCmd('fx.live.state');
 report.steps.previewNote=await note();
 await page.screenshot({path:path.join(out,'2b-scene-overlay.png')});
 // 对照原样（画布回到原图）
 await page.locator('#fx-workshop button',{hasText:'对照原样'}).click();
 await page.waitForTimeout(600);
 report.steps.compareColors=await canvasColors();
 await page.locator('#fx-workshop button',{hasText:'看候选'}).click();
 await page.waitForTimeout(400);
 // 存草稿
 await page.locator('#fx-workshop button',{hasText:'存为本机草稿'}).click();
 await page.waitForTimeout(1200);
 report.steps.adoptedNote=await note();
 const draft=await page.evaluate(()=>localStorage.getItem('tm.fx.plan.v1:apostles'));
 report.steps.draft=draft?JSON.parse(draft).verify:null;
 if(draft)fs.writeFileSync(path.join(out,'draft-plan.json'),draft);
 // 回退叠加层
 report.steps.reverted=await gameCmd('fx.revert');
 await page.screenshot({path:path.join(out,'3-drafted.png')});
 report.pass=!!(report.steps.candColors>report.steps.baseColors&&draft&&report.steps.checks.length>=5&&report.steps.overlay?.overlay===true&&report.steps.replayVisible&&report.steps.replayColors>50&&(report.steps.liveState?.wake?.particles||0)>0);
}catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,1200);
 try{report.state=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,note:document.querySelector('#fx-workshop .agent-note')?.textContent}));}catch{}
 try{await page.screenshot({path:path.join(out,'fail-page.png')});}catch{}
}finally{await ctx.close();await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,1).slice(0,4000));
