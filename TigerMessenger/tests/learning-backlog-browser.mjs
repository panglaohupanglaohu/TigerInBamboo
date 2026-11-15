import {reconcileBacklog} from '../src/scene-authoring/learning-backlog.js';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const read=p=>JSON.parse(fs.readFileSync(p));const expected=await reconcileBacklog(read('townscaper-web/REACodeRefactoring/learn/coverage-progress.json'),read('townscaper-web/REACodeRefactoring/learn/coverage.json'),read('TigerMessenger/src/scene-authoring/catalog/learning-backlog-review.json'),{verified:true,items:read('TigerMessenger/src/scene-authoring/catalog/learning-backlog-deliveries.json').items});
const out=process.argv[2]||'TigerMessenger/artifacts/workshop-tests/backlog-live-'+Date.now();fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/TigerMessenger/index.html?*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>isolated game</title>'}));
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#learning');
 const folder=page.locator('[data-progress-section=next]');await folder.waitFor();
 assert.equal(await folder.locator(':scope>summary').textContent(),'整理后待办（'+expected.active.length+'） · 已核销 '+expected.closed.length);
 await folder.locator(':scope>summary').click();
 for(const [stage,count]of [...Object.entries(expected.counts),['closed',expected.closed.length]])assert.match(await folder.locator(`[data-backlog-stage=${stage}]>summary`).textContent(),new RegExp(`（${count}）`));
 assert.equal(await folder.locator('[data-backlog-id]').count(),expected.items.length);
 const archived=folder.locator('[data-backlog-stage=closed]');await archived.locator(':scope>summary').click();assert.ok(await archived.locator('a').count()>0);
 await folder.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/backlog-desktop.png'});
 await page.getByRole('button',{name:'刷新学习进度',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#learning-progress button').disabled);
 assert.notEqual(await folder.getAttribute('open'),null);assert.equal(await folder.locator('[data-backlog-id]').count(),expected.items.length);
 await page.setViewportSize({width:390,height:844});await folder.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/backlog-mobile.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'返回当前场景管线 →',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#capability-sidebar .cap-count')?.textContent.includes('待适配'));
 assert.ok(!(await page.locator('#capability-sidebar').textContent()).includes('· 占位'));
 const workerResult=await page.evaluate(async()=>{
 const run=(path,message)=>new Promise((resolve,reject)=>{const worker=new Worker(path,{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('worker timeout'));},10000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.onmessage=({data})=>{if(data.heartbeat)return;clearTimeout(timer);worker.terminate();data.ok?resolve(data.result):reject(Error(data.error));};worker.postMessage(message);});
 const layout=[0,0.4,2].map((x,i)=>({id:String(i),kind:'tree',x,z:0,r:.05,edit:{dx:0,dy:0,dz:0,ry:0,s:1,hidden:false}})),steps=[{id:'object.path-spacing',params:{maxMove:1}}];
 const result=await run('/TigerMessenger/src/system-workshop/object/transform-worker.js',{job:'path-test',type:'run',layout,steps});
 return result;
 });
 assert.equal(workerResult.report[0].status,'applied');assert.equal(workerResult.edits['1'].dx,0.6);
 assert.deepEqual(errors,[]);
 const report={passed:true,raw:expected.rawCount,merged:expected.merged,closed:expected.closed.length,active:expected.active.length,counts:expected.counts,errors,workerResult,scope:'live API, isolated parent UI and real object Worker; no game preview or save'};
 fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
