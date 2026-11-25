// R37 火（Guide §9 E 组）：fx.fire 封装成可执行能力 —— meta 全字段、run 真实调用 life/fire-coupling.js / core/smoke-order.js、
// 独立验证会在计划被破坏时判失败、实景接线（world/rea/fxLive.js 调 life/effects.js 的 Effects 火粒子）存在。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describeFxCapabilities, matchAll, runPlan } from '../src/system-workshop/fx/capabilities.js';
import { verifyFx } from '../src/system-workshop/fx/verify.js';
import { fireLight, burstPlan } from '../../townscaper-web/REACodeRefactoring/src/life/fire-coupling.js';
import { cliffStage, clone } from './fixtures/fx-stage.mjs';

const root = new URL('../../', import.meta.url), read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const run = (site, params = {}) => { const s = clone(site); const report = runPlan(s, [{ id: 'fx.fire', params }]); return { s, report, v: verifyFx(s, s.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) }) }; };

test('fx.fire：meta 有 §5.3 全字段，line = fire，modules 真实存在于重构库', () => {
  const m = describeFxCapabilities().find((c) => c.id === 'fx.fire');
  assert.ok(m, '能力库里没有 fx.fire');
  for (const k of ['id', 'name', 'domain', 'line', 'requires', 'modules', 'sources', 'does', 'params']) assert.ok(m[k] !== undefined, '缺 ' + k);
  assert.equal(m.line, 'fire'); assert.equal(m.domain, 'fx'); assert.ok(m.executable);
  assert.ok(m.modules.includes('src/life/effects.js') && m.modules.includes('src/life/fire-coupling.js'));
  for (const p of m.modules) assert.ok(fs.existsSync(new URL('townscaper-web/REACodeRefactoring/' + p, root)), p + ' 不存在');
  assert.deepEqual(m.sources, m.modules.map((p) => 'townscaper-web/REACodeRefactoring/' + p));
});

test('fx.fire：在小屋上按间隔点火，曲线等于 fire-coupling 实测点', () => {
  const site = cliffStage();
  assert.ok(matchAll(clone(site)).find((r) => r.id === 'fx.fire').count > 0);
  const { s, report } = run(site, { count: 3, stagger: 0.5 });
  assert.equal(report[0].status, 'applied');
  const f = s.plan.fire;
  assert.equal(f.sources.length, 3); assert.equal(f.basis, 'house');
  assert.ok(f.sources.every((x) => x.house)); assert.deepEqual(f.sources.map((x) => x.t0), [0, 0.5, 1]);
  assert.equal(f.at018, +fireLight(0.18).toFixed(4)); assert.equal(f.at039, +fireLight(0.39).toFixed(4));
  assert.ok(Math.abs(f.smokeArea018 - 2.3) < 0.08, '0.18s 烟面积应 ≈ 2.30×，得 ' + f.smokeArea018);
  assert.equal(f.burst.total, burstPlan().total); assert.ok(f.flameLight > 0); assert.equal(f.blend, 'max');
});

test('fx.fire：确定性 + 没有小屋时退到最高台地', () => {
  assert.deepEqual(run(cliffStage()).s.plan.fire, run(cliffStage()).s.plan.fire);
  const { s } = run(cliffStage({ houses: false }), { count: 2 });
  assert.equal(s.plan.fire.basis, 'top'); assert.equal(s.plan.fire.sources.length, 2);
  const top = Math.max(...cliffStage().grid.map((c) => c[2])); assert.ok(s.plan.fire.sources.every((x) => x.lv === top));
});

test('fx.fire：独立验证通过；点火处挪出格网 / 篡改火光 / 曲线反向 → 失败', () => {
  const { s, v } = run(cliffStage());
  assert.notEqual(v.status, 'fail', v.summary);
  const curve = v.checks.find((c) => c.id === 'fire-curve'); assert.equal(curve.status, 'pass'); assert.equal(curve.metric.threshold, 0.35); assert.equal(curve.metric.direction, 'max');
  const steps = [{ id: 'fx.fire' }];
  const a = clone(s.plan); a.fire.sources[0].x += 0.37; assert.equal(verifyFx(s, a, { steps }).checks.find((c) => c.id === 'fire-sources').status, 'fail');
  const b = clone(s.plan); b.fire.at039 = 0.9; assert.equal(verifyFx(s, b, { steps }).checks.find((c) => c.id === 'fire-curve').status, 'fail');
  const c = clone(s.plan); c.fire.curve.reverse(); assert.equal(verifyFx(s, c, { steps }).status, 'fail');
  const d = clone(s.plan); delete d.fire; assert.equal(verifyFx(s, d, { steps }).status, 'fail');
});

test('fx.fire：实景接线 —— fxLive.js 用 life/effects.js 的 Effects 点火，桥登记 fx.live.*，工坊调用，单元清单已登记', () => {
  const live = read('TigerMessenger/src/world/rea/fxLive.js');
  assert.match(live, /life\/effects\.js/); assert.match(live, /new Effects\(/); assert.match(live, /setFireSources\(/); assert.match(live, /showFire = true/);
  for (const f of ['previewSceneFxLive', 'compareSceneFxLive', 'revertSceneFxLive', 'commitSceneFxLive']) assert.match(live, new RegExp('export (async )?function ' + f + '\\b'));
  const bridge = read('TigerMessenger/src/scene-authoring/pipeline-bridge.js');
  for (const c of ['fx.live.preview', 'fx.live.compare', 'fx.live.revert', 'fx.live.commit', 'fx.live.state']) assert.ok(bridge.includes(`case '${c}'`), c);
  assert.match(read('TigerMessenger/src/system-workshop/fx-workshop.js'), /fx\.live\.preview/);
  assert.match(read('TigerMessenger/tools/scene-authoring/test_workshops.py'), /'fx-fire'/);
});
