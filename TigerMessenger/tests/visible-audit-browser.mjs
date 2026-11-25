import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('artifacts/visible-audit/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();const rep={out,errors:[]};
p.on('pageerror',e=>rep.errors.push(e.message.slice(0,200)));
await p.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
await p.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
rep.topTabs=await p.evaluate(()=>[...document.querySelectorAll('header button, header a, .tabs button, nav button')].map(e=>e.textContent.trim()).filter(Boolean).slice(0,20));
rep.sceneOptions=await p.evaluate(()=>[...document.querySelectorAll('#scene option')].map(o=>o.value+'|'+o.textContent.trim()));
const panels=()=>p.evaluate(()=>({workshops:[...document.querySelectorAll('[id$="-workshop"]')].map(e=>({id:e.id,shown:e.offsetParent!==null,h:Math.round(e.getBoundingClientRect().height),nodes:e.querySelectorAll('.tier-node').length})),subTabs:[...document.querySelectorAll('.system-tabs button,[role=tab]')].map(e=>e.textContent.trim()),sidebarCaps:document.querySelectorAll('#capability-sidebar .cap-item').length,execCaps:[...document.querySelectorAll('#capability-sidebar .cap-item[data-capability-id]')].map(e=>e.dataset.capabilityId).filter(i=>/^(fx|mountain|battle|planet|object|gscene|grid|scene)\./.test(i))}));
for(const id of ['highland-citadel','apostles']){
 if(!rep.sceneOptions.some(o=>o.startsWith(id+'|'))){rep[id]='无此场景选项';continue;}
 await p.locator('#scene').selectOption(id);await p.waitForTimeout(9000);
 rep[id]=await panels();await p.screenshot({path:path.join(out,id+'.png'),fullPage:true});
}
await p.goto('http://localhost:8931/TigerMessenger/pipeline.html?learningView=tree#learning');await p.waitForTimeout(8000);
rep.learnTabs=await p.evaluate(()=>[...document.querySelectorAll('#learning button, .learning-tabs button')].map(e=>e.textContent.trim()).filter(t=>t&&t.length<14).slice(0,24));
await p.screenshot({path:path.join(out,'tree.png')});
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(rep,null,1));console.log(JSON.stringify(rep,null,1));await b.close();
