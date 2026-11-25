// R59 端到端：整体放置 / 替换 / 撤回。执行一次 → 「换一组（整体替换）」→ 种子变了、场景里仍只有一组候选、栋位不同 → 「撤回建筑群」→ 场景里一组都没有。
// 运行：cd TigerMessenger && $NODE tests/building-replace-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('building-replace'),{report,expect,page}=t;
const layoutSig=()=>page.locator('#building-layout-svg').evaluate(s=>[...s.querySelectorAll('g[data-prefab]')].map(g=>g.dataset.prefab+':'+g.querySelector('rect').getAttribute('x')+','+g.querySelector('rect').getAttribute('y')).join(' '));
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const r=await t.runBuilding(),sigA=await layoutSig();report.steps.first={seed:r.state.seed,buildings:r.state.buildings};
 await t.cmd('building.camera',{view:'oblique'});await t.shotGame('R59-1-first-group');
 await page.click('#building-replace');
 await page.waitForFunction(()=>/已用种子|失败/.test(document.getElementById('building-action-note')?.textContent||''),{},{timeout:300000});
 const note=await page.locator('#building-action-note').textContent();expect(/已用种子/.test(note),'整体替换失败：'+note);
 const s2=await t.gameState(),sigB=await layoutSig();report.steps.second={seed:s2.seed,buildings:s2.buildings,note};
 expect(s2.seed!==r.state.seed,'种子没变');expect(s2.groups.length===1,'场景里候选组数 '+s2.groups.length+'（旧的一组没撤掉）');expect(sigA!==sigB,'换一组后栋位没变');
 await t.cmd('building.camera',{view:'oblique'});await t.shotGame('R59-2-replaced-group');
 await page.click('#building-revert');await page.waitForTimeout(800);
 const s3=await t.gameState();report.steps.reverted=s3;expect(!s3.previewing&&s3.groups.length===0,'撤回后场景里还有候选');
 await t.shotGame('R59-3-reverted');await t.cmd('building.camera',{view:'free'});
 t.cap('building.joint-wfc',{replace:[r.state.seed,s2.seed],reverted:true});
});
