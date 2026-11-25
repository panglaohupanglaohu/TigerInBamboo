// planet-caps.test.mjs — 星球工坊全部能力的真 match/run 单元测试。
// PLANET_CAPABILITIES 三类执行面：run（改配方）、runSea（改海面样式）、runWeather（改天气样式），
// 统一经 runPlanetPlan 驱动（Worker 同款路径）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_CAPABILITIES, DEFAULT_PLANET_RECIPE, PLANET_RECIPE_KEYS, cleanRecipe, runPlanetPlan } from '../src/system-workshop/planet/capabilities.js';

const SUMMARY = {
  stats: { land: 0.62, landmarks: 4, lowestLandmark: { height: 1.2, id: 'anchor-a' }, charts: 6, cells: 1280 },
  hashes: { wfc: 'wfc-abc' }, recipe: DEFAULT_PLANET_RECIPE, ms: 42,
  reports: { seamReport: { ok: true } },
};

// ---------------------------------------------------------------- 注册面
// 字面能力清单：成熟度构建器按引用判定单测覆盖；同时断言注册表没丢/没多出能力。
const EXPECTED_IDS = [
  'planet.sea-level', 'planet.reseed', 'planet.surface-detail', 'planet.chart-split', 'planet.grid-subdivision',
  'planet.sea-shore-field', 'planet.sea-tint', 'planet.sea-foam', 'planet.sea-waves', 'planet.sea-reflection',
  'planet.weather-kind', 'planet.weather-wind', 'planet.weather-clouds', 'planet.weather-fog',
  'planet.weather-snow-cover', 'planet.light-time', 'planet.light-sun-shadow', 'planet.light-ao',
  'planet.light-ambient-bounce', 'planet.light-rock', 'planet.light-ink-rim', 'planet.light-view-grade',
];
test('planet: 全部能力 meta 完整、有执行面、参数默认值在范围内', () => {
  assert.deepEqual(PLANET_CAPABILITIES.map((c) => c.meta.id).sort(), [...EXPECTED_IDS].sort());
  const ids = new Set();
  for (const cap of PLANET_CAPABILITIES) {
    const m = cap.meta;
    assert.match(m.id, /^planet\./);
    assert.ok(!ids.has(m.id), `${m.id} 重复`); ids.add(m.id);
    assert.ok(m.name && m.does && m.line && m.domain, `${m.id} 缺描述字段`);
    assert.ok(m.reads?.length && m.writes?.length && m.preserves?.length, `${m.id} 缺契约字段`);
    assert.equal(typeof cap.match, 'function', `${m.id} 缺 match`);
    assert.ok(cap.run || cap.runSea || cap.runWeather, `${m.id} 没有执行面`);
    for (const [k, d] of Object.entries(m.params ?? {})) {
      if (d.min !== undefined) assert.ok(d.min <= d.default && d.default <= d.max, `${m.id}.${k} 默认值出界`);
    }
  }
});

test('planet: match 对每个能力返回带理由的目标', () => {
  for (const cap of PLANET_CAPABILITIES) {
    const targets = cap.match(SUMMARY, {});
    assert.ok(Array.isArray(targets) && targets.length >= 1, `${cap.meta.id} match 空`);
    for (const t of targets) assert.ok(t.id && t.reason && typeof t.score === 'number', `${cap.meta.id} 目标缺字段`);
  }
});

// ---------------------------------------------------------------- runPlanetPlan 全量执行
test('planet: 全部能力走 runPlanetPlan 逐步执行，applied 且产出归位', () => {
  const steps = PLANET_CAPABILITIES.map((c) => ({ id: c.meta.id, params: {} }));
  const { recipe, report, sea, weather } = runPlanetPlan(DEFAULT_PLANET_RECIPE, steps);
  assert.equal(report.length, PLANET_CAPABILITIES.length);
  for (const r of report) assert.equal(r.status, 'applied', `${r.id} 未执行: ${r.status}`);
  for (const k of Object.keys(recipe)) assert.ok(PLANET_RECIPE_KEYS.includes(k) || k === 'radius', `配方多了野字段 ${k}`);
  // 海面管线存在 → sea 补齐默认骨架且各段有值
  assert.ok(sea && sea.field && 'tint' in sea && 'foam' in sea && 'waves' in sea && 'reflection' in sea, 'sea 骨架没补齐');
  assert.ok(weather && typeof weather.kind === 'number' && weather.wind && weather.fog, 'weather 不全');
});

// ---------------------------------------------------------------- 具体变换语义
test('planet.sea-level: run 改 seaLevel 且不动锚点字段', () => {
  const cap = PLANET_CAPABILITIES.find((c) => c.meta.id === 'planet.sea-level');
  const r2 = cap.run({ ...DEFAULT_PLANET_RECIPE }, { level: 2.5 });
  assert.equal(r2.seaLevel, 2.5);
  assert.equal(r2.seed, DEFAULT_PLANET_RECIPE.seed, '海平面不该动种子');
});

test('planet.reseed: run 改 seed 取整', () => {
  const cap = PLANET_CAPABILITIES.find((c) => c.meta.id === 'planet.reseed');
  assert.equal(cap.run({ ...DEFAULT_PLANET_RECIPE }, { seed: 42.7 }).seed, 43);
});

test('planet.weather-kind: runWeather 产出天气样式不动配方', () => {
  const { recipe, weather, report } = runPlanetPlan(DEFAULT_PLANET_RECIPE, [{ id: 'planet.weather-kind', params: { kind: 2 } }]);
  assert.equal(report[0].status, 'applied');
  assert.equal(weather.kind, 2);
  assert.deepEqual(recipe, cleanRecipe(DEFAULT_PLANET_RECIPE), '天气步骤动了配方');
});

test('planet.sea-tint: runSea 产出海面样式不动配方', () => {
  const { recipe, sea, report } = runPlanetPlan(DEFAULT_PLANET_RECIPE, [{ id: 'planet.sea-tint', params: { near: 2, far: 30, light: 1.1 } }]);
  assert.equal(report[0].status, 'applied');
  assert.equal(sea.tint.on, true);
  assert.equal(sea.tint.near, 2);
  assert.deepEqual(recipe, cleanRecipe(DEFAULT_PLANET_RECIPE), '海面步骤动了配方');
});

// ---------------------------------------------------------------- 边界
test('planet: 参数越界被夹到 min/max，未知步骤记 missing', () => {
  const { report } = runPlanetPlan(DEFAULT_PLANET_RECIPE, [
    { id: 'planet.reseed', params: { seed: 99999 } },
    { id: 'planet.nonexistent', params: {} },
  ]);
  assert.equal(report[0].status, 'applied');
  assert.equal(report[0].params.seed, 999, 'seed 没被夹到 max');
  assert.equal(report[1].status, 'missing');
});

test('planet.cleanRecipe: 缺省回填、landformChain 转布尔、野字段被清掉', () => {
  const r = cleanRecipe({ seed: '5', landformChain: 0, bogus: 1 });
  assert.equal(r.seed, 5);
  assert.equal(r.landformChain, false);
  assert.equal(r.bogus, undefined);
  assert.deepEqual(cleanRecipe(), DEFAULT_PLANET_RECIPE);
});
