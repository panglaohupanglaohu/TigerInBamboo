// R57 端到端：建筑候选进高山圣城。扫描 → ▶ 执行（整体放置）→ 斜俯 / 对照原样 两张实景图 → 原有网格数与位置指纹前后完全一样（不碰已有建筑）
//   → 「✓ 采用建筑群（只记候选）」只写 tm.building.adopted.v1:citadel 且 autoDeploy=false → 「撤销采用记录」删掉。
// 运行：cd TigerMessenger && $NODE tests/building-citadel-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('building-citadel'),{report,expect,page}=t,KEY='tm.building.adopted.v1:citadel';
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const before=await t.rootSig('citadel');report.steps.rootBefore=before;expect(await t.storage(KEY)===null,'新 context 里不该有采用记录');
 const r=await t.runBuilding();report.steps.run={h4:r.h4,checks:r.checks,state:r.state};
 expect(r.state.previewing&&r.state.inScene&&r.state.buildings>0,'没有预览：'+JSON.stringify(r.state));expect(!r.checks.some(c=>c.startsWith('✗')),'验证有失败项：'+r.checks.join(' | '));
 const during=await t.rootSig('citadel');report.steps.rootDuring=during;expect(JSON.stringify(during)===JSON.stringify(before),'预览改动了圣城原有网格：'+JSON.stringify([before,during]));
 await t.cmd('building.camera',{view:'oblique'});await t.shotGame('R57-1-candidate-oblique');
 await t.cmd('building.compare',{on:true});const cmp=await t.gameState();expect(cmp.comparing&&cmp.groups[0]&&!cmp.groups[0].visible,'对照原样没隐藏候选');await t.shotGame('R57-2-original-same-camera');await t.cmd('building.compare',{on:false});
 const commit=page.locator(BW+' button',{hasText:'采用建筑群'});await commit.first().click();await page.waitForTimeout(1500);
 const rec=JSON.parse(await t.storage(KEY)||'null');report.steps.record={buildings:rec?.buildings,autoDeploy:rec?.autoDeploy,terrain:rec?.terrain};
 expect(rec&&rec.autoDeploy===false&&rec.buildings===r.state.buildings,'采用记录不对：'+JSON.stringify(report.steps.record));
 await page.click('#building-unadopt');await page.waitForTimeout(800);expect(await t.storage(KEY)===null,'撤销采用后记录还在');
 const after=await t.rootSig('citadel');expect(JSON.stringify(after)===JSON.stringify(before),'撤回后圣城原有网格不一致');
 t.cap('building.joint-wfc',{scene:'citadel',buildings:r.state.buildings,meshes:r.state.meshes});
 await t.cmd('building.camera',{view:'free'});await t.shotEl(BS,'R57-3-side-after-unadopt');
});
