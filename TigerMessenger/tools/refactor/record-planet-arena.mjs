// ⑦ 擂台登记：planet.* 22 个能力逐个在固定 SUMMARY 考场上 match→runPlanetPlan 单步执行，实测量：
//   targets   match 目标数
//   status    runPlanetPlan 步进状态（Worker 同款路径）
//   changed   实际产出变化：配方键 diff / sea 字段 / weather 字段
// 判定规则写死：targets≥1 且 status='applied' 且三类产出至少一处有真实变化为「擂过」。
// 每能力一份 catalog/arena/<id>.json 指针文件指向共享表 planet.json。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-planet-arena.mjs
import fs from 'node:fs';
import { PLANET_CAPABILITIES, DEFAULT_PLANET_RECIPE, cleanRecipe, runPlanetPlan } from '../../src/system-workshop/planet/capabilities.js';

const SUMMARY = {
  stats: { land: 0.62, landmarks: 4, lowestLandmark: { height: 1.2, id: 'anchor-a' }, charts: 6, cells: 1280 },
  hashes: { wfc: 'wfc-abc' }, recipe: DEFAULT_PLANET_RECIPE, ms: 42,
  reports: { seamReport: { ok: true } },
};
const day = new Date().toISOString().slice(0, 10);

const keyDiff = (a, b) => Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]));

const results = [];
for (const cap of PLANET_CAPABILITIES) {
  const targets = cap.match(SUMMARY, {});
  const before = cleanRecipe(DEFAULT_PLANET_RECIPE);
  const t0 = Date.now();
  const { recipe, report, sea, weather } = runPlanetPlan(DEFAULT_PLANET_RECIPE, [{ id: cap.meta.id, params: {} }]);
  const step = report[0];
  const changed = {
    recipe: keyDiff(before, recipe),
    sea: sea ? Object.keys(sea).filter((k) => sea[k] !== undefined) : [],
    weather: weather ? Object.keys(weather).filter((k) => weather[k] !== undefined) : [],
  };
  const produced = changed.recipe.length + changed.sea.length + changed.weather.length;
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, status: step.status, ms: Date.now() - t0,
    changed, produced,
    pass: targets.length >= 1 && step.status === 'applied' && produced >= 1,
    reason: targets[0]?.reason ?? null,
  };
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: '固定 SUMMARY（land .62、4 锚点、6 图幅）+ DEFAULT_PLANET_RECIPE', runner: 'TigerMessenger/tools/refactor/record-planet-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且 runPlanetPlan status=applied 且配方键/海面字段/天气字段至少一处有真实变化为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('planet.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'planet', schemaVersion: 1, pass: r.pass,
    basis: '本能力在固定 SUMMARY 考场（planet.json）真实跑过 match→runPlanetPlan 单步，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/planet.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-planet-arena.mjs（实算）',
    test: 'TigerMessenger/tests/planet-caps.test.mjs',
    arena: { fixture: 'SUMMARY+DEFAULT_PLANET_RECIPE' },
    result: { verdict: r.verdict, targets: r.targets, status: r.status, changed: r.changed, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`planet arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} status=${r.status} produced=${r.produced}`);
