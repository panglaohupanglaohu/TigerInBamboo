// R59 整体放置 / 替换 / 撤回：换种子 = 同一窗口整体换一组（仍过验证）；撤回 = 整组删掉；撤销采用 = 删记录。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runPlan, describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { verifyBuilding } from '../src/system-workshop/building/verify.js';
import { relayout, solveJointLayout } from '../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
import { terraceField, buildingSite } from './lib/building-fixtures.mjs';

const F = terraceField();
const steps = (seed) => describeBuildingCapabilities().map((c) => ({ id: c.id, params: c.id === 'building.joint-wfc' ? { seed } : {} }));
const plan = (seed) => { const s = buildingSite(F); runPlan(s, steps(seed)); return s.plan; };

test('replace: a new seed replaces the whole group in the same window and still verifies', () => {
  const a = plan(7), b = plan(8);
  assert.ok(a.layout && b.layout, (a.solve?.reason || '') + (b.solve?.reason || ''));
  assert.deepEqual(a.layout.window, b.layout.window, 'replacement stays in the same area');
  assert.notEqual(JSON.stringify(a.layout.placements), JSON.stringify(b.layout.placements), 'a different group');
  for (const [p, s] of [[a, 7], [b, 8]]) assert.notEqual(verifyBuilding(F, p, { steps: steps(s) }).status, 'fail');
});
test('replace: relayout keeps window and prefab subset', () => {
  const a = solveJointLayout(F, { seed: 5, maxStep: 3, prefabs: ['cottage', 'hall'] }); assert.ok(a.ok, a.reason);
  const b = relayout(F, a.layout, { seed: 6 }); assert.ok(b.ok, b.reason);
  assert.deepEqual(b.layout.window, a.layout.window); assert.ok(b.layout.placements.every((p) => ['cottage', 'hall'].includes(p.prefab)));
});
test('replace / revert: page buttons and game-side functions exist and stay on candidates only', () => {
  const w = fs.readFileSync(new URL('../src/system-workshop/building-workshop.js', import.meta.url), 'utf8');
  for (const id of ['building-replace', 'building-revert', 'building-unadopt', 'building-cam-oblique', 'building-cam-top']) assert.ok(w.includes(`'${id}'`), id);
  const g = fs.readFileSync(new URL('../src/world/rea/buildingCandidate.js', import.meta.url), 'utf8');
  assert.match(g, /export function revertBuilding/); assert.match(g, /export function unadoptBuilding/);
  assert.match(g, /clearGroup\(\);\s*\n?\s*const \{ group, meshes \} = buildGroup/, 'preview must remove the old group before adding the new one (整体替换)');
});
