// R65–R68 光影与生命层：代际要过擂台（⑦）——9 个能力在固定种子合成岛上「加这一代 vs 不加」（上一代 = 排在它前面的能力，第一代 = baseline），
//   每一代必须赢；登记过成绩以后，任何改动让任一规则指标比登记的差过该指标自己的容差 → 红。
//   规则先定后量：lightlife/arena.js ARENA_RULES 与登记表 catalog/arena/<能力ID>.json 里的 rule 必须一字不差（改规则要单独说明）。
//   登记表只能由 tools/refactor/record-lightlife-arena.mjs 写（实算）；本测试重算 prev/next 与登记 metrics 核对。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/lightlife-arena.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { LIGHTLIFE_CAPABILITIES } from '../src/system-workshop/lightlife/capabilities.js';
import { runArena, ARENA_RULES, regressions, lightlifeMetrics, LIGHTLIFE_ARENA_SEED, LIGHTLIFE_ORDER } from '../src/system-workshop/lightlife/arena.js';
import { judge } from '../src/system-workshop/terrain/arena-generic.js';
import { syntheticSite } from '../src/system-workshop/lightlife/scene-voxels.js';

// 字面量写出全部 9 个能力 ID：⑤ 单测证据按「测试文件里以引号写出能力 ID」认（build-capability-maturity.mjs quoted）
const IDS = ['scene.town-graph', 'light.voxel-ao', 'light.bounce', 'light.megatex', 'life.plant-atlas', 'life.wind', 'life.smoke', 'life.animals', 'scene.plateau-diag'];
const reg = (id) => JSON.parse(fs.readFileSync(new URL(`../src/scene-authoring/catalog/arena/${id}.json`, import.meta.url), 'utf8'));

test('判定规则：守护指标退步超过容差 → 输；要变好的都没好过容差 → 输；否则赢', () => {
  const rule = { better: [{ key: 'a', dir: 1, tol: 0.01 }], guard: [{ key: 'g', dir: -1, tol: 0.05 }] };
  assert.equal(judge({ a: 0.5, g: 1 }, { a: 0.52, g: 1.04 }, rule).pass, true);
  assert.equal(judge({ a: 0.5, g: 1 }, { a: 0.52, g: 1.06 }, rule).pass, false, '守护指标退步 0.06 > 0.05');
  assert.equal(judge({ a: 0.5, g: 1 }, { a: 0.505, g: 1 }, rule).pass, false, '没好过容差');
  assert.match(judge({ a: 0.5, g: 1 }, { a: 0.4, g: 1 }, rule).why, /退步/);
});
test('指标口径：空 plan 全 0；跑完全管线各项产出都在', async () => {
  const empty = lightlifeMetrics({ plan: { metrics: {} } }, [], { checks: [] });
  for (const [k, v] of Object.entries(empty)) assert.equal(v, 0, k);
  const { runPlan } = await import('../src/system-workshop/lightlife/capabilities.js');
  const site = syntheticSite(LIGHTLIFE_ARENA_SEED);
  const report = runPlan(site, IDS.map((id) => ({ id })));
  const m = lightlifeMetrics(site, report, { checks: [] });
  for (const k of ['townBuildings', 'aoMean', 'tintShift', 'megaExact', 'plantCoverage', 'windLines', 'smokePuffs', 'animals', 'animalsOnLand'])
    assert.ok(m[k] > 0, k + ' 应有产出');
});
test('擂台登记：9 个能力都有规则，登记表齐全、rule = ARENA_RULES、beat = 前面的能力（第一代 baseline）、种子一致', () => {
  assert.deepEqual(Object.keys(ARENA_RULES).sort(), [...IDS].sort());
  assert.deepEqual(LIGHTLIFE_ORDER, IDS);
  for (const [i, id] of IDS.entries()) {
    const r = reg(id), cap = LIGHTLIFE_CAPABILITIES[i];
    assert.equal(r.capability, id); assert.equal(r.line, cap.meta.line); assert.equal(r.status, 'measured');
    assert.equal(r.arena.seed, LIGHTLIFE_ARENA_SEED); assert.equal(r.arena.generator, 'lightlife/scene-voxels.js syntheticSite');
    assert.deepEqual(r.rule, ARENA_RULES[id], id + '：登记表里的规则和代码不一样');
    const prefix = IDS.slice(0, i);
    assert.equal(r.beat, prefix.length ? prefix.join('+') : 'baseline', id + '：beat 应是排在它前面的能力');
    assert.equal(r.pass, true, id + '：登记表记的是没赢');
    for (const side of ['prev', 'next']) for (const [k, v] of Object.entries(r[side])) assert.ok(Number.isFinite(v), `${id} ${side}.${k} 不是数`);
    assert.deepEqual(r.planSummary.steps, [...prefix, id]);
  }
});
for (const id of IDS) {
  test(`擂台 ${id}：这一代必须赢上一代；重算与登记一致；登记过成绩的，不许比登记的差`, () => {
    const a = runArena(id), b = runArena(id);
    assert.deepEqual(a.next, b.next, '确定性：同种子同结果');
    assert.deepEqual(a.prev, b.prev, '确定性：prev 同种子同结果');
    assert.ok(a.pass, `${id} 没赢：${a.judge.why} ${JSON.stringify(a.judge.rows)}`);
    const r = reg(id);
    assert.deepEqual(a.next, r.next, `${id}：重算的 next 和登记表不一致（登记表只能由 record-lightlife-arena.mjs 写）`);
    assert.deepEqual(a.prev, r.prev, `${id}：重算的 prev 和登记表不一致`);
    assert.equal(r.metrics && JSON.stringify(r.metrics), JSON.stringify(r.next), `${id}：metrics 应等于 next`);
    const back = regressions(a.next, r.next, ARENA_RULES[id]);
    assert.deepEqual(back, [], `${id} 比登记的这一代退步：${JSON.stringify(back)}`);
    assert.equal(r.judge.pass, true, '登记表记的是没赢：不该挂这一代的名字');
  });
}
test('回归检查自己会红：把登记成绩改好一点，现在的成绩就算退步', () => {
  const a = runArena('life.wind'), rule = ARENA_RULES['life.wind'];
  assert.deepEqual(regressions(a.next, a.next, rule), []);
  // regressions(now, recorded)：now 比 recorded 差过该指标 tol → 列出
  const worseLines = { ...a.next, windLines: a.next.windLines - 10 };
  assert.equal(regressions(worseLines, a.next, rule)[0]?.key, 'windLines');
  const guardWorse = { ...a.next, windInside: 1 };
  assert.equal(regressions(guardWorse, a.next, rule)[0]?.key, 'windInside', '风进实心必须算退步');
});
