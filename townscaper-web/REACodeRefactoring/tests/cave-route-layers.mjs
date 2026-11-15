// 906416813810049025 / 890611046435627008（第 50 轮，对照 REACode src/cavepath.js）：同一条路线在平面图上重合、在立面上分成两条——
// 「穿洞」和「翻越」必须带层号。共享 World + 分层导航（world/battle-navigation.js）：厚板下开洞（洞底 1 层、板顶 4 层），
// 穿洞路线逐格保持 1 层，翻越路线经台阶上到 4 层；按单值高度场（world.top）摆放会把穿洞路线整段抬到板顶上 3 层（REACode 实测的那个错）。
import assert from 'node:assert/strict';
import { World } from '../src/core/world.js';
import { BattleNavigation } from '../src/world/battle-navigation.js';
const n = 8, cells = Array.from({ length: n }, (_, id) => ({ id, n: 4, cx: id, cz: 0, pts: [{ x: id - .5, z: -.5 }, { x: id + .5, z: -.5 }, { x: id + .5, z: .5 }, { x: id - .5, z: .5 }], edgeNeighbors: [-1, id < n - 1 ? id + 1 : -1, -1, id > 0 ? id - 1 : -1] }));
const w = new World({ cells }); const L = .5;
for (const c of cells) w.fill(c, 1, { rock: true });
for (const id of [2, 3, 4]) { w.setSolid(cells[id], 3, true, { rock: true }); w.setSolid(cells[id], 4, true, { rock: true }); }   // 厚板：洞高 1 层（2 层空），板厚 2 层
w.fill(cells[5], 3, { rock: true }); w.fill(cells[6], 2, { rock: true });   // 右侧台阶 1→2→3→板顶 4
const index = { cellAt(x, z) { return Math.abs(z) <= .5 ? cells.find((c) => Math.abs(x - c.cx) <= .5) ?? null : null; } };
const nav = new BattleNavigation(w, index, { levelHeight: L });
const walk = (startCell, startFloor, goalCell, goalFloor) => {
  const u = { x: startCell.cx, z: 0, y: startFloor * L, navFloor: startFloor }, route = [[startCell.id, startFloor]];
  for (let k = 0; k < 40; k++) { const p = nav.plan(u, goalCell, goalFloor); assert.ok(p, '可达'); if (p.arrived) break; u.x = p.next.cell.cx; u.y = p.next.floor * L; u.navFloor = p.next.floor; route.push([p.next.cell.id, p.next.floor]); }
  return route;
};
const tunnel = walk(cells[0], 1, cells[3], 1), over = walk(cells[7], 1, cells[3], 4);
assert.deepEqual(tunnel.map(([, f]) => f), tunnel.map(() => 1), '穿洞路线全程 1 层');
assert.ok(over.some(([id, f]) => id === 3 && f === 4) && over.some(([id, f]) => id === 4 && f === 4), '翻越路线在板顶 4 层');
const shared = tunnel.filter(([id]) => over.some(([j]) => j === id)).map(([id]) => id);
assert.ok(shared.includes(3), '两条路线在平面上重合（格 3：一条在洞底、一条在板顶）');
const naive = tunnel.map(([id, f]) => (w.top(cells[id]) - f) * L), maxErr = Math.max(...naive);
assert.ok(Math.abs(maxErr - 3 * L) < 1e-9, `按单值高度场摆放，穿洞段被抬到板顶（误差 ${maxErr} = 3 层）`);
console.log('PASS 穿洞 / 翻越：路线点带层号；单值高度场会把穿洞路线抬 3 层', JSON.stringify({ tunnel, over, naiveErr: maxErr }));
