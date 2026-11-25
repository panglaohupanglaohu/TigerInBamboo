// R55 联合 WFC：prefab（种类 / 朝向 / 位置）+ 路 + 空地一次解；地形规则（足迹平、坡度、保护格）；门只对路；独立验证。
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveJointLayout, validateLayout, latticeFromField, layoutProbeCells, DIRS } from '../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
import { runPlan, describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { verifyBuilding } from '../src/system-workshop/building/verify.js';
import { terraceField, buildingSite } from './lib/building-fixtures.mjs';

const F = terraceField(), steps = (p = {}) => describeBuildingCapabilities().map((c) => ({ id: c.id, params: p[c.id] || {} }));

test('joint-wfc: solves a group with several prefab kinds, roads, and passes independent validation', () => {
  const r = solveJointLayout(F, { seed: 7, maxStep: 3, minBuildings: 3 });
  assert.ok(r.ok, r.reason);
  const v = validateLayout(F, r.layout, { minBuildings: 3 });
  assert.ok(v.ok, JSON.stringify(v.checks.filter((c) => c.status === 'fail')));
  assert.ok(r.layout.roads.length >= 1, 'doors need roads');
  assert.ok(new Set(r.layout.placements.map((p) => p.prefab)).size >= 2, 'expected more than one prefab kind: ' + JSON.stringify(r.stats.byPrefab));
});
test('joint-wfc: terrain rules — no footprint on protected / sea / steep cells, footprint height range within maxStep', () => {
  const r = solveJointLayout(F, { seed: 11, maxStep: 3 }), L = latticeFromField(F, r.layout.params);
  for (const p of r.layout.placements) { let lo = Infinity, hi = -Infinity; for (const [I, J] of p.cells) { assert.equal(L.reason[J * L.W + I], 0, 'protected cell used'); lo = Math.min(lo, L.hMin[J * L.W + I]); hi = Math.max(hi, L.hMax[J * L.W + I]); } assert.ok(hi - lo <= 3 + 1e-9); }
  const fp = layoutProbeCells(r.layout, F.n); for (const q of [...fp.building, ...fp.road]) { assert.equal(F.cls[q], 0); assert.ok(F.h[q] > 0.3); }
});
test('joint-wfc: doors face roads (socket rule), roads never dangle', () => {
  const r = solveJointLayout(F, { seed: 3, maxStep: 3 }), roads = new Map(r.layout.roads.map((x) => [x.cell.join(','), x.mask]));
  for (const p of r.layout.placements) { const o = [p.door.cell[0] + DIRS[p.door.dir][0], p.door.cell[1] + DIRS[p.door.dir][1]].join(','); assert.ok(roads.has(o), 'door of ' + p.name + ' faces no road'); assert.ok((roads.get(o) >> ((p.door.dir + 2) % 4)) & 1); }
  assert.equal(validateLayout(F, r.layout).checks.find((c) => c.id === 'roads').status, 'pass');
});
test('joint-wfc: placements carry stable multi-cell instance ids; same seed → same identity set', () => {
  const r = solveJointLayout(F, { seed: 7, maxStep: 3, minBuildings: 3 });
  const ids = r.layout.placements.map((p) => p.instance);
  assert.ok(ids.every((x) => typeof x === 'string' && x.length > 3), 'every building needs an instance id');
  assert.equal(new Set(ids).size, ids.length, 'instance ids unique');
  assert.deepEqual(solveJointLayout(F, { seed: 7, maxStep: 3, minBuildings: 3 }).layout.placements.map((p) => p.instance), ids, 'regeneration keeps identity');
});
test('joint-wfc: building layer runs it as an executable capability; deterministic; verify passes', () => {
  const a = buildingSite(F), b = buildingSite(F);
  const ra = runPlan(a, steps()), rb = runPlan(b, steps());
  assert.deepEqual(ra.map((x) => x.status), ['applied', 'applied', 'applied'], JSON.stringify(ra));
  assert.equal(JSON.stringify(a.plan), JSON.stringify(b.plan));
  const v = verifyBuilding(F, a.plan, { steps: steps(), sceneId: 'citadel' });
  assert.notEqual(v.status, 'fail', JSON.stringify(v.checks.filter((c) => c.status === 'fail')));
});
test('joint-wfc: nothing buildable → no-target and verification fails (does not invent a layout)', () => {
  const sea = { ...F, h: F.h.map(() => 0) }, s = buildingSite(sea), rep = runPlan(s, steps());
  assert.equal(rep.at(-1).status, 'no-target'); assert.equal(s.plan.layout, null);
  assert.equal(verifyBuilding(sea, s.plan, { steps: steps() }).status, 'fail');
});
