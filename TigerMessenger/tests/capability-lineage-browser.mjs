// 能力成长与闭环：8769 学习管线与 8931 学习工坊同一模型；系统工坊左栏能力线 ⇄ 学习工坊 ⇄ 管线。
// 新的非持久浏览器上下文，不读写用户存档；加入管线只发生在测试上下文内，不保存配方。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/capability-lineage-20261115/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});const report={errors:[],out};
try{
 const context=await browser.newContext({viewport:{width:1500,height:1000}}),shot=(p,name)=>p.screenshot({path:path.join(out,name)});
 const watch=p=>{p.on('pageerror',e=>report.errors.push(e.message));return p;};
 // ── 8769 源库学习管线
 const src=watch(await context.newPage());await src.goto('http://localhost:8769/pipeline.html');await src.waitForSelector('.cmap [data-map-line]');assert.equal(await src.locator('.cmap [data-map-line]').count(),27,'8769 能力地图');await src.screenshot({path:path.join(out,'source-map.png')});await src.locator('#capability-lineage-fold>summary').click();await src.waitForSelector('.capability-lineage .lineage-queue li');
 const S=src.locator('.capability-lineage');report.source={lines:+await S.getAttribute('data-lineage-lines'),queue:+await S.getAttribute('data-lineage-queue')};
 assert.equal(report.source.lines,27);assert.equal(await src.locator('.lineage-stage').count(),7);assert.equal(await src.locator('.lineage-svg .row').count(),27);
 report.source.order=await src.locator('.lineage-queue li').evaluateAll(ns=>ns.map(n=>n.dataset.queueClip));
 await src.locator('.lineage-svg .row[data-line="shore"]').click();assert.equal(await S.getAttribute('data-lineage-line'),'shore');
 report.source.shore=await src.locator('.lineage-gen').evaluateAll(ns=>ns.map(n=>n.dataset.generation));assert.deepEqual(report.source.shore.slice(0,2),['A','A+']);
 assert.equal(await src.locator('.lineage-gen.is-frontier').count(),1);assert.equal(await src.locator('.lineage-net [data-net-line]').count(),27,'8769 也有能力网');await shot(src,'source-top.png');await S.screenshot({path:path.join(out,'source-lineage.png')});
 await src.locator('.lineage-target button').last().click();await src.waitForFunction(()=>document.querySelectorAll('.evolution-event').length===1);report.source.focus=await src.locator('.evolution-event').getAttribute('data-evolution-clip');
 await src.setViewportSize({width:390,height:900});report.source.mobileOverflow=await src.evaluate(()=>['capability-map','capability-lineage-fold','capability-evolution'].some(id=>{const e=document.getElementById(id);return e.scrollWidth>e.clientWidth+1;}));assert.equal(report.source.mobileOverflow,false,'能力地图 / 明细 / 时间线三段在窄屏不溢出');
 report.source.pageOverflowFrom=await src.evaluate(()=>[...document.querySelector('main').children].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.tagName));   // 页面其余旧区块随上游进度文字变化，只记录不判定await shot(src,'source-mobile.png');await src.close();
 // ── 8931 学习工坊（默认页签）
 const page=watch(await context.newPage());await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#learning');await page.waitForSelector('.cmap [data-map-line]',{timeout:240000});
 // 默认：能力地图
 assert.equal(await page.locator('.learning-tabs button[aria-pressed=true]').innerText(),'能力地图');assert.equal(await page.locator('.learning-tabs button').count(),5,'常用页签：雷达·树·地图·队列·时间线');
 assert.equal(await page.locator('.cmap [data-map-line]').count(),27);assert.match(await page.locator('.cmap-panel h2').innerText(),/整个能力库/);assert.equal(await page.locator('.cmap-todo').count(),3);
 await page.screenshot({path:path.join(out,'map-overview.png')});
 await page.getByLabel('场景',{exact:true}).selectOption('apostles');assert.match(await page.locator('.cmap-panel h2').innerText(),/十二门徒/);assert.ok(await page.locator('[data-map-note="apostles"]').count(),'显示已做过的对照结论');assert.ok(await page.locator('.cmap-node.unused').count()>5);
 await page.screenshot({path:path.join(out,'map-apostles.png')});
 await page.locator('[data-map-line="terrain"]').click();assert.match(await page.locator('.cmap-panel h2').innerText(),/地形/);assert.ok(await page.locator('.cmap-steps li').count()>=4);
 assert.ok((await page.locator('[data-map-scene-line="terrain"]').innerText()).includes('terrain/shape.js'),'抽屉列出这条线上的旧副本');
 await page.screenshot({path:path.join(out,'map-apostles-terrain.png')});
 await page.locator('.cmap-close').click();assert.match(await page.locator('.cmap-panel h2').innerText(),/十二门徒/);
 report.mapOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(report.mapOverflow,false);
 await page.getByRole('button',{name:'队列与闭环',exact:true}).click();await page.waitForSelector('.capability-lineage .lineage-queue li');
 const L=page.locator('.capability-lineage');report.system={lines:+await L.getAttribute('data-lineage-lines'),queue:+await L.getAttribute('data-lineage-queue')};
 assert.equal(report.system.lines,report.source.lines);assert.equal(report.system.queue,report.source.queue,'两页缺口数相同');
 report.system.loop=await page.locator('.lineage-stage').evaluateAll(ns=>ns.map(n=>n.innerText.replace(/\n/g,' | ')));
 report.system.executables=await page.locator('.lineage-exp [data-executable]').count();assert.ok(report.system.executables>9,'系统侧比源库多出执行适配');
 await page.locator('.lineage-svg .row[data-line="shore"]').click();assert.deepEqual(await page.locator('.lineage-gen').evaluateAll(ns=>ns.map(n=>n.dataset.generation)),report.source.shore,'同一条线两页代际相同');
 await shot(page,'system-top.png');await L.screenshot({path:path.join(out,'system-lineage.png')});
 // 能力网 + 场景诊断：十二门徒
 assert.equal(await page.locator('.lineage-net [data-net-line]').count(),27);report.net={edges:await page.locator('.lineage-net .edge').count(),scenes:await page.getByLabel('对照场景',{exact:true}).locator('option').allInnerTexts()};
 assert.ok(report.net.edges>10&&report.net.scenes.some(t=>t.includes('十二门徒')));
 await page.getByLabel('对照场景',{exact:true}).selectOption('apostles');await page.waitForSelector('[data-consumer-summary="apostles"]');
 report.net.summary=await page.locator('[data-consumer-summary="apostles"]').innerText();report.net.guide=Object.fromEntries(await page.locator('.lineage-guide section').evaluateAll(ns=>ns.map(n=>[n.dataset.guideKind,n.querySelector('h4').textContent])));
 assert.match(report.net.summary,/十二门徒.*17 个与最新库不同/);assert.ok(await page.locator('.lineage-guide .guide-sync article').count()>=3);
 assert.ok(await page.locator('.lineage-guide .guide-sync').innerText().then(t=>t.includes('src/terrain/shape.js')),'地形旧副本列在同步里');
 assert.ok(await page.locator('.lineage-net .node.unused').count()>5,'没用到的能力线变淡');
 await page.locator('.capability-lineage .lineage-block').nth(1).screenshot({path:path.join(out,'system-net-apostles.png')});
 await page.locator('.lineage-net [data-net-line="terrain"]').click();assert.equal(await L.getAttribute('data-lineage-line'),'terrain');await page.locator('.lineage-svg .row[data-line="shore"]').click();
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
 await page.waitForSelector('.cmap');assert.equal(await page.locator('.cmap').getAttribute('data-map-line'),'grid','左栏下一步 → 能力地图定位到这条线');await page.getByRole('button',{name:'队列与闭环',exact:true}).click();await page.waitForSelector('.capability-lineage');
 // 学习工坊 → 管线：可执行能力加入场景管线（仅测试上下文）
 await page.locator('.lineage-svg .row[data-line="terrain"]').click();const exec=page.locator('.lineage-steps .lineage-exec').first();report.use=await exec.innerText();await exec.click();
 await page.waitForFunction(()=>location.hash==='#scene');report.status=await page.locator('#status').innerText();assert.match(report.status,/已加入场景管线/);
 // 分区视图仍可用，选择被记住
 await page.locator('#capability-sidebar .cap-view button').nth(1).click();assert.equal(await page.locator('#capability-sidebar .cap-list').getAttribute('data-view'),'domain');assert.equal(await page.locator('#capability-sidebar .cap-line').count(),0);
 await page.locator('#capability-sidebar .cap-view button').nth(0).click();
 await page.setViewportSize({width:390,height:900});await page.locator('#learning-workshop-tab').click();await page.waitForSelector('.capability-lineage,.cmap');report.system.mobileOverflow=await page.evaluate(()=>document.querySelector('#learning-workshop').scrollWidth>innerWidth+1);assert.equal(report.system.mobileOverflow,false);await shot(page,'system-mobile.png');
 await context.close();assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,out,failure:report.failure?.slice(0,600),source:report.source&&{lines:report.source.lines,queue:report.source.queue},system:report.system&&{queue:report.system.queue,executables:report.system.executables}}));}
