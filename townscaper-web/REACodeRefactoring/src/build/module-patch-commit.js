/** 1751932427272909032 续（补学：指定模块 patch 的「周围补网/WFC + 形变碰撞 + 整体回滚」事务层）。
 * 已存在、本文件只组合不重做的：
 *   · core/module-patch.js   —— synthesizeModulePatch 生成模块需要的那一小块网格；spliceModulePatch
 *     把它缝进共享网格（星形洞 + 角度拉链三角接缝，外圈顶点对象保留）。
 *   · core/radial-patch.js   —— migrateWorldToPatch：旧 World 逐列迁到新网格（被切格按最近格重采样）。
 *   · core/wfc.js solveWithPrefab —— 模块部件逐格钉住、部件间贴配对 socket、对外边用调用方 socket；
 *     普通 solveWFC 把周围格按 socket 解到一致（= 周围补网）。
 *   · build/module-volume.js —— placeModuleVolume：共享 World 上的原子体量放置（支撑/占用/河道预检）。
 * 本文件补的事务层（一次「指定模块 patch」= 六步，任一步失败原 World 原样返回）：
 *   ① 几何：splice 模式把 patch/pattern 缝进网格并迁移 World（新网格 + 新 World，原对象不动）；
 *      fit 模式复用调用方给的现有足迹 mapping（同网格同 World，先暂存列再落盘）。
 *   ② 接口：逐条收集模块部件对外边的 socket（boundary 清单），供「验证相邻模块接口」。
 *   ③ 补网：solveWithPrefab 解周围；解完独立 findWFCConflicts 复核，不一致判失败。
 *   ④ 体量：可选 placeModuleVolume 写模块体积（splice 模式用原 patch 网格做几何复核；
 *      fit 模式用目标网格自身，几何平凡成立）。
 *   ⑤ 形变碰撞：新旧 World 按 cell 对应（splice：sourceCellOf，新格取最近被切格）逐格对比，
 *      输出可走面/阻挡的新增与消失清单（gainedWalkable/lostWalkable/gainedBlocker/lostBlocker）。
 *      可走面 = 顶面是岩石的陆地格（无建筑压顶、非河道）；阻挡 = 顶面是建筑。
 *   ⑥ 回滚：splice 失败天然保留原 World（新网格/新 World 整体丢弃）；fit 模式所有写入先在
 *      暂存列上验完才 copy 回。撤回 withdrawModulePatch：fit 就地 restore snapshot；
 *      splice 返回补丁前的 World 对象（要求期间未被改，版本号核验）。
 * 没做的：原版 prefab 的美术/房型；socket 语义由调用方目录决定；WFC 指派本身不写体素，
 *   除非显式传 tileColumn(tileId, cell) 钩子（只作用于非模块格，整数列覆盖，先验后写）。
 * 纯函数、确定性（同输入同种子同输出），Node / 浏览器 / Worker 通用。
 */
import { World, MAX_LEVEL } from '../core/world.js';
import { synthesizeModulePatch, spliceModulePatch, halfEdgeClosure } from '../core/module-patch.js';
import { migrateWorldToPatch } from '../core/radial-patch.js';
import { describeModule } from '../core/module-search.js';
import { solveWithPrefab, findWFCConflicts } from '../core/wfc.js';
import { placeModuleVolume } from './module-volume.js';

const FIELDS = ['solid', 'rock', 'color', 'river'];
const SOLID_MAX = (1 << MAX_LEVEL) - 1;
const norm = (a) => [...a].sort((x, y) => x - y);
const sameAdj = (a, b) => a.length === b.length && norm(a).every((v, i) => v === norm(b)[i]);
const samePattern = (a, b) => a && b && a.sides.length === b.sides.length && a.sides.every((s, i) => s === b.sides[i]) && a.adj.every((r, i) => sameAdj(r, b.adj[i]));

