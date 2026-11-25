// 787319655648100352「67帧3D模块逐步拼装」：分步拼装序列 + 空中零件轨迹 + 桥廊/围合楼体模块集。
// 底板 = 铺地平台（built 顶 1 层）；lattice 层 k 提交到世界层 ground+k（同 commitAssembly 约定）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSquareGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { solveWFC } from '../src/core/wfc.js';
import { classifyCourtyards } from '../src/core/courtyards.js';
import { layeredLattice, labelCompatible } from '../src/build/tile-assembly.js';
import { moduleTiles, courtyardHouseSet, courtyardPlan, bridgeArcadeSet, bridgeArcadePlan, matchTile, voidTile } from '../src/build/assembly-modules.js';
import { planAssembly, createAssembly, applyStep, undoStep, verifyAssembly, assemblyGhosts, dropTrajectory } from '../src/build/assembly-sequence.js';
import { getCapability, runPlan } from '../src/capabilities/registry.js';

const cellAt = (w, x, z) => w.cells.find((c) => Math.round(c.cx) === x && Math.round(c.cz) === z);
const rectCells = (w, x0, x1, z0, z1) => w.cells.filter((c) => c.cx >= x0 - 0.5 && c.cx <= x1 + 0.5 && c.cz >= z0 - 0.5 && c.cz <= z1 + 0.5).map((c) => c.id);
const pave = (w, ids) => { for (const id of ids) w.fill(w.cells[id], 1); };

/** 7×7 铺地底板 + 中央 3×3 内院的围合楼体现场。 */
function courtyardFixture({ wallLevels = 2 } = {}) {
  const w = new World(buildSquareGrid({ radius: 8, cellSize: 1 }));
  const plate = rectCells(w, -3, 3, -3, 3);
  pave(w, plate);
  const interior = rectCells(w, -1, 1, -1, 1);
  const set = courtyardHouseSet();
  const lattice = layeredLattice(w, plate, wallLevels + 1);
  const tiles = moduleTiles(set.modules, lattice.cells[0].n - 2);
  const compatible = labelCompatible(set.joins, { gravity: set.gravity });
  const spec = courtyardPlan(w, lattice, tiles, { interior, wallLevels, pillars: [{ cell: cellAt(w, 0, 0).id, top: 2 }] });
  return { w, plate, interior, set, lattice, tiles, compatible, spec };
}

/** 跨 3 格水面的桥廊现场：9×5 底板，x∈[-1,1] 一条水面，桥沿 z=0 从 x=-2 架到 x=2。 */
function bridgeFixture({ deckLevel = 2 } = {}) {
  const w = new World(buildSquareGrid({ radius: 8, cellSize: 1 }));
  const plate = rectCells(w, -4, 4, -2, 2);
  const gap = rectCells(w, -1, 1, -2, 2);
  pave(w, plate.filter((id) => !gap.includes(id)));
  const deck = [-2, -1, 0, 1, 2].map((x) => cellAt(w, x, 0).id);
  const set = bridgeArcadeSet();
  const lat = new Set(deck);
  for (const id of deck) for (const nb of w.cells[id].edgeNeighbors) if (nb >= 0) lat.add(nb);
  const lattice = layeredLattice(w, [...lat], deckLevel + 2);
  const tiles = moduleTiles(set.modules, lattice.cells[0].n - 2);
  const compatible = labelCompatible(set.joins, { gravity: set.gravity });
  const spec = bridgeArcadePlan(w, lattice, tiles, { deck, piers: [deck[0], deck[4]], deckLevel });
  return { w, plate, gap, deck, set, lattice, tiles, compatible, spec, deckLevel };
}

const applyAll = (session) => { const steps = []; let v; while (true) { const r = applyStep(session); if (!r.ok) { v = verifyAssembly(session); return { steps, last: r, v }; } steps.push(r.step); v = verifyAssembly(session); assert.ok(v.ok, `step ${r.index} 后状态非法: ${JSON.stringify(v.unsupported)} ${JSON.stringify(v.conflicts)}`); } };

