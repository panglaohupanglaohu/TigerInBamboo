// R53 端到端：「按目标自动拼管线」。高山圣城：目标「在山上建一片带路的建筑群」→ 两段（山形 → 建筑），推理里有跨层那一句（高度场）；
//   目标「建一片房子和礼拜堂」→ 只有建筑一段；空目标 → 沿用 R22 按场景预装。每次截图；不装、不执行。
// 运行：cd TigerMessenger && $NODE tests/auto-assemble-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('auto-assemble'),{report,expect,page}=t;
const assemble=async(goal,shot)=>{await page.fill('#assemble-goal',goal);await page.selectOption('#assemble-scene','citadel');await page.click('#assemble-run');await page.waitForTimeout(500);const a=await t.data(AA,'assembly');const why=await page.locator('#assemble-reasoning li').evaluateAll(ls=>ls.map(l=>({kind:l.dataset.kind,text:l.textContent})));await t.shotEl(AA,shot);return {...a,why};};
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const a=await assemble('在山上建一片带路的建筑群','R53-1-mountain-then-building');report.steps.both=a;
 expect(a.mode==='goal'&&JSON.stringify(a.stages.map(s=>s.layer))==='["mountain","building"]','应拼出 山形 → 建筑：'+JSON.stringify(a.stages));
 expect(a.why.some(w=>w.kind==='order'&&/高度场/.test(w.text)),'推理里没有跨层的高度场链接');
 const b=await assemble('建一片房子和礼拜堂','R53-2-building-only');report.steps.buildingOnly=b;
 expect(JSON.stringify(b.stages.map(s=>s.layer))==='["building"]','只要房子时不该拉山形：'+JSON.stringify(b.stages));
 const c=await assemble('','R53-3-no-goal-preload');report.steps.noGoal=c;
 expect(c.mode==='preload'&&c.why.some(w=>/R22/.test(w.text)),'空目标应沿用 R22 预装：'+c.mode);
 for(const id of a.steps)t.cap(id,{assembledBy:'goal'});
});