/** 一列体素的碰撞语义：顶面岩石 = 可走面；顶面建筑 = 阻挡；空列（水）两者皆非。 */
function columnState(world, id) {
  const m = world.solid[id], top = m === 0 ? 0 : 32 - Math.clz32(m);
  const r = world.rock[id], ground = r === 0 ? 0 : 32 - Math.clz32(r);
  const topIsRock = top > 0 && ((r >> (top - 1)) & 1) === 1;
  const river = !!world.river[id];
  return { top, ground, river, walkable: topIsRock && !river, blocked: top > 0 && !topIsRock };
}

/** tileColumn 钩子返回值的范围校验 + 应用（只在暂存/新 World 上）。 */
function applyTileColumns(staged, grid, assignment, inside, tileColumn) {
  const written = [];
  for (const c of grid.cells) {
    if (inside.has(c.id)) continue;
    const spec = tileColumn(String(assignment[c.id]), c);
    if (spec == null) continue;
    if (typeof spec !== 'object') throw new TypeError('tileColumn must return a column spec or null');
    for (const k of FIELDS) {
      if (spec[k] === undefined) continue;
      const v = spec[k];
      const ok = k === 'color' ? Number.isInteger(v) && v >= -1 && v <= 30
        : k === 'river' ? v === 0 || v === 1
        : Number.isInteger(v) && v >= 0 && v <= SOLID_MAX;
      if (!ok) throw new RangeError(`tileColumn ${k} out of range`);
      staged[k][c.id] = v;
    }
    written.push(c.id);
  }
  return written;
}

/**
 * 一次「指定模块 patch」事务。spec：
 *   pattern {sides,adj} | patch 网格       —— splice 模式的模块来源（pattern 先合成）
 *   at {x,z,angle,clearance,maxGrow}      —— splice 落点（必填）
 *   mapping [cellId]                       —— fit 模式：现有足迹（模块 index 序）；与 pattern/patch 同序
 *   socket (part,edge,cell)=>label 或常量  —— 每个模块部件对外边声明的 socket（默认 0）
 *   tiles, compatible                      —— 周围 WFC 目录与相容判据（必填，默认等值相容）
 *   volume {floor,stories,color}           —— 可选：把模块写成体量（复用 placeModuleVolume）
 *   tileColumn (tileId,cell)=>spec|null    —— 可选：把 WFC 指派落成体素列（只作用非模块格）
 *   seed, maxSteps, partWeight, expectedVersion
 * 返回 ok:true → {mode,world,grid,mapping,boundary,solve,collision,volume?,receipt,closure?}；
 * ok:false → {reason,world(原对象),detail?}，原 World 保证原样。
 */
