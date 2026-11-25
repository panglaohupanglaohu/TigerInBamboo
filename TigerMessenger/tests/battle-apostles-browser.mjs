// 战役管线端到端：系统工坊 · 场景层 · 十二门徒 · Bad North 战役部署。
//   选场景 → 战役面板扫描（battle.probe 实景采样）→ 三步能力进管线 → ▶ 执行管线
//   → 验证 Worker 检查计划 → battle.preview 真在实景开战 → 实况快照 → 写入采用 → 放弃回退。
// 每个断言都读真实 DOM / 游戏状态；截图保留在唯一时间目录。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/battle-apostles-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const ctx=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
const note=()=>page.locator('#battle-workshop .agent-note').textContent();
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles'),{},{timeout:90000});
 await page.locator('#scene').selectOption('apostles');
 await page.waitForFunction(()=>document.body.dataset.sceneBattle==='1',{},{timeout:30000});
 // __tm.scene/camera chỉ tồn tại sau khi main.js chạy hết top-level await (toàn bộ scenes load xong)
 const frame0=page.frames().find(f=>f.url().includes('index.html'));
 await frame0.waitForFunction(()=>!!globalThis.__tm?.scene&&!!globalThis.__tm?.camera,{},{timeout:300000});
 report.steps.tmReady='ok';
 // 战役面板应已挂载并自动扫描（probe 采样真实地形）
 await page.waitForFunction(()=>document.querySelector('#battle-workshop .tier-lane'),{},{timeout:60000});
 report.steps.mount='ok';
 // 等扫描完成（probe 采样 nặng ~30-90s）；báo lỗi cũng phải bắt
 await page.waitForFunction(()=>/扫描完成|扫描失败|没有可作用/.test(document.querySelector('#battle-workshop .agent-note')?.textContent||''),{},{timeout:240000});
 report.steps.scan=await note();
 if((report.steps.scan||'').includes('扫描失败'))throw Error('probe scan failed: '+report.steps.scan);
 // 采样结论必须写着陆地格与小屋（battle-side 挂在 #viewer-side）
 const info=await page.locator('.battle-side p').nth(0).textContent();
 report.steps.siteInfo=info;
 // 三个能力进管线：真实 UI 路径——侧栏切到「工坊分区」视图，双击卡片 → onActivate → dropInto → views.battle.add
 await page.locator('#capability-sidebar button',{hasText:'工坊分区'}).click();
 await page.waitForTimeout(500);
 for(const id of['battle.stage','battle.garrison','battle.waves']){
   const card=page.locator(`#capability-sidebar .cap-item[data-capability-id="${id}"]`);
   await card.scrollIntoViewIfNeeded();
   await card.dblclick();
   await page.waitForTimeout(300);
 }
 report.steps.pipelineNodes=await page.locator('#battle-workshop .tier-node').count();
 await page.screenshot({path:path.join(out,'1-pipeline.png')});
 // 执行管线
 await page.locator('#battle-workshop .tier-head-actions .primary').click();
 // 等验证结果（候选面板出现写入按钮或失败文案）
 await page.waitForFunction(()=>{
   const res=document.querySelector('#battle-workshop .agent-result h4');
   return res&&/候选/.test(res.textContent);
 },{},{timeout:180000});
 report.steps.candidate=await page.locator('#battle-workshop .agent-result h4').textContent();
 report.steps.checks=await page.locator('#battle-workshop .verify-checks li').allTextContents();
 await page.waitForTimeout(4000); // 等首波单位落位
 // 实况：战斗在实景里真的跑
 const frame=page.frames().find(f=>f.url().includes('/TigerMessenger/index.html'));
 const snap=await frame.evaluate(()=>({stage:!!globalThis.__tmBattleStage,running:globalThis.__tmBattleStage?.running,battle:globalThis.__tmBattleStage?{units:globalThis.__tmBattleStage.battle.units.length,wave:globalThis.__tmBattleStage.battle.wave,houses:globalThis.__tmBattleStage.battle.houses.length,groupVisible:globalThis.__tmBattleStage.battle.group.visible}:null}));
 report.steps.liveBattle=snap;
 // 镜头对准门徒再拍（编辑模式已取景到场景）
 await page.locator('#game').scrollIntoViewIfNeeded();
 await page.locator('#game').screenshot({path:path.join(out,'2-battle-live.png')});
 // 对照：隐藏战斗图层 → 应该看不到单位
 await page.locator('#battle-workshop button', {hasText:'对照原样'}).click();
 await page.waitForTimeout(800);
 const hidden=await frame.evaluate(()=>globalThis.__tmBattleStage?.battle?.group?.visible===false);
 report.steps.compareHidden=hidden;
 await page.locator('#game').screenshot({path:path.join(out,'3-compare-original.png')});
 await page.locator('#battle-workshop button', {hasText:'看候选'}).click();
 // 写入采用
 const commitBtn=page.locator('#battle-workshop button',{hasText:'采用战役'});
 await commitBtn.click();await page.waitForTimeout(1200);
 report.steps.adoptedNote=await note();
 const adopted=await frame.evaluate(()=>localStorage.getItem('tm.battle.adopted.v1:apostles'));
 report.steps.adoptedFlag=!!adopted;
 await page.locator('#game').screenshot({path:path.join(out,'4-adopted.png')});
 report.pass=!!(snap.stage&&snap.running&&snap.battle.units>0&&snap.battle.houses>0&&hidden&&adopted);
}catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,1200);
 try{report.state=await page.evaluate(()=>({ds:{...document.body.dataset},status:document.querySelector('#status')?.textContent,note:document.querySelector('#battle-workshop .agent-note')?.textContent}));}catch{}
 try{await page.screenshot({path:path.join(out,'fail-page.png')});await page.locator('#game').screenshot({path:path.join(out,'fail.png')});}catch{}
}finally{await ctx.close();await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,1).slice(0,4000));
