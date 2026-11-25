// R60 端到端：「地形 → 建筑」两段管线在高山圣城连起来跑。目标「在山上建一片带路的建筑群」→ 点「两段连跑（地形 → 建筑）」
//   = 按契约拼管线 → 装进山形 / 建筑两层 → 山形执行并预览 → 建筑重新扫描（读山形候选高度）→ 建筑执行并预览。
//   断言：两段都出候选、建筑地形来源 = mountain-candidate、游戏里山形与建筑候选同时在；三张实景图 + 面板图。最后两段都撤回，不采用。
// 运行：cd TigerMessenger && $NODE tests/terrain-building-chain-browser.mjs   （整段约 5–10 分钟）
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('terrain-building-chain'),{report,expect,page}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 await page.fill('#assemble-goal','在山上建一片带路的建筑群');await page.selectOption('#assemble-scene','citadel');
 await page.click('#assemble-chain');
 await page.waitForFunction(()=>!!document.getElementById('auto-assemble')?.dataset.chain,{},{timeout:900000});
 const chain=await t.data(AA,'chain');report.steps.chain=chain;await t.shotEl(AA,'R60-1-assemble-panel');
 expect(chain.ok,'两段连跑没成功：'+JSON.stringify(chain));
 const ms=await t.cmd('mountain.state'),bs=await t.gameState();report.steps.mountainState=ms;report.steps.buildingState=bs;
 expect(ms.previewing,'山形候选没在预览');expect(bs.previewing&&bs.terrain==='mountain-candidate'&&!bs.terrainStale,'建筑没站在山形候选上：'+JSON.stringify(bs));
 await t.cmd('building.camera',{view:'oblique'});await t.shotGame('R60-2-chain-oblique');
 await t.cmd('building.camera',{view:'top'});await t.shotGame('R60-3-chain-top');
 await t.cmd('mountain.compare',{on:true});await t.cmd('building.compare',{on:true});await t.cmd('building.camera',{view:'oblique'});await t.shotGame('R60-4-original-same-camera');
 await t.cmd('mountain.compare',{on:false});await t.cmd('building.compare',{on:false});
 await t.shotEl(BW,'R60-5-building-pane');
 for(const s of chain.steps)t.cap(s.layer,{status:s.status,previewed:s.previewed,terrain:s.terrain||null});
 await t.cmd('building.camera',{view:'free'});await t.cmd('building.revert');await t.cmd('mountain.revert');
});
