// 能力成长与闭环：8769 学习管线与 8931 学习工坊同一模型；系统工坊左栏能力线 ⇄ 学习工坊 ⇄ 管线。
// 新的非持久浏览器上下文，不读写用户存档；加入管线只发生在测试上下文内，不保存配方。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/capability-lineage-20261114/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});const report={errors:[],out};
try{
 const context=await browser.newContext({viewport:{width:1500,height:1000}}),shot=(p,name)=>p.screenshot({path:path.join(out,name)});
 const watch=p=>{p.on('pageerror',e=>report.errors.push(e.message));return p;};
 // ── 8769 源库学习管线
 const src=watch(await context.newPage());await src.goto('http://localhost:8769/pipeline.html');await src.waitForSelector('.capability-lineage .lineage-queue li');
 const S=src.locator('.capability-lineage');report.source={lines:+await S.getAttribute('data-lineage-lines'),queue:+await S.getAttribute('data-lineage-queue')};
 assert.equal(report.source.lines,27);assert.equal(await src.locator('.lineage-stage').count(),7);assert.equal(await src.locator('.lineage-svg .row').count(),27);
 report.source.order=await src.locator('.lineage-queue li').evaluateAll(ns=>ns.map(n=>n.dataset.queueClip));
 await src.locator('.lineage-svg .row[data-line="shore"]').click();assert.equal(await S.getAttribute('data-lineage-line'),'shore');
 report.source.shore=await src.locator('.lineage-gen').evaluateAll(ns=>ns.map(n=>n.dataset.generation));assert.deepEqual(report.source.shore.slice(0,2),['A','A+']);
 assert.equal(await src.locator('.lineage-gen.is-frontier').count(),1);await shot(src,'source-top.png');await S.screenshot({path:path.join(out,'source-lineage.png')});
 await src.locator('.lineage-target button').last().click();await src.waitForFunction(()=>document.querySelectorAll('.evolution-event').length===1);report.source.focus=await src.locator('.evolution-event').getAttribute('data-evolution-clip');
 await src.setViewportSize({width:390,height:900});report.source.mobileOverflow=await src.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(report.source.mobileOverflow,false);await shot(src,'source-mobile.png');await src.close();
 // ── 8931 学习工坊（默认页签）
 const page=watch(await context.newPage());await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#learning');await page.waitForSelector('.capability-lineage .lineage-queue li',{timeout:240000});
 assert.equal(await page.locator('.learning-tabs button[aria-pressed=true]').innerText(),'能力成长与闭环');
 const L=page.locator('.capability-lineage');report.system={lines:+await L.getAttribute('data-lineage-lines'),queue:+await L.getAttribute('data-lineage-queue')};
 assert.equal(report.system.lines,report.source.lines);assert.equal(report.system.queue,report.source.queue,'两页缺口数相同');
 report.system.loop=await page.locator('.lineage-stage').evaluateAll(ns=>ns.map(n=>n.innerText.replace(/\n/g,' | ')));
 report.system.executables=await page.locator('.lineage-exp [data-executable]').count();assert.ok(report.system.executables>9,'系统侧比源库多出执行适配');
 await page.locator('.lineage-svg .row[data-line="shore"]').click();assert.deepEqual(await page.locator('.lineage-gen').evaluateAll(ns=>ns.map(n=>n.dataset.generation)),report.source.shore,'同一条线两页代际相同');
 await shot(page,'system-top.png');await L.screenshot({path:path.join(out,'system-lineage.png')});
 // 学习 → 演进明细
 await page.locator('.lineage-target button').last().click();await page.waitForSelector('.evolution-event');assert.equal(await page.locator('.evolution-event').count(),1);assert.equal(await page.locator('.evolution-event').getAttribute('data-evolution-clip'),report.source.focus);
 assert.equal(await page.locator('.learning-tabs button[aria-pressed=true]').innerText(),'时间线与能力演进');
 // 系统工坊左栏：能力线视图 → 学习工坊
 await page.locator('#system-tab').click();await page.waitForSelector('#capability-sidebar .cap-line');
 report.sidebar={lines:await page.locator('#capability-sidebar .cap-line[data-line]').count(),years:await page.locator('#capability-sidebar .cap-line[data-line] .cap-line-year').allInnerTexts()};
 assert.equal(report.sidebar.lines,27);assert.deepEqual(report.sidebar.years,[...report.sidebar.years].sort(),'能力线按诞生时间排列');
 await page.locator('#capability-sidebar .cap-line[data-line="terrain"] summary').click();assert.ok(await page.locator('#capability-sidebar .cap-line[data-line="terrain"] .cap-item.runnable').count()>=3);
 await shot(page,'system-sidebar.png');await page.locator('#capability-sidebar').screenshot({path:path.join(out,'sidebar.png')});
 await page.locator('#capability-sidebar .cap-line[data-line="grid"] summary').click();await page.locator('#capability-sidebar .cap-line[data-line="grid"] .cap-line-next').click();
 await page.waitForSelector('.capability-lineage');assert.equal(await page.locator('.capability-lineage').getAttribute('data-lineage-line'),'grid');
 // 学习工坊 → 管线：可执行能力加入场景管线（仅测试上下文）
 await page.locator('.lineage-svg .row[data-line="terrain"]').click();const exec=page.locator('.lineage-steps .lineage-exec').first();report.use=await exec.innerText();await exec.click();
 await page.waitForFunction(()=>location.hash==='#scene');report.status=await page.locator('#status').innerText();assert.match(report.status,/已加入场景管线/);
 // 分区视图仍可用，选择被记住
 await page.locator('#capability-sidebar .cap-view button').nth(1).click();assert.equal(await page.locator('#capability-sidebar .cap-list').getAttribute('data-view'),'domain');assert.equal(await page.locator('#capability-sidebar .cap-line').count(),0);
 await page.locator('#capability-sidebar .cap-view button').nth(0).click();
 await page.setViewportSize({width:390,height:900});await page.locator('#learning-workshop-tab').click();await page.waitForSelector('.capability-lineage');report.system.mobileOverflow=await page.evaluate(()=>document.querySelector('#learning-workshop').scrollWidth>innerWidth+1);assert.equal(report.system.mobileOverflow,false);await shot(page,'system-mobile.png');
 await context.close();assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,out,failure:report.failure?.slice(0,600),source:report.source&&{lines:report.source.lines,queue:report.source.queue},system:report.system&&{queue:report.system.queue,executables:report.system.executables}}));}
