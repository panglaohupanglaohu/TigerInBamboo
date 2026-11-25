// R23 端到端：九级成熟度在页面上看得见。
//   新开隔离浏览器 → pipeline.html?learningView=tree#learning → 能力树每条有可执行能力的线带 L1–L9 徽章、顶栏有九级分布、「可执行（去重）」
//   → 点地形线，抽屉里每个 ⚙ 能力带级别 → 切到系统工坊，左栏 ⚙ 能力带徽章、计数写「场景层可执行 N · 全系统去重 M」
//   → 另开一个上下文把 capability-maturity.json 拦成 404：树和左栏照常显示，只是写「成熟度数据未生成」。每步截图，人必须打开看。
// 前置：先在 TigerMessenger 目录跑 $NODE tools/refactor/build-capability-maturity.mjs（没有 json 时第一段会直接判失败并说明）。
// 运行：cd TigerMessenger && $NODE tests/capability-maturity-browser.mjs   （需要 8931 服务）
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../artifacts/capability-maturity-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[],pass:false};
const BASE='http://localhost:8931/TigerMessenger/pipeline.html';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const expect=(cond,msg)=>{if(!cond)throw Error(msg);};
const watch=(page,tag)=>{page.on('pageerror',e=>report.errors.push(tag+' pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(tag+' console: '+m.text().slice(0,300));});};
const treeState=page=>page.evaluate(()=>{const sh=document.querySelector('.ctree');const lines=[...document.querySelectorAll('.ctree-line')];
 return {maturity:sh?.dataset.maturity||null,execUnique:sh?.dataset.treeExecUnique||null,execPerLine:sh?.dataset.treeExecPerLine||null,lines:lines.length,
  withExec:lines.filter(r=>[...r.querySelectorAll('.ctree-name em')].some(e=>e.textContent.startsWith('⚙'))).length,badged:lines.filter(r=>r.querySelector('.ctree-mat')).map(r=>({line:r.dataset.line,level:r.dataset.maturity,text:r.querySelector('.ctree-mat').textContent})),
  pill:document.querySelector('.ctree-pills .k-exec')?.textContent||'',dist:document.querySelector('.ctree-matdist')?.textContent||''};});
const sideState=page=>page.evaluate(()=>{const s=document.querySelector('#capability-sidebar');return {count:s?.querySelector('.cap-count')?.textContent||'',unique:s?.querySelector('.cap-count')?.dataset.unique||'',
 runnable:s?.querySelectorAll('.cap-item.runnable:not(.cap-set)').length||0,badges:[...(s?.querySelectorAll('.cap-item.runnable:not(.cap-set) .cap-mat')||[])].map(b=>b.textContent),missingBadge:[...(s?.querySelectorAll('.cap-item.runnable:not(.cap-set)')||[])].filter(c=>!c.querySelector('.cap-mat')).map(c=>c.dataset.capabilityId)};});
try{
 // ── 1. 正常：有成熟度数据 ──
 const ctx=await browser.newContext({viewport:{width:1600,height:1000}});const page=await ctx.newPage();watch(page,'p1');
 const resp=await ctx.request.get('http://localhost:8931/TigerMessenger/src/scene-authoring/catalog/capability-maturity.json');
 expect(resp.ok(),'capability-maturity.json 读不到（HTTP '+resp.status()+'）：先在 TigerMessenger 目录跑 build-capability-maturity.mjs');
 const mj=await resp.json();report.steps.json={rows:mj.rows.length,byLevel:mj.distribution.byLevel,missingEverywhere:mj.distribution.missingEverywhere,counts:mj.counts.map(c=>({id:c.id,value:c.value,seen:c.seen}))};
 await page.goto(BASE+'?learningView=tree#learning');
 await page.waitForSelector('.ctree .ctree-line',{timeout:180000});
 await page.waitForFunction(()=>document.querySelector('.ctree')?.dataset.maturity==='loaded',{},{timeout:60000});
 await page.waitForTimeout(800);
 const t1=await treeState(page);report.steps.tree=t1;await page.screenshot({path:path.join(out,'1-tree.png')});
 await page.locator('.ctree-top').screenshot({path:path.join(out,'1b-tree-top.png')});
 expect(t1.badged.length>0,'能力树上没有任何成熟度徽章');
 expect(t1.badged.length===t1.withExec,'有可执行能力的线 '+t1.withExec+' 条，带徽章的 '+t1.badged.length+' 条');
 expect(t1.badged.every(b=>/^L[0-9]$/.test(b.text)&&String(b.level)===b.text.slice(1)),'徽章文字与 data-maturity 不一致');
 expect(/九级成熟度/.test(t1.dist)&&/①/.test(t1.dist)&&/⑨/.test(t1.dist),'顶栏没有九级分布：'+t1.dist);
 expect(/可执行（去重）/.test(t1.pill),'顶栏可执行没改成去重口径：'+t1.pill);
 // 点一条带徽章的线（优先地形），抽屉里 ⚙ 能力带级别
 const pick=(t1.badged.find(b=>b.line==='terrain')||t1.badged[0]).line;
 await page.locator(`.ctree-line[data-line="${pick}"]`).click();await page.waitForTimeout(500);
 const drawer=await page.evaluate(()=>({buttons:[...document.querySelectorAll('.ctree-exec button')].map(b=>({text:b.textContent,level:b.dataset.maturity||null}))}));
 report.steps.drawer={line:pick,...drawer};await page.screenshot({path:path.join(out,'2-tree-drawer-'+pick+'.png')});
 expect(drawer.buttons.length>0&&drawer.buttons.every(b=>b.level!==null),'抽屉里有能力没有级别：'+JSON.stringify(drawer.buttons.filter(b=>b.level===null)));
 // 左栏
 await page.locator('#system-tab').click();
 await page.waitForFunction(()=>document.querySelector('#capability-sidebar .cap-item.runnable .cap-mat'),{},{timeout:120000});
 await page.waitForTimeout(800);
 const line=page.locator('#capability-sidebar .cap-line[data-line="terrain"] summary');if(await line.count())await line.first().click();
 await page.waitForTimeout(400);
 const s1=await sideState(page);report.steps.sidebar=s1;
 await page.screenshot({path:path.join(out,'3-system-sidebar.png')});await page.locator('#capability-sidebar').screenshot({path:path.join(out,'3b-sidebar.png')});
 expect(/可执行 \d+/.test(s1.count)&&s1.count.includes('全系统去重'),'左栏计数没写口径：'+s1.count);
 expect(s1.unique===String(mj.rows.length),'左栏去重数 '+s1.unique+' ≠ json 行数 '+mj.rows.length);
 expect(s1.badges.length>0&&s1.missingBadge.length===0,'左栏有 ⚙ 能力没有徽章：'+s1.missingBadge.slice(0,8).join('、'));
 await ctx.close();
 // ── 2. 降级：json 404 ──
 const ctx2=await browser.newContext({viewport:{width:1600,height:1000}});await ctx2.route('**/capability-maturity.json*',r=>r.fulfill({status:404,body:'not found'}));
 const p2=await ctx2.newPage();watch(p2,'p2');
 await p2.goto(BASE+'?learningView=tree#learning');await p2.waitForSelector('.ctree .ctree-line',{timeout:180000});await p2.waitForTimeout(1500);
 const t2=await treeState(p2);report.steps.degradedTree=t2;await p2.screenshot({path:path.join(out,'4-degraded-tree.png')});
 expect(t2.maturity==='missing'&&t2.badged.length===0&&/成熟度数据未生成/.test(t2.dist),'缺数据时能力树没有降级：'+JSON.stringify({m:t2.maturity,b:t2.badged.length,d:t2.dist}));
 expect(t2.lines>=27,'缺数据时能力树线数不对：'+t2.lines);
 await p2.locator('#system-tab').click();await p2.waitForFunction(()=>document.querySelector('#capability-sidebar .cap-item.runnable'),{},{timeout:120000});await p2.waitForTimeout(800);
 const s2=await sideState(p2);report.steps.degradedSidebar=s2;await p2.locator('#capability-sidebar').screenshot({path:path.join(out,'5-degraded-sidebar.png')});
 expect(s2.badges.length===0&&/可执行 \d+/.test(s2.count)&&/成熟度数据未生成/.test(s2.count),'缺数据时左栏没有降级：'+s2.count);
 await ctx2.close();
 report.pass=report.errors.filter(e=>e.includes('pageerror')).length===0;
 if(!report.pass)throw Error('page errors: '+report.errors.join(' | '));
}catch(e){report.failure=e.message;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,failure:report.failure||null,out},null,1));
await browser.close();process.exit(report.pass?0:1);
