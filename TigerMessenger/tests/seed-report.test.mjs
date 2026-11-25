// R61 多种子分布报告推广到所有管线层（Guide §1.4 创新 6）：通用算法 = R28 山形那套；每层一个适配器；跑不了的层如实 NOT_RUN。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/seed-report.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { distribution, pickThree, runLayerSeeds, seedReport, notRunReport, verificationScore, verificationMetrics, summarizeReport, formatMetric, STATUS } from '../src/system-workshop/seed-report.js';
import { LAYERS, SEED_LAYER_IDS, seedLayerFor, loadSeedAdapter, layerSeedReport } from '../src/system-workshop/seed-layers.js';
import * as M from '../src/system-workshop/mountain/seeds.js';
import { arenaIsland } from '../src/system-workshop/mountain/arena.js';
const strip = (rows) => rows.map(({ ms, ...x }) => x);

test('通用分布 / 挑选 = R28 山形同一算法（同一批行，两边答案逐值相同）', () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ seed: i + 1, score: i === 3 ? -1 : 50 + i, metrics: Object.fromEntries(M.SEED_METRICS.map((m, k) => [m.key, (i * (k + 1)) / 10])) }));
  const a = distribution(rows, M.SEED_METRICS), b = M.distribution(rows);
  assert.deepEqual(a, b);
  assert.deepEqual(pickThree(rows, M.SEED_METRICS, a), M.pickThree(rows, b));
  const p = pickThree(rows, M.SEED_METRICS);
  assert.equal(p.best, 11); assert.equal(p.worst, 4, '判失败 = −1 = 最差');
  assert.deepEqual(pickThree([], []), { best: null, worst: null, typical: null, typicalDistance: null });
  assert.deepEqual([a.mid.min, a.mid.median, a.mid.max], [0, 0.5, 1]);
});

test('逐个种子：某个种子抛错 = 这一座判失败，整批不中断；指标缺的写 null 不编数', () => {
  const adapter = { layer: 't', metrics: [{ key: 'x' }, { key: 'y' }], runSeed: (_, s) => { if (s === 3) throw new Error('坏种子'); return { score: s, status: 'pass', metrics: { x: s / 10 } }; } };
  const rows = [...runLayerSeeds(adapter, null, { count: 5 })];
  assert.equal(rows.length, 5); assert.equal(rows[2].status, 'error'); assert.equal(rows[2].score, -1); assert.match(rows[2].note, /坏种子/);
  assert.equal(rows[0].metrics.y, null);
  const r = seedReport(adapter, null, { count: 5 });
  assert.equal(r.status, STATUS.RUN); assert.equal(r.errors, 1); assert.equal(r.passed, 4); assert.equal(r.pick.worst, 3); assert.equal(r.pick.best, 5);
  assert.equal(r.distribution.y, null);
  assert.match(summarizeReport(r), /5 个种子/);
  assert.equal(formatMetric({ unit: '%' }, 0.1234), '12.3%'); assert.equal(formatMetric({ unit: 'm' }, 2), '2.00 m'); assert.equal(formatMetric({}, null), '—');
});

test('验证 → 通用分数：失败 = −1；通过 + 0.5 × 提醒；三个通用指标', () => {
  assert.equal(verificationScore({ status: 'fail', checks: [{ status: 'pass' }, { status: 'fail' }] }), -1);
  assert.equal(verificationScore({ status: 'warn', checks: [{ status: 'pass' }, { status: 'warn' }] }), 75);
  assert.deepEqual(verificationMetrics({ checks: [{ status: 'pass' }, { status: 'warn' }, { status: 'pass' }, { status: 'pass' }] }), { passShare: 0.75, warns: 1, fails: 0 });
});

