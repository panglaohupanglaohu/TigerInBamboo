// R26 端到端：多机位验收（固定机位：正面、侧面、俯视、斜后 + 玩家视角）原样 vs 候选逐张对照；地形线擂台在页面上实算。
//   pipeline.html#mountain → 扫描 → 四个固定机位先拍原样 → 执行山形管线 → 同四个机位拍候选 + 玩家视角 → 每对截图不能一样
//   → 验收台「在擂台上跑两代」→ 表格与判定出现在页面上（判定如实记进 report，不在这里放宽；单元测试 mountain-arena 负责红绿）。
// 运行：cd TigerMessenger && $NODE tests/mountain-views-browser.mjs   （需要 8931 服务）
import fs from 'node:fs';import crypto from 'node:crypto';
import {openMountain,A} from './mountain-e2e-lib.mjs';
const t=await openMountain('mountain-views'),{report,expect,cmd}=t,VIEWS=['front','side','top','oblique'];
const hash=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
await t.finish(async()=>{
 report.steps.scan=await t.boot();
 const orig={},cand={};report.steps.views={};
 for(const v of VIEWS){const r=await cmd('mountain.camera',{view:v});expect(r.ok,v+' 机位失败：'+r.reason);report.steps.views[v]=r;orig[v]=hash(await t.shotGame(`R26-${v}-0-original`,2500));}
 const run=await t.runCandidate();report.steps.run={h4:run.h4,checks:run.checks};
 for(const v of VIEWS){await cmd('mountain.camera',{view:v});cand[v]=hash(await t.shotGame(`R26-${v}-1-candidate`,2500));}
 const eye=await cmd('mountain.camera',{view:'eye'});report.steps.eye=eye;expect(eye.ok,'玩家视角失败：'+eye.reason);await t.shotGame('R26-eye-1-candidate',2500);
 report.steps.same=VIEWS.filter(v=>orig[v]===cand[v]);
 expect(!report.steps.same.length,'这些机位原样和候选截图一模一样（机位没生效或候选没换上）：'+report.steps.same.join(','));
 // 页面上的机位按钮也能用
 await t.page.locator(A+' [data-round="R26"] button[data-view="side"]').click();await t.page.waitForTimeout(800);
 expect(await t.data(A+' [data-round="R26"]','view')==='side','页面机位按钮没生效');
 await t.page.locator(A+' [data-round="R26"] button[data-view="free"]').click();
 // 擂台
 await t.page.waitForFunction(s=>document.querySelector(s)?.dataset.registry==='1',A+' [data-round="R26"]',{timeout:30000}).catch(()=>{});
 report.steps.registryShown=await t.data(A+' [data-round="R26"]','registry');
 await t.clickAccept('在擂台上跑两代');
 await t.page.waitForFunction(s=>!!document.querySelector(s)?.dataset.arena,A+' [data-round="R26"]',{timeout:240000});
 const arena=await t.data(A+' [data-round="R26"]','arena');report.steps.arena=arena;
 report.steps.arenaText=await t.page.locator(A+' [data-round="R26"] .ma-out').nth(1).textContent();
 expect(arena.rows?.length===4,'擂台表格不是四项指标');
 expect(await t.page.locator(A+' [data-round="R26"] .ma-pair canvas').count()===2,'擂台两代缩略图没画出来');
 await t.shotAccept('R26-arena-panel');await t.shotPage('R26-page');
});
