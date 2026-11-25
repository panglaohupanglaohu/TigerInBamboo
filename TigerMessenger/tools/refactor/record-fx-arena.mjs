// ⑦ 擂台登记：fx.* 9 个能力逐个在固定舞台考场上 match→run，实测量：
//   targets   match 目标数
//   applied   run 的 applied 条目
//   changed   run 的 changed 摘要条数 + site.plan 新增的键
// 判定规则写死：targets≥1 且 applied≥1 且 site.plan 真有新键为「擂过」。
// 每能力一份 catalog/arena/<id>.json 指针文件指向共享表 fx.json。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-fx-arena.mjs
import fs from 'node:fs';
import { FX_CAPABILITIES } from '../../src/system-workshop/fx/capabilities.js';

// 固定舞台考场：6×4 岛格（lv 1–3 台地 + 3 间小屋 + 水缘格），与 battle.probe 的 {grid:[x,z,lv,house]} 同构。
const site = { scale: 1, levelHeight: 0.5, grid: [] };
for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++)
  site.grid.push([x * 3, y * 3, 1 + ((x + y) % 3), (x === 2 && y === 1) || (x === 4 && y === 2) || (x === 1 && y === 3) ? 1 : 0]);
for (let x = 0; x < 6; x++) site.grid.push([x * 3, -3, 0, 0], [x * 3, 12, 0, 0]);   // 南北水缘

const defaultParams = (cap) => Object.fromEntries(Object.entries(cap.meta.params ?? {}).map(([k, d]) => [k, d.default]));
const day = new Date().toISOString().slice(0, 10);

const results = [];
for (const cap of FX_CAPABILITIES) {
  const s = { scale: site.scale, levelHeight: site.levelHeight, grid: site.grid.map((r) => r.slice()), plan: {} };
  let targets = [], error = null;
  try { targets = cap.match(s); } catch (e) { error = e.message; }
  const t0 = Date.now();
  let out = null;
  try { out = cap.run(s, { params: defaultParams(cap) }); } catch (e) { error = e.message; }
  const planKeys = Object.keys(s.plan ?? {});
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, applied: out?.applied?.length ?? 0,
    planKeys, changed: (out?.changed ?? []).length, ms: Date.now() - t0, error,
  };
  entry.pass = !error && targets.length >= 1 && entry.applied >= 1 && planKeys.length >= 1;
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: `舞台 ${site.grid.length} 格（6×4 台地岛 + 3 小屋 + 水缘）`, runner: 'TigerMessenger/tools/refactor/record-fx-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且 run applied≥1 且 site.plan 新增至少一键为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('fx.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'fx', schemaVersion: 1, pass: r.pass,
    basis: '本能力在固定舞台考场（fx.json）真实跑过 match→run，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/fx.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-fx-arena.mjs（实算）',
    test: 'TigerMessenger/tests/planet-caps.test.mjs 同款执行面',
    arena: { fixture: `${site.grid.length} 格舞台` },
    result: { verdict: r.verdict, targets: r.targets, applied: r.applied, planKeys: r.planKeys, changed: r.changed, error: r.error, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`fx arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} applied=${r.applied} plan=[${r.planKeys}]${r.error ? ' ERR:' + r.error.slice(0, 60) : ''}`);
