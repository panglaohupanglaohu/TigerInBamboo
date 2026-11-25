// R21 端到端：系统工坊顶部「战役管线 / 山形管线 / 表现层管线」三个直达页签。
//   新开隔离浏览器 → pipeline.html#scene → 点「战役管线」→ 自动切到十二门徒、只显示战役面板且高度 ≥ 50vh
//   → 点「山形管线」→ 自动切到高山圣城、只显示山形面板 → 点「表现层管线」→ 回到能跑表现层的场景
//   → 点「场景管线」→ 直达状态清除。另测地址栏 #battle 直接打开。每步截图，人必须打开看。
// 运行：cd TigerMessenger && $NODE tests/layer-focus-browser.mjs   （需要 8931 服务）
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../artifacts/layer-focus-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[],pass:false};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const ctx=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
const shot=n=>page.screenshot({path:path.join(out,n+'.png')});
const paneState=()=>page.evaluate(()=>{const r={};for(const id of ['scene-pane','gscene-workshop','battle-workshop','mountain-workshop','fx-workshop']){const el=document.getElementById(id);const cs=el&&getComputedStyle(el);r[id]={shown:!!el&&cs.display!=='none'&&!el.hidden,height:el?Math.round(el.getBoundingClientRect().height):0,nodes:el?el.querySelectorAll('.tier-node').length:0};}
 return {focus:document.body.dataset.layerFocus||null,tier:document.body.dataset.tier,scene:window.__tmCurrentScene,hash:location.hash,vh:innerHeight,selected:[...document.querySelectorAll('.pipe-tabs [role=tab][aria-selected=true]')].map(b=>b.textContent.trim()),panes:r,status:document.getElementById('status')?.textContent};});
const expect=(cond,msg)=>{if(!cond)throw Error(msg);};
async function clickFocus(id,label,wantScenes){
 const clicks=1;await page.locator('#'+id+'-focus-tab').click();
 await page.waitForFunction(([id,scenes])=>document.body.dataset.layerFocus===id&&scenes.includes(window.__tmCurrentScene),[id,wantScenes],{timeout:60000});
 await page.waitForFunction(id=>document.querySelector('#'+id+'-workshop .tier-lane'),id,{timeout:120000});
 await page.waitForTimeout(1500);
 const st=await paneState();report.steps[id]={...st,clicks};await shot('focus-'+id);
 expect(st.selected.length===1&&st.selected[0]===label,id+': selected tab '+JSON.stringify(st.selected));
 expect(st.hash==='#'+id,id+': hash '+st.hash);
 expect(st.panes[id+'-workshop'].shown,id+': pane hidden');
 expect(st.panes[id+'-workshop'].height>=st.vh*0.5*0.98,id+': pane height '+st.panes[id+'-workshop'].height+' < 50vh');
 expect(!st.panes['scene-pane'].shown,id+': voxel scene pane still shown');
 for(const o of ['battle','mountain','fx'])if(o!==id)expect(!st.panes[o+'-workshop'].shown,id+': other pane '+o+' shown');
}
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles'),{},{timeout:90000});
 report.steps.before=await paneState();await shot('0-before');
 expect(await page.locator('#battle-focus-tab').isVisible()&&await page.locator('#mountain-focus-tab').isVisible()&&await page.locator('#fx-focus-tab').isVisible(),'focus tabs not visible');
 await clickFocus('battle','战役管线',['apostles','moss','citadel','bookshop']);
 await clickFocus('mountain','山形管线',['citadel']);
 await clickFocus('fx','表现层管线',['apostles','moss','citadel','bookshop']);
 await page.locator('#scene-workshop-tab').click();await page.waitForTimeout(800);
 const back=await paneState();report.steps.backToScene=back;await shot('4-back-to-scene');
 expect(back.focus===null&&back.hash==='#scene','scene tab did not clear focus');
 // 地址栏直达：新页面 #battle
 const p2=await ctx.newPage();p2.on('pageerror',e=>report.errors.push('p2 pageerror: '+e.message));
 await p2.goto('http://localhost:8931/TigerMessenger/pipeline.html#battle');
 await p2.waitForFunction(()=>document.body.dataset.layerFocus==='battle'&&['apostles','moss','citadel','bookshop'].includes(window.__tmCurrentScene),{},{timeout:300000});
 await p2.waitForFunction(()=>document.querySelector('#battle-workshop .tier-lane'),{},{timeout:120000});
 await p2.waitForTimeout(1500);await p2.screenshot({path:path.join(out,'5-hash-battle.png')});
 report.steps.hashBattle=await p2.evaluate(()=>({scene:window.__tmCurrentScene,height:Math.round(document.getElementById('battle-workshop').getBoundingClientRect().height),vh:innerHeight}));
 expect(report.steps.hashBattle.height>=report.steps.hashBattle.vh*0.49,'hash #battle pane too short');
 report.pass=report.errors.filter(e=>e.startsWith('pageerror')).length===0;
 if(!report.pass)throw Error('page errors: '+report.errors.join(' | '));
}catch(e){report.failure=e.message;try{await shot('zz-failure');report.state=await paneState();}catch{}}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,failure:report.failure||null,out},null,1));
await browser.close();process.exit(report.pass?0:1);
