// 第 55 批 G5 tileplace（784847588893814785 / 787319655648100352）：加权熵进共享求解器 + 逐块拼装回放写进 World。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const T = await import('../src/build/tile-assembly.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const w = new F.World(F.grid('mixed')); generateTerrain(w, { seed: 7 });
const tally = { true: {}, false: {} }; let replays = 0; const sols = {};
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const weighted of [true, false]) {
  const site = T.assemblySite(w, { seed, size: 24, height: 3 }), r = T.solveAssembly(w, site, { tileset: T.TILESET_RUIN, seed, weighted });
  assert.ok(r.ok && !r.conflicts.length);
  const solid = r.lattice.cells.filter(c => r.byId.get(r.tiles[c.id]).solid).map(c => c.id);
  // 逐块顺序：每个实心块恰好一次；顺序来自 explain 记录（决定 / 传播到只剩 1 个候选）
  assert.deepEqual([...r.pieces.map(p => p.id)].sort((a, b) => a - b), solid.sort((a, b) => a - b));
  for (let i = 1; i < r.pieces.length; i++) assert.ok(r.pieces[i].decisions >= r.pieces[i - 1].decisions, 'pieces follow solver time');
  for (const c of r.lattice.cells) { const n = r.byId.get(r.tiles[c.id]).name; tally[weighted][n] = (tally[weighted][n] ?? 0) + 1; }
  sols[seed] = (sols[seed] ?? []).concat(JSON.stringify(r.tiles));
  // 回放进 World：前缀单调、来回拖动精确、终态 = 整批 commit
  const w2 = new F.World(F.grid('mixed')); for (const k of ['solid', 'rock', 'color', 'river']) w2[k].set(w[k]);
  const ref = new F.World(F.grid('mixed')); for (const k of ['solid', 'rock', 'color', 'river']) ref[k].set(w[k]); T.commitAssembly(ref, site, r);
  let prev = -1;
  for (const k of [0, 1, Math.floor(r.pieces.length / 2), r.pieces.length, 2, r.pieces.length]) {
    const a = T.applyAssemblyPrefix(w2, site, r, k, { by: 'piece' }); assert.ok(a.ok); assert.equal(a.voxels, k);
    for (const [i, p] of r.pieces.entries()) { const c = r.lattice.cells[p.id]; assert.equal(!!w2.isBuilt(w2.cells[c.cell], site.ground + c.level), i < k); }
    if (k === r.pieces.length) assert.deepEqual([...w2.solid], [...ref.solid], 'final replay = batch commit');
    prev = k;
  }
  // 幽灵：未定且候选里还有实心块的格，占比 ∈ (0,1]
  for (const s of r.steps) for (const [, share] of s.ghostCells) assert.ok(share > 0 && share <= 1);
  replays++;
}
// 加权熵真的改变了解（不是只换首选）；全体 tile 统计按名字记录在输出里（RUIN 约束强，名字占比主要由标签决定，
// 权重 → 频率的定量关系在 tests/wfc-weighted-3d.mjs 的无约束网格里测）
assert.ok(Object.values(sols).filter(([a, b]) => a !== b).length >= 4, 'weighted changes solutions');
console.log('PASS weighted-entropy assembly + piece-by-piece World replay', { replays, weighted: tally.true, unweighted: tally.false });
