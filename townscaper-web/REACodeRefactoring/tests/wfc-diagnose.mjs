// 1164926304640229376（第 50 轮，迁自 REACode src/socketrock.js）：「某类 tile 一块都不出现」= tile 集在接口上不闭合 → 传播里整类被消掉。
// 共享混合 / 四边形网格上：① 接口 9 没有任何 tile 能接 → 该 tile 死、报 unpairedSockets；② 「只能和自己接」的 tile 在边界锁住时死、
// 不锁时活（原版 A/B 变体）；③ 给它补一块过渡 tile（一侧 1、其余 0）后边界锁住也活（原版 C 变体），且真求解能放下它。
import assert from 'node:assert/strict';
import { diagnoseTiles, solveWFC } from '../src/core/wfc.js';
import { buildMixedGrid, buildQuadGrid } from '../src/core/grid.js';
const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 3, seed: 4 })], ['mixed', buildMixedGrid({ radius: 4, seed: 4 })]]) {
  const sizes = [...new Set(grid.cells.map((c) => c.n))];
  const T = (id, f) => sizes.map((n) => ({ id: `${id}${n}`, edges: Array.from({ length: n }, (_, e) => f(e, n)) }));
  const grass = T('grass', () => 0), rock = T('rock', () => 1), orphan = T('orphan', (e) => (e === 0 ? 9 : 0));
  // ① 接口 9 只能接 8（「公母接口」），而集里没有 8 → 无人接
  const plug = (a, b) => (a === 9 || b === 9 ? a + b === 17 : a === b);
  const d1 = diagnoseTiles(grid, { tiles: [...grass, ...orphan], compatible: plug, boundary: 0 });   // 外沿也锁 0（否则接口落在外沿的那几格不受约束）
  assert.ok(orphan.every((t) => d1.dead.includes(t.id)), `${name} 孤立接口 tile 死`); assert.ok(d1.unpairedSockets.some((u) => u.socket === 9), '报出没人接的接口');
  // ② rock 只能接 rock：边界锁 0 → 死；不锁 → 活（满铺岩石）
  const d2 = diagnoseTiles(grid, { tiles: [...grass, ...rock], boundary: 0 }), d2b = diagnoseTiles(grid, { tiles: [...grass, ...rock] });
  assert.ok(rock.every((t) => d2.dead.includes(t.id)), `${name} 边界锁 0 时岩石死`); assert.ok(rock.every((t) => !d2b.dead.includes(t.id)), `${name} 不锁时岩石活`);
  // ③ 补过渡（一侧 1、其余 0；所有旋转）→ 锁 0 也活，真求解能出现岩石
  const cap = sizes.flatMap((n) => Array.from({ length: n }, (_, k) => ({ id: `cap${n}-${k}`, edges: Array.from({ length: n }, (_, e) => (e === k ? 1 : 0)) })));
  const tiles3 = [...grass, ...rock, ...cap], d3 = diagnoseTiles(grid, { tiles: tiles3, boundary: 0 });
  assert.equal(d3.dead.filter((id) => id.startsWith('rock')).length, 0, `${name} 补过渡后锁边界岩石也活`);
  const pinRock = grid.cells.find((c) => c.edgeNeighbors.every((x) => x >= 0) && c.n === 4) || grid.cells.find((c) => c.edgeNeighbors.every((x) => x >= 0));
  const s = solveWFC(grid, { tiles: tiles3, seed: 3, pins: { [pinRock.id]: `rock${pinRock.n}` } });
  assert.ok(s.ok, `${name} 钉一格岩石能解`);
  out[name] = { dead1: d1.dead.length, deadRockLocked: d2.dead.length, aliveRockCap: Object.entries(d3.alive).filter(([k]) => k.startsWith('rock')).map(([, v]) => v) };
}
console.log('PASS tile 集闭合诊断：孤立接口、边界锁 / 不锁、补过渡后可放', JSON.stringify(out));
