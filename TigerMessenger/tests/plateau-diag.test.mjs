// 补学 #6「185帧台地诊断」（grid 线 A 代，clip 815236105079398400）：真实 World 上的两个新诊断量——
//   同高片 plateauRuns：相邻（共边）且 top 相同的柱子聚成片，每片记 层数 / 格数 / 面积 / 边界周长；
//   逻辑阶差 stepDropArea：相邻柱高差 ≥ minStep（默认 2）层的边，记边数 / 总长 / 高差×边长的立面面积。
// 能力 scene.plateau-diag 挂在光影与生命层（读 scene-voxels.js 采出的同一份 World），只读诊断。
// 原片算法未公开（learn/data.js 卡点·C），断言的是可观察行为，不是原算法。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/plateau-diag.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { buildSquareGrid } from '../../townscaper-web/REACodeRefactoring/src/core/grid.js';
import { World } from '../../townscaper-web/REACodeRefactoring/src/core/world.js';
import { plateauRuns, stepDropArea, terraceProfile } from '../../townscaper-web/REACodeRefactoring/src/core/terrace-profile.js';
import { worldFromSite, squareGrid } from '../src/system-workshop/lightlife/scene-voxels.js';
import { runPlan, matchAll, describeLightLifeCapabilities } from '../src/system-workshop/lightlife/capabilities.js';
import { verifyLightLife } from '../src/system-workshop/lightlife/verify.js';

/** n×n 世界，fill[i][j] = 层数（0 = 海）。 */
function worldOf(levels, { rock = true } = {}) {
  const n = levels.length, grid = squareGrid(n, 1), w = new World(grid);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const lv = levels[j][i]; if (lv) w.fill(grid.cells[j * n + i], lv, { rock }); }
  return w;
}
const ALL1 = (n) => Array.from({ length: n }, () => new Array(n).fill(1));
function twoStep(n = 5) { // 平地 1 层，中央 2×2 抬到 3 层
  const h = ALL1(n);
  for (const [i, j] of [[2, 2], [3, 2], [2, 3], [3, 3]]) h[j][i] = 3;
  return h;
}

test('同高片：平地一片；台阶两片；面积 / 边界长正确；水格不成片', () => {
  const flat = plateauRuns(worldOf(ALL1(5)));
  assert.equal(flat.count, 1); assert.equal(flat.landCells, 25);
  assert.deepEqual([flat.runs[0].level, flat.runs[0].count, flat.runs[0].area], [1, 25, 25]);
  assert.equal(flat.runs[0].boundary, 20); // 5×5 方形周长
  assert.equal(flat.runs[0].boundaryEdges, 20);

  const r = plateauRuns(worldOf(twoStep()));
  assert.equal(r.count, 2);
  const low = r.runs.find((x) => x.level === 1), high = r.runs.find((x) => x.level === 3);
  assert.ok(low && high); assert.equal(low.count, 21); assert.equal(high.count, 4);
  assert.equal(high.area, 4); assert.equal(high.boundary, 8); // 2×2 块周长 8
  assert.deepEqual(r.levels, { 1: 1, 3: 1 });

  const sea = worldOf(ALL1(5).map((row, j) => row.map((v, i) => (i === 0 || j === 0 || i === 4 || j === 4 ? 0 : 1))));
  const rs = plateauRuns(sea); assert.equal(rs.count, 1); assert.equal(rs.landCells, 9); // 外圈水不聚片
});

test('逻辑阶差：平地 0 条；中央抬 2 层 → 8 条阶差边、立面 16（边长1×高差2×层高1）', () => {
  const flat = stepDropArea(worldOf(ALL1(5)));
  assert.equal(flat.edges, 0); assert.equal(flat.area, 0);

  const s = stepDropArea(worldOf(twoStep()));
  assert.equal(s.edges, 8); // 2×2 块 8 条边全部朝 1 层邻居
  assert.equal(s.land, 8); assert.equal(s.shore, 0);
  assert.equal(s.length, 8); assert.equal(s.area, 16);
  assert.deepEqual(s.byDrop, { 2: 8 });
  assert.equal(s.steps.filter((x) => x.shore).length, 0);

  // minStep = 1 时朝外海的 1 层落差也算进来（岸）；minStep = 3 时中央块 Δ=2 不算
  const s1 = stepDropArea(worldOf(twoStep()), { minStep: 1 });
  assert.equal(s1.edges, 8 + 20); // 8 条陆地阶差 + 5×5 外圈 1 层岸 20 条
  assert.equal(s1.shore, 20);
  const s3 = stepDropArea(worldOf(twoStep()), { minStep: 3 });
  assert.equal(s3.edges, 0);
  assert.throws(() => stepDropArea(worldOf(ALL1(2)), { minStep: 0 }), /minStep/);
  assert.throws(() => stepDropArea(worldOf(ALL1(2)), { levelHeight: 0 }), /level height/);
});

