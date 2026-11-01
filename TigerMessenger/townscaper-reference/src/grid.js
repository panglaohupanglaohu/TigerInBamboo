/**
 * grid.js — the town grid.
 *
 * Mirrors Placemaker.GridGenerator from the shipped build:
 *   HexToPlane / PlaneToHex   -> axial hex <-> world plane
 *   GetSubdivisions           -> each hexagon is cut into quads
 *   GetVertCost / relaxation  -> shared vertices are pushed off the regular
 *                                lattice, which is what makes every quad a
 *                                slightly different size instead of a tiling of
 *                                identical tiles
 *   GetQuad / GetAdjecentQuad -> the quad graph handed to the voxel graph
 *
 * One hexagon becomes 6 kites: (edgeMid[i-1], corner[i], edgeMid[i], center).
 * Corners and edge midpoints are shared with the neighbouring hexagons, so a
 * jitter applied to a shared vertex moves every quad that touches it — exactly
 * the coherent irregularity the original grid has.
 */

const SQRT3 = Math.sqrt(3);

/** Deterministic 32-bit hash of a string -> [0, 1). */
function hash01(key, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Quantised vertex identity: the same lattice point reached from two hexes. */
const vkey = (x, z) => `${Math.round(x * 256)}:${Math.round(z * 256)}`;

const cross2 = (ax, az, bx, bz) => ax * bz - az * bx;

/** Signed area of a polygon in the XZ plane (positive = one winding). */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a * 0.5;
}

/**
 * 一个 quad 的"健康检查"。
 *
 * 原文（x.com/OskSta/status/1302686201401442309）：
 *   "A smoothing and inversion bug I came across while playing with the grid
 *    generation. The inverted patches collapse into a mess, but are stretched
 *    out when interpolating to fit with their neighbors. And the poor
 *    non-inverted patches need to stretch real far to pick up the slack"
 *
 * 画面里能看到的就是这句话的字面意思：先出现一个**黑点**（反转的 patch 塌成
 * 一个点），随后邻居被拉出细长的触手去够它（frame 009 里那几根星形尖刺）。
 *
 * 所以"凸性"一条不够，必须同时查三件事，任何一条不过就当这个 quad 坏了：
 *   1. 绕向 —— 面积符号必须还是初始那个（有向面积翻号 = 顶点转了一圈，即反转）
 *   2. 面积 —— 不能塌。用中位数面积做基准，小于 18% 视为塌陷（塌陷的 quad 在
 *      插值时会被邻居硬拉到正常尺寸，那几根触手就是这么来的）
 *   3. 最短边 —— 两个顶点几乎重合时，面积可能勉强够，但法线会突变
 *
 * 修法是**就地作废**而不是继续拉：把坏 quad 的四个顶点偏移清零（回到规则风筝
 * 形），它一定是合法 quad。清零只会让邻居更规整，所以是单调变好的，不会来回抖。
 */
function isConvex(pts, eps = 1e-6) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const c = pts[(i + 2) % 4];
    const k = cross2(b.x - a.x, b.z - a.z, c.x - b.x, c.z - b.z);
    if (Math.abs(k) < eps) continue;
    const s = Math.sign(k);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** 四条边里最短的那条（世界单位）。 */
function minEdge(pts) {
  let m = Infinity;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    m = Math.min(m, Math.hypot(b.x - a.x, b.z - a.z));
  }
  return m;
}

/** 这个 quad 是不是坏的：绕向翻转 / 非凸 / 塌陷 / 有重合顶点。 */
function cellIsBad(cell, median, minAreaRatio, minEdgeLen) {
  if (Math.sign(signedArea(cell.pts)) !== cell.wind) return 'wound';
  if (!isConvex(cell.pts)) return 'concave';
  if (Math.abs(signedArea(cell.pts)) / median < minAreaRatio) return 'collapsed';
  if (minEdge(cell.pts) < minEdgeLen) return 'pinched';
  return null;
}

/** 只查不修（对照实验用）：统计坏 quad 的数量与种类。 */
function auditCells(cells, { minAreaRatio = 0.18, minEdgeLen = 0.05 } = {}) {
  const areas = cells.map((c) => Math.abs(signedArea(c.pts)));
  const sorted = [...areas].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1] || 1;
  const kinds = { wound: 0, concave: 0, collapsed: 0, pinched: 0 };
  let bad = 0;
  for (const cell of cells) {
    const why = cellIsBad(cell, median, minAreaRatio, minEdgeLen);
    if (why) { bad++; kinds[why]++; }
  }
  return { cells: cells.length, repaired: 0, dropped: 0, caught: bad, kinds, medianArea: median, badRatio: bad / cells.length };
}

