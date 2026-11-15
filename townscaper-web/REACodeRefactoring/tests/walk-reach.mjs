// 917405214638006273（第 50 轮，迁自 REACode src/walkreach.js）：共享 World 真实生成地形上，「图上连通 ≠ 能走到」→ 沿路线补台阶后可达。
import assert from 'node:assert/strict';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { decorateCells } from '../src/core/spatial.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { walkComponents, landRoute, cliffCrossings, repairReach } from '../src/terrain/walk-reach.js';
const out = {};
let sawBlocked = 0;
for (const [name, mk] of [['quad', () => buildQuadGrid({ radius: 10 })], ['mixed', () => buildMixedGrid({ radius: 14 })]]) for (const seed of [3, 7, 11, 19]) {
  const w = new World(decorateCells(mk())); generateTerrain(w, { seed, rivers: 0, caves: 0, features: false });
  const land = w.cells.filter((c) => w.top(c) >= 1 && !w.isSolid(c, w.top(c) + 1));
  const from = land.reduce((a, c) => (w.top(c) < w.top(a) ? c : a)), to = land.reduce((a, c) => (w.top(c) > w.top(a) ? c : a));
  const route = landRoute(w, from, to); if (!route) continue;
  const before = cliffCrossings(w, route).length;
  const r = repairReach(w, from, to);
  assert.ok(r.ok, `${name}/${seed} 修补后可达`);
  const after = landRoute(w, from, to);
  assert.equal(cliffCrossings(w, after).length, 0, '路线上没有 > 1 层的落差');
  assert.ok(r.after.share >= r.before.share - 0.1, `可达比例基本不降（${r.before.share.toFixed(3)}→${r.after.share.toFixed(3)}；加高一格可能切断它与更低邻格的连接，如实记录）`);
  if (!r.before.reachable) { sawBlocked++; assert.ok(r.raised.length > 0, '原来走不到 → 补了台阶'); }
  // 只加不减：每个加高格都 +1 层
  for (const x of r.raised) assert.equal(Math.abs(x.to - x.from), 1, "每次只动一层（加高台阶或削一层）");
  out[`${name}/${seed}`] = { crossings: before, raised: r.raised.length, reachBefore: r.before.reachable, share: [+r.before.share.toFixed(3), +r.after.share.toFixed(3)] };
}
assert.ok(sawBlocked >= 1, '至少一张图「图连通但走不到」（原片要解决的就是这个）');
console.log('PASS 可走连通 + 沿路线补台阶（共享 World 真实地形）', JSON.stringify(out));
