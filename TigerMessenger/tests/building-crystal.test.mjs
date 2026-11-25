// R58 水晶城：解析峡谷阶地 + 已有建筑足迹 → 高度场；同一条建筑管线在阶地上摆建筑群，不压已有晶塔 / 用户搭建。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crystalField } from '../src/world/rea/building-geom.js';
import { runPlan, describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { verifyBuilding } from '../src/system-workshop/building/verify.js';
import { layoutProbeCells } from '../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';

// 7 级阶地（与 canyon.js 同样的量化：越靠谷心越低），中间散着几座「已有晶塔」
const groundAt = (x, z) => { const t = Math.max(0, 1 - Math.hypot(x, z) / 160); return -60 * Math.floor(t * 7) / 7; };
const towers = [[-30, -30], [20, 10], [-10, 40], [45, -35], [0, 0]].map(([x, z]) => ({ x0: x - 6, x1: x + 6, z0: z - 6, z1: z + 6 }));
const F = crystalField({ n: 61, step: 4, half: 120, groundAt, structures: towers });

test('crystal: terraces sampled, towers marked as existing buildings, lowest terrace treated as sea', () => {
  assert.equal(F.h.length, 61 * 61); assert.ok(F.marked > 0);
  const levels = new Set(F.h.map((v) => Math.round(v * 10) / 10)); assert.ok(levels.size >= 3, [...levels].join(','));
  const lo = Math.min(...F.h); assert.ok(Math.abs(F.sea - (lo + 0.5)) < 0.01);
  const q = (x, z) => Math.round((z + 120) / 4) * 61 + Math.round((x + 120) / 4); assert.equal(F.cls[q(20, 10)], 1);
});
test('crystal: the building pipeline places a group on flat terraces without touching towers', () => {
  const site = { scene: { id: 'crystal' }, field: F, terrain: 'original' }, steps = describeBuildingCapabilities().map((c) => ({ id: c.id, params: c.id === 'building.sites' ? { cellSize: 8 } : {} }));
  const rep = runPlan(site, steps); assert.equal(rep.at(-1).status, 'applied', JSON.stringify(rep.at(-1)));
  const fp = layoutProbeCells(site.plan.layout, F.n);
  for (const q of [...fp.building, ...fp.road]) assert.equal(F.cls[q], 0, 'footprint on an existing tower');
  const v = verifyBuilding(F, site.plan, { steps, sceneId: 'crystal' });
  assert.notEqual(v.status, 'fail', JSON.stringify(v.checks.filter((c) => c.status === 'fail')));
  assert.equal(v.checks.find((c) => c.id === 'preserve.lakeBuildings').status, 'pass');
});
test('crystal: game-side probe uses canyon.js and never reads the crystal-city save', () => {
  const src = fs.readFileSync(new URL('../src/world/rea/buildingCandidate.js', import.meta.url), 'utf8');
  assert.match(src, /canyonOffsetDir/); assert.match(src, /BUILDING_SCENES = \['citadel', 'crystal'\]/);
  assert.ok(!/loadCrystalLayoutFromStorage|CRYSTAL_CITY_LAYOUT_KEY|tm\.crystalCity/.test(src));
});
