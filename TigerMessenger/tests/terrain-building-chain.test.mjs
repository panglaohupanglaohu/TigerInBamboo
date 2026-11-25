// R60 「地形 → 建筑」两段管线：按目标沿契约拼出（山形在前、建筑在后），山形计划的高度喂给建筑管线，建筑站在新山上，两段各自通过验证。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assemblePipeline, layersForScene } from '../src/system-workshop/auto-assemble.js';
import { describeMountainCapabilities, runPlan as runMountain } from '../src/system-workshop/mountain/capabilities.js';
import { describeBuildingCapabilities, runPlan as runBuilding } from '../src/system-workshop/building/capabilities.js';
import { verifyBuilding } from '../src/system-workshop/building/verify.js';
import { verifyPreserves } from '../src/system-workshop/contract-verify.js';
import { terraceField, mountainSite, buildingSite } from './lib/building-fixtures.mjs';

const GOAL = '在山上建一片带路的建筑群';
const layers = () => layersForScene('citadel', [{ id: 'mountain', name: '山形', caps: describeMountainCapabilities() }, { id: 'building', name: '建筑', caps: describeBuildingCapabilities() }]);

test('chain: assembled from contracts, then run stage by stage with the mountain plan feeding the building stage', () => {
  const asm = assemblePipeline({ goal: GOAL, sceneId: 'citadel', layers: layers() });
  assert.deepEqual(asm.stages.map((s) => s.layer), ['mountain', 'building']);
  const F = terraceField();
  // 第 1 段：山形（与游戏同一套能力代码；主峰压低一点，让山上还有能盖房的缓处）
  const mSteps = asm.stages[0].ids.map((id) => ({ id, params: id === 'mountain.massif' ? { peak: 10 } : {} }));
  const ms = mountainSite(F); runMountain(ms, mSteps);
  assert.equal(ms.plan.h.length, F.n * F.n);
  let changed = 0; for (let q = 0; q < F.h.length; q++) if (F.cls[q] === 0 && F.h[q] > 0.3 && Math.abs(ms.plan.h[q] - F.h[q]) > 0.5) changed++;
  assert.ok(changed > 50, 'mountain stage did not reshape the land: ' + changed);
  // 契约生成的通用检查同样适用于山形计划：已有建筑 / 轨道格高度不变
  const gm = verifyPreserves(['userBuildings', 'railClearance'], { field: F, after: { h: ms.plan.h }, railBand: 0.1 });
  assert.equal(gm.find((c) => c.id === 'preserve.userBuildings').status, 'pass', JSON.stringify(gm));
  // 第 2 段：建筑读山形候选的高度（与 building.probe 一样：只换自由地形格）
  const field2 = { ...F, h: F.h.map((v, q) => (F.cls[q] === 0 && ms.plan.h[q] != null ? ms.plan.h[q] : v)) };
  const bSteps = asm.stages[1].ids.map((id) => ({ id, params: id === 'building.joint-wfc' ? { minBuildings: 1 } : {} })), bs = buildingSite(field2, { terrain: 'mountain-candidate', mountainSig: 'test' });
  const rep = runBuilding(bs, bSteps);
  assert.equal(rep.at(-1).status, 'applied', JSON.stringify(rep.at(-1)) + JSON.stringify(bs.plan.solve));
  assert.equal(bs.plan.terrain, 'mountain-candidate');
  const v = verifyBuilding(field2, bs.plan, { steps: bSteps, sceneId: 'citadel' });
  assert.notEqual(v.status, 'fail', JSON.stringify(v.checks.filter((c) => c.status === 'fail')));
  // 建筑真的站在新山上：底面 ≥ 新山面最高处，且至少一栋的底面和原地形不一样高
  const n = F.n, k = bs.plan.layout.k; let differs = 0;
  for (const p of bs.plan.layout.placements) { let hiNew = -Infinity, hiOld = -Infinity; for (const [I, J] of p.cells) for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) { const q = (J * k + b) * n + I * k + a; hiNew = Math.max(hiNew, field2.h[q]); hiOld = Math.max(hiOld, F.h[q]); } assert.ok(p.base >= hiNew - 1e-6); if (Math.abs(hiNew - hiOld) > 0.3) differs++; }
  assert.ok(differs > 0, 'buildings ignore the mountain stage');
  // 同一个场地直接在原地形上跑，结果不同（说明第 2 段真的吃了第 1 段的输出）
  const flat = buildingSite(F); runBuilding(flat, bSteps);
  assert.notEqual(JSON.stringify(flat.plan.layout?.placements), JSON.stringify(bs.plan.layout.placements));
});
test('chain: the page has the one-click two-stage run and the game rejects a stale terrain', () => {
  const panel = fs.readFileSync(new URL('../src/system-workshop/auto-assemble-panel.js', import.meta.url), 'utf8');
  assert.match(panel, /两段连跑（地形 → 建筑）/); assert.match(panel, /views\.mountain\.generate\(\)/); assert.match(panel, /views\.building\.scan\(\)/);
  assert.ok(panel.indexOf('views.mountain.generate()') < panel.indexOf('views.building.generate()'));
  const g = fs.readFileSync(new URL('../src/world/rea/buildingCandidate.js', import.meta.url), 'utf8');
  assert.match(g, /山形候选在扫描之后变了/); assert.match(g, /terrain = 'mountain-candidate'/);
});
