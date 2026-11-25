// R52 验证检查项从契约 preserves 自动生成：每个保护项一个通用检查器；没数据给 warn 不给 pass；建筑层 verify 真的用上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPreserves, checksFromPreserves, preservesOfSteps, PRESERVE_CHECKS } from '../src/system-workshop/contract-verify.js';
import { PRESERVES, contractOf } from '../src/system-workshop/contracts.js';
import { terraceField } from './lib/building-fixtures.mjs';
import { verifyBuilding } from '../src/system-workshop/building/verify.js';
import { runPlan, describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { buildingSite } from './lib/building-fixtures.mjs';

const F = terraceField(), n = F.n, q = (i, j) => j * n + i;
const ALL = Object.keys(PRESERVES);
const st = (checks, key) => checks.find((c) => c.id === 'preserve.' + key)?.status;

test('verify: every preserve key in the vocabulary has a generic checker', () => {
  for (const k of ALL) assert.equal(typeof PRESERVE_CHECKS[k], 'function', k);
  assert.ok(checksFromPreserves(ALL).every((c) => c.generic));
  assert.equal(checksFromPreserves(['madeUp'])[0].generic, false);
});
test('verify: clean footprint on free land passes all footprint checks', () => {
  const c = verifyPreserves(ALL, { field: F, after: { footprint: { building: [q(40, 20), q(41, 20)], road: [q(40, 21)] } }, sceneId: 'citadel' });
  for (const k of ['userBuildings', 'buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'lakeBuildings', 'originalTerrain']) assert.equal(st(c, k), 'pass', k + ' ' + JSON.stringify(c.find((x) => x.id === 'preserve.' + k)));
  assert.ok(c.every((x) => x.generated && x.name.startsWith('契约 · ')));
});
test('verify: breaking each preserve is caught', () => {
  assert.equal(st(verifyPreserves(['userBuildings'], { field: F, after: { footprint: { building: [q(10, 30)] } } }), 'userBuildings'), 'fail');
  assert.equal(st(verifyPreserves(['buildingBuffer'], { field: F, band: 4, after: { footprint: { building: [q(14, 30)] } } }), 'buildingBuffer'), 'fail');
  assert.equal(st(verifyPreserves(['railClearance'], { field: F, railBand: 6, after: { footprint: { road: [q(30, 48)] } } }), 'railClearance'), 'fail');
  const h = F.h.slice(); h[q(30, 47)] += 2;
  assert.equal(st(verifyPreserves(['railClearance'], { field: F, after: { h } }), 'railClearance'), 'fail', 'rail height moved');
  const h2 = F.h.slice(); h2[q(30, 30)] = 0;
  assert.equal(st(verifyPreserves(['coastline'], { field: F, after: { h: h2 } }), 'coastline'), 'fail', 'land sunk into sea');
  assert.equal(st(verifyPreserves(['coastline'], { field: F, after: { footprint: { building: [q(0, 0)] } } }), 'coastline'), 'fail', 'building on sea');
  assert.equal(st(verifyPreserves(['userSaves'], { field: F, storageWrites: ['tm.crystalCity.layout.v1'] }), 'userSaves'), 'fail');
  assert.equal(st(verifyPreserves(['lakeBuildings'], { field: F, sceneId: 'morris-lake', after: { footprint: { building: [q(40, 20)] } } }), 'lakeBuildings'), 'fail');
});
test('verify: no comparable data is a warning, never a pass', () => {
  const c = verifyPreserves(['userBuildings', 'buildingBuffer', 'coastline', 'madeUp'], { field: F });
  for (const x of c) assert.equal(x.status, 'warn', x.id);
});
test('verify: blame points at the capabilities that declared the preserve', () => {
  const caps = describeBuildingCapabilities().map((m) => contractOf(m, 'building')), { preserves, blameOf } = preservesOfSteps(caps, ['building.sites', 'building.prefabs', 'building.joint-wfc']);
  assert.ok(preserves.includes('userBuildings') && preserves.includes('railClearance'));
  const c = verifyPreserves(['userBuildings'], { field: F, after: { footprint: { building: [q(10, 30)] } } }, { blameOf });
  assert.deepEqual(c[0].blame, ['building.sites', 'building.joint-wfc']);
});
test('verify: the building layer verify includes the generated checks', () => {
  const site = buildingSite(F); const steps = describeBuildingCapabilities().map((c) => ({ id: c.id, params: {} }));
  runPlan(site, steps);
  const v = verifyBuilding(F, site.plan, { steps, sceneId: 'citadel' });
  const gen = v.checks.filter((c) => c.generated);
  assert.ok(gen.length >= 6, 'generated ' + gen.length);
  assert.ok(gen.every((c) => c.status !== 'fail'), JSON.stringify(gen.filter((c) => c.status === 'fail')));
  assert.equal(v.metrics.generated, gen.length);
});
