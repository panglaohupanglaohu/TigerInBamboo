// R26 擂台登记：在固定种子测试岛上实算每一代的四项指标，写回 src/scene-authoring/catalog/arena/terrain.json。
// 登记表只能由这个脚本写（tests/mountain-arena.test.mjs 会核对登记 = 实算）；判定按 arena.js 写死的规则，不手改。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-terrain-arena.mjs
import fs from 'node:fs';
import { arenaIsland, ARENA_SEED, ARENA_GENERATIONS, ARENA_TOLERANCE, terrainMetrics, runArenaGeneration, compareGenerations } from '../../src/system-workshop/mountain/arena.js';
const file = new URL('../../src/scene-authoring/catalog/arena/terrain.json', import.meta.url), reg = JSON.parse(fs.readFileSync(file, 'utf8'));
const field = arenaIsland(ARENA_SEED), day = new Date().toISOString().slice(0, 10), pick = (m) => ({ mid: m.mid, cliff: m.cliff, drain: m.drain, hardEdge: m.hardEdge });
const runs = ARENA_GENERATIONS.map((g) => runArenaGeneration(g, field));
reg.tolerance = ARENA_TOLERANCE;
reg.original = pick(terrainMetrics(field, { h: field.h, protect: { band: 6, railBand: 8 } }));
reg.generations = runs.map((r) => ({ id: r.id, label: r.label, steps: r.steps, metrics: pick(r.metrics), recordedAt: day, recordedBy: 'tools/refactor/record-terrain-arena.mjs（实算）' }));
const v = compareGenerations(runs.at(-2).metrics, runs.at(-1).metrics);
reg.verdict = { current: runs.at(-1).id, previous: runs.at(-2).id, beats: v.beats, text: v.text, rows: v.rows.map(({ key, prev, cur, gain, verdict }) => ({ key, prev, cur, gain, verdict })) };
fs.writeFileSync(file, JSON.stringify(reg, null, 1) + '\n');
// 按能力分发 ⑦ 证据：每个真实参与代际管线的能力一份指针文件（参照 nav-parity 的 per-cap 分发）。
const capIds = [...new Set(ARENA_GENERATIONS.flatMap((g) => g.steps))];
for (const id of capIds) {
  const capFile = new URL(`../../src/scene-authoring/catalog/arena/${id}.json`, import.meta.url);
  const inGens = runs.filter((r) => r.steps.includes(id)).map((r) => ({ id: r.id, label: r.label, metrics: pick(r.metrics) }));
  fs.writeFileSync(capFile, JSON.stringify({
    capability: id, line: 'terrain', schemaVersion: 1,
    basis: '本能力真实参与 arena 代际管线（见 inGenerations），成绩与判定登记在共享表 terrain.json——判定按 arena.js 写死的规则，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/terrain.json#' + id,
    runner: 'TigerMessenger/tools/refactor/record-terrain-arena.mjs（实算）', test: 'TigerMessenger/tests/mountain-arena.test.mjs',
    arena: { seed: ARENA_SEED, tolerance: ARENA_TOLERANCE },
    inGenerations: inGens, verdict: reg.verdict, recordedAt: day, pass: true, status: 'measured',
  }, null, 1) + '\n');
}
console.log(`擂台登记已写：${runs.map((r) => `${r.id} ${JSON.stringify(pick(r.metrics))}`).join(' | ')}\n判定：${v.text}\n按能力分发 ${capIds.length} 份 arena/<能力ID>.json`);
