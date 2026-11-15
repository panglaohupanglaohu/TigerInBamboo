import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sourceOnly=process.argv.includes('--source-only'),out=path.resolve('TigerMessenger/artifacts/capability-evolution-20261114/'+(sourceOnly?'source':'both')+'-'+Date.now());fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});const report={errors:[],out};
try{
 const context=await browser.newContext({viewport:{width:1450,height:1100}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8769/pipeline.html');await page.waitForSelector('[data-evolution-fingerprint]');
 report.sourceFingerprint=await page.locator('.capability-evolution').getAttribute('data-evolution-fingerprint');
 assert.equal(await page.locator('.capability-evolution').getAttribute('data-evolution-posts'),'285');
 await page.locator('[data-evolution-phase="sphere"]').filter({hasText:'sphere'}).click();await page.getByLabel('补全优先级',{exact:true}).selectOption('高');
 assert.ok(await page.locator('[data-completion-priority="高"]').count()>=4);
 assert.equal(await page.locator('[data-evolution-clip="1768627849529893109"] time').textContent(),'2024-03-15');
 await page.locator('.capability-evolution').screenshot({path:path.join(out,'source-sphere.png')});
 await page.getByRole('button',{name:'全部阶段',exact:true}).click();await page.getByLabel('补全优先级',{exact:true}).selectOption('partial');
 await page.getByLabel('能力演进主题',{exact:true}).selectOption('all');assert.equal(await page.locator('.capability-evolution').getAttribute('data-visible-total'),'177');
 while(await page.getByRole('button',{name:/显示更多/}).isVisible())await page.getByRole('button',{name:/显示更多/}).click();
 report.partialCards=await page.locator('[data-completion-priority]').count();assert.equal(report.partialCards,177);
 await page.getByLabel('补全优先级',{exact:true}).selectOption('all');await page.getByLabel('能力演进主题',{exact:true}).selectOption('shore');
 report.shoreOrder=await page.locator('.evolution-event').evaluateAll(ns=>ns.map(n=>n.dataset.evolutionClip));assert.equal(report.shoreOrder.at(-1),'1991103578011029507');
 assert.ok(await page.locator('[data-relation-type="alternative"]').count());
 await page.getByRole('button',{name:'查看前身 1664565063552847873',exact:true}).click();assert.equal(await page.locator('.evolution-event').count(),1);assert.equal(await page.locator('.evolution-event').getAttribute('data-evolution-clip'),'1664565063552847873');
 await page.getByLabel('搜索能力演进',{exact:true}).fill('');await page.getByLabel('能力演进主题',{exact:true}).selectOption('grid');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'source-overview.png')});
 report.legacyAnnotations=await page.locator('.evolution-legacy-note').count();assert.ok(report.legacyAnnotations>150);
 await page.setViewportSize({width:390,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'source-mobile.png')});report.sourceMobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(report.sourceMobileOverflow,false);
 if(!sourceOnly){
  await page.setViewportSize({width:1450,height:1100});await page.goto('http://localhost:8931/TigerMessenger/pipeline.html?learningView=evolution#learning');
  await page.waitForSelector('[data-evolution-fingerprint]',{timeout:240000});report.systemFingerprint=await page.locator('.capability-evolution').getAttribute('data-evolution-fingerprint');assert.equal(report.systemFingerprint,report.sourceFingerprint);
  await page.locator('[data-evolution-phase="sphere"]').filter({hasText:'sphere'}).click();await page.getByLabel('补全优先级',{exact:true}).selectOption('高');
  assert.equal(await page.locator('[data-evolution-clip="1768627849529893109"] time').textContent(),'2024-03-15');
  await page.screenshot({path:path.join(out,'system-sphere.png')});
  const counterpart=await page.getByRole('link',{name:'在另一学习管线查看同一主题 ↗'}).getAttribute('href');assert.ok(counterpart.includes('evolutionPhase=sphere'));report.counterpart=counterpart;
  const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'在另一学习管线查看同一主题 ↗'}).click();const popup=await popupPromise;await popup.waitForSelector('[data-evolution-fingerprint]');assert.equal(await popup.getByLabel('补全优先级',{exact:true}).inputValue(),'高');assert.equal(await popup.locator('.capability-evolution').getAttribute('data-evolution-phase'),'sphere');assert.equal(await popup.locator('.capability-evolution').getAttribute('data-evolution-fingerprint'),report.sourceFingerprint);await popup.close();report.crossPageSelectionPreserved=true;
  await page.getByRole('button',{name:'重构代码能力库',exact:true}).click();await page.waitForSelector('[data-module-path="src/water/shore.js"]');
  const row=page.locator('[data-module-path="src/water/shore.js"]');await row.locator('summary').click();assert.match(await row.innerText(),/2025-11-19/);
  const manifest=await page.evaluate(async()=>{const r=await fetch('/api/workshop/code-library');if(!r.ok)throw Error('scan '+r.status);return r.json();});assert.equal(manifest.evolution.fingerprint,report.sourceFingerprint);report.scanCounts=manifest.counts;
  await page.getByRole('button',{name:'时间线与能力演进',exact:true}).click();assert.equal(await page.getByLabel('补全优先级',{exact:true}).inputValue(),'高');assert.equal(await page.locator('.capability-evolution').getAttribute('data-evolution-phase'),'sphere');report.tabSelectionPreserved=true;await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(out,'system-mobile.png')});
  report.systemMobileOverflow=await page.evaluate(()=>document.querySelector('#learning-workshop').scrollWidth>innerWidth+1);assert.equal(report.systemMobileOverflow,false);
 }
 await context.close();assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
