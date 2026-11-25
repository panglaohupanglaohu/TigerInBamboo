// 表现层管线单元测试：合成舞台格网跑五能力 + 独立验证。
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeFxCapabilities, matchAll, runPlan } from '../src/system-workshop/fx/capabilities.js';
import { verifyFx } from '../src/system-workshop/fx/verify.js';

const mkSite = () => {
  const g = [];
  for (let i = 0; i < 200; i++) { const a = i * 2.4, r = 10 + 8 * Math.sin(i * .7); g.push([Math.cos(a) * r + Math.sin(i) * 3, Math.sin(a) * r, 1 + (i % 3), i % 40 === 0 ? 1 : 0]); }
  return { scene: { id: 't' }, scale: 5, unitHeight: 1.7, land: g.length, maxLevel: 3, houses: 5, grid: g };
};

test('fx catalog has 5 executable capabilities mapped to adapt lines', () => {
  const caps = describeFxCapabilities();
  assert.equal(caps.length, 5);
  assert.deepEqual(caps.map((c) => c.line).sort(), ['camera', 'campaign', 'tools', 'ui-decoration', 'water-effects']);
  assert.ok(caps.every((c) => c.executable && c.sources.length));
});

test('fx runPlan executes all five capabilities on a synthetic stage', () => {
  const site = mkSite();
  assert.equal(matchAll(site).filter((m) => m.count > 0).length, 5);
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
