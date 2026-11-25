// R27 配色二选一：Bad North 夏季 / Townscaper 两套候选的可量化检查（草坡面积、不偏灰）。
// 选哪套由用户定（docs/PENDING_USER_DECISIONS.md）；这里只保证检查本身算得对、坏配色会判失败、两套候选都如实出数。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/mountain-palette.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { PALETTE_CANDIDATES, PALETTE_RULES, paletteStats, compareCandidates, saturation } from '../src/system-workshop/mountain/palette-check.js';
import { PALETTES } from '../src/system-workshop/mountain/palettes.js';
import { arenaIsland, ARENA_GENERATIONS, runArenaGeneration } from '../src/system-workshop/mountain/arena.js';
const field = arenaIsland(), plan = runArenaGeneration(ARENA_GENERATIONS.at(-1), field).plan;

test('两套候选就是 Bad North 夏季（1）与 Townscaper（2），来源写在候选上', () => {
  assert.deepEqual(PALETTE_CANDIDATES.map((c) => c.id), [1, 2]);
  for (const c of PALETTE_CANDIDATES) { assert.ok(PALETTES[c.id], '配色表里缺 ' + c.id); assert.match(c.source, /townscaper-web\/REACodeRefactoring\/src\//); }
  assert.deepEqual(PALETTE_RULES, { grassMin: 0.45, greyMax: 0.35, grassSatMin: 0.18 }, '判定线是先定后量的，不按结果改');
});

test('饱和度：灰色 = 0，纯色 = 1；两套候选的草坡 / 草丛颜色本身都不灰（≥ 判定线）', () => {
  assert.equal(saturation([0.5, 0.5, 0.5]), 0); assert.equal(saturation([1, 0, 0]), 1); assert.equal(saturation([0, 0, 0]), 0);
  for (const c of PALETTE_CANDIDATES) for (const m of [0, 5]) assert.ok(saturation(PALETTES[c.id][m]) >= PALETTE_RULES.grassSatMin, `${c.label} 材质 ${m} 饱和度 ${saturation(PALETTES[c.id][m]).toFixed(3)}`);
});

test('已知答案：全草坡的山 → 草坡 100%、通过；全岩壁的山 → 草坡 0%、判失败（坏配色 / 坏着色必须红）', () => {
  const grass = { ...plan, mat: plan.mat.map(() => 0), shade: plan.shade.map(() => 1) }, rock = { ...plan, mat: plan.mat.map(() => 1), shade: plan.shade.map(() => 1) };
  for (const c of PALETTE_CANDIDATES) {
    const g = paletteStats(field, grass, c.id), r = paletteStats(field, rock, c.id);
    assert.equal(g.grassShare, 1); assert.equal(g.status, 'pass', c.label + JSON.stringify(g.checks));
    assert.equal(r.grassShare, 0); assert.equal(r.status, 'fail'); assert.equal(r.checks.find((x) => x.id === 'grass').status, 'fail');
    assert.equal(r.checks.find((x) => x.id === 'grey').status, 'fail', c.label + ' 全岩壁应判偏灰');
  }
  assert.throws(() => paletteStats(field, plan, 9), /没有这套配色/); assert.throws(() => paletteStats(field, { ...plan, mat: [] }, 1), /材质/);
});

test('配色只换颜色：两套候选的草坡面积相同（同一座山、同一张材质图），灰面与饱和度各自算', () => {
  const rows = compareCandidates(field, plan);
  assert.equal(rows.length, 2); assert.equal(rows[0].grassShare, rows[1].grassShare); assert.equal(rows[0].area, rows[1].area);
  for (const r of rows) { assert.ok(r.area > 10000); assert.ok(r.grassShare >= 0 && r.grassShare <= 1 && r.greyShare >= 0 && r.greyShare <= 1); assert.equal(r.checks.length, 2); }
  console.log('[R27 擂台岛] ' + rows.map((r) => `${r.label}：${r.status} · ${r.checks.map((c) => c.detail).join(' · ')}`).join(' | '));
});

test('确定性：同一计划两次检查结果完全相同', () => { assert.deepEqual(compareCandidates(field, plan), compareCandidates(field, plan)); });

test('实景接线：实景换配色 / 对照命令在桥上；采用时记下当前配色；不改默认配色', () => {
  const mc = fs.readFileSync(new URL('../src/world/rea/mountainCandidate.js', import.meta.url), 'utf8'), caps = fs.readFileSync(new URL('../src/system-workshop/mountain/capabilities.js', import.meta.url), 'utf8');
  assert.match(mc, /export function paletteMountain\(palette\)/); assert.match(mc, /export function currentMountain\(\)/);
  assert.match(caps, /palette: \{ label: '配色（0 原 \/ 1 Bad North \/ 2 Townscaper）', min: 0, max: 2, step: 1, default: 1 \}/, 'mountain.lowpoly 的默认配色没有被本轮改动（改默认要用户点头）');
});
