// 补学 1751932427272909032「指定模块 patch」事务层：splice/fit → 边缘 socket 收集 → 周围 WFC 补网
// → 体量写入 → 形变碰撞清单 → 整体回滚。两种网格、支撑/碰撞失败保留原 World、相邻模块接口复核。
import assert from 'node:assert/strict';
import { buildMixedGrid, buildQuadGrid } from '../src/core/grid.js';
import { synthesizeModulePatch } from '../src/core/module-patch.js';
import { cornerVariantTiles, findWFCConflicts } from '../src/core/wfc.js';
import { describeModule, findModulePatches } from '../src/core/module-search.js';
import { World } from '../src/core/world.js';
import { commitModulePatch, withdrawModulePatch } from '../src/build/module-patch-commit.js';

const CLIP = { sides: [4, 4, 3, 3, 3, 4, 4], adj: [[1, 4, 6], [0, 2, 5], [1, 3], [2, 4], [0, 3], [1], [0]] };
const catalog = () => { const t = []; for (let n = 3; n <= 8; n++) t.push(...cornerVariantTiles(n, 3)); return t; };
const door = (i) => (i === 0 ? 2 : 0);   // 部件 0 的全部外边 = 门 socket 2，其余外边 = 墙 0
const snap = (w) => JSON.stringify(w.snapshot());
const rockWorld = (grid, h = () => 1) => { const w = new World(grid); for (const c of grid.cells) w.fill(c, h(c), { rock: true }); return w; };

// ① splice 模式，两种网格：打 patch → 接口清单 → 周围补网一致 → 体量 → 碰撞清单 → 撤回还旧 World
for (const [kind, mk] of [['mixed', () => buildMixedGrid({ radius: 12, seed: 3 })], ['quad', () => buildQuadGrid({ radius: 8, seed: 5 })]]) {
  const w = rockWorld(mk()), before = snap(w), version = w.version;
  const r = commitModulePatch(w, { pattern: CLIP, at: { x: .4, z: -.3 }, socket: door, tiles: catalog(), volume: { stories: 2, color: 3 }, seed: 7 });
  assert.ok(r.ok, kind + ': ' + r.reason + ' ' + (r.detail || ''));
  assert.equal(r.mode, 'splice'); assert.notEqual(r.world, w);
  assert.equal(snap(w), before, kind + ': 原 World 原样'); assert.equal(w.version, version);
  assert.equal(r.closure.ok, true, kind + ': 半边闭合');
  assert.ok(samePatternCheck(r.grid, r.mapping, CLIP), kind + ': 模块邻接');
  // 边缘 socket：全部朝外、部件 0 都是门
  assert.ok(r.boundary.length >= CLIP.sides.length, kind + ': 有外边');
  for (const b of r.boundary) { assert.ok(!r.mapping.includes(b.neighbor)); assert.equal(b.socket, b.part === 0 ? 2 : 0); }
  // 相邻模块接口：每个「门」对面那格的孪生边真的是 2
  for (const b of r.boundary.filter((x) => x.neighbor >= 0 && x.socket === 2)) {
    const nb = r.grid.cells[b.neighbor], t = nb.edgeNeighbors.indexOf(b.cell);
    const tile = r.solve.catalog.find((x) => x.id === r.solve.tiles[b.neighbor]);
    assert.equal(tile.edges[t], 2, kind + ': 门 socket 不匹配');
  }
  assert.deepEqual(findWFCConflicts(r.grid, r.solve.tiles, r.solve.catalog, { compatible: r.solve.compatible }), [], kind + ': 补网一致');
  // 形变碰撞：7 个模块格由可走岩石面变成建筑（挡），周围可能有 resample 顶面变化
  const fp = new Set(r.mapping);
  assert.equal(r.collision.gainedBlocker, 7, kind + ': 模块格全部成阻挡');
  assert.equal(r.collision.lostWalkable, 7, kind + ': 模块格失去可走面');
  for (const e of r.collision.entries) {
    if (fp.has(e.cell)) { assert.ok(e.changes.includes('blocker-gained') && e.changes.includes('walkable-lost')); assert.equal(e.after.blocked, true); }
    assert.ok(r.grid.cells[e.cell] && (e.source === -1 || w.cells[e.source]), kind + ': 对应关系有效');
  }
  assert.ok(r.collision.resampled > 0, kind + ': seam/patch 格有重采样来源计数');
  // 模块体量真的写上去了：层 2/3 是建筑
  for (const id of r.mapping) { const c = r.world.cells[id]; assert.ok(r.world.isBuilt(c, 2) && r.world.isBuilt(c, 3) && r.world.isRock(c, 1)); }
  // 撤回 = 换回补丁前的 World 对象
  const back = withdrawModulePatch(r.world, r.receipt);
  assert.ok(back.ok); assert.equal(back.world, w); assert.equal(back.version, version);
}
function samePatternCheck(grid, mapping, pattern) { const d = describeModule(grid, mapping); const s = (a) => [...a].sort((x, y) => x - y).join(','); return d.sides.join(',') === pattern.sides.join(',') && d.adj.every((r, i) => s(r) === s(pattern.adj[i])); }

