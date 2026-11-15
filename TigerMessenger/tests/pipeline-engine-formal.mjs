// Formal app check in a fresh non-persistent context; only preview and discard.
import {renderedContent} from './rendered-scene-check.mjs';
import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='TigerMessenger/artifacts/workshop-tests/pipeline-engine-20261113';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();
const report={scope:'Normal pipeline app + unmodified game iframe, new non-persistent context; preview/discard only',started:new Date().toISOString(),errors:[]};page.on('pageerror',e=>report.errors.push(e.message));const save=()=>fs.writeFileSync(out+'/formal.json',JSON.stringify(report,null,2));
await page.addInitScript(()=>{window.__engineReceipts=[];const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data?.result?.engine)window.__engineReceipts.push(e.data.result.engine);});}};});
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');console.log('Normal app loading');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:240000});
 await page.waitForFunction(()=>document.querySelectorAll('#scene option').length>2,{},{timeout:60000});
 report.options=await page.locator('#scene option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,label:n.textContent})));
 const target=report.options.find(n=>n.label.includes('书店'));assert.ok(target,'registered bookshop scene');console.log('Connected; select '+target.id);
 await page.locator('#scene').selectOption(target.id);await page.locator('#gscene-workshop .tier-head').waitFor({timeout:30000});
 await page.evaluate(()=>{let seq=800000;window.formalRequest=(action,payload)=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{removeEventListener('message',listen);reject(Error('bridge timeout '+action));},20000);function listen(e){if(e.origin!==location.origin||e.source!==document.querySelector('#game').contentWindow||e.data?.type!=='tm.pipeline.reply'||e.data.id!==id)return;clearTimeout(timer);removeEventListener('message',listen);e.data.error?reject(Error(e.data.error)):resolve(e.data.result);}addEventListener('message',listen);document.querySelector('#game').contentWindow.postMessage({type:'tm.pipeline.command',id,action,payload},location.origin);});});
 report.before=await page.evaluate(()=>formalRequest('gscene.style.get'));console.log('Actual materials '+report.before.materials.length);save();
 report.visualBefore=await renderedContent(page,await page.locator('#game').screenshot({path:out+'/formal-before.png'}));assert.ok(report.visualBefore.colorBins>12&&report.visualBefore.dominantRatio<.95,'scene must contain visible geometry, not a flat water overlay');
 const set=page.locator('#capability-sidebar .cap-set').filter({hasText:'感知色板与层次'});await set.dblclick();
 await page.locator('#gscene-workshop [data-node-id="scene.oklab-palette"]').waitFor();await page.locator('#gscene-workshop [data-node-id="scene.oklab-contrast"]').waitFor();
 await page.locator('#gscene-workshop').getByRole('button',{name:'▶ 执行管线',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#gscene-workshop')?.textContent.includes('候选已预览'),{},{timeout:90000});
 report.candidate=await page.evaluate(()=>formalRequest('gscene.style.get'));assert.ok(report.candidate.previewing);report.changed=report.candidate.materials.filter((m,i)=>m.color!==report.before.materials[i].color).length;assert.ok(report.changed>0);console.log('Candidate changed '+report.changed+' materials');
 report.visualCandidate=await renderedContent(page,await page.locator('#game').screenshot({path:out+'/formal-candidate.png'}));assert.ok(report.visualCandidate.colorBins>12&&report.visualCandidate.dominantRatio<.95,'candidate must contain visible geometry');
 await page.locator('#gscene-workshop').getByRole('button',{name:'对照原样',exact:true}).click();await page.locator('#gscene-workshop').getByRole('button',{name:'看候选',exact:true}).click();
 await page.locator('#gscene-workshop').getByRole('button',{name:'放弃',exact:true}).click();
 report.restored=await page.evaluate(()=>formalRequest('gscene.style.get'));assert.ok(!report.restored.previewing);assert.deepEqual(report.restored.saved,report.before.saved);assert.deepEqual(report.restored.materials.map(m=>m.color),report.before.materials.map(m=>m.color));
 report.engineReceipts=await page.evaluate(()=>window.__engineReceipts);const executed=report.engineReceipts.filter(r=>r.name==='PipeLineEngine'&&r.status==='executed');assert.ok(executed.some(r=>r.steps.some(s=>s.id==='scene.oklab-palette')&&r.steps.some(s=>s.id==='scene.oklab-contrast')),'real UI combination executed by PipeLineEngine');report.passed=true;
}catch(e){report.passed=false;report.error=e.stack;throw e;}finally{save();await browser.close();}
