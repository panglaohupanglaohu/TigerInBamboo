// R24 端到端：管线页「最近新增」栏。
//   新开隔离浏览器 → pipeline.html#scene → 管线区上方看得见「最近新增」：每项有名字、能力线、加入日期 + 依据、能跑的场景、九级成熟度
//   → 点一项战役 / 山形 / 表现层能力 → 进 R21 直达页签（hash、选中页签、场景切到能跑的）→ 点一项非直达能力 → 进对应工坊。
//   不点「采用」，不改场景数据。每步截图，人必须打开看。
// 前置：先在 TigerMessenger 目录跑 $NODE tools/refactor/build-capability-maturity.mjs（没有 json 时栏位会降级成「日期未知 / 未评级」，本脚本判失败并说明）。
// 运行：cd TigerMessenger && $NODE tests/recent-additions-browser.mjs   （需要 8931 服务）
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../artifacts/recent-additions-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[],pass:false};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const ctx=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
const shot=n=>page.screenshot({path:path.join(out,n+'.png')});
const expect=(cond,msg)=>{if(!cond)throw Error(msg);};
const panel=()=>page.evaluate(()=>{const h=document.getElementById('recent-additions');const r=h?.getBoundingClientRect();
 return {source:h?.dataset.source||null,total:+(h?.dataset.total||0),visible:!!h&&r.height>40&&r.top<innerHeight&&getComputedStyle(h).display!=='none',top:r?Math.round(r.top):null,height:r?Math.round(r.height):null,note:h?.querySelector('.recent-note')?.textContent||'',
  items:[...(h?.querySelectorAll('.recent-item')||[])].map(b=>({id:b.dataset.capabilityId,target:b.dataset.target,level:b.dataset.level||null,basis:b.dataset.basis,name:b.querySelector('.recent-name')?.textContent,line:b.querySelector('.recent-line')?.textContent,date:b.querySelector('.recent-date')?.textContent,scenes:b.querySelector('.recent-scenes')?.textContent,badge:b.querySelector('.recent-level')?.textContent}))};});
const state=()=>page.evaluate(()=>({focus:document.body.dataset.layerFocus||null,tier:document.body.dataset.tier,scene:window.__tmCurrentScene,hash:location.hash,selected:[...document.querySelectorAll('.pipe-tabs [role=tab][aria-selected=true]')].map(b=>b.textContent.trim()),status:document.getElementById('status')?.textContent||'',flash:!!document.querySelector('#capability-sidebar .cap-item.cap-flash')}));
const FOCUS={'#battle':['battle','战役管线',['apostles','moss','citadel','bookshop']],'#mountain':['mountain','山形管线',['citadel']],'#fx':['fx','表现层管线',['apostles','moss','citadel','bookshop']]};
try{
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles'),{},{timeout:90000});
 await page.waitForFunction(()=>document.querySelectorAll('#recent-additions .recent-item').length>0,{},{timeout:60000});
 await page.waitForTimeout(1200);
 const p0=await panel();report.steps.panel=p0;await shot('0-recent-panel');await page.locator('#recent-additions').screenshot({path:path.join(out,'0b-recent-strip.png')});
 expect(p0.visible&&p0.top<300,'「最近新增」进页面看不见（top '+p0.top+'，高 '+p0.height+'）');
 expect(p0.source==='maturity','成熟度数据没读到（栏位降级成页面能力清单）：先跑 build-capability-maturity.mjs。note='+p0.note);
 expect(p0.items.length>=1&&p0.items.length<=8,'默认应显示 1–8 项，实际 '+p0.items.length);
 for(const x of p0.items){expect(x.name&&x.line&&/线$/.test(x.line),x.id+' 缺能力线');expect(x.date&&/·/.test(x.date),x.id+' 缺日期 / 依据');expect(/^能跑：/.test(x.scenes||''),x.id+' 缺场景');expect(/^L\d$/.test(x.badge||''),x.id+' 缺九级成熟度徽章：'+x.badge);}
 const dates=p0.items.map(x=>x.date.split(' ')[0]).filter(d=>/^\d{4}-/.test(d));expect(dates.every((d,i)=>!i||dates[i-1]>=d),'没有按日期倒序：'+dates.join(' '));
 // 1. 点一项直达层能力
 let item=p0.items.find(x=>FOCUS[x.target]);
 if(!item&&p0.total>8){await page.locator('#recent-additions .recent-more').click();await page.waitForTimeout(400);const all=await panel();report.steps.expanded={items:all.items.length};item=all.items.find(x=>FOCUS[x.target]);await shot('1a-expanded');}
 expect(item,'列表里没有战役 / 山形 / 表现层能力可点');
 const [focus,label,scenes]=FOCUS[item.target];
 await page.locator(`#recent-additions .recent-item[data-capability-id="${item.id}"]`).click();
 await page.waitForFunction(([f,sc])=>document.body.dataset.layerFocus===f&&sc.includes(window.__tmCurrentScene),[focus,scenes],{timeout:90000});
 await page.waitForFunction(f=>document.querySelector('#'+f+'-workshop .tier-lane'),focus,{timeout:120000});await page.waitForTimeout(1500);
 const s1=await state();report.steps.clickFocus={item,...s1};await shot('1-click-'+focus);
 expect(s1.hash===item.target,'hash '+s1.hash+' ≠ '+item.target);expect(s1.selected.length===1&&s1.selected[0]===label,'选中页签 '+JSON.stringify(s1.selected));
 expect(/最近新增/.test(s1.status),'状态栏没说去了哪：'+s1.status);
 // 2. 点一项非直达能力（球系统 / 物件 / 场景管线）
 if(!(await page.locator('#recent-additions .recent-more').count())||!(await panel()).items.some(x=>!FOCUS[x.target])){const more=page.locator('#recent-additions .recent-more');if(await more.count()&&(await more.textContent()).startsWith('全部'))await more.click();await page.waitForTimeout(300);}
 const p2=await panel();const other=p2.items.find(x=>!FOCUS[x.target]);
 if(other){await page.locator(`#recent-additions .recent-item[data-capability-id="${other.id}"]`).click();await page.waitForTimeout(2500);
  const s2=await state();report.steps.clickOther={item:other,...s2};await shot('2-click-other');
  expect(s2.focus===null,'非直达能力点完还停在直达层：'+s2.focus);expect(s2.hash===other.target,'hash '+s2.hash+' ≠ '+other.target);}
 else report.steps.clickOther='列表里全是直达层能力，跳过';
 report.pass=report.errors.filter(e=>e.startsWith('pageerror')).length===0;
 if(!report.pass)throw Error('page errors: '+report.errors.join(' | '));
}catch(e){report.failure=e.message;try{await shot('zz-failure');report.state=await state();}catch{}}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,failure:report.failure||null,out},null,1));
await browser.close();process.exit(report.pass?0:1);
