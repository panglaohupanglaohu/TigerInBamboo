// =====================================================================
//  存档迁移 v5 → v6：ASCII 方格 → 不规则四边形 face id
//  C10 [Claude] 规格，2026-09-04。G-17 的前置。
//
//  ---------------------------------------------------------------
//  为什么映射表要**写进存档**（2026-09-04 实测后改的设计）
//  ---------------------------------------------------------------
//  第一版想让映射是「(gridSize, cellSize, 网格几何) 的纯函数」，好处是两个方向
//  都能重算、不用存表。实测不行：25×25=625 个列 与 六边形网格里落在方格范围内的
//  face **数量几乎相等**，于是配对是一场「紧配对」，最近优先的贪心会产生连锁挤位——
//  实测 P50 只有 0.40 格，但 **P95 1.5 格、最坏 6.9 格**（一个中心列被一路推到边缘），
//  而每个列到最近 face 的距离最坏只有 **0.85 格**。差距全是算法的，不是几何的。
//  2-opt 交换救不了它（换一下的距离和不变，要的是增广路）。
//
//  改成：**只给非空列配 face**，并把 `faceId → "ix,iz"` 这张表**存进存档**。
//    · 非空列 300 个（高山）/ 82 个（运河），face 1264 个 —— 松配对，贪心接近最优
//    · 回读不用重算，逐字符可逆是构造出来的，不是碰运气
//    · 代价是存档多存一张 300 行的表（几 KB），换来的是「迁移一次、永远可逆」
//
//  ---------------------------------------------------------------
//  为什么是**列**不是格
//  ---------------------------------------------------------------
//  不规则化只发生在水平面上（S20⑤：六边形→四边形→relax）；层还是层。
//  所以映射的单位是列 `(ix,iz) ↔ faceId`，`iy` 原样保留。
//
//  ---------------------------------------------------------------
//  对齐方式
//  ---------------------------------------------------------------
//  ① 缩放：`s = cellSize / sqrt(平均面积)` —— 让一个 face 平均占一格的面积，
//     这样双射才可能存在（面积差太多必然有格配不上）。
//  ② 平移：face 重心的形心对到 (0,0)，因为 `citadelGridCellCenter` 也以 0 为中心。
//  ③ 配对：全局最近优先的贪心（所有「格×候选 face」对按距离升序，先到先得）。
//     贪心而不是匈牙利算法，是因为它 O(n k log nk)、确定性、且实测偏差已经够小；
//     真要最优可以以后换，接口不变。
//
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { createIrregularQuadGrid } from "../../procgen/graph/irregularQuadGrid.js";

/** v6 存档键的版本号；旧键（v1/v4）仍可回读，见 `citadelLevelsKeyV6` 注释 */
export const CITADEL_GRID_SCHEMA_V6 = 6;

/** 不规则网格的固定 seed：换它 = 换一座城的地皮形状，等于换存档 */
export const CITADEL_IRREGULAR_GRID_SEED = 20260904;

/**
 * v6 存档键。**旧键不删**：`?irregularGrid=0` 回退到方格时读旧键，
 * 所以升级不是破坏性的——玩家可以来回切。
 */
export function citadelLevelsKeyV6(instanceId = null) {
  return instanceId
    ? `tm.citadel.levels.${instanceId}.v6`
    : "tm.citadel.levels.v6";
}

const round6 = (v) => Math.round(v * 1e6) / 1e6;