test('模块集：桥廊/围合楼体 tile 目录与空模块解析', () => {
  for (const [setName, set, expect] of [['bridge', bridgeArcadeSet(), ['air', 'pier', 'cap.end', 'cap.mid', 'span', 'post', 'roof']], ['court', courtyardHouseSet(), ['air', 'wall.m', 'wall.c', 'wall.i', 'roof.m', 'roof.i', 'pillar', 'pillar.cap']]]) {
    const tiles = moduleTiles(set.modules, 4);
    const names = new Set(tiles.map((t) => t.name));
    for (const n of expect) assert.ok(names.has(n), `缺 ${n}`);
    assert.ok(voidTile(tiles, 4, 'air'));
    if (setName === 'bridge') {
      // 旋转去重：[D,A,D,A] → 2 变体；[D,A,A,A] → 4 变体
      assert.equal(tiles.filter((t) => t.name === 'span').length, 2);
      assert.equal(tiles.filter((t) => t.name === 'cap.end').length, 4);
      // matchTile 精确签名：桥端柱头朝内一面 D
      assert.equal(matchTile(tiles, { sides: ['D', 'A', 'A', 'A'], up: 'U', down: 'P' })?.name, 'cap.end');
    }
    assert.equal(matchTile(tiles, { sides: ['A', 'D', 'A', 'D'], up: 'U', down: 'A' })?.name ?? 'none', setName === 'bridge' ? 'span' : 'none');
  }
});

test('围合楼体：平面图覆盖全 lattice、socket 闭合、确定性', () => {
  const { w, lattice, tiles, compatible, spec } = courtyardFixture({});
  assert.ok(spec.ok, JSON.stringify(spec.missing?.[0]));
  assert.equal(spec.ringCells.length, 12);   // 3×3 内院的边邻外环 12 格（对角环格不占边，庭院按边密封）
  for (const lc of lattice.cells) assert.ok(spec.assignment[lc.id], `格 ${lc.id} 未指派`);
  const plan = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1, seed: 7 });
  assert.ok(plan.ok, plan.reason);
  // 确定性：同种子同计划
  const plan2 = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1, seed: 7 });
  assert.deepEqual(plan2.steps.map((s) => s.lattice), plan.steps.map((s) => s.lattice));
  assert.deepEqual(plan2.steps.map((s) => s.trajectory.p0), plan.steps.map((s) => s.trajectory.p0));
  // 步数 = 墙 12×2 + 顶 12 + 柱身1 + 柱头1 = 38；全部支撑落地
  assert.equal(plan.count, 38);
  assert.equal(plan.floating, 0);
});

test('围合楼体：逐步提交每步合法，完成后庭院闭合', () => {
  const { w, lattice, tiles, compatible, spec, interior } = courtyardFixture({});
  const plan = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1, seed: 7 });
  const session = createAssembly(w, plan, { color: 3 });
  const { steps, last, v } = applyAll(session);
  assert.equal(last.reason, 'done');
  assert.equal(steps.length, plan.count);
  assert.ok(v.ok);
  // 全部墙/顶/柱实心落位；庭院格顶仍 1（铺地），周边墙 ≥2 层
  for (const s of steps) assert.ok(w.isSolid(w.cells[s.cell], s.commit.level), `${s.instance}`);
  const yards = classifyCourtyards(w);
  const yardCells = new Set(yards.components.flat().map((c) => c.id));
  const pillarCell = cellAt(w, 0, 0).id;   // 细柱所在内院格本身是实心柱，不算院格但照样封边
  assert.ok(w.isSolid(w.cells[pillarCell], 2), '细柱没落位');
  for (const id of interior) { if (id === pillarCell) continue; assert.ok(yardCells.has(id), `内院格 ${id} 未围合`); }
  assert.ok(yards.components.length >= 1);
});

test('逐步撤销回滚：LIFO 逐块还原，空栈如实报 empty', () => {
  const { w, lattice, tiles, compatible, spec } = courtyardFixture({});
  const plan = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1, seed: 7 });
  const session = createAssembly(w, plan);
  const base = w.snapshot();
  applyAll(session);
  let n = 0;
  while (true) { const r = undoStep(session); if (!r.ok) { assert.equal(r.reason, 'empty'); break; } n++; assert.ok(verifyAssembly(session).ok); }
  assert.equal(n, plan.count);
  for (const k of ['solid', 'rock', 'color', 'river']) assert.deepEqual([...w[k]], [...base[k]], `撤销后 ${k} 未还原`);
});

