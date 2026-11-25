// R27 端到端：配色二选一——Bad North 夏季 与 Townscaper 两套候选并排对照（页面缩略图 + 检查），实景一键切换、一键回计划配色。
//   pipeline.html#mountain → 扫描 → 执行山形管线 → 验收台「对照两套配色」→ 两张卡片各有草坡面积 / 不偏灰两项检查
//   → 「实景换上这套」切到 Bad North 夏季、再切到 Townscaper（同一斜后机位各拍一张）→ 「实景回计划配色」。选哪套由用户定，这里不设默认。
// 运行：cd TigerMessenger && $NODE tests/mountain-palette-browser.mjs   （需要 8931 服务）
import {openMountain,A} from './mountain-e2e-lib.mjs';
const t=await openMountain('mountain-palette'),{report,expect,cmd}=t,S=A+' [data-round="R27"]';
await t.finish(async()=>{
 report.steps.scan=await t.boot();
 const run=await t.runCandidate();report.steps.run={h4:run.h4,palette:run.state.palette};
 await cmd('mountain.camera',{view:'oblique'});await t.shotGame('R27-0-plan-palette',2500);
 await t.clickAccept('对照两套配色');await t.page.waitForFunction(s=>!!document.querySelector(s)?.dataset.palette,S,{timeout:60000});
 const rows=await t.data(S,'palette');report.steps.rows=rows;
 expect(rows.length===2&&rows.map(r=>r.id).join()==='1,2','两套候选不是 Bad North 夏季 / Townscaper：'+JSON.stringify(rows));
 for(const r of rows)expect(r.checks.length===2&&Number.isFinite(r.grassShare)&&Number.isFinite(r.greyShare),r.label+' 检查不完整');
 expect(rows[0].grassShare===rows[1].grassShare,'同一座山两套配色的草坡面积应相同（只换颜色）');
 expect(await t.page.locator(S+' .ma-card canvas').count()===2,'对照缩略图没画出来');
 await t.shotAccept('R27-1-compare-panel');
 const states={};
 for(const id of [1,2]){await t.page.locator(S+` .ma-card[data-palette="${id}"] button`).click();await t.page.waitForTimeout(800);
  states[id]=await cmd('mountain.state');expect(states[id].palette===id&&states[id].paletteOverride,'实景没换成配色 '+id+'：'+JSON.stringify({p:states[id].palette,o:states[id].paletteOverride}));
  expect(states[id].ground?.installed,'换配色不应撤掉玩家地面');
  await t.shotGame(`R27-${id+1}-live-${id===1?'badnorth-summer':'townscaper'}`,2500);}
 report.steps.states=Object.fromEntries(Object.entries(states).map(([k,v])=>[k,{palette:v.palette,override:v.paletteOverride,triangles:v.triangles}]));
 expect(states[1].triangles===states[2].triangles,'换配色改了形状（面数不同）');
 await t.clickAccept('实景回计划配色');await t.page.waitForTimeout(800);const back=await cmd('mountain.state');report.steps.back={palette:back.palette,override:back.paletteOverride};
 expect(back.paletteOverride===false,'没回到计划配色');
 const adopted=await t.frame()?.evaluate(()=>localStorage.getItem('tm.mountain.adopted.v1:citadel'));expect(!adopted,'对照配色不应写采用记录');
 await cmd('mountain.camera',{view:'free'});await t.shotPage('R27-4-page');
});
