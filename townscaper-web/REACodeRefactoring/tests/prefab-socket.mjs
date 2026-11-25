// R54 / R55（TigerMessenger 构筑枝）：多格 prefab / socket + 联合 WFC（src/build/prefab-socket.js，底下是 core/wfc.js solveWFC）。
// 1579483114178768898 + 1751932427272909032。合成台地岛：外圈海、两级台地、一块已有建筑、一条轨道。
import assert from 'node:assert/strict';
import { PREFAB_LIBRARY, DIRS, validateLibrary, rotatePrefab, prefabTiles, fillTiles, socketCompatible, latticeFromField, chooseWindow, buildJointProblem, solveJointLayout, validateLayout, relayout, layoutProbeCells } from '../src/build/prefab-socket.js';

function field({ n = 61, step = 3 } = {}) {
  const half = (n - 1) * step / 2, N = n * n, h = new Array(N), cls = new Array(N).fill(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i * step - half, z = j * step - half, r = Math.hypot(x, z); h[j * n + i] = r > half * 0.92 ? 0 : Math.round((4 + 0.03 * x + (r < half * 0.35 ? 6 : 0)) * 100) / 100; }
  for (let j = 27; j <= 33; j++) for (let i = 8; i <= 13; i++) cls[j * n + i] = 1;
  for (let i = 6; i <= 54; i++) cls[47 * n + i] = 2;
  return { n, step, half, h, cls, sea: 0.3 };
}
// ① 库：连通、门在外边、转向后门跟着转
assert.ok(validateLibrary().ok, JSON.stringify(validateLibrary()));
assert.equal(validateLibrary([{ id: 'bad', cells: [[0, 0], [2, 0]], door: [0, 1], stories: 1 }]).ok, false, '不连通的足迹必须被拒');
assert.equal(validateLibrary([{ id: 'bad', cells: [[0, 0], [1, 0]], door: [0, 0], stories: 1 }]).ok, false, '门朝着自己另一格必须被拒');
const hall = PREFAB_LIBRARY.find((p) => p.id === 'hall'), r1 = rotatePrefab(hall, 1);
assert.deepEqual(r1.cells, [[0, 0], [0, 1]]); assert.equal(r1.door[1], (hall.door[1] + 1) % 4);
// ② 部件 tile：内部边两侧标签相同，且只和自己相容；外边恰好一扇门
const { tiles, variants } = prefabTiles();
const byId = new Map(tiles.map((t) => [t.id, t]));
for (const v of variants) {
  const idx = new Map(v.cells.map(([x, y], i) => [x + ',' + y, i])); let doors = 0;
  v.cells.forEach(([x, y], i) => { const t = byId.get(`pf:${v.id}:${v.rot}:${i}`); DIRS.forEach(([dx, dy], e) => { const j = idx.get((x + dx) + ',' + (y + dy)); if (j === undefined) { if (t.edges[e] === 'door') doors++; return; } const u = byId.get(`pf:${v.id}:${v.rot}:${j}`); assert.equal(t.edges[e], u.edges[(e + 2) % 4], 'pair label mismatch ' + v.id); assert.ok(socketCompatible(t.edges[e], u.edges[(e + 2) % 4])); assert.ok(!socketCompatible(t.edges[e], 'g')); }); });
  assert.equal(doors, 1, v.id + ' 应该恰好一扇门');
}
for (const a of ['r', 'g', 'w', 'door', 'k', 'x']) for (const b of ['r', 'g', 'w', 'door', 'k', 'x']) assert.equal(socketCompatible(a, b), socketCompatible(b, a), 'socket 表要对称 ' + a + b);
assert.ok(socketCompatible('door', 'r') && !socketCompatible('door', 'g') && !socketCompatible('r', 'x'));
assert.equal(fillTiles().filter((t) => t.id.startsWith('road:')).length, 15);
// ③ 建筑格：老城 / 轨道 / 海 / 太陡都标出来
const F = field(), L = latticeFromField(F);
const cnt = (r) => [...L.reason].filter((x) => x === r).length;
assert.ok(cnt(0) > 100 && cnt(1) > 0 && cnt(2) > 0 && cnt(3) > 0 && cnt(4) > 0, JSON.stringify([0, 1, 2, 3, 4, 5].map(cnt)));
const win = chooseWindow(L, 16), prob = buildJointProblem(L, win);
assert.ok(prob.feasibleParts > 0);
for (const c of prob.grid.cells) { const r = L.reason[c.J * L.W + c.I]; if (r === 1) assert.deepEqual(prob.allowed[c.id], ['keep']); if (r === 2 || r === 3 || r === 4) assert.deepEqual(prob.allowed[c.id], ['rim']); }
// ④ 联合 WFC：解得出、≥3 栋、独立验证全过、确定性
const a = solveJointLayout(F, { seed: 7, minBuildings: 3 });
assert.ok(a.ok, a.reason);
assert.ok(a.layout.placements.length >= 3, 'buildings ' + a.layout.placements.length);
const va = validateLayout(F, a.layout, { minBuildings: 3 });
assert.ok(va.ok, JSON.stringify(va.checks.filter((c) => c.status === 'fail')));
assert.equal(JSON.stringify(solveJointLayout(F, { seed: 7, minBuildings: 3 }).layout), JSON.stringify(a.layout), '同种子必须同结果');
for (const p of a.layout.placements) { const fp = layoutProbeCells({ ...a.layout, placements: [p], roads: [] }, F.n).building; assert.ok(fp.every((q) => F.cls[q] === 0 && F.h[q] > 0.3), '建筑落在已有建筑 / 轨道 / 海上'); }
// ⑤ 破坏判失败：把一栋挪到老城上；删掉门外的路
const moved = structuredClone(a.layout), p0 = moved.placements[0], dI = 5 - p0.anchor[0], dJ = 15 - p0.anchor[1];   // 已有建筑在采样格 i 8..13 / j 27..33 = 建筑格 I 4..6 / J 13..16
p0.anchor = [p0.anchor[0] + dI, p0.anchor[1] + dJ]; p0.cells = p0.cells.map(([I, J]) => [I + dI, J + dJ]); p0.door.cell = [p0.door.cell[0] + dI, p0.door.cell[1] + dJ];
assert.equal(validateLayout(F, moved).checks.find((c) => c.id === 'footprint').status, 'fail');
const noRoad = structuredClone(a.layout), d = noRoad.placements[0].door, out = [d.cell[0] + DIRS[d.dir][0], d.cell[1] + DIRS[d.dir][1]];
noRoad.roads = noRoad.roads.filter((r) => r.cell[0] !== out[0] || r.cell[1] !== out[1]);
assert.equal(validateLayout(F, noRoad).checks.find((c) => c.id === 'door').status, 'fail');
// ⑥ 整体替换：同一窗口、换种子、仍然全过
const b = relayout(F, a.layout, { seed: 8 });
assert.ok(b.ok, b.reason); assert.deepEqual(b.layout.window, a.layout.window);
assert.ok(validateLayout(F, b.layout).ok);
// ⑦ 没有可建地：如实失败，不抛
const sea = { ...F, h: F.h.map(() => 0) }, s0 = solveJointLayout(sea, { seed: 1 });
assert.equal(s0.ok, false); assert.match(s0.reason, /放下|太小/);
// ⑧ 多格实例身份：每栋有稳定 instance（prefab + 锚点），唯一；同种子重解 → 同 id 集（重生成一致性）
const ids = a.layout.placements.map((p) => p.instance);
assert.ok(ids.every((x) => /^pf:[a-z]+:\d+x\d+$/.test(x)), JSON.stringify(ids));
assert.equal(new Set(ids).size, ids.length, 'instance ids must be unique');
assert.deepEqual(solveJointLayout(F, { seed: 7, minBuildings: 3 }).layout.placements.map((p) => p.instance), ids);
console.log('prefab-socket ok', a.layout.placements.length, 'buildings', a.layout.roads.length, 'roads', 'seed', a.layout.seed);
