// R56 端到端：建筑层挂上页面——建筑面板出现在高山圣城、扫描后自动预装 3 个 ⚙ 能力（选址 → prefab 目录 → 联合 WFC），左栏能力库里有「（建筑）」三项。
// 运行：cd TigerMessenger && $NODE tests/building-layer-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('building-layer'),{report,expect,page}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const pane=await page.evaluate(()=>{const e=document.getElementById('building-workshop'),cs=getComputedStyle(e);return {shown:cs.display!=='none',h:Math.round(e.getBoundingClientRect().height),scene:document.body.dataset.sceneBuilding};});
 report.steps.pane=pane;expect(pane.shown&&pane.h>200&&pane.scene==='1','建筑面板没显示：'+JSON.stringify(pane));
 const names=await page.locator(BW+' .tier-node:not(.pending) strong').allTextContents();report.steps.nodes=names;
 expect(names.length===3,'预装节点数 '+names.length+'：'+names.join('、'));expect(/自动预装/.test(await t.note()),'提示里没有「自动预装」');
 const side=await page.locator('#capability-sidebar').textContent();expect((side.match(/（建筑）/g)||[]).length>=3,'左栏没有建筑能力');
 for(const n of names)t.cap(n,{layer:'building',preloaded:true});
 await t.shotEl(BW,'R56-1-building-pane');await t.shotPage('R56-2-page');
});
