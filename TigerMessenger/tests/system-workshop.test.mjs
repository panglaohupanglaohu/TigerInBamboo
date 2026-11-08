// 系统工坊：球系统 / 物件两层的能力代码与验证（纯数据，Node 直接跑；浏览器里是同一份代码在 Worker 中执行）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_PLANET_RECIPE, runPlanetPlan } from '../src/system-workshop/planet/capabilities.js';
import { compileAndSummarize } from '../src/system-workshop/planet/summarize.js';
import { verifyPlanet } from '../src/system-workshop/planet/verify.js';
import { matchObjects, runObjectPlan } from '../src/system-workshop/object/capabilities.js';
import { verifyObjects } from '../src/system-workshop/object/verify.js';
import { routeByKeywords } from '../src/system-workshop/tier-agent.js';

const base = compileAndSummarize(DEFAULT_PLANET_RECIPE, { W: 64, H: 32 });
const tryPlan = (steps) => { const { recipe } = runPlanetPlan(DEFAULT_PLANET_RECIPE, steps); const a = compileAndSummarize(recipe, { W: 64, H: 32 }); return verifyPlanet(base, a, a.ok ? compileAndSummarize(recipe, { W: 8, H: 4 }) : null); };

test('planet: small sea-level rise passes all checks', () => {
  assert.ok(base.ok);
  const v = tryPlan([{ id: 'planet.sea-level', params: { level: 0.5 } }]);
  assert.equal(v.status, 'pass', JSON.stringify(v.checks));
});
test('planet: drowning a scene landmark fails verification', () => {
  const v = tryPlan([{ id: 'planet.sea-level', params: { level: 1.5 } }]);
  assert.equal(v.status, 'fail');
  assert.equal(v.checks.find((c) => c.id === 'landmarks').status, 'fail');
});
test('planet: compiler failure is a failed candidate, not a crash', () => {
  const v = tryPlan([{ id: 'planet.grid-subdivision', params: { level: 2 } }]);
  assert.equal(v.checks[0].status, 'fail');
});

const E = { dx: 0, dy: 0, dz: 0, ry: 0, s: 1, hidden: false };
const L = Array.from({ length: 10 }, (_, i) => ({ id: 'plane-tree:' + i, kind: 'plane-tree', x: i * 0.4, z: 0, r: 0.4, edit: { ...E }, locked: false }));
L.push({ id: 'plane-tree:manual', kind: 'plane-tree', x: 1.1, z: 0.1, r: 0.4, edit: { ...E, dx: 0.2 }, locked: true });
test('object: scan finds identical trees and overlaps; router follows goal keywords', () => {
  const m = matchObjects(L);
  assert.ok(m.every((x) => x.count > 0));
  const caps = [{ id: 'object.spacing-relax', keywords: ['挤'] }, { id: 'object.scale-variety', keywords: ['大小'] }, { id: 'object.yaw-variety', keywords: ['朝向'] }];
  assert.deepEqual(routeByKeywords('别挤在一起', caps, m).map((r) => r.id), ['object.spacing-relax']);
});
test('object: plan reduces overlaps, keeps manual edits, passes verification', () => {
  const steps = [{ id: 'object.scale-variety' }, { id: 'object.spacing-relax', params: { maxMove: 0.35 } }];
  const r = runObjectPlan(L, steps);
  assert.ok(!('plane-tree:manual' in r.edits));
  const v = verifyObjects(L, r.edits, { steps });
  assert.notEqual(v.status, 'fail', JSON.stringify(v.checks));
});
test('object: touching a manual edit or exceeding the move budget fails', () => {
  const v = verifyObjects(L, { 'plane-tree:manual': { ...E, dx: 0.2, s: 1.2 }, 'plane-tree:0': { ...E, dx: 3 } }, { steps: [] });
  assert.equal(v.checks.find((c) => c.id === 'manual').status, 'fail');
  assert.equal(v.checks.find((c) => c.id === 'move').status, 'fail');
});
test('catalog: three workshops, every node has an execution state', () => {
  const cat = JSON.parse(fs.readFileSync(new URL('../src/scene-authoring/catalog/system-catalog.json', import.meta.url)));
  assert.deepEqual(cat.workshops.map((w) => w.id), ['planet', 'scene', 'object']);
  for (const w of cat.workshops) for (const d of w.domains) for (const n of d.nodes) assert.ok(['code', 'refactored', 'partial', 'original', 'reference'].includes(n.exec));
});
