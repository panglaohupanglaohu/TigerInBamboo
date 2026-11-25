// R29 端到端：十二门徒三套外观（approved / soft / soft,palette）各拍 4 个有效机位（全景 / 侧面 / 俯视 / 崖脚特写），并自动查「半透明破面」。
//   每套一个新的隔离上下文；读状态前先等岩体网格连续 3 次稳定出现（修 Guide §13「实景状态读取竞态」：重建间隙读到 0）。
//   崖脚特写：如果这套外观查出反面三角，镜头对准反面三角最多的那块岩体的那个位置；否则对准前排左台离镜头最近的崖脚。
//   断言：稳定读到 9 块左右的岩体、实景外观就是要的那套、4 个机位都有效（镜头在海面以上、没被岩体挡住）、岩体材质不透明、
//         候选比 approved 没有多出反面三角（半透明破面的常见原因）。植被 / 白沫的同机位比较也记进报告（R30 单独断言）。
//   产出：artifacts/apostles-look-views-e2e/run-*/<外观>-<机位>.png、report.json；并覆盖 artifacts/apostles-look-views-e2e/latest.json（工坊对照区读它）。
// 运行：cd TigerMessenger && $NODE tests/apostles-look-views-browser.mjs [approved soft soft,palette]   （需要 8931 服务；人必须逐张打开看）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, openApostles, waitApostlesStable, probeCall, shootView, LOOK_ID, fileName, expect } from './lib/apostles-e2e.mjs';
import { compareToBaseline } from '../src/world/rea/apostles-surface-checks.js';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const base = path.join(root, 'artifacts/apostles-look-views-e2e'), out = path.join(base, 'run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const looks = process.argv.slice(2).length ? process.argv.slice(2) : ['approved', 'soft', 'soft,palette'];
const VIEWS = ['overview', 'side', 'top', 'cliff-foot'];
const report = { out, capabilities: [], looks: {}, regressions: {}, errors: [], pass: false };
const browser = await launch();
for (const look of looks) {
  const name = fileName(look), r = report.looks[name] = { look, errors: [], views: [] }; let ctx;
  try {
    const t0 = Date.now(), o = await openApostles(browser, { look, errors: r.errors }); ctx = o.ctx; const page = o.page;
    const w = await waitApostlesStable(page, { need: 3 }); r.stable = { ok: w.ok, samples: w.samples, resets: w.resets, ms: w.ms, sample: w.sample, reason: w.reason || null };
    expect(w.ok, name + ': ' + w.reason); expect(w.sample.count >= 5, name + ': 只稳定读到 ' + w.sample.count + ' 块岩体');
    expect(w.sample.look === LOOK_ID[look], name + ': 实景外观是 ' + w.sample.look + '，不是 ' + LOOK_ID[look]);
    r.surface = await probeCall(page, 'checkApostlesSurface'); expect(r.surface?.ok, name + ': 检查失败 ' + r.surface?.reason);
    for (const view of VIEWS) {
      const opts = view === 'cliff-foot' && r.surface.defect ? { at: { massId: r.surface.defect.massId, at: r.surface.defect.at } } : {};
      const v = await shootView(page, view, path.join(out, `${name}-${view}.png`), opts); r.views.push(v);
    }
    // 拍完再读一次：拍照过程中场景没被重建（同一个场景对象、同样块数）
    const after = await waitApostlesStable(page, { need: 2, timeout: 60000 }); r.stableAfter = { ok: after.ok, same: after.ok && after.sample.sceneKey === w.sample.sceneKey && after.sample.count === w.sample.count };
    r.seconds = Math.round((Date.now() - t0) / 1000);
    const bad = r.views.filter((v) => !v.ok || !v.valid);
    expect(!bad.length, name + ': 无效机位 ' + bad.map((v) => `${v.view}(${v.reason || (v.occluder ? '被 ' + v.occluder.mass + ' 挡住' : '在水下')})`).join('、'));
    expect(r.surface.totals.transparentRock === 0, name + ': 岩体材质半透明 ' + r.surface.totals.transparentRock);
    expect(r.stableAfter.same, name + ': 拍照过程中场景被重建了，截图和检查可能不是同一个场景');
    r.pass = true;
  } catch (e) { r.pass = false; r.failure = String(e.stack || e).slice(0, 900); }
  finally { await ctx?.close(); }
  console.log(name, JSON.stringify({ pass: r.pass, failure: r.failure || null, stable: r.stable, views: r.views.map((v) => [v.view, v.valid]), totals: r.surface?.totals }).slice(0, 1200));
}
await browser.close();
// 同机位与 approved 比
const A = report.looks.approved?.surface?.totals;
for (const [name, r] of Object.entries(report.looks)) if (name !== 'approved') {
  report.regressions[name] = r.surface?.totals ? compareToBaseline(A, r.surface.totals) : [{ id: 'missing', name: '没有检查结果' }];
  const glass = report.regressions[name].filter((x) => x.id === 'material' || x.id === 'inverted' || x.id === 'missing');
  if (glass.length) { r.pass = false; r.failure = (r.failure ? r.failure + ' | ' : '') + '半透明破面：' + glass.map((x) => `${x.name} ${x.before}→${x.after}`).join('；'); }
}
report.pass = Object.values(report.looks).every((r) => r.pass);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
// 工坊对照区的清单（相对 TigerMessenger/，只放文件名与检查汇总）
const manifest = { dir: path.relative(root, out).split(path.sep).join('/'), at: Date.now(), pass: report.pass, looks: {}, regressions: report.regressions };
for (const [name, r] of Object.entries(report.looks)) manifest.looks[name] = { views: r.views.map((v) => ({ view: v.view, file: v.file, valid: !!(v.ok && v.valid) })), surface: r.surface?.ok ? { status: r.surface.status, totals: r.surface.totals } : null, error: r.pass ? null : (r.failure || '').split('\n')[0].slice(0, 200) };
fs.writeFileSync(path.join(base, 'latest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ pass: report.pass, out, latest: path.join(base, 'latest.json') }, null, 1));
process.exit(report.pass ? 0 : 1);