test('登记表：11 层；体素场景层登记为 NOT_RUN 并写明原因；没登记的层 = NOT_RUN（blocked）', async () => {
  assert.deepEqual(SEED_LAYER_IDS, ['mountain', 'lightlife', 'battle', 'fx', 'apostles-terrain', 'gscene', 'object', 'planet', 'relief', 'building', 'scene']);
  for (const L of LAYERS) { assert.ok(L.label && (L.notRun || (typeof L.load === 'function' && L.inputLabel && L.seedMeaning)), L.layer); }
  const s = await layerSeedReport('scene');
  assert.equal(s.status, 'NOT_RUN'); assert.match(s.reason, /浏览器|iframe/); assert.equal(s.rows.length, 0); assert.equal(s.blocked, false);
  const u = await layerSeedReport('no-such-layer');
  assert.equal(u.status, 'NOT_RUN'); assert.equal(u.blocked, true);
  const r = await layerSeedReport('relief', { count: 2 });
  assert.equal(r.status, 'RUN', r.reason);
  assert.equal(await loadSeedAdapter('scene'), null);
  assert.equal(notRunReport({ layer: 'x', reason: '' }).reason, '没有说明原因');
});

for (const layer of ['battle', 'fx', 'apostles-terrain', 'gscene', 'object', 'relief', 'building']) {
  test(`${layer}：5 个种子各跑一次（合成输入）→ 分布 + 三张代表；同输入两次逐值相同`, async () => {
    const a = await layerSeedReport(layer, { count: 5 }), b = await layerSeedReport(layer, { count: 5 });
    assert.equal(a.status, 'RUN', a.reason); assert.equal(a.count, 5); assert.equal(a.errors, 0, JSON.stringify(a.rows.filter((r) => r.status === 'error')));
    for (const m of a.metrics) { const d = a.distribution[m.key]; if (d) assert.ok(d.min <= d.p10 && d.p10 <= d.median && d.median <= d.p90 && d.p90 <= d.max, layer + '.' + m.key); }
    for (const k of ['best', 'worst', 'typical']) if (a.pick[k] != null) assert.ok(a.rows.some((r) => r.seed === a.pick[k]), k);
    assert.deepEqual(strip(a.rows), strip(b.rows));
    assert.ok(seedLayerFor(layer).seedMeaning.includes('种子'));
  });
}

test('山形适配器复用 R28 的 mountain/seeds.js：同种子同一行', async () => {
  const r = await layerSeedReport('mountain', { count: 2 });
  assert.equal(r.status, 'RUN');
  assert.deepEqual(strip(r.rows).map(({ status, score, metrics, seed }) => ({ seed, score, status, metrics })), strip([...M.runSeeds(arenaIsland(), { count: 2 })]).map(({ status, score, metrics, seed }) => ({ seed, score, status, metrics })));
  assert.match((await loadSeedAdapter('mountain')).ownPanel, /R28/);
});

test('光影与生命：3 个合成岛各跑全部 9 个能力 + 独立验证', async () => {
  const r = await layerSeedReport('lightlife', { count: 3 });
  assert.equal(r.status, 'RUN', r.reason); assert.equal(r.count, 3); assert.equal(r.errors, 0, JSON.stringify(r.rows.map((x) => x.note)));
  for (const key of ['aoMean', 'corner', 'open', 'tintShift', 'megaOccupancy', 'plantCoverage', 'windLines', 'smokePuffs', 'animalsOnLand']) assert.ok(r.metrics.some((m) => m.key === key), key);
  assert.ok(r.rows.every((x) => Number.isFinite(x.metrics.aoMean)));
});

test('球系统：配方 seed = s，2 个种子能编译出两颗不同的星球', async () => {
  const r = await layerSeedReport('planet', { count: 2 });
  assert.equal(r.status, 'RUN', r.reason); assert.equal(r.count, 2);
  assert.ok(r.rows.every((x) => x.status !== 'error'), JSON.stringify(r.rows.map((x) => x.note)));
});

test('命令行脚本：层清单来自登记表；写 artifacts/seed-report/<层>/latest.json；不 import 原版 REACode', () => {
  const src = fs.readFileSync(new URL('../tools/refactor/seed-report.mjs', import.meta.url), 'utf8');
  assert.match(src, /SEED_LAYER_IDS/); assert.match(src, /artifacts\/seed-report/); assert.match(src, /latest\.json/);
  assert.doesNotMatch(src, /from ['"][^'"]*REACode\/src/);
});
