// R26 地形线第一个擂台（Guide §1.4 创新 3）：固定种子测试岛 + 四项与输入参数无关的指标 + 写死的比较规则。
// 「mountain.rolling 这一代必须赢上一代」按规则如实判，不放宽容差；没赢这条测试就是红的。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/mountain-arena.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { arenaIsland, ARENA_SEED, ARENA_GENERATIONS, ARENA_TOLERANCE, terrainMetrics, runArenaGeneration, compareGenerations, arenaStepsKnown } from '../src/system-workshop/mountain/arena.js';
const registry = JSON.parse(fs.readFileSync(new URL('../src/scene-authoring/catalog/arena/terrain.json', import.meta.url), 'utf8'));
const field = arenaIsland(ARENA_SEED), runs = ARENA_GENERATIONS.map((g) => runArenaGeneration(g, field));

test('测试岛固定：同种子逐格相同，换种子不同；有城、有轨道、有海', () => {
  const a = arenaIsland(ARENA_SEED), b = arenaIsland(ARENA_SEED + 1);
  assert.deepEqual(a, field); assert.notDeepEqual(a.h, b.h);
  assert.equal(a.n, 101); assert.equal(a.step, 3);
  const cnt = (k) => a.cls.filter((c) => c === k).length; assert.ok(cnt(1) > 50, '建筑格 ' + cnt(1)); assert.ok(cnt(2) > 30, '轨道格 ' + cnt(2));
  assert.ok(a.h.some((v) => v == null) && a.h.some((v) => v === -1) && a.h.some((v) => v > 20));
  assert.ok(arenaStepsKnown(), '擂台各代的能力都在能力库里');
});

test('指标定义只看产出地形：同一张高度场，不管能力参数 / 配色 / 用了哪些步骤，指标完全相同', () => {
  const p = runs.at(-1).plan, same = { h: p.h.slice(), protect: p.protect }, noisy = { ...structuredClone(p), style: { palette: 2, jitter: 0.4 }, mat: p.mat.map(() => 1) };
  assert.deepEqual(terrainMetrics(field, p), terrainMetrics(field, same)); assert.deepEqual(terrainMetrics(field, p), terrainMetrics(field, noisy));
});

test('指标的已知答案：圆锥全排进海；碗底排不出；紧贴保护区抬 4 m = 硬边位移 4 m', () => {
  const n = 61, c = 30, mk = (fn, cls = () => 0) => { const h = [], k = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { h.push(fn(Math.hypot(i - c, j - c), i, j)); k.push(cls(i, j)); } return { n, step: 3, h, cls: k, railY: [] }; };
  const cone = mk((d) => (d > 28 ? null : d > 26 ? -1 : 40 - d * 1.4)), mc = terrainMetrics(cone, { h: cone.h, protect: { band: 0, railBand: 0 } });
  assert.equal(mc.drain, 1, '圆锥排水率 ' + mc.drain); assert.equal(mc.hardEdge, 0);
  const bowl = mk((d) => (d > 28 ? null : d > 26 ? -1 : 6 + d)), mb = terrainMetrics(bowl, { h: bowl.h, protect: { band: 0, railBand: 0 } });
  assert.ok(mb.drain < 0.2, '碗形地（只有外圈一环能排进海，约 11%）排水率应很低：' + mb.drain);
  const town = (i, j) => (Math.hypot(i - c, j - c) < 3 ? 1 : 0), flat = mk((d) => (d > 28 ? null : d > 26 ? -1 : 10), town);
  const lifted = { h: flat.h.map((v, q) => (v != null && v > 0.3 && !flat.cls[q] ? v + 4 : v)), protect: { band: 0, railBand: 0 } };
  assert.ok(Math.abs(terrainMetrics(flat, lifted).hardEdge - 4) < 1e-9, '硬边位移 ' + terrainMetrics(flat, lifted).hardEdge);
});

test('比较规则写死：容差不放宽；任何一项退步超过容差 = 没赢；全持平 = 没赢', () => {
  assert.deepEqual(ARENA_TOLERANCE, { mid: 0.005, cliff: 0.005, drain: 0.005, hardEdge: 0.05 });
  assert.deepEqual(registry.tolerance, ARENA_TOLERANCE, '登记表里的容差与代码不一致');
  const base = { mid: 0.5, cliff: 0.1, drain: 0.5, hardEdge: 1 };
  assert.equal(compareGenerations(base, { ...base }).beats, false);
  assert.equal(compareGenerations(base, { ...base, drain: 0.6 }).beats, true);
  assert.equal(compareGenerations(base, { ...base, drain: 0.9, mid: 0.494 }).beats, false, '中等坡退步 0.006 > 容差，排水再好也不算赢');
  assert.equal(compareGenerations(base, { ...base, drain: 0.6, mid: 0.496 }).beats, true, '退步 0.004 在容差内');
});

test('确定性：同一代跑两次指标完全相同', () => {
  assert.deepEqual(runArenaGeneration(ARENA_GENERATIONS[1], field).metrics, runs[1].metrics);
});

test('登记表 catalog/arena/terrain.json 记的每代成绩 = 实算（不是手填）', () => {
  assert.equal(registry.arena.seed, ARENA_SEED);
  assert.deepEqual(registry.generations.map((g) => g.id), ARENA_GENERATIONS.map((g) => g.id));
  for (const [i, g] of registry.generations.entries()) { assert.deepEqual(g.steps, ARENA_GENERATIONS[i].steps);
    for (const k of Object.keys(ARENA_TOLERANCE)) assert.ok(Math.abs(g.metrics[k] - runs[i].metrics[k]) <= 0.0005, `${g.id}.${k} 登记 ${g.metrics[k]} ≠ 实算 ${runs[i].metrics[k]}（用 tools/refactor/record-terrain-arena.mjs 重记）`); }
  const v = compareGenerations(runs[0].metrics, runs[1].metrics); assert.equal(registry.verdict.beats, v.beats, '登记表的判定与实算不一致');
});

test('擂台：mountain.rolling 这一代在约定指标上必须赢上一代（规则见 arena.js 文件头，不放宽）', () => {
  const v = compareGenerations(runs[0].metrics, runs[1].metrics);
  console.log('[R26 擂台] ' + v.rows.map((r) => `${r.label} ${r.prev}→${r.cur}（${r.verdict}）`).join(' · '));
  assert.ok(v.beats, v.text);
});
