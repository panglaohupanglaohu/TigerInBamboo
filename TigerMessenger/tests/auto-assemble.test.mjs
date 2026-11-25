// R53 按目标自动拼管线：沿契约（写 → 读、requires）拉能力、拓扑排序、记推理；没有目标时原样走 R22 预装。
import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblePipeline, parseGoal, layersForScene, assemblySummary } from '../src/system-workshop/auto-assemble.js';
import { describeMountainCapabilities } from '../src/system-workshop/mountain/capabilities.js';
import { describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { describeBattleCapabilities } from '../src/system-workshop/battle/capabilities.js';
import { describeFxCapabilities } from '../src/system-workshop/fx/capabilities.js';

const avail = () => [{ id: 'mountain', name: '山形', caps: describeMountainCapabilities() }, { id: 'building', name: '建筑', caps: describeBuildingCapabilities() }, { id: 'battle', name: '战役', caps: describeBattleCapabilities() }, { id: 'fx', name: '表现层', caps: describeFxCapabilities() }];
const GOAL = '在山上建一片带路的建筑群';

test('assemble: goal parsing maps words to contract resources', () => {
  const w = parseGoal(GOAL).map((x) => x.resource);
  assert.ok(w.includes('heightfield') && w.includes('buildingLayout'), JSON.stringify(w));
  assert.deepEqual(parseGoal(''), []);
});
test('assemble: citadel goal → two stages, terrain first, building second', () => {
  const r = assemblePipeline({ goal: GOAL, sceneId: 'citadel', layers: layersForScene('citadel', avail()) });
  assert.equal(r.mode, 'goal'); assert.ok(r.ok, JSON.stringify(r.unmet));
  assert.deepEqual(r.stages.map((s) => s.layer), ['mountain', 'building'], assemblySummary(r));
  const ids = r.steps.map((s) => s.id), at = (id) => ids.indexOf(id);
  for (const id of ['mountain.protect', 'mountain.massif', 'building.sites', 'building.prefabs', 'building.joint-wfc']) assert.ok(at(id) >= 0, 'missing ' + id + ' in ' + ids);
  assert.ok(at('mountain.protect') < at('mountain.massif'), 'requires order');
  assert.ok(at('mountain.massif') < at('building.sites'), 'height writer before height reader');
  assert.ok(at('building.sites') < at('building.joint-wfc') && at('building.prefabs') < at('building.joint-wfc'));
  assert.ok(!ids.some((id) => id.startsWith('battle.') || id.startsWith('fx.')), 'unrelated layers pulled in: ' + ids);
  // 推理：跨层那一句点名高度场；链接里有 山形 → 建筑选址 的写 → 读
  assert.ok(r.reasoning.some((x) => x.kind === 'order' && /高度场/.test(x.text) && /建筑选址/.test(x.text)), JSON.stringify(r.reasoning.map((x) => x.text)));
  assert.ok(r.links.some((l) => l.kind === 'writes→reads' && l.to === 'building.sites' && l.resource === 'heightfield' && l.from.startsWith('mountain.')));
  assert.ok(r.reasoning.some((x) => x.kind === 'requires' && x.to === 'building.joint-wfc'));
  for (const s of r.steps) assert.ok(s.why.length, s.id + ' has no reason');
});
test('assemble: buildings only → no terrain stage (scene height field is enough)', () => {
  const r = assemblePipeline({ goal: '建一片房子和礼拜堂', sceneId: 'citadel', layers: layersForScene('citadel', avail()) });
  assert.deepEqual(r.stages.map((s) => s.layer), ['building']);
  assert.ok(!r.steps.some((s) => s.layer === 'mountain'));
});
test('assemble: crystal city has no terrain layer → honest unmet for the mountain part, building stage still assembled', () => {
  const r = assemblePipeline({ goal: GOAL, sceneId: 'crystal', layers: layersForScene('crystal', avail()) });
  assert.deepEqual(r.stages.map((s) => s.layer), ['building']);
  assert.equal(r.ok, false); assert.ok(r.unmet.some((u) => /高度场/.test(u.text)), JSON.stringify(r.unmet));
});
test('assemble: no goal falls back to R22 preload (scan matches + requires)', () => {
  const layers = layersForScene('citadel', avail()), scans = { building: { matches: [{ id: 'building.joint-wfc', count: 1 }] } };
  const r = assemblePipeline({ goal: '', sceneId: 'citadel', layers, scans });
  assert.equal(r.mode, 'preload'); assert.deepEqual(r.steps.map((s) => s.id), ['building.sites', 'building.prefabs', 'building.joint-wfc']);
  assert.ok(r.reasoning[0].text.includes('R22'));
  const u = assemblePipeline({ goal: '让它更好看一点吧', sceneId: 'citadel', layers, scans });
  assert.equal(u.mode, 'preload-fallback');
});
test('assemble: contract cycles are reported, not looped', () => {
  const caps = [{ id: 't.a', name: 'A', keywords: ['甲'], reads: ['palette'], writes: ['materials'], preserves: [], requires: ['t.b'] }, { id: 't.b', name: 'B', reads: [], writes: ['palette'], preserves: [], requires: ['t.a'] }];
  const r = assemblePipeline({ goal: '甲', layers: [{ id: 'gscene', caps }] });
  assert.equal(r.ok, false); assert.ok(r.reasoning.some((x) => x.kind === 'cycle'));
});
test('assemble: deterministic', () => {
  const a = assemblePipeline({ goal: GOAL, sceneId: 'citadel', layers: layersForScene('citadel', avail()) }), b = assemblePipeline({ goal: GOAL, sceneId: 'citadel', layers: layersForScene('citadel', avail()) });
  assert.deepEqual(a, b);
});
