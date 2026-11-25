// R39 沉积 + 抛射物（Guide §9 E 组）：fx.sediment（core/sediment-bands-c09.js bandRuns + core/sediment.js 剪切）
// 与 fx.projectiles（core/ballistic-table.js 查表 + projectileState）。正常通过、确定性、破坏判失败三类用例。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describeFxCapabilities, matchAll, runPlan } from '../src/system-workshop/fx/capabilities.js';
import { verifyFx } from '../src/system-workshop/fx/verify.js';
import { bandType, BAND_SLOTS } from '../../townscaper-web/REACodeRefactoring/src/core/sediment-bands-c09.js';
import { PROJECTILE_GRAVITY } from '../../townscaper-web/REACodeRefactoring/src/core/ballistic-table.js';
import { cliffStage, flatStage, clone } from './fixtures/fx-stage.mjs';

const root = new URL('../../', import.meta.url), read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const run = (id, params = {}, site = cliffStage()) => { const s = clone(site); const report = runPlan(s, [{ id, params }]); return { s, report, v: verifyFx(s, s.plan, { steps: [{ id }] }) }; };

test('fx.sediment / fx.projectiles：meta 全字段，line 分别是 sediment / projectiles', () => {
  const caps = describeFxCapabilities();
  for (const [id, line, mod] of [['fx.sediment', 'sediment', 'src/core/sediment-bands-c09.js'], ['fx.projectiles', 'projectiles', 'src/core/ballistic-table.js']]) {
    const m = caps.find((c) => c.id === id); assert.ok(m, id); assert.equal(m.line, line); assert.ok(m.modules.includes(mod)); assert.ok(Array.isArray(m.requires));
    for (const p of m.modules) assert.ok(fs.existsSync(new URL('townscaper-web/REACodeRefactoring/' + p, root)), p);
  }
});

test('fx.sediment：高崖面每条层带的岩性等于 bandType 查表，首尾相接盖满崖高', () => {
  const { s, report } = run('fx.sediment', { bend: 0, minDrop: 2 });
  assert.equal(report[0].status, 'applied');
  const sd = s.plan.sediment; assert.ok(sd.faces.length >= 10, '崖面 ' + sd.faces.length);
  for (const f of sd.faces) {
    assert.ok(f.y1 - f.y0 >= 2 * 0.5 - 1e-9);
    assert.ok(Math.abs(f.bands[0][1] - f.y0) < 1e-3 && Math.abs(f.bands.at(-1)[2] - f.y1) < 1e-3);
    f.bands.forEach((b, i) => { if (i) assert.ok(Math.abs(b[1] - f.bands[i - 1][2]) < 1e-3); assert.equal(bandType(Math.floor((b[1] + b[2]) / 2 / sd.period * BAND_SLOTS)), b[0]); });
  }
  assert.ok(sd.stats.bands > sd.faces.length, '层带应比崖面多（宽窄相间）');
});

test('fx.sediment：确定性；弯层改变层带；平地没有崖面不匹配', () => {
  assert.deepEqual(run('fx.sediment').s.plan.sediment, run('fx.sediment').s.plan.sediment);
  const straight = run('fx.sediment', { bend: 0 }).s.plan.sediment.faces.map((f) => f.bands), bent = run('fx.sediment', { bend: 1, amplitude: 0.3 }).s.plan.sediment.faces.map((f) => f.bands);
  assert.notDeepEqual(straight, bent);
  assert.equal(matchAll(flatStage()).find((r) => r.id === 'fx.sediment').count, 0);
});

test('fx.sediment：独立验证通过；改岩性 / 改崖面总数 → 失败', () => {
  const { s, v } = run('fx.sediment');
  assert.notEqual(v.status, 'fail', v.summary);
  assert.equal(v.checks.find((c) => c.id === 'sediment-faces').status, 'pass');
  assert.equal(v.checks.find((c) => c.id === 'sediment-variety').metric.direction, 'min');
  const steps = [{ id: 'fx.sediment' }];
  const a = clone(s.plan); a.sediment.faces[0].bands[0][0] = (a.sediment.faces[0].bands[0][0] + 1) % 4; assert.equal(verifyFx(s, a, { steps }).checks.find((c) => c.id === 'sediment-bands').status, 'fail');
  const b = clone(s.plan); b.sediment.total += 3; assert.equal(verifyFx(s, b, { steps }).checks.find((c) => c.id === 'sediment-faces').status, 'fail');
});

test('fx.projectiles：解析表弹道从射手出发、按抛体公式正好落到岸边格，顶点不低于两端', () => {
  const { s, report } = run('fx.projectiles', { shots: 8 });
  assert.equal(report[0].status, 'applied');
  const p = s.plan.projectiles; assert.ok(p.shots.length >= 4, '箭 ' + p.shots.length); assert.equal(p.table, 'analytic');
  const g = s.grid, u = p.unit;
  for (const x of p.shots) {
    assert.ok(Math.abs(x.path[0][0] - g[x.from][0]) < 1e-3 && Math.abs(x.path[0][2] - g[x.from][1]) < 1e-3);
    const y = x.a[1] / u + x.v * Math.sin(x.th) * x.time - 0.5 * PROJECTILE_GRAVITY * x.time ** 2;
    assert.ok(Math.abs(y - x.b[1] / u) < 2e-3, '落点高度偏 ' + (y - x.b[1] / u));
    assert.ok(x.miss < 1e-3); assert.ok(x.apex >= Math.max(x.a[1], x.b[1]) - 1e-6);
  }
});

test('fx.projectiles：确定性；带阻力走烘好的轨迹表且偏差 ≤ 0.06 格', () => {
  assert.deepEqual(run('fx.projectiles').s.plan.projectiles, run('fx.projectiles').s.plan.projectiles);
  const { s, v } = run('fx.projectiles', { drag: 0.5, shots: 4 });
  assert.equal(s.plan.projectiles.table, 'baked-drag'); assert.ok(s.plan.projectiles.shots.length >= 1);
  assert.ok(s.plan.projectiles.stats.maxMiss <= 0.06 + 1e-9); assert.notEqual(v.status, 'fail', v.summary);
});

test('fx.projectiles：独立验证通过；篡改速度 / 落点 → 失败', () => {
  const { s, v } = run('fx.projectiles');
  assert.equal(v.status, 'pass', v.summary);
  const hit = v.checks.find((c) => c.id === 'projectile-hit'); assert.equal(hit.metric.threshold, 0.06); assert.equal(hit.metric.direction, 'max');
  const steps = [{ id: 'fx.projectiles' }];
  const a = clone(s.plan); a.projectiles.shots[0].v *= 1.2; assert.equal(verifyFx(s, a, { steps }).checks.find((c) => c.id === 'projectile-hit').status, 'fail');
  const b = clone(s.plan); b.projectiles.shots[0].b[0] += 1; assert.equal(verifyFx(s, b, { steps }).status, 'fail');
});

test('沉积 / 弹道实景接线：fxLive.js 画层带面片与弹道，单元清单已登记', () => {
  const live = read('TigerMessenger/src/world/rea/fxLive.js');
  assert.match(live, /function addSediment\(/); assert.match(live, /function addProjectiles\(/);
  assert.match(read('TigerMessenger/tools/scene-authoring/test_workshops.py'), /'fx-sediment-projectiles'/);
});