// ② fit 模式：同网格现有足迹；撤回就地恢复；写后世界只剩预期差
{
  const g = buildQuadGrid({ radius: 8, seed: 2 }), w = rockWorld(g), before = snap(w), version = w.version;
  const PAT = { sides: [4, 4, 4, 4], adj: [[1, 2], [0, 3], [0, 3], [1, 2]] };
  const found = findModulePatches(g, PAT, { limit: 1 });
  assert.ok(found.matches.length, 'quad 网格应能找到 2×2 足迹');
  const mapping = found.matches[0];
  const r = commitModulePatch(w, { mapping, pattern: PAT, socket: door, tiles: catalog(), volume: { stories: 1, color: 4 }, seed: 11 });
  assert.ok(r.ok, 'fit: ' + r.reason); assert.equal(r.mode, 'fit'); assert.equal(r.world, w);
  assert.equal(w.version, version + 1);
  assert.equal(r.collision.gainedBlocker, 4); assert.equal(r.collision.lostWalkable, 4);
  assert.deepEqual(findWFCConflicts(g, r.solve.tiles, r.solve.catalog, { compatible: r.solve.compatible }), []);
  const back = withdrawModulePatch(w, r.receipt);
  assert.ok(back.ok); assert.equal(snap(w), before, '撤回后快照复原');
  // 别的 World 拿这张回执 → 'world'
  assert.equal(withdrawModulePatch(rockWorld(g), r.receipt).ok, false);
  // 再次撤回：restore 幂等（快照仍是打补丁前那张）
  assert.ok(withdrawModulePatch(w, r.receipt).ok);
}

// ③ 失败路径：每种失败原 World 原样保留
{
  const g = buildQuadGrid({ radius: 8, seed: 2 }), w = rockWorld(g), before = snap(w), version = w.version;
  const PAT = { sides: [4, 4, 4, 4], adj: [[1, 2], [0, 3], [0, 3], [1, 2]] };
  const mapping = findModulePatches(g, PAT, { limit: 1 }).matches[0];
  const cat = catalog();
  // stale-version
  assert.equal(commitModulePatch(w, { mapping, socket: door, tiles: cat, expectedVersion: -1 }).reason, 'stale-version');
  // wfc 矛盾：socket 值不在目录（0..2 之外）→ 邻居域为空
  assert.equal(commitModulePatch(w, { mapping, socket: () => 7, tiles: cat, seed: 3 }).reason, 'wfc-contradiction');
  // 支撑失败：掀掉足迹下一格的地表
  w.setSolid(w.cells[mapping[0]], 1, false);
  const r2 = commitModulePatch(w, { mapping, socket: door, tiles: cat, volume: { stories: 1 }, seed: 3 });
  assert.equal(r2.reason, 'support'); assert.equal(r2.stage, 'volume');
  w.setSolid(w.cells[mapping[0]], 1, true, { rock: true });
  // 碰撞失败（占用）：足迹格上面一层已经有东西 → 'occupied'，World 不动
  w.setSolid(w.cells[mapping[1]], 2, true);
  assert.equal(commitModulePatch(w, { mapping, socket: door, tiles: cat, volume: { stories: 1 }, seed: 3 }).reason, 'occupied');
  w.setSolid(w.cells[mapping[1]], 2, false);
  // 邻接不符：拿别人的足迹冒充 PAT
  const other = findModulePatches(g, { sides: [4, 4], adj: [[1], [0]] }, { limit: 1 }).matches[0];
  assert.equal(commitModulePatch(w, { mapping: other, pattern: PAT, socket: door, tiles: cat }).reason, 'adjacency');
  // splice 洞够到边界 → 'splice'，且原 World 未动
  const big = buildMixedGrid({ radius: 4, seed: 1 }), wb = rockWorld(big), wbBefore = snap(wb);
  assert.equal(commitModulePatch(wb, { pattern: CLIP, at: { x: 3.2, z: 0 }, socket: door, tiles: catalog() }).reason, 'splice');
  assert.equal(snap(wb), wbBefore, 'splice 失败不写');
  assert.equal(snap(w), before); assert.equal(w.version, version + 4, '失败本身不写；+4 是本测试自己的 setSolid');
  // 没目录 / 没模块来源
  assert.equal(commitModulePatch(w, { mapping, socket: door, tiles: [] }).reason, 'tiles');
  assert.equal(commitModulePatch(w, { socket: door, tiles: cat }).reason, 'module');
}

// ④ 确定性 + splice 失败的 World 完整性（失败返回里 world 就是入参对象）
{
  const g = buildMixedGrid({ radius: 12, seed: 4 }), w = rockWorld(g);
  const spec = { pattern: CLIP, at: { x: .2, z: .5 }, socket: door, tiles: catalog(), volume: { stories: 1 }, seed: 9 };
  const a = commitModulePatch(w, spec), b = commitModulePatch(w, spec);
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a.solve.tiles, b.solve.tiles, '同种子同补网');
  assert.deepEqual(a.boundary, b.boundary);
  assert.deepEqual(a.collision.entries, b.collision.entries);
  const fail = commitModulePatch(w, { pattern: CLIP, at: { x: 99, z: 0 }, socket: door, tiles: catalog() });
  assert.equal(fail.ok, false); assert.equal(fail.world, w, '失败回执里的 world 是原对象');
}
console.log('PASS 指定模块 patch 事务：splice/fit 两种网格、边界 socket 收集、周围 WFC 补网一致、体量原子写入、形变碰撞清单、失败全回滚、撤回复原');
