// R30 端到端：植被、岸线白沫跟随新地形复检（approved / soft / soft,palette）。
//   每套一个新的隔离上下文 → 等岩体网格连续 3 次稳定 → checkApostlesSurface：每块岩体抽样植物（每种实例最多 60 株）算离脚下岩面的高差，
//   白沫顶点离水线的距离、水线 3 米内有没有白沫 → 拍两张近景（俯视看顶面植被、主峰崖脚看白沫）。
//   断言：每套 植物不贴地 ≤ 20%、白沫离岸 / 水线无白沫 ≤ 35%（绝对线，粗）；候选比 approved 同指标不多 5 / 10 个百分点（主判据）。
//   产出 artifacts/apostles-surface-e2e/run-*/：<外观>-veg-top.png、<外观>-foam-cliff.png、report.json（每块岩体每种植物的高差分级）。
// 运行：cd TigerMessenger && $NODE tests/apostles-surface-browser.mjs [approved soft soft,palette]   （需要 8931 服务；人必须打开看）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, openApostles, waitApostlesStable, probeCall, shootView, LOOK_ID, fileName, expect } from './lib/apostles-e2e.mjs';
import { compareToBaseline } from '../src/world/rea/apostles-surface-checks.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/apostles-surface-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const looks = process.argv.slice(2).length ? process.argv.slice(2) : ['approved', 'soft', 'soft,palette'];
const report = { out, looks: {}, regressions: {}, pass: false };
const browser = await launch();
for (const look of looks) {
  const name = fileName(look), r = report.looks[name] = { look, errors: [] }; let ctx;
  try {
    const o = await openApostles(browser, { look, errors: r.errors }); ctx = o.ctx; const page = o.page;
    const w = await waitApostlesStable(page, { need: 3 }); expect(w.ok, name + ': ' + w.reason); expect(w.sample.look === LOOK_ID[look], name + ': 外观是 ' + w.sample.look);
    const s = await probeCall(page, 'checkApostlesSurface', { plantsPerMesh: 60 }); expect(s?.ok, name + ': 检查失败 ' + s?.reason);
    r.totals = s.totals; r.status = s.status;
    r.masses = s.masses.map((m) => ({ id: m.id, status: m.status, plants: m.plants, plantsByMesh: m.plantsByMesh, foam: m.foam, checks: m.checks }));
    r.shots = [await shootView(page, 'top', path.join(out, `${name}-veg-top.png`)), await shootView(page, 'cliff-foot', path.join(out, `${name}-foam-cliff.png`), { massId: 'back-right' })];
    expect(s.totals.plants > 0, name + ': 一株植物都没抽到（植被丢了？）');
    expect(s.totals.plantBadShare <= 0.2, name + ': 植物不贴地 ' + (s.totals.plantBadShare * 100).toFixed(1) + '%');
    expect(s.totals.foam > 0 && s.totals.coast > 0, name + ': 没有白沫或水线点');
    expect(s.totals.foamStrayShare <= 0.35 && s.totals.foamUncoveredShare <= 0.35, name + `: 白沫离岸 ${(s.totals.foamStrayShare * 100).toFixed(1)}% / 水线无白沫 ${(s.totals.foamUncoveredShare * 100).toFixed(1)}%`);
    r.pass = true;
  } catch (e) { r.pass = false; r.failure = String(e.stack || e).slice(0, 900); }
  finally { await ctx?.close(); }
  console.log(name, JSON.stringify({ pass: r.pass, failure: r.failure || null, totals: r.totals }).slice(0, 900));
}
await browser.close();
const A = report.looks.approved?.totals;
for (const [name, r] of Object.entries(report.looks)) if (name !== 'approved') {
  const reg = (r.totals ? compareToBaseline(A, r.totals) : [{ id: 'missing', name: '没有检查结果' }]).filter((x) => ['plants', 'foam', 'foam-stray', 'missing'].includes(x.id));
  report.regressions[name] = reg;
  if (reg.length) { r.pass = false; r.failure = (r.failure ? r.failure + ' | ' : '') + '比 approved 变差：' + reg.map((x) => `${x.name} ${x.before}→${x.after}`).join('；'); }
}
report.pass = Object.values(report.looks).every((r) => r.pass);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, out }, null, 1));
process.exit(report.pass ? 0 : 1);
