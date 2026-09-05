// =====================================================================
//  笼形变形（C10）：单位立方体 [0,1]³ → 四边形四角双线性 × 层高线性。
//  方格时四角是正方形，映射是恒等（与 cx/cz 一致）。
//  纯数据，禁止 import Three.js。
// =====================================================================

/** c00=(u0,v0) c10=(u1,v0) c01=(u0,v1) c11=(u1,v1)，各为 [x,z] */
export function bilinearXZ(c00, c10, c01, c11, u, v) {
  const a = 1 - u;
  const b = 1 - v;
  return [
    a * b * c00[0] + u * b * c10[0] + a * v * c01[0] + u * v * c11[0],
    a * b * c00[1] + u * b * c10[1] + a * v * c01[1] + u * v * c11[1],
  ];
}

export function cageMapUnit(u, y, v, cornersXZ, y0, y1) {
  const xz = bilinearXZ(cornersXZ[0], cornersXZ[1], cornersXZ[2], cornersXZ[3], u, v);
  return [xz[0], y0 + y * (y1 - y0), xz[1]];
}

export function squareCellCorners(ix, iz, cellSize, gridSize) {
  const half = (gridSize - 1) / 2;
  const x0 = (ix - half - 0.5) * cellSize;
  const z0 = (iz - half - 0.5) * cellSize;
  const x1 = x0 + cellSize;
  const z1 = z0 + cellSize;
  return [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ];
}

function nearestUnused(pts, target, used) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    const d = (pts[i][0] - target[0]) ** 2 + (pts[i][1] - target[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  used.add(best);
  return pts[best];
}

/** 把 face 四角对到方格四角槽位，保证双线性 u/v 与 (ix,iz) 一致。 */
export function orderFaceCorners(pts, square) {
  if (!pts || pts.length < 4) return square;
  const used = new Set();
  return square.map((target) => nearestUnused(pts, target, used));
}

export function cellCageCorners(ix, iz, { quad = null, mapping = null, cellSize = 2, gridSize = 25 } = {}) {
  const square = squareCellCorners(ix, iz, cellSize, gridSize);
  if (!quad || !mapping) return square;
  const fid = mapping.cellToFace.get(`${ix},${iz}`);
  if (!fid) return square;
  if (!quad._faceIndex) {
    quad._faceIndex = new Map(quad.faceIds.map((id, i) => [id, i]));
  }
  const i = quad._faceIndex.get(fid);
  if (i === undefined) return square;
  return orderFaceCorners(quad.corners[i], square);
}

/**
 * 角柱对偶立方体的四个水平角 = 四格中心。
 * columnAt(ix,iz) → {x,z} | null，缺的回落方格中心。
 */
export function cornerCageCorners(gx, gz, { columnAt, cellSize = 2, gridSize = 25 } = {}) {
  const at = (ix, iz) => {
    const c = columnAt?.(ix, iz);
    if (c) return [c.x, c.z];
    const half = (gridSize - 1) / 2;
    return [(ix - half) * cellSize, (iz - half) * cellSize];
  };
  return [
    at(gx - 1, gz - 1),
    at(gx, gz - 1),
    at(gx - 1, gz),
    at(gx, gz),
  ];
}
