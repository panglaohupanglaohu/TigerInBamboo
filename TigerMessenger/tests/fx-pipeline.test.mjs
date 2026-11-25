// 表现层管线单元测试：合成舞台格网跑原有五能力 + 独立验证。R37–R39 起能力库共 9 个（新增四个的用例在 fx-fire / fx-hallway / fx-sediment-projectiles）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeFxCapabilities, matchAll, runPlan } from '../src/system-workshop/fx/capabilities.js';
import { verifyFx } from '../src/system-workshop/fx/verify.js';

const mkSite = () => {
  const g = [];
  for (let i = 0; i < 200; i++) { const a = i * 2.4, r = 10 + 8 * Math.sin(i * .7); g.push([Math.cos(a) * r + Math.sin(i) * 3, Math.sin(a) * r, 1 + (i % 3), i % 40 === 0 ? 1 : 0]); }
  return { scene: { id: 't' }, scale: 5, unitHeight: 1.7, land: g.length, maxLevel: 3, houses: 5, grid: g };
};

const FIVE = ['fx.campaign', 'fx.camera', 'fx.wake', 'fx.ornament', 'fx.replay'];
test('fx catalog has 9 executable capabilities mapped to adapt lines (R37–R39 add fire / hallway / sediment / projectiles)', () => {
  const caps = describeFxCapabilities();
  assert.equal(caps.length, 9);
  assert.deepEqual(caps.map((c) => c.line).sort(), ['camera', 'campaign', 'fire', 'hallway', 'projectiles', 'sediment', 'tools', 'ui-decoration', 'water-effects']);
  for (const id of FIVE) assert.ok(caps.some((c) => c.id === id), id);
  assert.ok(caps.every((c) => c.executable && c.sources.length));
});

test('fx runPlan executes all five capabilities on a synthetic stage', () => {
  const site = mkSite();
  const m = matchAll(site); for (const id of FIVE) assert.ok(m.find((r) => r.id === id).count > 0, id + ' should match');
  const report = runPlan(site, [{ id: 'fx.campaign' }, { id: 'fx.camera' }, { id: 'fx.wake' }, { id: 'fx.ornament' }, { id: 'fx.replay' }]);
  assert.equal(report.filter((r) => r.status === 'applied').length, 5);
  assert.ok(site.plan.campaign.nodes.length >= 8 && new Set(site.plan.campaign.zones).size >= 2);
  assert.ok(site.plan.camera.path.length >= 24);
  assert.ok(site.plan.wake.points.length > 10);
  assert.equal(site.plan.ornament.field.length, site.plan.ornament.size ** 2);
  assert.ok(site.plan.replay.stable);
});

test('fx verify independently re-checks the produced plan', () => {
  const site = mkSite();
  const report = runPlan(site, describeFxCapabilities().map((c) => ({ id: c.id })));
  const v = verifyFx(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) });
  assert.notEqual(v.status, 'fail');
  for (const c of v.checks) assert.ok(c.blame.length);
});

test('fx verify fails on missing or corrupted plan', () => {
  const site = mkSite();
  const v1 = verifyFx(site, null, { steps: [{ id: 'fx.campaign' }] });
  assert.equal(v1.status, 'fail');
  runPlan(site, [{ id: 'fx.camera', params: { maxSpeed: 1, seconds: 4 } }]);
  const v2 = verifyFx(site, site.plan, { steps: [{ id: 'fx.camera', params: { maxSpeed: 1, seconds: 4 } }] });
  assert.ok(v2.checks.find((c) => c.id === 'camera-speed')?.status !== 'pass');
});
