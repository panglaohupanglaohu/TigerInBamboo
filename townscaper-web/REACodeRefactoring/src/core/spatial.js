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

/**
 * 重心坐标：预先算好三角形的两个"对偶向量"，之后每个坐标只要 1 次减法 + 1 次点积
 * （974579499802202113 "Barycentric Coordinates can be calculated with 1 subtraction and 1 dot product
 *  (if you've precalculated some nice vectors in the triangle)"；974564862729838592 讲课用的小工具）。
 *   const B = baryPrep(a, b, c);  B(x, z) → [wa, wb, wc]
 * 向量 g_b 垂直于 ca、长度使 g_b·(b−a) = 1；g_c 同理。于是 wb = g_b·(p−a)，wc = g_c·(p−a)，wa = 1 − wb − wc。
 */
export function baryPrep(a, b, c) {
  const ax=a.x,az=a.z;
  if(![ax,az,b.x,b.z,c.x,c.z].every(Number.isFinite))throw new RangeError('finite XZ triangle required');
  const e1x=b.x-ax,e1z=b.z-az,e2x=c.x-ax,e2z=c.z-az;
  const scale=Math.max(Math.abs(e1x),Math.abs(e1z),Math.abs(e2x),Math.abs(e2z));
  const x1=e1x/scale,z1=e1z/scale,x2=e2x/scale,z2=e2z/scale,det=x1*z2-z1*x2;
  if(!Number.isFinite(det)||Math.abs(det)<=64*Number.EPSILON)throw new RangeError('degenerate XZ triangle');
  const gbx=z2/det/scale,gbz=-x2/det/scale;
  const gcx=-z1/det/scale,gcz=x1/det/scale;
  return (x,z)=>{
    if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('finite XZ query required');
    const px=x-ax,pz=z-az,wb=gbx*px+gbz*pz,wc=gcx*px+gcz*pz;
    return[1-wb-wc,wb,wc];
  };
}
