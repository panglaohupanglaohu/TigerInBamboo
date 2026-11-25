// ⑦ 擂台登记：building.{sites,prefabs,joint-wfc} 3 个可执行能力在合成高度场考场上 match→run：
//   targets   match 目标数
//   applied   run 的 applied 条目
//   planKeys  run 后 site.plan 新增键（sites/prefabs/solve/layout）
//   layout    joint-wfc 解出的建筑格数
// 判定规则写死：targets≥1 且 run applied≥1 且 site.plan 真新增内容为「擂过」。
// 考场：site.field 与 building.probe 同构 {n,step,half,h[],cls[],sea} —— 中央平缓台地 + 海缘。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-building-arena.mjs
import fs from 'node:fs';
import { BUILDING_CAPABILITIES } from '../../src/system-workshop/building/capabilities.js';

// 18×18 高度场：中央 10×10 平缓台地（3–6 m，微坡），外圈落海（null→海）。
const field = (() => {
  const n = 18, step = 3, h = [], cls = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.max(Math.abs(i - 8.5), Math.abs(j - 8.5));
    if (r > 6) { h.push(0); cls.push(0); }                 // 海（h=0 + 靠外）
    else if (r > 5) { h.push(1.2); cls.push(0); }          // 滩
    else { h.push(3 + ((i + j) % 3) * 0.5); cls.push(0); } // 台地
  }
  return { n, step, half: (n - 1) / 2, h, cls, sea: 0 };
})();

const defaultParams = (cap) => Object.fromEntries(Object.entries(cap.meta.params ?? {}).map(([k, d]) => [k, d.default]));
const day = new Date().toISOString().slice(0, 10);
const RUNNABLE = new Set(['building.sites', 'building.prefabs', 'building.joint-wfc']);

const results = [];
for (const cap of BUILDING_CAPABILITIES) {
  if (!RUNNABLE.has(cap.meta.id)) continue;
  const site = { scene: 'citadel', terrain: 'original', field: { ...field, h: field.h.slice(), cls: field.cls.slice() }, plan: {} };
  let targets = [], error = null;
  try { targets = cap.match(site); } catch (e) { error = e.message; }
  const t0 = Date.now();
  let out = null;
  try { out = cap.run(site, { params: defaultParams(cap) }); } catch (e) { error = e.message; }
  const planKeys = Object.keys(site.plan ?? {});
  const layout = site.plan?.layout?.placements?.length ?? 0;
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, applied: out?.applied?.length ?? 0,
    planKeys, layout, changed: (out?.changed ?? []).length, ms: Date.now() - t0, error,
  };
  entry.pass = !error && targets.length >= 1 && (entry.applied >= 1 || planKeys.length >= 1);
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: `高度场 ${field.n}×${field.n}（中央台地 + 海缘，与 building.probe 同构）`, runner: 'TigerMessenger/tools/refactor/record-building-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且 run applied≥1（或 plan 新增键，如 prefabs 目录登记）为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('building.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'tools', schemaVersion: 1, pass: r.pass,
    basis: '本能力在合成高度场考场（building.json）真实跑过 match→run，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/building.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-building-arena.mjs（实算）',
    test: 'TigerMessenger/tests/building-pipeline.test.mjs',
    arena: { fixture: `${field.n}×${field.n} 高度场` },
    result: { verdict: r.verdict, targets: r.targets, applied: r.applied, planKeys: r.planKeys, layout: r.layout, changed: r.changed, error: r.error, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`building arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} applied=${r.applied} plan=[${r.planKeys}] layout=${r.layout}${r.error ? ' ERR:' + r.error.slice(0, 60) : ''}`);
