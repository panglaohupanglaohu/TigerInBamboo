// R38 建筑纹理走廊（Guide §9 E 组）：fx.hallway —— run 真实调用 core/doodle-hallway-layout.js planHallway / mirroredMotifs，
// 独立验证用同一组选项重跑版式；实景样板走 build/doodle-hallway.js makeHallway。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describeFxCapabilities, runPlan } from '../src/system-workshop/fx/capabilities.js';
import { verifyFx } from '../src/system-workshop/fx/verify.js';
import { planHallway, mirroredMotifs } from '../../townscaper-web/REACodeRefactoring/src/core/doodle-hallway-layout.js';
import { cliffStage, clone } from './fixtures/fx-stage.mjs';

const root = new URL('../../', import.meta.url), read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const run = (params = {}, site = cliffStage()) => { const s = clone(site); const report = runPlan(s, [{ id: 'fx.hallway', params }]); return { s, report, v: verifyFx(s, s.plan, { steps: [{ id: 'fx.hallway' }] }) }; };

test('fx.hallway：meta 全字段，line = hallway，modules 含版式与贴图两个库模块', () => {
  const m = describeFxCapabilities().find((c) => c.id === 'fx.hallway');
  assert.ok(m); assert.equal(m.line, 'hallway'); assert.deepEqual(m.requires, []);
  assert.ok(m.modules.includes('src/core/doodle-hallway-layout.js') && m.modules.includes('src/build/doodle-hallway.js'));
  for (const p of m.modules) assert.ok(fs.existsSync(new URL('townscaper-web/REACodeRefactoring/' + p, root)), p);
});

test('fx.hallway：板与纹样数等于 planHallway 直接算的结果，覆盖整面墙，落在小屋上', () => {
  const { s, report } = run({ seed: 11, density: 1.2, mirror: 1 });
  assert.equal(report[0].status, 'applied');
  const h = s.plan.hallway, ref = planHallway({ seed: 11, density: 1.2, mirror: true });
  assert.equal(h.panels.length, ref.panels.length); assert.equal(h.strips, ref.strips.length);
  assert.equal(h.motifs, ref.panels.reduce((n, p) => n + mirroredMotifs(ref, p).length, 0));
  assert.ok(Math.abs(h.coverage - 1) < 1e-3, '覆盖率 ' + h.coverage);
  assert.equal(h.host.basis, 'house'); assert.ok(h.door && h.door.s0 > 0 && h.door.s1 < h.S);
});

test('fx.hallway：确定性；换种子版式变；关镜像纹样数变', () => {
  assert.deepEqual(run({ seed: 7 }).s.plan.hallway, run({ seed: 7 }).s.plan.hallway);
  assert.notDeepEqual(run({ seed: 7 }).s.plan.hallway.panels.map((p) => p.motifs), run({ seed: 8 }).s.plan.hallway.panels.map((p) => p.motifs));
  assert.notEqual(run({ mirror: 1 }).s.plan.hallway.motifs, run({ mirror: 0 }).s.plan.hallway.motifs);
});

test('fx.hallway：独立验证通过；挪板 / 板重叠 / 落点出格网 → 失败', () => {
  const { s, v } = run();
  assert.equal(v.status, 'pass', v.summary);
  const cov = v.checks.find((c) => c.id === 'hallway-cover'); assert.equal(cov.metric.direction, 'min'); assert.equal(cov.metric.threshold, 0.98);
  const steps = [{ id: 'fx.hallway' }];
  const a = clone(s.plan); a.hallway.panels[1].s0 += 0.2; assert.equal(verifyFx(s, a, { steps }).checks.find((c) => c.id === 'hallway-plan').status, 'fail');
  const b = clone(s.plan); b.hallway.panels[2].s0 = b.hallway.panels[1].s0; assert.equal(verifyFx(s, b, { steps }).checks.find((c) => c.id === 'hallway-cover').status, 'fail');
  const c = clone(s.plan); c.hallway.host.x += 0.5; assert.equal(verifyFx(s, c, { steps }).checks.find((c2) => c2.id === 'hallway-host').status, 'fail');
});

test('fx.hallway：实景样板接线 —— fxLive.js 调 makeHallway，工坊画展开面条，单元清单已登记', () => {
  const live = read('TigerMessenger/src/world/rea/fxLive.js');
  assert.match(live, /build\/doodle-hallway\.js/); assert.match(live, /makeHallway\(/);
  assert.match(read('TigerMessenger/src/system-workshop/fx-workshop.js'), /drawHallStrip\(/);
  assert.match(read('TigerMessenger/tools/scene-authoring/test_workshops.py'), /'fx-hallway'/);
});
