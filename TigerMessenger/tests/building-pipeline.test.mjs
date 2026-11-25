// R56 建筑层（§7.2 清单）：PipeLineEngine 适配器、独立验证（正常 / 确定性 / 破坏判失败）、worker-host、studio 挂载、能力树登记、pipeline-bridge 命令。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createWorkerEngine } from '../src/pipeline-engine/worker-adapters.js';
import { validateEngineOutput } from '../src/pipeline-engine/PipeLineEngine.js';
import { verifyBuilding } from '../src/system-workshop/building/verify.js';
import { latticeFromField } from '../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
import { describeBuildingCapabilities } from '../src/system-workshop/building/capabilities.js';
import { terraceField, buildingSite } from './lib/building-fixtures.mjs';

const F = terraceField(), read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const STEPS = [{ id: 'building.sites' }, { id: 'building.prefabs' }, { id: 'building.joint-wfc' }];

test('building layer: engine catalog / scan / run with a valid receipt', async () => {
  const e = await createWorkerEngine('building');
  const cat = e.catalog(); assert.deepEqual(cat.map((c) => c.id), ['building.sites', 'building.prefabs', 'building.joint-wfc']);
  assert.ok(cat.every((c) => c.executable && c.implementation.startsWith('src/system-workshop/building/capabilities.js#')));
  const ctx = { tier: 'building', sceneId: 'citadel' };
  const scan = await e.scan(buildingSite(F), { context: ctx }); assert.ok(scan.matches.every((m) => m.count >= 1), JSON.stringify(scan.matches));
  const run = await e.run(buildingSite(F), STEPS, { context: ctx });
  await validateEngineOutput(run);
  assert.ok(run.plan.layout?.placements.length >= 1);
  await assert.rejects(() => e.run(buildingSite(F), [{ id: 'building.joint-wfc' }], { context: ctx }), /需要先执行/);
});
test('building verify: pass, deterministic, and broken plans fail', async () => {
  const e = await createWorkerEngine('building'), ctx = { tier: 'building', sceneId: 'citadel' };
  const run = await e.run(buildingSite(F), STEPS, { context: ctx }), steps = run.report.map((r) => ({ id: r.id, params: r.params }));
  const v = verifyBuilding(F, run.plan, { steps, sceneId: 'citadel' });
  assert.notEqual(v.status, 'fail', JSON.stringify(v.checks.filter((c) => c.status === 'fail')));
  assert.deepEqual(verifyBuilding(F, run.plan, { steps, sceneId: 'citadel' }), v);
  // 破坏 1：一栋挪到已有建筑上（目标格从实际建筑格里找「老城保护带」，不写死坐标——建筑格边长随 cellSize / 采样步长变）
  const moved = structuredClone(run.plan), p = moved.layout.placements[0];
  const lat = latticeFromField(F, run.plan.layout.params); let tI = -1, tJ = -1;
  for (let J = 0; J < lat.H && tI < 0; J++) for (let I = 0; I < lat.W; I++) if (lat.reason[J * lat.W + I] === 1) { tI = I; tJ = J; break; }
  assert.ok(tI >= 0, 'fixture has no protected cell');
  const dI = tI - p.anchor[0], dJ = tJ - p.anchor[1];
  p.anchor = [tI, tJ]; p.cells = p.cells.map(([I, J]) => [I + dI, J + dJ]); p.door.cell = [p.door.cell[0] + dI, p.door.cell[1] + dJ];
  const vm = verifyBuilding(F, moved, { steps });
  assert.equal(vm.status, 'fail'); assert.equal(vm.checks.find((c) => c.id === 'layout.footprint').status, 'fail');
  assert.ok(['preserve.userBuildings', 'preserve.buildingBuffer'].some((id) => vm.checks.find((c) => c.id === id)?.status === 'fail'), 'contract-generated check must catch it too');
  assert.ok(vm.checks.filter((c) => c.status === 'fail').some((c) => c.blame.includes('building.joint-wfc')));
  // 破坏 2：建筑埋进地里
  const sunk = structuredClone(run.plan); sunk.layout.placements[0].base -= 5;
  assert.equal(verifyBuilding(F, sunk, { steps }).checks.find((c) => c.id === 'base').status, 'fail');
  // 破坏 3：计划与采样网格对不上
  const other = terraceField({ n: 41 });
  assert.equal(verifyBuilding(other, run.plan, { steps }).checks.find((c) => c.id === 'grid').status, 'fail');
});
test('building layer: registered in worker-host, adapters, studio, lineage, bridge (§7.2 #4 #5)', () => {
  assert.match(read('../src/pipeline-engine/worker-host.js'), /kind==='building'\?m\.site|\|\|kind==='building'\?m\.site/);
  assert.match(read('../src/pipeline-engine/worker-host.js'), /worker-adapters\.js\?v=[\w-]+/);
  assert.match(read('../src/pipeline-engine/worker-adapters.js'), /building\/capabilities\.js\?v=building-r2/);
  const studio = read('../src/scene-authoring/studio.js');
  assert.match(studio, /building-workshop\.js\?v=building-r1/); assert.match(studio, /BUILDING_SCENE_IDS=new Set\(\['citadel','crystal'\]\)/); assert.match(studio, /buildingCaps\.some/);
  assert.match(read('../tools/refactor/build-capability-lineage.mjs'), /describeBuildingCapabilities\(\)\.map/);
  const bridge = read('../src/scene-authoring/pipeline-bridge.js');
  for (const c of ['probe', 'preview', 'compare', 'revert', 'commit', 'unadopt', 'camera', 'state']) assert.match(bridge, new RegExp(`case 'building\\.${c}'`), c);
  const w = read('../src/system-workshop/building/transform-worker.js'); assert.match(w, /installPipeLineWorker\('building'\)/);
  for (const m of describeBuildingCapabilities()) assert.ok(m.line && m.modules.length, m.id);
});
