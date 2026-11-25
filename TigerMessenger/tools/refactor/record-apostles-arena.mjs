// ⑦ 擂台登记：apostles.* 2 个能力逐个在合成双岩体考场上 match→run，实测量：
//   targets   match 岩体数
//   applied   run 的 applied 条目
//   planKeys  run 后 site.plan 新增键
//   massChanges run 后 lv/colors 实际变化的岩体数
// 判定规则写死：targets≥1 且 applied≥1 且flag 入列 且 metrics 真产逐岩体行为「擂过」（现场外观由 look 下发，不原地改 lv）。
// 考场与 tests/apostles-terrain-pipeline.test.mjs 同形（24×24 双层台地岩体×2，带顶/壁颜色）。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-apostles-arena.mjs
import fs from 'node:fs';
import { APOSTLES_TERRAIN_CAPABILITIES } from '../../src/system-workshop/apostles-terrain/capabilities.js';

function mass(id, order, step) {
  const n = 24, xz = [], lv = [], edges = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i - 12, z = j - 12, r = Math.hypot(x, z); xz.push(x, z); lv.push(r > 10 ? 0 : step === 1 ? 1 + Math.floor((10 - r) / 1.5) : 1 + 2 * Math.floor((10 - r) / 3)); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * n + i; for (const b of [i + 1 < n ? a + 1 : -1, j + 1 < n ? a + n : -1]) if (b >= 0 && lv[a] > 0 && lv[b] > 0) edges.push(a, b); }
  return { id, order, seed: 7300 + order * 101, spire: false, scale: 2.1, xz, lv, edges, colors: { top: '#9fbf55', wall: '#d8d2c2' } };
}
const site = () => ({ ok: true, scene: 'apostles', look: { id: 'approved', soft: false, palette: false }, masses: [mass('front-left', 3, 1), mass('back-right', 1, 2)] });
const day = new Date().toISOString().slice(0, 10);

const results = [];
for (const cap of APOSTLES_TERRAIN_CAPABILITIES) {
  const s = site();
  let targets = [], error = null;
  try { targets = cap.match(s); } catch (e) { error = e.message; }
  const t0 = Date.now();
  let out = null;
  try { out = cap.run(s, { params: {} }); } catch (e) { error = e.message; }
  const flag = { 'apostles.soft': 'soft', 'apostles.palette': 'palette' }[cap.meta.id];
  const flags = s.plan?.flags ?? [], metrics = s.plan?.metrics ?? {};
  const mrows = metrics.soft?.masses?.length ?? metrics.palette?.masses?.length ?? 0;
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, applied: out?.applied?.length ?? 0,
    flagSet: flags.includes(flag), metricsRows: mrows,
    planKeys: Object.keys(s.plan ?? {}), changed: out?.changed?.[0]?.slice(0, 100) ?? null, ms: Date.now() - t0, error,
  };
  entry.pass = !error && targets.length >= 1 && entry.applied >= 1 && entry.flagSet && mrows >= 1;
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: '双岩体考场（24×24 双层台地，带顶/壁色）——与 apostles-terrain-pipeline.test.mjs 同形', runner: 'TigerMessenger/tools/refactor/record-apostles-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且 run applied≥1 且 flag 入列 + metrics 有逐岩体实算行为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('apostles.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'terrain', schemaVersion: 1, pass: r.pass,
    basis: '本能力在双岩体考场（apostles.json）真实跑过 match→run，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/apostles.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-apostles-arena.mjs（实算）',
    test: 'TigerMessenger/tests/apostles-terrain-pipeline.test.mjs',
    arena: { fixture: '双岩体（台地 + 颜色）' },
    result: { verdict: r.verdict, targets: r.targets, applied: r.applied, planKeys: r.planKeys, flagSet: r.flagSet, metricsRows: r.metricsRows, changed: r.changed, error: r.error, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`apostles arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} applied=${r.applied} metricsRows=${r.metricsRows} plan=[${r.planKeys}]${r.error ? ' ERR:' + r.error.slice(0, 60) : ''}`);
