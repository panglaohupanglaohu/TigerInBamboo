// R25–R28 山形 e2e 公用：新开隔离浏览器（非持久 context，不碰用户浏览器资料）→ pipeline.html#mountain 直达山形管线 → 等高山圣城扫描完。
// 每个脚本自己的截图在 TigerMessenger/artifacts/<名字>-e2e/run-<时间>/，report.json 同目录。运行目录：TigerMessenger。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
export const BASE=process.env.BASE||'http://localhost:8931/TigerMessenger/';
export const W='#mountain-workshop',A='#mountain-accept';
export async function openMountain(name){
 const out=path.resolve(here,'../artifacts/'+name+'-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const report={out,steps:{},errors:[],shots:[],pass:false};
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
 const ctx=await browser.newContext({viewport:{width:1600,height:1000}});const page=await ctx.newPage();
 const listen=p=>{p.on('pageerror',e=>report.errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});};listen(page);
 const t={out,report,browser,ctx,page,
  expect:(cond,msg)=>{if(!cond)throw Error(msg);},
  frame:()=>page.frames().find(f=>f.url().includes('index.html')),
  cmd:(action,payload={})=>page.evaluate(([action,payload])=>new Promise((res,rej)=>{const id='t'+Math.random();const on=e=>{if(e.data?.type==='tm.pipeline.reply'&&e.data.id===id){removeEventListener('message',on);e.data.error?rej(Error(e.data.error)):res(e.data.result);}};addEventListener('message',on);document.querySelector('#game').contentWindow.postMessage({type:'tm.pipeline.command',id,action,payload},location.origin);setTimeout(()=>rej(Error('timeout '+action)),90000);}),[action,payload]),
  shotGame:async(n,wait=1500)=>{await page.waitForTimeout(wait);await page.locator('#game').scrollIntoViewIfNeeded();const f=path.join(out,n+'.png');await page.locator('#game').screenshot({path:f});report.shots.push(n+'.png');return f;},
  shotPage:async n=>{await page.screenshot({path:path.join(out,n+'.png'),fullPage:false});report.shots.push(n+'.png');},
  shotAccept:async n=>{await page.locator(A).scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.locator(A).screenshot({path:path.join(out,n+'.png')});report.shots.push(n+'.png');},
  data:(sel,key)=>page.evaluate(([s,k])=>{const v=document.querySelector(s)?.dataset[k];try{return v?JSON.parse(v):null;}catch{return v;}},[sel,key]),
  async boot(hash='#mountain'){
   await page.goto(BASE+'pipeline.html'+hash);
   await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
   await page.waitForFunction(()=>document.body.dataset.layerFocus==='mountain'&&window.__tmCurrentScene==='citadel',{},{timeout:300000});
   await page.waitForFunction(()=>!!document.querySelector('#game')?.contentWindow?.__tm?.scene,{},{timeout:300000}).catch(()=>{});
   await page.waitForFunction(()=>document.querySelectorAll('#mountain-workshop .tier-node').length>=5,{},{timeout:180000});
   await page.waitForFunction(()=>/扫描完成|扫描失败/.test(document.querySelector('#mountain-workshop .agent-note')?.textContent||''),{},{timeout:300000});
   const scan=await page.locator(W+' .agent-note').textContent();if(scan.includes('失败'))throw Error('扫描失败：'+scan);
   await page.waitForSelector(A+'[data-ready="1"]',{timeout:60000});
   return scan;
  },
  async runCandidate(){
   await page.locator(W+' .tier-head-actions .primary').click();
   await page.waitForFunction(()=>/候选/.test(document.querySelector('#mountain-workshop .agent-result h4')?.textContent||'')||/执行失败/.test(document.querySelector('#mountain-workshop .agent-note')?.textContent||''),{},{timeout:300000});
   const h4=await page.locator(W+' .agent-result h4').textContent().catch(()=>null),checks=await page.locator(W+' .verify-checks li').allTextContents();
   const state=await t.cmd('mountain.state');
   if(!state?.previewing)throw Error('执行后实景没有换上候选：'+(await page.locator(W+' .agent-note').textContent()));
   return {h4,checks,state};
  },
  clickAccept:async text=>{await page.locator(A+' button',{hasText:text}).first().scrollIntoViewIfNeeded();await page.locator(A+' button',{hasText:text}).first().click();},
  async finish(fn){
   try{await fn();const pe=report.errors.filter(e=>e.startsWith('pageerror'));if(pe.length)throw Error('页面报错：'+pe.join(' | '));report.pass=true;}
   catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,1500);try{await page.screenshot({path:path.join(out,'zz-failure.png')});report.shots.push('zz-failure.png');}catch{}}
   fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
   console.log(JSON.stringify({pass:report.pass,failure:report.failure||null,out,shots:report.shots},null,1));
   await browser.close();process.exit(report.pass?0:1);
  }};
 return t;
}
