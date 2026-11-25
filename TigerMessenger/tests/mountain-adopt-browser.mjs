// R28 端到端：用户采用后进游戏自动换上新山形（只在采用后生效）+ 一键回原山形 + 30 种子分布与三张缩略图。
//   ① 新开隔离 context：pipeline.html#mountain → 扫描 → 先确认「没有采用记录 = 原山形」→ 执行 → 「✓ 采用山形」→ 本机写 v2 记录
//   ② 同一 context 重新打开页面（= 重新进游戏）→ 不点任何候选，游戏自己把采用的山形换上（__tmMountainAuto = deployed）、玩家地面接管
//   ③ 验收台「跑 30 个种子」→ 分布直方图 + 最好 / 最典型 / 最差三张卡 → 每座「实景看这座」斜后机位拍一张
//      → 截图同时复制到 artifacts/mountain-seeds-e2e/latest/（+ thumbs.json），山形面板下次打开就显示这三张实景缩略图
//   ④ 「回到原山形（删除采用记录）」→ 采用记录没了、实景是原山形；再进一次游戏也不换。
// 运行：cd TigerMessenger && $NODE tests/mountain-adopt-browser.mjs   （需要 8931 服务；整段约 10–20 分钟）
import fs from 'node:fs';import path from 'node:path';
import {openMountain,A,W} from './mountain-e2e-lib.mjs';
const t=await openMountain('mountain-adopt'),{report,expect,cmd,page}=t,S=A+' [data-round="R28"]',KEY='tm.mountain.adopted.v1:citadel';
const waitAuto=(want,ms=300000)=>page.waitForFunction(w=>{const s=document.querySelector('#game')?.contentWindow?.__tmMountainAuto;return s&&w.includes(s.status);},want,{timeout:ms}).then(()=>t.frame().evaluate(()=>globalThis.__tmMountainAuto));
await t.finish(async()=>{
 report.steps.scan=await t.boot();
 const fresh=await cmd('mountain.adopted',{id:'citadel'});report.steps.fresh=fresh;
 expect(!fresh.adopted&&!fresh.deployedNow,'新 context 里不应有采用记录：'+JSON.stringify(fresh).slice(0,300));
 report.steps.freshAuto=await waitAuto(['skipped'],60000).catch(()=>null);
 const run=await t.runCandidate();report.steps.run={h4:run.h4};
 await cmd('mountain.camera',{view:'oblique'});await t.shotGame('R28-0-candidate-before-adopt',2500);
 await page.locator(W+' button',{hasText:'采用山形'}).click();await page.waitForTimeout(1500);
 const rec=await t.frame().evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),KEY);
 report.steps.record=rec&&{v:rec.v,autoDeploy:rec.autoDeploy,sig:rec.sig,palette:rec.plan?.style?.palette};
 expect(rec&&rec.v===2&&rec.autoDeploy===true&&rec.sig?.n>0,'采用没写下 v2 记录');
 // ② 重新进游戏
 await t.boot();
 const auto=await waitAuto(['deployed','mismatch','gave-up','skipped'],360000);report.steps.auto=auto;
 expect(auto.status==='deployed','重新进游戏没有自动换上采用的山形：'+auto.status+' '+auto.reason);
 const st=await cmd('mountain.state');report.steps.autoState={previewing:st.previewing,autoDeployed:st.autoDeployed,ground:st.ground,triangles:st.triangles};
 expect(st.previewing&&st.autoDeployed&&st.ground?.installed,'自动换上后状态不对：'+JSON.stringify(report.steps.autoState));
 await cmd('mountain.camera',{view:'oblique'});await t.shotGame('R28-1-auto-deployed-after-reentry',2500);
 await t.clickAccept('刷新采用状态');await page.waitForTimeout(1200);report.steps.panelAdopted=await t.data(S,'adopted');await t.shotAccept('R28-2-adopted-panel');
 // ③ 30 种子
 await t.clickAccept('跑 30 个种子');
 await page.waitForFunction(s=>!!document.querySelector(s)?.dataset.seeds,S,{timeout:1200000});
 const seeds=await t.data(S,'seeds');report.steps.seeds=seeds;
 expect(seeds.count===30,'不是 30 座：'+seeds.count);
 expect(await page.locator(S+' .ma-bars').count()>=4,'分布直方图没出来');
 await t.shotAccept('R28-3-seeds-panel');
 const latest=path.resolve(t.out,'../../mountain-seeds-e2e/latest');fs.mkdirSync(latest,{recursive:true});const shots={};
 for(const k of ['best','typical','worst']){const card=page.locator(S+` .ma-card[data-pick="${k}"]`);if(!await card.count())continue;
  const seed=Number(await card.getAttribute('data-seed'));await card.locator('button').click();await page.waitForTimeout(1500);
  await cmd('mountain.camera',{view:'oblique'});const f=await t.shotGame(`R28-4-seed-${k}-${seed}`,2500);
  fs.copyFileSync(f,path.join(latest,k+'.png'));shots[k]={file:k+'.png',seed,run:path.basename(t.out)};}
 expect(Object.keys(shots).length>=2,'三张代表至少要有最好和最典型');
 fs.writeFileSync(path.join(latest,'thumbs.json'),JSON.stringify({at:new Date().toISOString(),scene:'citadel',view:'oblique',pick:seeds.pick,shots},null,1));
 report.steps.thumbs=shots;
 // ④ 回原山形
 await t.clickAccept('回到原山形');await page.waitForTimeout(1500);
 const gone=await t.frame().evaluate(k=>localStorage.getItem(k),KEY),after=await cmd('mountain.state'),ad=await cmd('mountain.adopted',{id:'citadel'});
 report.steps.unadopt={recordGone:gone==null,previewing:after.previewing||false,adopted:ad.adopted};
 expect(gone==null&&!ad.adopted,'回原山形后采用记录还在');expect(!after.previewing,'回原山形后实景还是新山形');
 await cmd('mountain.camera',{view:'oblique'}).catch(()=>{});await t.shotGame('R28-5-back-to-original',2500);
 await t.boot();const again=await waitAuto(['skipped','deployed','mismatch','gave-up'],120000);report.steps.reentryAfterUnadopt=again;
 expect(again.status==='skipped','回原后再进游戏不应换山形：'+again.status);
 await t.shotPage('R28-6-page');
});
