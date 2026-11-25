// R51 端到端：系统工坊页上的「能力契约」总览。新开隔离浏览器 → pipeline.html#mountain → 契约面板：
//   除并行编码中的地貌层（relief，如实显示「没有」）外，每个已登记的可执行能力都有契约（读 · 写 · 不动）、错误数 0、迁进 meta 的层标「meta」、mountain / battle / fx 标「过渡表」；建筑能力那行写着「候选建筑群」。
// 运行：cd TigerMessenger && $NODE tests/capability-contracts-browser.mjs   （需要 8931 服务）
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('capability-contracts'),{report,expect,page}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const c=await t.data(AA,'contracts');report.steps.contracts=c;
 expect(c&&c.total>=45,'契约总数太少：'+JSON.stringify(c));
 // 地貌层（relief，R41–R50 并行编码区域）还没声明契约：页面如实显示为「没有」；除它以外不许有缺失或错误
 expect(c.missingIds.every(id=>id.startsWith('relief.')),'有能力没有契约：'+c.missingIds.join('、'));expect(c.errorIds.every(id=>id.startsWith('relief.')),'契约有错误：'+c.errorIds.join('、'));report.steps.reliefPending=c.missingIds;
 await page.locator('#contract-panel summary').click();await page.waitForTimeout(400);
 const rows=await page.locator('#contract-panel tr[data-cap]').evaluateAll(trs=>trs.map(tr=>({id:tr.dataset.cap,cells:[...tr.children].map(td=>td.textContent)})));
 report.steps.rows=rows.length;expect(rows.length===c.total,'表格行数 '+rows.length+' != '+c.total);
 const jw=rows.find(r=>r.id==='building.joint-wfc');expect(jw&&/候选建筑群/.test(jw.cells[2])&&jw.cells[3]==='meta','建筑联合 WFC 的契约行不对：'+JSON.stringify(jw));
 const pr=rows.find(r=>r.id==='mountain.protect');expect(pr&&pr.cells[3]==='过渡表','山形保护带应在过渡表');
 expect(rows.filter(r=>r.id.startsWith('planet.')).every(r=>r.cells[3]==='meta'),'球系统能力应迁进 meta');
 for(const r of rows)t.cap(r.id,{contract:r.cells[2],source:r.cells[3],checks:r.cells[4]});
 await t.shotEl('#contract-panel','R51-1-contract-panel');await t.shotPage('R51-2-page');
});
