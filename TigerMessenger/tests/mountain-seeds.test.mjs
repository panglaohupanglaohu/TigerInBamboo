// R28 多种子分布报告（Guide §1.4 创新 6）：同一条山形管线只换噪声种子跑 30 次，看分布，选最好 / 最差 / 最典型。纯函数，Node 可跑。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/mountain-seeds.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { seedGenome, runSeeds, distribution, pickThree, seedReport, SEED_METRICS } from '../src/system-workshop/mountain/seeds.js';
import { defaultGenome, genomeKey } from '../src/system-workshop/mountain/evolve.js';
import { arenaIsland } from '../src/system-workshop/mountain/arena.js';
const field = arenaIsland();

test('种子基因：只改 massif.seed 与 rolling.seed，其余全是默认；30 个种子两两不同', () => {
  const d = defaultGenome(), keys = new Set();
  for (let s = 1; s <= 30; s++) { const g = seedGenome(s); keys.add(genomeKey(g));
    assert.equal(g['mountain.massif'].seed, s); assert.equal(g['mountain.rolling'].seed, (s * 37) % 1000);
    for (const [id, p] of Object.entries(d)) for (const [k, v] of Object.entries(p)) if (!(k === 'seed' && (id === 'mountain.massif' || id === 'mountain.rolling'))) assert.equal(g[id][k], v, `${id}.${k}`); }
  assert.equal(keys.size, 30);
});

test('分布与挑选（已知答案）：分位数、直方图、最好 / 最差 / 最典型', () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ seed: i + 1, score: i === 3 ? -1 : 50 + i, metrics: Object.fromEntries(SEED_METRICS.map((m) => [m.key, i / 10])) }));
  const d = distribution(rows);
  assert.deepEqual([d.mid.min, d.mid.median, d.mid.max, d.mid.p10, d.mid.p90], [0, 0.5, 1, 0.1, 0.9]);
  assert.equal(d.mid.bins.reduce((a, b) => a + b, 0), 11); assert.equal(d.mid.bins.length, 10);
  const p = pickThree(rows, d);
  assert.equal(p.best, 11, '分数最高'); assert.equal(p.worst, 4, '没过硬检查的 = −1 = 最差'); assert.equal(p.typical, 6, '离中位数最近');
  assert.deepEqual(pickThree([]), { best: null, worst: null, typical: null, typicalDistance: null });
});

test('30 种子报告：30 座都跑完、每座都有六项指标；三张代表都在里面；同输入两次完全相同', () => {
  const r = seedReport(field, { count: 30 });
  assert.equal(r.count, 30); assert.equal(r.rows.length, 30);
  for (const row of r.rows) { assert.ok(row.score === -1 || row.score > 0); for (const { key } of SEED_METRICS) assert.ok(Number.isFinite(row.metrics[key]), `种子 ${row.seed} ${key}`); }
  for (const { key } of SEED_METRICS) { const s = r.distribution[key]; assert.ok(s.min <= s.p10 && s.p10 <= s.median && s.median <= s.p90 && s.p90 <= s.max, key); }
  const seeds = r.rows.map((x) => x.seed); for (const k of ['best', 'worst', 'typical']) if (r.pick[k] != null) assert.ok(seeds.includes(r.pick[k]), k);
  if (r.passed) { assert.ok(r.pick.best != null && r.pick.typical != null); const best = r.rows.find((x) => x.seed === r.pick.best); assert.ok(r.rows.every((x) => x.score <= best.score)); }
  const again = [...runSeeds(field, { count: 3 })].map(({ ms, ...x }) => x); assert.deepEqual(again, r.rows.slice(0, 3).map(({ ms, ...x }) => x));
  console.log(`[R28 分布 · 擂台岛] ${r.passed}/30 过硬检查 · 最好 ${r.pick.best} · 最差 ${r.pick.worst} · 最典型 ${r.pick.typical} · 中等坡中位 ${r.distribution.mid.median} · 排水中位 ${r.distribution.drain.median}`);
});

test('keepPlans：只在要时带 plan（Worker 给三张缩略图用；报告默认不带）', () => {
  const [a] = [...runSeeds(field, { count: 1 })], [b] = [...runSeeds(field, { count: 1, keepPlans: true })];
  assert.equal(a.plan, undefined); assert.ok(Array.isArray(b.plan.h) && b.plan.h.length === field.n * field.n);
});