export function commitModulePatch(world, spec = {}) {
  if (!world || !world.grid?.cells?.length || !FIELDS.every((k) => world[k])) throw new TypeError('World required');
  const { pattern = null, patch = null, at = null, mapping: fitMapping = null, tiles = null,
    compatible = (a, b) => a === b, seed = 1, maxSteps = 1000000, volume = null,
    tileColumn = null, partWeight = 1, expectedVersion = world.version } = spec;
  const socket = typeof spec.socket === 'function' ? spec.socket : () => spec.socket ?? 0;
  if (expectedVersion !== world.version) return { ok: false, reason: 'stale-version', world };
  if (!Array.isArray(tiles) || !tiles.length) return { ok: false, reason: 'tiles', detail: '周围 WFC 目录必填', world };
  if (fitMapping === null && !patch && !pattern) return { ok: false, reason: 'module', detail: '需要 patch / pattern / mapping 之一', world };
  if (fitMapping === null && !at) return { ok: false, reason: 'module', detail: 'splice 模式需要 at', world };

  // ① 几何：splice（新网格 + 迁移出的新 World）或 fit（同网格，暂存列）
  let grid = world.grid, staged = world, mapping = fitMapping, spliced = null, resampleOf = null, src = patch;
  if (fitMapping === null) {
    src ??= synthesizeModulePatch(pattern, { scale: world.grid.hexSize ?? 1 }).grid;
    try { grid = spliceModulePatch(world.grid, src, at); }
    catch (e) { return { ok: false, reason: 'splice', detail: e.message, world }; }
    spliced = grid.splice; mapping = [...spliced.patchCellIds];
    staged = migrateWorldToPatch(world, grid, World).world;
    // 新格（patch+seam）碰撞基准 = 迁移时重采样的那个最近被切格
    const removed = world.grid.cells.filter((c) => !grid.sourceCellOf.includes(c.id));
    resampleOf = new Map();
    for (const c of grid.cells) {
      if (grid.sourceCellOf[c.id] >= 0) continue;
      let best = Infinity, from = removed[0]?.id ?? -1;
      for (const r of removed) { const d = (r.cx - c.cx) ** 2 + (r.cz - c.cz) ** 2; if (d < best || (d === best && r.id < from)) { best = d; from = r.id; } }
      resampleOf.set(c.id, from);
    }
    if (pattern && !samePattern(describeModule(grid, mapping), pattern))
      return { ok: false, reason: 'adjacency', detail: 'splice 后模块诱导邻接与模式不符', world };
  } else {
    if (!Array.isArray(mapping) || !mapping.length || new Set(mapping).size !== mapping.length
      || mapping.some((id) => !Number.isInteger(id) || id < 0 || id >= world.grid.cells.length))
      return { ok: false, reason: 'module', detail: 'mapping 无效', world };
    if (pattern && !samePattern(describeModule(grid, mapping), pattern))
      return { ok: false, reason: 'adjacency', detail: '足迹诱导邻接与 pattern 不符', world };
    if (patch && mapping.some((id, i) => !patch.cells?.[i] || grid.cells[id].n !== patch.cells[i].n))
      return { ok: false, reason: 'adjacency', detail: '足迹边数与 patch 不符', world };
    staged = Object.create(world);
    for (const k of FIELDS) staged[k] = world[k].slice();
  }

  // ② 边缘 socket 约束收集：模块部件每条朝外（朝非模块格或网格外沿）的边
  const inside = new Set(mapping), byCell = new Map(grid.cells.map((c) => [c.id, c])), boundary = [];
  for (let i = 0; i < mapping.length; i++) {
    const c = byCell.get(mapping[i]);
    for (let e = 0; e < c.n; e++) {
      const nb = c.edgeNeighbors[e];
      if (inside.has(nb)) continue;
      boundary.push(Object.freeze({ part: i, cell: c.id, edge: e, neighbor: nb, socket: socket(i, e, c) }));
    }
  }

  // ③ 周围补网：模块部件钉死 + socket 约束传播到全网格一致，独立复核半边接口
  const solve = solveWithPrefab(grid, { tiles, mapping, socket, seed, maxSteps, compatible, partWeight });
  if (!solve.ok) return { ok: false, reason: 'wfc-' + solve.reason, solve, world };
  const conflicts = findWFCConflicts(grid, solve.tiles, solve.catalog, { compatible: solve.compatible });
  if (conflicts.length) return { ok: false, reason: 'interface', conflicts, world };

  // 形变碰撞的「前」态：原 World 列（splice 按 sourceCellOf/重采样源对应；fit 同格）
  const corr = new Int32Array(grid.cells.length);
  for (const c of grid.cells) corr[c.id] = fitMapping === null ? (grid.sourceCellOf[c.id] >= 0 ? grid.sourceCellOf[c.id] : resampleOf.get(c.id)) : c.id;
  const before = grid.cells.map((c) => (corr[c.id] >= 0 ? columnState(world, corr[c.id]) : null));

  // ④ WFC 指派落体素（可选）→ 模块体量（原子预检）；任一失败到此为止，world 未动
  try { if (tileColumn) applyTileColumns(staged, grid, solve.tiles, inside, tileColumn); }
  catch (e) { return { ok: false, reason: 'tile-column', detail: e.message, world }; }
  let placed = null;
  if (volume) {
    // fit 模式的几何复核源就是足迹格本身（恒等拟合，几何平凡成立，支撑/占用预检照跑）
    const source = fitMapping === null ? src : { cells: mapping.map((id) => grid.cells[id]) };
    placed = placeModuleVolume(staged, source, mapping, { ...volume, expectedVersion: staged.version });
    if (!placed.ok) return { ok: false, reason: placed.reason, stage: 'volume', cell: placed.cell ?? null, world };
  }

  // ⑤ 形变碰撞清单：逐格「前态 vs 提交后」
  const entries = [];
  const summary = { gainedWalkable: 0, lostWalkable: 0, gainedBlocker: 0, lostBlocker: 0, resampled: 0, topChanged: 0, riverChanged: 0 };
  for (const c of grid.cells) {
    const b = before[c.id], a = columnState(staged, c.id);
    if (spliced && grid.sourceCellOf[c.id] < 0) summary.resampled++;   // 新格按最近被切格重采样
    if (!b) continue;
    const changes = [];
    if (a.walkable && !b.walkable) { changes.push('walkable-gained'); summary.gainedWalkable++; }
    if (!a.walkable && b.walkable) { changes.push('walkable-lost'); summary.lostWalkable++; }
    if (a.blocked && !b.blocked) { changes.push('blocker-gained'); summary.gainedBlocker++; }
    if (!a.blocked && b.blocked) { changes.push('blocker-lost'); summary.lostBlocker++; }
    if (a.top !== b.top) { changes.push('top-changed'); summary.topChanged++; }
    if (a.river !== b.river) { changes.push('river-changed'); summary.riverChanged++; }
    if (changes.length) entries.push(Object.freeze({ cell: c.id, source: corr[c.id], before: b, after: a, changes }));
  }
  const collision = { entries: Object.freeze(entries), ...summary };

  // ⑥ 落盘与回执
  let receipt;
  if (fitMapping === null) {
    receipt = Object.freeze({ mode: 'splice', world: staged, priorWorld: world, priorVersion: world.version, mapping: Object.freeze([...mapping]), removedCells: Object.freeze([...spliced.removedCells]) });
  } else {
    const snapshot = world.snapshot();
    for (const k of FIELDS) world[k].set(staged[k]);
    world.touch();
    receipt = Object.freeze({ mode: 'fit', world, snapshot, mapping: Object.freeze([...mapping]) });
  }
  return {
    ok: true, mode: fitMapping === null ? 'splice' : 'fit', world: fitMapping === null ? staged : world, grid, mapping, boundary,
    solve: { ok: true, steps: solve.steps, backtracks: solve.backtracks, tiles: solve.tiles, catalog: solve.catalog, compatible: solve.compatible },
    collision, volume: placed, receipt,
    splice: spliced, closure: spliced ? halfEdgeClosure(grid) : null,
  };
}

/** 撤回一次 commitModulePatch。fit：就地 restore（voxel+实例身份同一快照）；splice：返回补丁前的
 *  World 对象（网格已形变，撤销=换回旧网格），priorWorld 期间被改过 → 'stale-prior'。 */
export function withdrawModulePatch(world, receipt) {
  if (!receipt || (receipt.mode !== 'fit' && receipt.mode !== 'splice')) return { ok: false, reason: 'receipt' };
  if (receipt.world !== world) return { ok: false, reason: 'world' };
  if (receipt.mode === 'fit') {
    world.restore(receipt.snapshot);
    return { ok: true, world, version: world.version };
  }
  if (receipt.priorWorld.version !== receipt.priorVersion) return { ok: false, reason: 'stale-prior' };
  return { ok: true, world: receipt.priorWorld, version: receipt.priorVersion, restored: 'prior-grid' };
}
