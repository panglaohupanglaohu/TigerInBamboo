// R58 端到端：建筑管线进水晶城。#scene 选水晶城 → 扫描（峡谷阶地 + 已有晶塔足迹）→ ▶ 执行 → 斜俯 / 俯视实景图；
//   水晶城根对象原有网格指纹、用户搭建存档 tm.crystalCity.layout.v1 前后完全一样。
// 运行：cd TigerMessenger && $NODE tests/building-crystal-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('building-crystal'),{report,expect,page}=t,SAVE='tm.crystalCity.layout.v1';
await t.finish(async()=>{
 report.steps.scan=await t.boot('crystal');
 const terrain=await t.data(BS,'terrain');report.steps.terrain=terrain;
 const before=await t.rootSig('crystal'),saveBefore=await t.storage(SAVE);report.steps.rootBefore=before;
 const r=await t.runBuilding();report.steps.run={h4:r.h4,checks:r.checks,state:r.state};
 expect(r.state.id==='crystal'&&r.state.previewing&&r.state.buildings>0,'水晶城没有建筑候选：'+JSON.stringify(r.state));
 expect(!r.checks.some(c=>c.startsWith('✗')),'验证有失败项：'+r.checks.join(' | '));
 expect(JSON.stringify(await t.rootSig('crystal'))===JSON.stringify(before),'预览改动了水晶城原有网格');
 expect(await t.storage(SAVE)===saveBefore,'用户的水晶城搭建存档被改了');
 await t.cmd('building.camera',{view:'oblique'});await t.shotGame('R58-1-crystal-oblique');
 await t.cmd('building.camera',{view:'top'});await t.shotGame('R58-2-crystal-top');await t.cmd('building.camera',{view:'free'});
 t.cap('building.joint-wfc',{scene:'crystal',buildings:r.state.buildings});
 await t.shotEl('#building-plan','R58-3-crystal-plan');
});