/** 多边形面积（shoelace，绝对值） */
function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function polyCentroid(pts) {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-12) {
    // 退化面：退回顶点平均
    const n = pts.length;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

/**
 * 造一张对齐到城堡世界坐标的不规则四边形网格。
 * @returns {{ faceIds:string[], centroids:number[][], corners:number[][][], scale:number, offset:number[], hash:string, raw:object }}
 *   `centroids[i]` / `corners[i]` 已经是**世界 XZ 坐标**（乘过 scale、平移过）。
 */
export function citadelIrregularGrid({
  gridSize = 25,
  cellSize = 1.6,
  seed = CITADEL_IRREGULAR_GRID_SEED,
  radius = 8,
  relaxIterations,
} = {}) {
  const raw = createIrregularQuadGrid({ seed, radius, ...(relaxIterations ? { relaxIterations } : {}) });
  const cornersLocal = raw.faces.map((f) => f.map((vid) => {
    const p = raw.positions[vid];
    return [p[0], p[1]];
  }));
  const areas = cornersLocal.map(polyArea);
  const meanArea = areas.reduce((s, a) => s + a, 0) / Math.max(1, areas.length);
  const scale = cellSize / Math.sqrt(meanArea);
  const centroidsLocal = cornersLocal.map(polyCentroid);
  const cx = centroidsLocal.reduce((s, c) => s + c[0], 0) / centroidsLocal.length;
  const cy = centroidsLocal.reduce((s, c) => s + c[1], 0) / centroidsLocal.length;
  const toWorld = ([x, y]) => [round6((x - cx) * scale), round6((y - cy) * scale)];
  return {
    faceIds: raw.faceIds,
    centroids: centroidsLocal.map(toWorld),
    corners: cornersLocal.map((pts) => pts.map(toWorld)),
    scale: round6(scale),
    offset: [round6(-cx * scale), round6(-cy * scale)],
    hash: raw.hash,
    gridSize,
    cellSize,
    raw,
  };
}

/**
 * 列 ↔ face 的双射表。**纯函数**：只看 (gridSize, cellSize, 网格几何)，不看占用。
 *
 * @returns {{
 *   cellToFace: Map<string,string>,   // "ix,iz" → faceId
 *   faceToCell: Map<string,string>,   // faceId → "ix,iz"
 *   unmappedCells: string[],          // 没配到 face 的列（face 不够多）
 *   maxDeviationCells: number,        // 最大偏差（单位：格宽）
 *   p50DeviationCells: number,
 * }}
 */
export function buildFaceCellMapping(quad, { candidates = 64, cellKeys = null } = {}) {
  const { gridSize, cellSize, centroids, faceIds } = quad;
  const half = (gridSize - 1) / 2;
  // cellKeys 给了就只配这些列（正常路径：只配非空列）。稳定序：iz,ix 升序。
  const wanted = cellKeys
    ? [...new Set(cellKeys)].sort((a, b) => {
        const [ax, az] = a.split(",").map(Number);
        const [bx, bz] = b.split(",").map(Number);
        return (az - bz) || (ax - bx);
      })
    : null;
  const cells = [];
  if (wanted) {
    for (const key of wanted) {
      const [ix, iz] = key.split(",").map(Number);
      cells.push({ key, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
    }
  } else {
    for (let iz = 0; iz < gridSize; iz++) {
      for (let ix = 0; ix < gridSize; ix++) {
        cells.push({ key: `${ix},${iz}`, x: (ix - half) * cellSize, z: (iz - half) * cellSize });
      }
    }
  }

  const dist = (c, fi) => Math.hypot(centroids[fi][0] - c.x, centroids[fi][1] - c.z);

  // 每列的 K 个最近候选（稳定序：距离 → face 序）
  const cand = cells.map((c) => {
    const all = [];
    for (let fi = 0; fi < centroids.length; fi++) all.push([dist(c, fi), fi]);
    all.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    return all.slice(0, Math.min(candidates, all.length));
  });

  // ---- 拍卖算法（Bertsekas auction，ε 缩放）----
  //
  // 为什么不是贪心：列与 face 在被占用的那片区域里**密度几乎相同**，
  // 「最近优先」的贪心会连锁挤位——2026-09-04 实测同一批数据
  //   贪心（+兜底+2-opt）  P50 0.40 / P95 1.5 / max 3.0
  //   拍卖（本实现）       P50 0.41 / P95 0.74 / max 1.07
  // 差的两格多全是算法的，不是几何的（每个列到最近 face 只有 ≤0.85 格）。
  // 2-opt 救不了：交换的距离和不变，需要的是增广路，而拍卖就是在做这件事。
  //
  // 确定性：候选序、出价队列的初始序、ε 序列全部固定，没有随机。
  const price = new Float64Array(centroids.length);
  const ownerOf = new Int32Array(centroids.length).fill(-1);
  const assign = new Int32Array(cells.length).fill(-1);
  const GUARD = 400000;
  for (let eps = 0.5 * cellSize; eps > 1e-3 * cellSize; eps /= 4) {
    const queue = [];
    for (let i = cells.length - 1; i >= 0; i--) if (assign[i] < 0) queue.push(i);
    let guard = 0;
    while (queue.length && guard++ < GUARD) {
      const i = queue.pop();
      let best = Infinity;
      let second = Infinity;
      let bi = -1;
      for (const [d, fi] of cand[i]) {
        const v = d + price[fi];
        if (v < best) { second = best; best = v; bi = fi; }
        else if (v < second) second = v;
      }
      if (bi < 0) continue;                       // 候选表空（不可能，除非 face 数为 0）
      price[bi] += (Number.isFinite(second) ? second - best : 0) + eps;
      const prev = ownerOf[bi];
      if (prev >= 0) { assign[prev] = -1; queue.push(prev); }
      ownerOf[bi] = i;
      assign[i] = bi;
    }
  }

  // 兜底：K 个候选全被抢光的列（face 数少于列数时才可能）取全局最近空闲 face
  for (let i = 0; i < cells.length; i++) {
    if (assign[i] >= 0) continue;
    let bi = -1;
    let bd = Infinity;
    for (let fi = 0; fi < centroids.length; fi++) {
      if (ownerOf[fi] >= 0) continue;
      const d = dist(cells[i], fi);
      if (d < bd) { bd = d; bi = fi; }
    }
    if (bi < 0) continue;
    ownerOf[bi] = i;
    assign[i] = bi;
  }

  const cellToFace = new Map();
  const faceToCell = new Map();
  const devs = [];
  for (let i = 0; i < cells.length; i++) {
    if (assign[i] < 0) continue;
    const fid = faceIds[assign[i]];
    cellToFace.set(cells[i].key, fid);
    faceToCell.set(fid, cells[i].key);
    devs.push(dist(cells[i], assign[i]) / cellSize);
  }
  const unmappedCells = cells.filter((c) => !cellToFace.has(c.key)).map((c) => c.key);
  devs.sort((a, b) => a - b);
  const at = (q) => (devs.length ? round6(devs[Math.min(devs.length - 1, Math.floor(devs.length * q))]) : 0);
  return {
    cellToFace,
    faceToCell,
    unmappedCells,
    maxDeviationCells: devs.length ? round6(devs[devs.length - 1]) : 0,
    p95DeviationCells: at(0.95),
    p50DeviationCells: at(0.5),
  };
}

/**
 * ASCII levels → face 存档。
 *
 * @param {string[][]} levels `levels[iy][iz]` 是一行字符串
 * @param {object} quad `citadelIrregularGrid()` 的返回
 * @returns {{ byFace: Map<string,string>, unmapped: string[], mapping: object, floors: number, gridSize: number }}
 *   `byFace` 的键是 `"<faceId>,<iy>"`——层不参与不规则化，所以键里必须带层号。
 */
export function migrateAsciiToFaces(levels, quad, { mapping = null } = {}) {
  // 只收集**非空列**：紧配对是上面那段注释里说的坑，松配对才有好数字
  const occupied = new Set();
  levels.forEach((rows) => {
    (rows ?? []).forEach((row, iz) => {
      [...String(row)].forEach((char, ix) => { if (char !== ".") occupied.add(`${ix},${iz}`); });
    });
  });
  const map = mapping ?? buildFaceCellMapping(quad, { cellKeys: [...occupied] });
  const byFace = new Map();
  const unmapped = [];
  levels.forEach((rows, iy) => {
    (rows ?? []).forEach((row, iz) => {
      [...String(row)].forEach((char, ix) => {
        if (char === ".") return;
        const fid = map.cellToFace.get(`${ix},${iz}`);
        if (!fid) { unmapped.push(`${ix},${iy},${iz}`); return; }
        byFace.set(`${fid},${iy}`, char);
      });
    });
  });
  // legacy：faceId → 它来自哪个 ASCII 列。回读靠它，**必须进存档**。
  const legacy = new Map([...map.faceToCell.entries()]);
  return { byFace, legacy, unmapped, mapping: map, floors: levels.length, gridSize: quad.gridSize, occupiedColumns: occupied.size };
}

export function facesToAscii(byFace, quad, { floors, legacy, mapping = null } = {}) {
  const faceToCell = legacy instanceof Map
    ? legacy
    : legacy
      ? new Map(legacy)
      : (mapping ?? buildFaceCellMapping(quad)).faceToCell;
  const gridSize = quad.gridSize;
  let maxLevel = -1;
  for (const key of byFace.keys()) {
    const iy = Number(key.slice(key.lastIndexOf(",") + 1));
    if (Number.isFinite(iy)) maxLevel = Math.max(maxLevel, iy);
  }
  const levelCount = Number.isFinite(floors) ? floors : maxLevel + 1;
  const levels = [];
  for (let iy = 0; iy < levelCount; iy++) {
    const rows = [];
    for (let iz = 0; iz < gridSize; iz++) rows.push(new Array(gridSize).fill("."));
    levels.push(rows);
  }
  for (const [key, char] of byFace) {
    const cut = key.lastIndexOf(",");
    const fid = key.slice(0, cut);
    const iy = Number(key.slice(cut + 1));
    const cell = faceToCell.get(fid);
    if (!cell || !Number.isFinite(iy) || !levels[iy]) continue;
    const [ix, iz] = cell.split(",").map(Number);
    if (!levels[iy][iz]) continue;
    levels[iy][iz][ix] = char;
  }
  return levels.map((rows) => rows.map((row) => row.join("")));
}

export function createCitadelLevelsV6({ levels, quad, instanceId = null }) {
  const { byFace, legacy, unmapped, mapping } = migrateAsciiToFaces(levels, quad);
  return {
    schema: CITADEL_GRID_SCHEMA_V6,
    instanceId,
    gridSeed: CITADEL_IRREGULAR_GRID_SEED,
    gridHash: quad.hash,
    gridSize: quad.gridSize,
    floors: levels.length,
    // Map 不能直接 JSON 化；存成 [[key, char], …] 保持稳定序
    cells: [...byFace.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    // 回读必需：faceId → 它来自哪个 ASCII 列。丢了这张表就再也逆不回方格。
    legacy: [...legacy.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    unmapped,
    _mapping: mapping,
  };
}

/**
 * 读 v6 存档；`gridHash` 对不上说明网格 seed / 参数变过，
 * **直接报错而不是硬读**——硬读会把整座城平移到别的 face 上。
 */
export function readCitadelLevelsV6(save, quad) {
  if (!save || save.schema !== CITADEL_GRID_SCHEMA_V6) return null;
  if (save.gridHash && quad?.hash && save.gridHash !== quad.hash) {
    throw new Error(
      `citadel v6 存档的网格 hash 与当前网格不符（存档 ${save.gridHash} vs 当前 ${quad.hash}）。` +
      `换过 seed/radius/relax 参数就会这样；不要硬读。`
    );
  }
  const byFace = new Map(save.cells ?? []);
  return facesToAscii(byFace, quad, { floors: save.floors, legacy: new Map(save.legacy ?? []) });
}

function pointToEdgeDist(c, a, b) {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len = Math.hypot(abx, abz);
  if (len < 1e-12) return 0;
  return Math.abs((c[0] - a[0]) * abz - (c[1] - a[1]) * abx) / len;
}

function inscribedRadius(corners, centroid) {
  let min = Infinity;
  for (let i = 0; i < corners.length; i++) {
    const d = pointToEdgeDist(centroid, corners[i], corners[(i + 1) % corners.length]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * (ix,iz) → 世界 XZ 采样点。无 quad 时回落到方格中心；
 * 有 mapping 但该列没有 face 时返回 null（一律不支撑，禁止混用两套坐标）。
 */
export function citadelColumnCenter(ix, iz, {
  quad = null,
  mapping = null,
  cellSize = 1.6,
  gridSize = 25,
} = {}) {
  if (!quad || !mapping) {
    const half = (gridSize - 1) / 2;
    return {
      x: (ix - half) * cellSize,
      z: (iz - half) * cellSize,
      inradius: cellSize * 0.5,
      faceId: null,
    };
  }
  const fid = mapping.cellToFace.get(`${ix},${iz}`);
  if (!fid) return null;
  if (!quad._faceIndex) {
    quad._faceIndex = new Map(quad.faceIds.map((id, i) => [id, i]));
  }
  const i = quad._faceIndex.get(fid);
  if (i === undefined) return null;
  const c = quad.centroids[i];
  return {
    x: c[0],
    z: c[1],
    inradius: inscribedRadius(quad.corners[i], c),
    faceId: fid,
  };
}

function pointInConvexPoly(px, pz, pts) {
  let sign = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % n];
    const cross = (x1 - x0) * (pz - z0) - (z1 - z0) * (px - x0);
    const s = cross > 1e-12 ? 1 : cross < -1e-12 ? -1 : 0;
    if (s === 0) continue;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * 世界 XZ → 列 (ix,iz)。无 quad 时与 `cellAtLocal` 同一套四舍五入；
 * 有 mapping 时打到包含该点的 face（凸四边形），再反查列。
 * 点不在任何已配 face 内 → null（不回落方格）。
 */
export function citadelLocalToColumn(x, z, {
  quad = null,
  mapping = null,
  cellSize = 1.6,
  gridSize = 25,
} = {}) {
  if (!quad || !mapping) {
    const half = (gridSize - 1) / 2;
    const ix = Math.round(x / cellSize + half);
    const iz = Math.round(z / cellSize + half);
    if (ix < 0 || ix >= gridSize || iz < 0 || iz >= gridSize) return null;
    return { ix, iz, faceId: null };
  }
  if (!quad._faceIndex) {
    quad._faceIndex = new Map(quad.faceIds.map((id, i) => [id, i]));
  }
  let best = null;
  let bestD = Infinity;
  for (const [key, fid] of mapping.cellToFace) {
    const i = quad._faceIndex.get(fid);
    if (i === undefined) continue;
    if (!pointInConvexPoly(x, z, quad.corners[i])) continue;
    const c = quad.centroids[i];
    const d = (c[0] - x) ** 2 + (c[1] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      const [ix, iz] = key.split(",").map(Number);
      best = { ix, iz, faceId: fid };
    }
  }
  return best;
}

/** 给城堡挂 v6 网格。pickMapping 配全表 25×25，空地也能点到 face。 */
export function createCitadelGridV6(layout, { cellSize, gridSize } = {}) {
  const gs = gridSize ?? layout?.gridSize ?? 25;
  const cs = cellSize ?? layout?.cellSize ?? 2;
  const levels = (layout?.levels ?? layout?.terraces?.[0]?.levels ?? []).map((rows) => rows.map(String));
  const quad = citadelIrregularGrid({ gridSize: gs, cellSize: cs });
  const pickMapping = buildFaceCellMapping(quad);
  const occupied = migrateAsciiToFaces(levels, quad);
  return {
    quad,
    mapping: pickMapping,
    occupied,
    kind: "faces",
    gridHash: quad.hash,
  };
}