test('top 含建筑、ground 只看岩石地表：同一根柱子两个读法', () => {
  const h = ALL1(3), w = worldOf(h);
  const mid = w.grid.cells[4]; w.setSolid(mid, 2, true); w.setSolid(mid, 3, true); // 岩石柱顶上加 2 层非岩石（建筑）：top=3、ground=1
  assert.equal(w.top(mid), 3); assert.equal(w.ground(mid), 1);
  assert.equal(plateauRuns(w, { height: 'top' }).count, 2);
  assert.equal(plateauRuns(w, { height: 'ground' }).count, 1);
  assert.equal(stepDropArea(w, { height: 'top' }).edges, 4);
  assert.equal(stepDropArea(w, { height: 'ground' }).edges, 0);
  assert.throws(() => plateauRuns(w, { height: 'ceil' }), /height/);
});

test('既有量化保留：terraceProfile 的 patches（ground 分片）不受新函数影响；World 不被改', () => {
  const w = worldOf(twoStep()); const before = JSON.stringify(w.snapshot());
  const p0 = terraceProfile(w), r0 = plateauRuns(w), s0 = stepDropArea(w);
  assert.equal(p0.patches.length, 2); // ground 分片还是 2 片
  assert.deepEqual(plateauRuns(w), r0); assert.deepEqual(stepDropArea(w), s0);
  assert.equal(JSON.stringify(w.snapshot()), before, '诊断必须只读');
});

test('能力 scene.plateau-diag：契约 meta 齐（line / modules / requires），管线里能跑、能验证', () => {
  const cap = describeLightLifeCapabilities().find((c) => c.id === 'scene.plateau-diag');
  assert.ok(cap, '能力没登记'); assert.equal(cap.line, 'grid'); assert.equal(cap.domain, 'lightlife'); assert.equal(cap.executable, true);
  assert.deepEqual(cap.requires, []); assert.ok(cap.modules.includes('src/core/terrace-profile.js') && cap.modules.includes('src/core/world.js'));

  // 合成 site：6×6 采样，内圈 4×4 陆地 1 层、中央 2×2 抬 3 层（L = 1 m/层）
  const n = 6, h = new Array(36).fill(0), kind = new Array(36).fill(0), col = new Array(36).fill('#7aa65a');
  for (let j = 1; j <= 4; j++) for (let i = 1; i <= 4; i++) { h[j * 6 + i] = 1; kind[j * 6 + i] = 1; }
  for (const [i, j] of [[2, 2], [3, 2], [2, 3], [3, 3]]) h[j * 6 + i] = 3;
  const site = { scene: { id: 'plateau-t', label: '台地样例' }, source: 'test', n, step: 1, L: 1, x0: 0, z0: 0, h, kind, col, flora: {}, seed: 1 };
  assert.ok(matchAll(site).find((r) => r.id === 'scene.plateau-diag' && r.count > 0));

  const report = runPlan(site, [{ id: 'scene.plateau-diag' }]);
  assert.equal(report[0].status, 'applied'); assert.equal(report[0].line, 'grid');
  const q = site.plan.plateau;
  assert.equal(q.runs, 2); assert.equal(q.landCells, 16); assert.deepEqual(q.levels, { 1: 1, 3: 1 });
  assert.equal(q.steps.edges, 8); assert.equal(q.steps.land, 8); assert.equal(q.steps.shore, 0);
  assert.equal(q.steps.area, 16); assert.equal(site.plan.persist, false);

  const v = verifyLightLife(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) });
  assert.equal(v.status, 'pass', v.summary);
  const pc = v.checks.find((c) => c.id === 'plateau'); assert.ok(pc && pc.status === 'pass');
  // 破坏候选 → 复算必须红
  site.plan.plateau.runs = 99;
  const v2 = verifyLightLife(site, site.plan, { steps: report.map((r) => ({ id: r.id, params: r.params })) });
  assert.equal(v2.checks.find((c) => c.id === 'plateau').status, 'fail');
});

test('能力只读：rock=1 时按岩石地表分片，世界 / 高度场不被改', () => {
  const n = 4, h = new Array(16).fill(0), kind = new Array(16).fill(0), col = new Array(16).fill('#7aa65a');
  for (let j = 1; j <= 2; j++) for (let i = 1; i <= 2; i++) { h[j * 4 + i] = 1; kind[j * 4 + i] = 1; }
  h[2 * 4 + 2] = 3; kind[2 * 4 + 2] = 2; // 一格房子：top 3 层、ground 1 层
  const site = { scene: { id: 'plateau-r', label: '岩面样例' }, source: 'test', n, step: 1, L: 1, x0: 0, z0: 0, h, kind, col, flora: {}, seed: 1 };
  const report = runPlan(site, [{ id: 'scene.plateau-diag', params: { rock: 1 } }]);
  assert.equal(report[0].status, 'applied');
  assert.equal(site.plan.plateau.height, 'ground'); assert.equal(site.plan.plateau.runs, 1); // 岩面一整片
  assert.deepEqual(site.h.slice(0, 16), h, '高度场不该被动');
});
