/**
 * spatial.js — 网格上的几何查询：点在哪一格、格子的包围盒。
 */

/** 点是否在凸多边形内（XZ 平面；三角格、方格都行）。 */
export function pointInQuad(pts, x, z) {
  let sign = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const k = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(k) < 1e-9) continue;
    const s = Math.sign(k);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** 给每格补上包围盒与尺寸，拾取和栅格化都要用。 */
export function decorateCells(grid) {
  for (const cell of grid.cells) {
    const xs = cell.pts.map((p) => p.x);
    const zs = cell.pts.map((p) => p.z);
    cell.minX = Math.min(...xs); cell.maxX = Math.max(...xs);
    cell.minZ = Math.min(...zs); cell.maxZ = Math.max(...zs);
    // 尺寸 = 角到格心的平均距离 × 0.7（方格时约等于原来的"对角线 / 4"）
    let r = 0;
    for (const p of cell.pts) r += Math.hypot(p.x - cell.cx, p.z - cell.cz);
    cell.size = (r / cell.pts.length) * 0.7;
  }
  return grid;
}

/** 空间哈希：直接跳到某个点附近的几格。 */
export function buildCellIndex(grid, bucket = 2) {
  const map = new Map();
  const key = (ix, iz) => ix * 100003 + iz;
  for (const cell of grid.cells) {
    for (let ix = Math.floor(cell.minX / bucket); ix <= Math.floor(cell.maxX / bucket); ix++) {
      for (let iz = Math.floor(cell.minZ / bucket); iz <= Math.floor(cell.maxZ / bucket); iz++) {
        const k = key(ix, iz);
        let list = map.get(k);
        if (!list) map.set(k, (list = []));
        list.push(cell);
      }
    }
  }
  return {
    at(x, z) { return map.get(key(Math.floor(x / bucket), Math.floor(z / bucket))) ?? []; },
    cellAt(x, z) {
      for (const c of this.at(x, z)) if (pointInQuad(c.pts, x, z)) return c;
      return null;
    },
  };
}
