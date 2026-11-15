// 第 56 批 C03 · 793545297376972801：多格 WFC 解写进共享 World（之后外观走共享建筑管线），实心体素一一对应、拱下仍空、垫岩台。
import assert from 'node:assert/strict';
import { World } from '../src/core/world.js';
import { solveMultitile } from '../src/build/multitile-wfc.js';
import { multitileIntoWorld, meanCellSpacing } from '../src/build/multitile-world.js';
const N = 12, cells = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const id = j * N + i; cells.push({ id, n: 4, cx: i - 5.5, cz: j - 5.5, pts: [], edgeNeighbors: [j > 0 ? id - N : -1, i < N - 1 ? id + 1 : -1, j < N - 1 ? id + N : -1, i > 0 ? id - 1 : -1] }); }
const index = { cellAt(x, z) { const i = Math.round(x + 5.5), j = Math.round(z + 5.5); return i >= 0 && i < N && j >= 0 && j < N ? cells[j * N + i] : null; } };
const world = new World({ cells });
assert.ok(Math.abs(meanCellSpacing(world) - 1) < 1e-9);
for (const seed of [1, 3]) {
  const res = solveMultitile({ size: [5, 8, 5], seed }); assert.ok(res.ok);
  const r = multitileIntoWorld(res, world, index, { center: { x: 0, z: 0 } });
  assert.equal(r.cells, 25); assert.equal(r.skipped, 0); assert.equal(r.voxels, res.stats.solid, '实心体素一一对应');
  let built = 0, archGaps = 0;
  for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) {
    const c = index.cellAt(x - 2, z - 2);
    assert.ok(world.isRock(c, 1), '岩台');
    for (let y = 0; y < 8; y++) { const s = res.solid[res.idx(x, y, z)]; assert.equal(!!world.isBuilt(c, 2 + y), !!s); if (s) built++; if (!s && y > 0 && [...Array(8 - y - 1)].some((_, k) => res.solid[res.idx(x, y + 1 + k, z)])) archGaps++; }
  }
  assert.equal(built, res.stats.solid); assert.ok(archGaps > 0, '有悬空（拱下 / 挑台下）—— 共享建筑管线会画成拱洞底面');
  // 外圈垫岩
  assert.ok(world.isRock(index.cellAt(-3, 0), 1) && !world.isSolid(index.cellAt(-4, 0), 1));
  console.log('PASS multitile→World seed', seed, JSON.stringify({ voxels: r.voxels, multi: res.stats.multi, archGaps }));
}
assert.throws(() => multitileIntoWorld(solveMultitile({ size: [3, 12, 3], seed: 1 }), world, index), RangeError);
