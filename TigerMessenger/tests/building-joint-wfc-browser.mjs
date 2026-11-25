// R55 端到端：高山圣城跑建筑管线 → 侧栏「联合 WFC 平面图」（建筑 / 路 / 门；线框平面图，不是最终效果）与游戏里真的建出来的栋数一致。
// 运行：cd TigerMessenger && $NODE tests/building-joint-wfc-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('building-joint-wfc'),{report,expect,page}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const r=await t.runBuilding();report.steps.run={h4:r.h4,checks:r.checks,state:r.state};
 expect(r.state.previewing&&r.state.buildings>0,'游戏里没有建筑候选：'+JSON.stringify(r.state));
 const svg=await page.locator('#building-layout-svg').evaluate(s=>({buildings:+s.dataset.buildings,roads:+s.dataset.roads,groups:s.querySelectorAll('g[data-prefab]').length,kinds:[...new Set([...s.querySelectorAll('g[data-prefab]')].map(g=>g.dataset.prefab))]}));
 report.steps.svg=svg;expect(svg.buildings===r.state.buildings&&svg.groups===svg.buildings,'平面图与实景栋数不一致：'+JSON.stringify(svg)+' / '+r.state.buildings);
 expect(r.state.groups.length===1&&r.state.groups[0].children===r.state.meshes,'场景里候选组不对：'+JSON.stringify(r.state.groups));
 t.cap('building.joint-wfc',{buildings:svg.buildings,roads:svg.roads,kinds:svg.kinds});
 await t.shotEl('#building-plan','R55-1-joint-wfc-plan');
 await t.cmd('building.camera',{view:'top'});await t.shotGame('R55-2-game-top');await t.cmd('building.camera',{view:'free'});
});