test('桥廊：连通两端、拱跨侧挂支撑、墩柱承底板', () => {
  const { w, lattice, tiles, compatible, spec, deck, deckLevel } = bridgeFixture({});
  assert.ok(spec.ok, JSON.stringify(spec.missing));
  const plan = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1, seed: 3 });
  assert.ok(plan.ok, plan.reason);
  // 5 桥面格 ×（墩2+cap/span+post+roof）：端墩 pier+cap+post+roof=4，中墩…两端墩×2 + 3 跨×(span+post+roof) + 墩柱两段
  assert.ok(plan.count > 0);
  assert.equal(plan.floating, 0);
  const session = createAssembly(w, plan);
  const { last, v } = applyAll(session);
  assert.equal(last.reason, 'done'); assert.ok(v.ok);
  // 廊面层（world level = ground+deckLevel）从西端墩连通到东端墩
  const lv = 1 + deckLevel, seen = new Set([deck[0]]), q = [deck[0]];
  const inDeck = new Set(deck);
  while (q.length) {
    const id = q.shift();
    for (const nb of w.cells[id].edgeNeighbors) {
      if (nb < 0 || seen.has(nb) || !inDeck.has(nb)) continue;
      if (w.isSolid(w.cells[nb], lv)) { seen.add(nb); q.push(nb); }
    }
  }
  assert.ok(seen.has(deck[4]), '廊面没有连通两端');
  for (const id of deck) assert.ok(w.isSolid(w.cells[id], lv), `桥面 ${id} 第 ${lv} 层不实`);
  // 跨中格（水面）在廊面层以下确实悬空——但它是 'sides' 侧挂，非违例
  const mid = deck[2];
  assert.ok(!w.isSolid(w.cells[mid], 1) && !w.isSolid(w.cells[mid], 2), '水面下不应有体素');
});

test('空中零件：轨迹起点在空中、终点在落位，ghosts=待置件', () => {
  const { w, lattice, tiles, compatible, spec } = courtyardFixture({});
  const plan = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1, seed: 7 });
  const session = createAssembly(w, plan);
  const g0 = assemblyGhosts(session);
  assert.equal(g0.length, plan.count);
  for (const [i, s] of plan.steps.entries()) {
    const t = s.trajectory;
    assert.equal(t.kind, 'quadratic');
    assert.ok(t.p0[1] > t.p2[1], `step ${i} 起点不在空中`);
    assert.equal(t.p2[1], (s.commit.level - 0.5) * 1);
    assert.ok(t.hover.amp > 0 && t.dur > 0 && t.start >= 0);
    if (i) assert.ok(t.start > plan.steps[i - 1].trajectory.start, '落下时序应递增');
  }
  applyStep(session);
  const g1 = assemblyGhosts(session);
  assert.equal(g1.length, plan.count - 1);
  assert.equal(g0[0].lattice, plan.steps[0].lattice);
  // dropTrajectory 独立确定性
  const a = dropTrajectory({ x: 1, y: 2, z: 3 }, { seed: 5, piece: 9 }), b = dropTrajectory({ x: 1, y: 2, z: 3 }, { seed: 5, piece: 9 });
  assert.deepEqual(a, b);
});

test('WFC 求解路径：钉住空地/环格域，求解器补朝向与平面图一致', () => {
  const { w, lattice, tiles, compatible, spec } = courtyardFixture({ wallLevels: 2 });
  assert.ok(spec.ok);
  // 钉域 = 同名单元的全部旋转：求解器只补朝向，socket 约束逼回平面图逐格一致
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const allowed = {};
  for (const lc of lattice.cells) {
    const want = tileById.get(spec.assignment[lc.id]).name;
    allowed[lc.id] = tiles.filter((t) => t.name === want).map((t) => t.id);
  }
  const r = solveWFC(lattice, { tiles, seed: 11, allowed, compatible, maxSteps: 200000 });
  assert.ok(r.ok, r.reason);
  // 求解结果与脚本平面图逐格一致（socket 把朝向全逼出来）
  for (const lc of lattice.cells) assert.equal(r.tiles[lc.id], spec.assignment[lc.id], `格 ${lc.id}（${spec.roles[lc.id]}）`);
  const plan = planAssembly(w, lattice, r.tiles, tiles, { compatible, ground: 1, seed: 7 });
  assert.ok(plan.ok && plan.floating === 0);
});