/**
 * 体检 + 就地修复，返回统计。
 *
 * `minAreaRatio` 是相对**中位数**面积的阈值：中位数不会被少数塌陷 quad 拉低，
 * 而平均值会被（塌陷的 quad 面积接近 0，平均面积直接掉一半）。
 */
function sanitizeCells(cells, { minAreaRatio = 0.18, minEdgeLen = 0.05 } = {}) {
  const areas = cells.map((c) => Math.abs(signedArea(c.pts)));
  const sorted = [...areas].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1] || 1;

  let repaired = 0;
  let dropped = 0;
  const kinds = { wound: 0, concave: 0, collapsed: 0, pinched: 0 };

  for (const cell of cells) {
    const why = cellIsBad(cell, median, minAreaRatio, minEdgeLen);
    if (!why) continue;
    kinds[why]++;

    // 作废：四个顶点回规则位置（偏移清零）。共享顶点被清零只会让邻居更规整。
    for (const p of cell.pts) {
      p.ox = 0;
      p.oz = 0;
      p.x = p.bx;
      p.z = p.bz;
    }
    cell.cx = (cell.pts[0].x + cell.pts[2].x) * 0.5;
    cell.cz = (cell.pts[0].z + cell.pts[2].z) * 0.5;
    // 包围盒也要刷：后面的边缘场、光照体积全靠它，留着旧值会把崖肩画错位置
    let mnX = Infinity, mxX = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    for (const p of cell.pts) {
      if (p.x < mnX) mnX = p.x;
      if (p.x > mxX) mxX = p.x;
      if (p.z < mnZ) mnZ = p.z;
      if (p.z > mxZ) mxZ = p.z;
    }
    cell.minX = mnX; cell.maxX = mxX; cell.minZ = mnZ; cell.maxZ = mxZ;

    if (cellIsBad(cell, median, minAreaRatio, minEdgeLen) === null) repaired++;
    else { dropped++; cell.dropped = true; }
  }

  return { cells: cells.length, repaired, dropped, caught: repaired + dropped, kinds, medianArea: median, badRatio: (repaired + dropped) / cells.length };
}

