// R51–R60 构筑枝 / 契约 e2e 公用：新开隔离浏览器（非持久 context，不碰用户浏览器资料）→ pipeline.html → 等游戏连上、场景就绪、建筑管线扫描完。
// 每个脚本的截图在 TigerMessenger/artifacts/<名字>-e2e/run-<时间戳>/，report.json 同目录（含 report.capabilities）。运行目录：TigerMessenger。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
export const BASE=process.env.BASE||'http://localhost:8931/TigerMessenger/';
export const BW='#building-workshop',AA='#auto-assemble',BS='#building-side';
export async function openBuilding(name){
 const out=path.resolve(here,'../../artifacts/'+name+'-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const report={out,capabilities:[],steps:{},errors:[],shots:[],pass:false};
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
 const ctx=await browser.newContext({viewport:{width:1600,height:1000}});const page=await ctx.newPage();
 page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
 const t={out,report,browser,ctx,page,
  expect:(cond,msg)=>{if(!cond)throw Error(msg);},
  cap:(id,info={})=>report.capabilities.push({id,...info}),
  frame:()=>page.frames().find(f=>f.url().includes('index.html')),
  cmd:(action,payload={})=>page.evaluate(([action,payload])=>new Promise((res,rej)=>{const id='t'+Math.random();const on=e=>{if(e.data?.type==='tm.pipeline.reply'&&e.data.id===id){removeEventListener('message',on);e.data.error?rej(Error(e.data.error)):res(e.data.result);}};addEventListener('message',on);document.querySelector('#game').contentWindow.postMessage({type:'tm.pipeline.command',id,action,payload},location.origin);setTimeout(()=>rej(Error('timeout '+action)),120000);}),[action,payload]),
  /** 游戏页里直接读建筑候选模块（与 pipeline-bridge 同一个 ?v，同一份状态）+ 场景里候选组的真实子网格数 */
  gameState:()=>t.frame().evaluate(async()=>{const m=await import('/TigerMessenger/src/world/rea/buildingCandidate.js?v=building-r1');const st=m.buildingState();const groups=[];globalThis.__tm?.scene?.traverse(o=>{if(/^building-candidate-(citadel|crystal)$/.test(o.name))groups.push({name:o.name,children:o.children.length,visible:o.visible});});return {...st,groups};}),
  /** 场景根对象下原有网格的数量与位置指纹：预览 / 撤回前后必须完全一样（候选不碰已有建筑）。
      与 buildingCandidate.js 的 SKIP 同类：云 / 水 / 光斑等持续动画的装饰网格本来就在动，不算「被改动」。 */
  rootSig:id=>t.frame().evaluate(id=>{const r=globalThis.__tmSceneTargets?.().find(x=>x.id===id)?.root;if(!r)return null;let n=0,s=0;const SKIP=/cloud|mist|fog|beam|water|sea|ocean|foam|wave|particle|smoke|glow|halo|shadow|ring|sky|bird|flock|outline|mountain-candidate|building-candidate/i;r.updateWorldMatrix(true,true);r.traverse(o=>{if(!o.isMesh||o.userData?.buildingCandidate)return;let path='';for(let p=o;p&&p!==r;p=p.parent)path=(p.name||'')+'/'+path;if(SKIP.test(path))return;n++;const e=o.matrixWorld.elements;s+=e[12]*1.3+e[13]*0.7+e[14]*1.1;});return {meshes:n,sig:Math.round(s*1000)/1000};},id),
  storage:key=>t.frame().evaluate(k=>localStorage.getItem(k),key),
  shotGame:async(n,wait=1800)=>{await page.waitForTimeout(wait);await page.locator('#game').scrollIntoViewIfNeeded();await page.locator('#game').screenshot({path:path.join(out,n+'.png')});report.shots.push(n+'.png');},
  shotPage:async n=>{await page.screenshot({path:path.join(out,n+'.png'),fullPage:false});report.shots.push(n+'.png');},
  shotEl:async(sel,n)=>{const l=page.locator(sel).first();await l.scrollIntoViewIfNeeded();await page.waitForTimeout(400);await l.screenshot({path:path.join(out,n+'.png')});report.shots.push(n+'.png');},
  data:(sel,key)=>page.evaluate(([s,k])=>{const v=document.querySelector(s)?.dataset[k];try{return v?JSON.parse(v):null;}catch{return v;}},[sel,key]),
  note:()=>page.locator(BW+' .agent-note').first().textContent(),
  /** 打开页面。scene='citadel' 走 #mountain 直达（自动切到高山圣城，建筑面板在山形面板下面）；其他场景走 #scene 再选。 */
  async boot(scene='citadel'){
   await page.goto(BASE+'pipeline.html'+(scene==='citadel'?'#mountain':'#scene'));
   await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
   if(scene!=='citadel'){await page.waitForFunction(s=>[...document.querySelectorAll('#scene option')].some(o=>o.value===s),scene,{timeout:120000});await page.selectOption('#scene',scene);}
   await page.waitForFunction(s=>window.__tmCurrentScene===s,scene,{timeout:300000});
   await page.waitForFunction(()=>!!document.querySelector('#game')?.contentWindow?.__tm?.scene,{},{timeout:300000}).catch(()=>{});
   await page.waitForFunction(()=>document.querySelector('#building-workshop .tier-lane'),{},{timeout:180000});
   await page.waitForFunction(()=>/扫描完成|扫描失败/.test(document.querySelector('#building-workshop .agent-note')?.textContent||''),{},{timeout:300000});
   const scan=await t.note();if(/扫描失败/.test(scan))throw Error('建筑管线扫描失败：'+scan);
   await page.waitForSelector(AA+' #contract-panel summary',{timeout:60000});
   return scan;
  },
  async runBuilding(){
   const before=await page.locator(BW+' .agent-result h4').textContent().catch(()=>null);
   await page.locator(BW+' .tier-head-actions .primary').click();
   await page.waitForFunction(()=>/候选/.test(document.querySelector('#building-workshop .agent-result h4')?.textContent||'')&&!/执行中/.test(document.querySelector('#building-workshop .agent-note')?.textContent||'')||/执行失败/.test(document.querySelector('#building-workshop .agent-note')?.textContent||''),{},{timeout:300000});
   await page.waitForTimeout(800);
   const h4=await page.locator(BW+' .agent-result h4').textContent().catch(()=>null),checks=await page.locator(BW+' .verify-checks li').allTextContents(),note=await t.note();
   if(/执行失败/.test(note))throw Error('建筑管线执行失败：'+note);
   return {before,h4,checks,note,state:await t.gameState()};
  },
  async finish(fn){
   try{await fn();const pe=report.errors.filter(e=>e.startsWith('pageerror'));if(pe.length)throw Error('页面报错：'+pe.join(' | '));report.pass=true;}
   catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,1500);try{await page.screenshot({path:path.join(out,'zz-failure.png')});report.shots.push('zz-failure.png');}catch{}}
   try{await t.cmd('building.revert');}catch{}
   fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
   console.log(JSON.stringify({pass:report.pass,failure:report.failure||null,out,shots:report.shots},null,1));
   await browser.close();process.exit(report.pass?0:1);
  }};
 return t;
}