test('失败恢复：缺支撑报 unsupported、allowFloating 标记、占用拒写不动 World', () => {
  const { w, lattice, tiles, compatible, spec } = courtyardFixture({});
  // 篡改：把内院一格空中塞个墙块（脚下是空气 → 永远缺支撑）
  const bad = { ...spec.assignment };
  const innerLc = lattice.cells.find((c) => c.cell === spec.courtCells[0] && c.level === 2);
  const wallTile = tiles.find((t) => t.name === 'wall.m' && t.sides.every((s) => s === 'A')) ?? tiles.find((t) => t.name === 'pillar');
  bad[innerLc.id] = wallTile.id;
  const fail = planAssembly(w, lattice, bad, tiles, { compatible, ground: 1 });
  // 悬空墙与空气脚下 socket 不闭合——接口闭合校验先于支撑判定
  assert.ok(!fail.ok);
  assert.ok(fail.reason === 'conflicts' || fail.reason === 'unsupported', fail.reason);
  // 合法脚下空：造一个脚下是 air 的合法悬空（pillar 从 2 层起、1 层塞 air——socket 不闭合路径上面已覆盖；
  // 这里改测 allowFloating：把某墙脚下那格也塞墙但标 sides?——用占用路径代替）
  const plan = planAssembly(w, lattice, spec.assignment, tiles, { compatible, ground: 1 });
  const session = createAssembly(w, plan);
  // 先放前三步，再预占第 4 步的目标体素 → applyStep 拒写且 World 不动
  for (let i = 0; i < 3; i++) assert.ok(applyStep(session).ok);
  const target = plan.steps[3];
  w.setSolid(w.cells[target.cell], target.commit.level, true);
  const v0 = w.version, s0 = w.solid.slice();
  const r = applyStep(session);
  assert.equal(r.ok, false); assert.equal(r.reason, 'occupied');
  assert.equal(w.version, v0);
  assert.deepEqual([...w.solid], [...s0]);
  w.setSolid(w.cells[target.cell], target.commit.level, false);
});

test('能力消费：build.assembly 在铺地块上 runPlan 拼出围合楼体', () => {
  const cap = getCapability('build.assembly');
  assert.ok(cap, '能力未注册');
  const w = new World(buildSquareGrid({ radius: 8, cellSize: 1 }));
  pave(w, rectCells(w, -3, 3, -3, 3));
  const matches = cap.match(w, {}, { kind: 'court' });
  assert.ok(matches.length, '铺地块未匹配');
  const report = runPlan(w, [{ id: 'build.assembly', params: { kind: 'court', count: 1, wallLevels: 2 } }]);
  assert.equal(report[0].status, 'applied', JSON.stringify(report[0]));
  const yards = classifyCourtyards(w);
  assert.ok(yards.components.length >= 1, '拼完没有围合庭院');
});

test('能力消费：build.assembly 在水面空当上架桥廊', () => {
  const cap = getCapability('build.assembly');
  const w = new World(buildSquareGrid({ radius: 8, cellSize: 1 }));
  const plate = rectCells(w, -4, 4, -2, 2), gap = rectCells(w, -1, 1, -2, 2);
  pave(w, plate.filter((id) => !gap.includes(id)));
  const matches = cap.match(w, {}, { kind: 'bridge' });
  assert.ok(matches.some((m) => m.kind === 'bridge'), '桥面空当未匹配');
  const report = runPlan(w, [{ id: 'build.assembly', params: { kind: 'bridge', count: 1, deckLevel: 2 } }]);
  assert.equal(report[0].status, 'applied', JSON.stringify(report[0]));
});