export function buildGrid({ radius = 11, hexSize = 1.0, jitter = 0.22, relaxPasses = 6, sanitize = true } = {}) {
  /** @type {Map<string, {x:number,z:number,bx:number,bz:number,ox:number,oz:number}>} */
  const verts = new Map();

  const vertex = (bx, bz, amp, salt) => {
    const key = vkey(bx, bz);
    let v = verts.get(key);
    if (v === undefined) {
      const a = hash01(key, salt) * Math.PI * 2;
      const r = Math.sqrt(hash01(key, salt + 977)) * amp;
      v = { x: bx, z: bz, bx, bz, ox: Math.cos(a) * r, oz: Math.sin(a) * r };
      v.x = bx + v.ox;
      v.z = bz + v.oz;
      verts.set(key, v);
    }
    return v;
  };

  const hexCenter = (q, r) => [hexSize * SQRT3 * (q + r / 2), hexSize * 1.5 * r];
  const cornerAngle = (i) => (Math.PI / 3) * i + Math.PI / 6;

  const cells = [];
  const hexRange = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      hexRange.push([q, r]);
    }
  }

  for (const [q, r] of hexRange) {
    const [cx, cz] = hexCenter(q, r);

    const corners = [];
    const mids = [];
    for (let i = 0; i < 6; i++) {
      const a = cornerAngle(i);
      corners.push(vertex(cx + Math.cos(a) * hexSize, cz + Math.sin(a) * hexSize, jitter * hexSize, 13));
    }
    for (let i = 0; i < 6; i++) {
      const a = cornerAngle(i) + Math.PI / 6;
      const mr = hexSize * Math.cos(Math.PI / 6);
      mids.push(vertex(cx + Math.cos(a) * mr, cz + Math.sin(a) * mr, jitter * hexSize * 0.8, 29));
    }
    const center = vertex(cx, cz, jitter * hexSize * 0.55, 71);

    for (let i = 0; i < 6; i++) {
      const pts = [mids[(i + 5) % 6], corners[i], mids[i], center];
      // Unit-normal winding: triangle (0,1,2) then (0,2,3) must face +Y.
      //
      // 绕向必须按**未抖动**的位置判定。踩过的坑：一开始直接用抖动后的位置判，
      // 抖动本身就能把小风筝抖翻，于是同一批格子的"基准绕向"带随机性；体检时
      // 把顶点归位反而被判成"反转"，290 个格子全部修不掉（实测 jitter=0.95）。
      const basePts = pts.map((p) => ({ x: p.bx, z: p.bz }));
      if (signedArea(basePts) > 0) pts.reverse();
      const wind = Math.sign(signedArea(pts.map((p) => ({ x: p.bx, z: p.bz }))));
      cells.push({
        id: cells.length,
        hex: [q, r],
        sector: i,
        pts,
        wind,
        cx: (pts[0].x + pts[2].x) * 0.5,
        cz: (pts[0].z + pts[2].z) * 0.5,
        edges: new Array(4).fill(null),
        edgeNeighbors: new Array(4).fill(-1),
        cornerNeighbors: [],
      });
    }
  }

  // --- relaxation: keep every quad convex, pull offending vertices home -----
  for (let pass = 0; pass < relaxPasses; pass++) {
    let moved = false;
    for (const cell of cells) {
      if (isConvex(cell.pts)) continue;
      moved = true;
      for (const p of cell.pts) {
        p.ox *= 0.62;
        p.oz *= 0.62;
        p.x = p.bx + p.ox;
        p.z = p.bz + p.oz;
      }
      cell.cx = (cell.pts[0].x + cell.pts[2].x) * 0.5;
      cell.cz = (cell.pts[0].z + cell.pts[2].z) * 0.5;
    }
    if (!moved) break;
  }

  // --- 退化/反转体检 → 作废并回归规则形 -----------------------------------
  // sanitize:false 是给对照实验用的：保持旧行为（只做凸性松弛，不体检），
  // 这样才能量出这个 bug 到底会毁掉多少个 quad。
  const health = sanitize ? sanitizeCells(cells) : auditCells(cells);

  // --- edge graph ----------------------------------------------------------
  const edgeMap = new Map();
  const vertCells = new Map();
  for (const cell of cells) {
    for (let i = 0; i < 4; i++) {
      const a = cell.pts[i];
      const b = cell.pts[(i + 1) % 4];
      const ka = vkey(a.bx, a.bz);
      cell.edges[i] = [ka, vkey(b.bx, b.bz)];
      const ek = ka < cell.edges[i][1] ? `${ka}|${cell.edges[i][1]}` : `${cell.edges[i][1]}|${ka}`;
      const list = edgeMap.get(ek);
      if (list === undefined) edgeMap.set(ek, [cell.id]);
      else list.push(cell.id);
      for (const k of [ka, cell.edges[i][1]]) {
        let set = vertCells.get(k);
        if (set === undefined) vertCells.set(k, (set = new Set()));
        set.add(cell.id);
      }
    }
  }

  for (const [ek, ids] of edgeMap) {
    if (ids.length !== 2) continue;
    const [ka, kb] = ek.split('|');
    for (const id of ids) {
      const cell = cells[id];
      for (let i = 0; i < 4; i++) {
        const [a, b] = cell.edges[i];
        if ((a === ka && b === kb) || (a === kb && b === ka)) {
          cell.edgeNeighbors[i] = ids[0] === id ? ids[1] : ids[0];
          break;
        }
      }
    }
  }

  for (const set of vertCells.values()) {
    if (set.size < 2) continue;
    const ids = [...set];
    for (const id of ids) {
      const cell = cells[id];
      for (const other of ids) {
        if (other === id) continue;
        if (cell.edgeNeighbors.includes(other)) continue;
        if (!cell.cornerNeighbors.includes(other)) cell.cornerNeighbors.push(other);
      }
    }
  }

  return { cells, radius, hexSize, cellCount: cells.length, health };
}

export { signedArea, isConvex, minEdge, sanitizeCells, auditCells, cellIsBad };

/**
 * 外部再松弛之后的第二次体检入口。
 *
 * `engine/relax.js` 为了消蘑菇化会按高度把顶点往格子中心推，它自己的注释就写着
 * "an aggressive version folds quads inside out" —— 也就是说反转不是只会在
 * 建网格时发生，任何一次几何松弛之后都得再查一遍。原文那条 bug 正是这个阶段
 * 的产物：反转的 patch 塌成一团，邻居被拉出细长触手去够它。
 */
export function repairInvertedCells(grid, opts) {
  // 只体检/修复，不动没坏格子的 cx/cz —— 坑：这里如果顺手把所有格子的
  // cx/cz 重算一遍（用 pts[0]/pts[2]），松弛后的格子中心会整体偏移，
  // 树和房子的摆位就跟着变了（实测树从 32 棵变 36 棵）。
  return sanitizeCells(grid.cells, opts);
}
