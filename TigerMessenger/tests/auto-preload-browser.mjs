// R22 端到端：场景打开 → 场景层管线自动预装 → 一键 ▶ 执行管线 出候选。不拖任何能力。
//   战役（#battle → 十二门徒）、表现层（#fx）、山形（#mountain → 高山圣城），各断言：未拖拽时节点数 ≥ 1、
//   提示里写着「自动预装」、▶ 执行管线后出现候选卡；最后「清空管线」后重扫不再自动填，「按场景预装」能手动恢复。
//   每个面板截两张图（预装后 / 候选后），人必须打开看。不点「采用」，不写默认。
// 运行：cd TigerMessenger && $NODE tests/auto-preload-browser.mjs   （需要 8931 服务）
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../artifacts/auto-preload-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[],pass:false};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const ctx=await browser.newContext({viewport:{width:1600,height:1000}});
const expect=(c,m)=>{if(!c)throw Error(m);};
async function layer(id,scenes){
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(id+' pageerror: '+e.message));
 const W='#'+id+'-workshop',note=()=>page.locator(W+' .agent-note').textContent();
 await page.goto('http://localhost:8931/TigerMessenger/pipeline.html#'+id);
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),{},{timeout:300000});
 await page.waitForFunction(([id,s])=>document.body.dataset.layerFocus===id&&s.includes(window.__tmCurrentScene),[id,scenes],{timeout:120000});
 await page.waitForFunction(W=>document.querySelector(W+' .tier-lane'),W,{timeout:120000});
 await page.waitForFunction(W=>/扫描完成|扫描失败|没有可作用/.test(document.querySelector(W+' .agent-note')?.textContent||''),W,{timeout:240000});
 const r={scan:await note()};expect(!/扫描失败/.test(r.scan),id+' scan failed: '+r.scan);
 await page.waitForTimeout(800);
 r.nodes=await page.locator(W+' .tier-node:not(.pending)').count();r.names=await page.locator(W+' .tier-node:not(.pending) strong').allTextContents();
 r.preloadNote=await note();await page.screenshot({path:path.join(out,id+'-1-preloaded.png')});
 expect(r.nodes>=1,id+': no nodes preloaded');expect(/自动预装/.test(r.preloadNote),id+': note missing 自动预装: '+r.preloadNote);
 await page.locator(W+' .tier-head-actions .primary').click();
 await page.waitForFunction(W=>/候选/.test(document.querySelector(W+' .agent-result h4')?.textContent||'')||/执行失败/.test(document.querySelector(W+' .agent-note')?.textContent||''),W,{timeout:240000});
 r.candidate=await page.locator(W+' .agent-result h4').textContent().catch(()=>null);r.afterRun=await note();
 r.checks=await page.locator(W+' .verify-checks li').allTextContents();
 await page.screenshot({path:path.join(out,id+'-2-candidate.png')});
 expect(r.candidate&&/候选/.test(r.candidate),id+': no candidate: '+r.afterRun);
 // 放弃候选回原样（不采用），再测「清空管线」后不再自动填
 const discard=page.locator(W+' button',{hasText:'放弃'});if(await discard.count())await discard.first().click();
 await page.locator(W+' button',{hasText:'清空管线'}).click();await page.waitForTimeout(300);
 await page.locator(W+' .tier-head-actions button',{hasText:'扫描'}).click();
 await page.waitForFunction(W=>/扫描完成|扫描失败/.test(document.querySelector(W+' .agent-note')?.textContent||''),W,{timeout:240000});await page.waitForTimeout(500);
 r.afterClearNodes=await page.locator(W+' .tier-node:not(.pending)').count();expect(r.afterClearNodes===0,id+': refilled after user cleared');
 await page.locator(W+' button',{hasText:'按场景预装'}).click();await page.waitForTimeout(500);
 r.manualNodes=await page.locator(W+' .tier-node:not(.pending)').count();expect(r.manualNodes===r.nodes,id+': manual preload count '+r.manualNodes+' != '+r.nodes);
 await page.screenshot({path:path.join(out,id+'-3-manual-preload.png')});
 report.steps[id]=r;await page.close();
}
try{
 await layer('battle',['apostles','moss','citadel','bookshop']);
 await layer('fx',['apostles','moss','citadel','bookshop']);
 await layer('mountain',['citadel']);
 report.pass=!report.errors.some(e=>e.includes('pageerror'));
 if(!report.pass)throw Error(report.errors.join(' | '));
}catch(e){report.failure=e.message;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,failure:report.failure||null,out},null,1));
await browser.close();process.exit(report.pass?0:1);
