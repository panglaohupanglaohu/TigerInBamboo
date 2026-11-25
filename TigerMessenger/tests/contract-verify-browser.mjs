// R52 端到端：验证检查项从契约 preserves 自动生成。高山圣城跑一次建筑管线 → 验证列表里有「契约 · 已有建筑…」「契约 · 轨道净空」等生成项，且没有 ✗；
//   建筑侧栏「契约 → 验证会查什么」列出同样的项。截图后人要看。
// 运行：cd TigerMessenger && $NODE tests/contract-verify-browser.mjs
import {openBuilding,BW,AA,BS} from './lib/building-e2e.mjs';
const t=await openBuilding('contract-verify'),{report,expect,page}=t;
await t.finish(async()=>{
 report.steps.scan=await t.boot('citadel');
 const r=await t.runBuilding();report.steps.run=r;
 const gen=r.checks.filter(x=>x.includes('契约 · '));report.steps.generated=gen;
 for(const name of ['已有建筑','建筑保护带','轨道净空','海岸线','不写用户存档','不碰湖上建筑'])expect(gen.some(x=>x.includes(name)),'缺生成的检查：'+name+' / '+gen.join(' | '));
 expect(!gen.some(x=>x.startsWith('✗')),'生成的检查有失败：'+gen.join(' | '));
 for(const g of gen)t.cap('building.joint-wfc',{generatedCheck:g});
 await t.shotEl(BW+' .verify-checks','R52-1-generated-checks');
 await page.locator(BS+' details summary',{hasText:'契约'}).click();await t.shotEl(BS,'R52-2-side-contract');
});
