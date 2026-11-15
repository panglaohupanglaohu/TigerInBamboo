/**
 * 第 56 批 C03 · 793545297376972801（2016-11-01）「I got multi tiles and voxel AO working. Would you play a game that takes
 * place on a building like this? Maybe if it was infinitely tall?」
 * r46/r47 已有多格 3D WFC（multitile-wfc.js）+ 顶点体素 AO + 等轴测 Canvas 页；缺口是「没接进主场景共享 World」和
 * 「构件是体块，缺窗洞 / 栏杆美术模块」。这里把 WFC 解的实心体素写进共享 World 的一块区域（底下垫一层岩台），
 * 之后的建筑外观全部交给共享建筑管线（build/buildings.js：墙、窗、门、拱洞底面、屋顶、栏杆 / 挑台）和共享 AO —— 不另做一套美术。
 *
 * 网格映射：主场景的四边形网格是松弛过的不规则网格，不能按 (i, k) 直接索引。按「相邻格心平均间距」在世界坐标里取样
 * index.cellAt，同一格只认一次（重复取样跳过）；三角 / 混合网格同样能落，只是形状随网格变形。
 */
import { solveMultitile } from './multitile-wfc.js';

/** 相邻格心平均距离（采样步长）。 */
export function meanCellSpacing(world, sample = 200) {
  let s = 0, n = 0;
  for (const c of world.cells.slice(0, sample)) for (const id of c.edgeNeighbors) { if (id < 0) continue; const o = world.cells[id]; s += Math.hypot(o.cx - c.cx, o.cz - c.cz); n++; }
  return n ? s / n : 1;
}

/**
 * 写入：res = solveMultitile 结果；center = 世界坐标中心；baseLevel = WFC 第 0 层落在哪一层（下面 1..baseLevel-1 垫岩台）。
 * 返回 { cells, voxels, skipped（同格重复取样跳过的列数）, columns }。
 */
export function multitileIntoWorld(res, world, index, { center = { x: 0, z: 0 }, baseLevel = 2, clear = true, spacing = null } = {}) {
  if (!res?.ok) throw new Error('multitile solve failed');
  const [W, H, D] = res.size, step = spacing ?? meanCellSpacing(world);
  if (baseLevel + H - 1 > 12) throw new RangeError('too tall for World (MAX_LEVEL 12)');
  if (clear) world.reset();
  const used = new Map(); let voxels = 0, skipped = 0;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const px = center.x + (x - (W - 1) / 2) * step, pz = center.z + (z - (D - 1) / 2) * step, cell = index.cellAt(px, pz);
    if (!cell || used.has(cell.id)) { skipped++; continue; }
    used.set(cell.id, [x, z]);
    for (let lv = 1; lv < baseLevel; lv++) world.setSolid(cell, lv, true, { rock: true });
    for (let y = 0; y < H; y++) if (res.solid[res.idx(x, y, z)]) { world.setSolid(cell, baseLevel + y, true); voxels++; }
  }
  // 地台外围再垫一圈岩（片子里整栋楼立在一块地台上）
  for (const id of used.keys()) for (const nb of world.cells[id].edgeNeighbors) if (nb >= 0 && !used.has(nb)) { const c = world.cells[nb]; if (!world.isSolid(c, 1)) for (let lv = 1; lv < baseLevel; lv++) world.setSolid(c, lv, true, { rock: true }); }
  world.touch();
  return { cells: used.size, voxels, skipped, columns: W * D, step };
}

/** 一步到位：解 + 写入。 */
export function buildMultitileTower(world, index, { size = [5, 8, 5], seed = 3, center, baseLevel = 2 } = {}) {
  const res = solveMultitile({ size, seed });
  return { res, ...multitileIntoWorld(res, world, index, { center, baseLevel }) };
}
