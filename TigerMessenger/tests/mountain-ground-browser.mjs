// R25 端到端：采用 / 预览山形后玩家地面随新山重建——玩家能在新山上走；轨道净空、建筑高差复检为 0。
//   pipeline.html#mountain → 扫描高山圣城 → 执行山形管线（实景换上候选）→ 验证里有「玩家地面与山形一致 ✓」
//   → 验收台「走一圈检验」：新山面 / 玩家真用的地面链 / 射线打候选网格三方一致、没有洞、轨道 / 建筑高差 0
//   → 「把玩家放到新山上」→ 4 秒后玩家站在新山面上（没掉下去）→ 玩家视角截图 → 对照原样时地面交回原地形。
// 运行：cd TigerMessenger && $NODE tests/mountain-ground-browser.mjs   （需要 8931 服务）
import {openMountain,A} from './mountain-e2e-lib.mjs';
const t=await openMountain('mountain-ground'),{report,expect,cmd}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot();
 const run=await t.runCandidate();report.steps.run=run;
 const g=run.checks.find(c=>c.includes('玩家地面与山形一致'));report.steps.groundCheck=g||null;
 expect(g&&g.includes('✓')||g&&!/✗|失败/.test(g),'验证结果里没有通过的「玩家地面与山形一致」：'+JSON.stringify(run.checks));
 expect(run.state.ground?.installed&&run.state.ground.active,'玩家地面没有接管：'+JSON.stringify(run.state.ground));
 await cmd('mountain.camera',{view:'oblique'});await t.shotGame('R25-1-candidate-oblique');
 await t.clickAccept('走一圈检验');await t.page.waitForFunction(s=>!!document.querySelector(s)?.dataset.walk,A+' [data-round="R25"]',{timeout:60000});
 const walk=await t.data(A+' [data-round="R25"]','walk');report.steps.walk=walk;await t.shotAccept('R25-2-walk-panel');
 expect(walk.ok&&walk.chainAvailable,'走一圈检验没跑起来：'+JSON.stringify(walk).slice(0,300));
 expect(walk.samples.count>=100&&walk.samples.holes===0,'新山面有洞：'+JSON.stringify(walk.samples));
 expect(walk.samples.chainAgree>0&&walk.samples.chainLower===0&&walk.samples.chainNull===0,'玩家地面链没有跟上新山面：'+JSON.stringify(walk.samples));
 expect(walk.samples.maxMeshErr<=0.05,'碰撞地面与画面网格差 '+walk.samples.maxMeshErr+' m');
 expect(walk.recheck.railCells>0&&walk.recheck.railDiff<=0.011&&walk.recheck.structureDiff<=0.011,'轨道 / 建筑高差复检不为 0：'+JSON.stringify(walk.recheck));
 expect(walk.path.holes===0,'穿山直线上有洞：'+JSON.stringify(walk.path));
 expect(walk.pass,'走一圈检验总判定没通过');
 // 玩家真站上去
 await t.clickAccept('把玩家放到新山上');await t.page.waitForTimeout(4000);
 await t.clickAccept('读玩家离地');await t.page.waitForTimeout(600);const p1=await t.data(A+' [data-round="R25"]','player');
 await t.page.waitForTimeout(1500);await t.clickAccept('读玩家离地');await t.page.waitForTimeout(600);const p2=await t.data(A+' [data-round="R25"]','player');
 report.steps.player=[p1,p2];
 expect(p1?.ok&&p2?.ok,'读不到玩家：'+JSON.stringify(p2).slice(0,300));
 expect(p2.player.groundR!=null&&p2.player.aboveGround>-0.3&&p2.player.aboveGround<2.5,'玩家没站在新山面上（离地 '+p2.player.aboveGround+' m）');
 expect(Math.abs(p2.player.radius-p1.player.radius)<0.3,'玩家还在往下掉：半径 '+p1.player.radius+' → '+p2.player.radius);
 const eye=await cmd('mountain.camera',{view:'eye'});report.steps.eye=eye;await t.shotGame('R25-3-player-eye-view');
 // 对照原样：地面交回原地形；再看候选：新山面回来
 await cmd('mountain.compare',{on:true});const cmp=await cmd('mountain.state');report.steps.compareState=cmp.ground;
 expect(cmp.comparing&&cmp.ground&&cmp.ground.active===false,'对照原样时地面应交回原地形：'+JSON.stringify(cmp.ground));
 await cmd('mountain.camera',{view:'oblique'});await t.shotGame('R25-4-compare-original-oblique');
 await cmd('mountain.compare',{on:false});await cmd('mountain.camera',{view:'free'});
 await t.shotPage('R25-5-page');
});
