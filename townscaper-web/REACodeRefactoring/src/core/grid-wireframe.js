/**
 * grid-wireframe.js — 不规则四边格 + 三角填充的**按面型着色线框**。
 *
 * 依据：1459169210752507904「And another」（609 帧全看）
 *   画面是一座岛的线框：大片橙色四边格（每格中间还有一条对角线似的红点带），
 *   中间横穿几条青色/绿色的三角带，外圈是深绿的岛缘。三角带不是装饰——
 *   它是四边格阵列方向翻转处留下的过渡带（三角形没法再拆成四边格），
 *   所以带子会把整片格子切成几块朝向不同的补丁。每 40–60 帧整片清空重铺一次
 *   （换种子重新生成），说明这是生成器的调试视图，不是资产。
 *
 * grid.js 的 buildMixedGrid 已经把「三角形合并成菱形→再细分成四边格，剩下的三角形保留」
 * 做出来了（cell.n === 3 就是保留下来的三角形），本模块只补一层**诊断**：
 * 把每条边按它两侧的面型分类，并把三角过渡带串成一条条带子。
 *
 * API：
 *   classifyWireframe(grid)  → { edges, counts, faces, degree, manifold }
 *   seamBands(wireframe)     → [{ corners, length, closed }]（按长度降序）
 */

function cellKey(cell, i) {
  const a = cell.pts[i].id, b = cell.pts[(i + 1) % cell.n].id;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * 每条边只出现一次。kind：
 *   'quad'  两侧都是四边格（片子里橙色那层）
 *   'tri'   两侧都是三角形（三角带内部）
 *   'seam'  四边格 ↔ 三角形（三角带的外轮廓，片子里最亮的那圈青绿）
 *   'rim'   只有一侧有格子（岛缘 / 补丁边界）
 */
export function classifyWireframe(grid) {
  if (!grid || !Array.isArray(grid.cells)) throw new RangeError('grid.cells must be an array');
  const byKey = new Map();
  let quads = 0, tris = 0, other = 0;
  for (const cell of grid.cells) {
    if (!cell || !Array.isArray(cell.pts) || cell.pts.length !== cell.n || cell.n < 3) {
      throw new RangeError('every cell needs pts.length === n >= 3');
    }
    if (cell.n === 4) quads++; else if (cell.n === 3) tris++; else other++;
    for (let i = 0; i < cell.n; i++) {
      const key = cellKey(cell, i);
      let edge = byKey.get(key);
      if (!edge) byKey.set(key, (edge = { key, a: cell.pts[i].id, b: cell.pts[(i + 1) % cell.n].id, faces: [], kinds: [] }));
      edge.faces.push(cell.id);
      edge.kinds.push(cell.n === 4 ? 'quad' : cell.n === 3 ? 'tri' : 'other');
    }
  }
  const edges = [];
  const degree = new Map();
  let manifold = true;
  for (const edge of byKey.values()) {
    const n = edge.faces.length;
    if (n > 2) manifold = false;
    let kind;
    if (n === 1) kind = 'rim';
    else if (n > 2) kind = 'nonmanifold';
    else {
      const [k0, k1] = edge.kinds;
      kind = k0 === k1 ? (k0 === 'quad' ? 'quad' : k0 === 'tri' ? 'tri' : 'other') : 'seam';
    }
    edges.push({ a: edge.a, b: edge.b, kind, faces: edge.faces.slice() });
    for (const v of [edge.a, edge.b]) degree.set(v, (degree.get(v) || 0) + 1);
  }
  edges.sort((p, q) => p.a - q.a || p.b - q.b);
  const counts = { quad: 0, tri: 0, seam: 0, rim: 0, other: 0, nonmanifold: 0 };
  for (const e of edges) counts[e.kind] = (counts[e.kind] || 0) + 1;
  return {
    edges,
    counts,
    faces: { quads, tris, other, total: grid.cells.length },
    degree,
    manifold,
    // 手性检查：三角形必然是"没被合并掉的残余"，四边格是主体的量
    trianglesKept: grid.cells.filter((c) => c.n === 3).length,
  };
}

/**
 * 把 seam 边串成带子。片子里的三角带是**横穿整片格子的长条**，不会在岔口断掉，
 * 所以岔口处按"最接近直行"继续（有顶点坐标时用方向夹角挑，没坐标就按 id 定序）。
 * 返回的 corners 是顶点 id 序列（闭合带回起点，closed=true）；length = 边数。
 */
export function seamBands(wireframe, { grid = null, minLength = 1 } = {}) {
  const pos = new Map();
  if (grid && Array.isArray(grid.verts)) for (const v of grid.verts) pos.set(v.id, v);
  const seam = new Set();
  const at = new Map();
  for (const e of wireframe.edges) {
    if (e.kind !== 'seam') continue;
    const key = `${e.a}|${e.b}`;
    seam.add(key);
    for (const v of [e.a, e.b]) {
      if (!at.has(v)) at.set(v, []);
      at.get(v).push(key);
    }
  }
  const used = new Set();
  const bands = [];
  const ends = (key) => key.split('|').map(Number);
  const other = (key, v) => { const [a, b] = ends(key); return a === v ? b : a; };
  const dir = (from, to) => {
    const p = pos.get(from), q = pos.get(to);
    if (!p || !q) return null;
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz) || 1;
    return [dx / len, dz / len];
  };
  const walk = (startV, startKey) => {
    const corners = [startV];
    let v = startV, key = startKey;
    while (key && !used.has(key)) {
      used.add(key);
      const w = other(key, v);
      const back = dir(v, w);
      corners.push(w);
      v = w;
      const open = (at.get(w) || []).filter((k) => !used.has(k));
      if (!open.length) { key = null; break; }
      if (open.length === 1) { key = open[0]; continue; }
      // 岔口：优先接着直行的那条，其次按 id 定序，保证确定性
      let best = null, bestDot = -Infinity;
      for (const k of open.slice().sort()) {
        const ahead = dir(w, other(k, w));
        const dot = back && ahead ? back[0] * ahead[0] + back[1] * ahead[1] : 0;
        if (dot > bestDot + 1e-12) { bestDot = dot; best = k; }
      }
      key = best;
    }
    return corners;
  };
  // 先从端点（只连一条 seam 边）走，剩下的都是闭环
  const starts = [...at.entries()].filter(([, keys]) => keys.length === 1).map(([v, keys]) => [v, keys[0]]);
  for (const [v, key] of starts.sort((p, q) => p[0] - q[0])) {
    if (used.has(key)) continue;
    bands.push({ corners: walk(v, key), closed: false });
  }
  for (const key of [...seam].sort()) {
    if (used.has(key)) continue;
    const [a] = ends(key);
    const corners = walk(a, key);
    bands.push({ corners, closed: corners.length > 2 && corners[0] === corners[corners.length - 1] });
  }
  return bands
    .map((b) => ({ ...b, length: b.corners.length - 1 }))
    .filter((b) => b.length >= minLength)
    .sort((p, q) => q.length - p.length || p.corners[0] - q.corners[0]);
}

/** 四边格自己的轴向（第一条边的方向，折到 0–90°）。 */
export function cellAxisDeg(cell) {
  const a = cell.pts[0], b = cell.pts[1];
  let ang = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
  return ((ang % 90) + 90) % 90;
}

/** 两个轴向的环面距离（周期 90°）。 */
export const axisDelta = (a, b) => {
  const d = Math.abs(a - b) % 90;
  return Math.min(d, 90 - d);
};

/**
 * 补丁层（1459169210752507904「And another」）：片子里的四边格**不是逐格各转一个角度**，
 * 而是按整片共用一套轴向 —— 同一块补丁里所有方格朝向完全一致，补丁之间才出现缝与三角过渡带。
 *
 *   patchLayout(grid) → { patches, cellPatch, families, edgeKinds, edges, maxSpreadDeg, triangleCells }
 *
 * 族向优先取 `buildMixedGrid({constraintFamilies:true})` 记在 `cell.family` 上的生成期族向；
 * 没有就按当前几何吸附到最近族（这时 spread 会很大，正好用来说明"没钉族向就聚不出补丁"）。
 * 补丁 = 同族 + 共边的四边格连通块。
 */
export function patchLayout(grid, { wireframe = null } = {}) {
  if (!grid || !Array.isArray(grid.cells)) throw new RangeError('grid.cells must be an array');
  const wire = wireframe || classifyWireframe(grid);
  const quads = grid.cells.filter((c) => c.n === 4);
  const axis = new Map(quads.map((c) => [c.id, cellAxisDeg(c)]));
  const family = new Map(quads.map((c) => {
    const own = c.family;
    if (own != null) return [c.id, own];
    const a = axis.get(c.id);
    const cand = [0, 30, 60, 90].map((k) => ({ k: k % 90, d: axisDelta(a, k) })).sort((p, q) => p.d - q.d)[0];
    return [c.id, cand.k];
  }));
  const parent = new Map(quads.map((c) => [c.id, c.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const c of quads) {
    for (const nb of c.edgeNeighbors) {
      if (nb < 0 || !family.has(nb)) continue;
      if (family.get(nb) !== family.get(c.id)) continue;
      const ra = find(c.id), rb = find(nb);
      if (ra !== rb) parent.set(rb, ra);
    }
  }
  const groups = new Map();
  for (const c of quads) {
    const r = find(c.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c.id);
  }
  const patches = [...groups.entries()]
    .map(([root, cells]) => {
      const fam = family.get(cells[0]);
      const spread = cells.reduce((m, id) => Math.max(m, axisDelta(axis.get(id), fam)), 0);
      return { id: root, family: fam, cells, size: cells.length, spreadDeg: spread };
    })
    .sort((p, q) => q.size - p.size || p.family - q.family);
  const cellPatch = new Map();
  patches.forEach((p, i) => { p.index = i; for (const id of p.cells) cellPatch.set(id, i); });
  // 边：同补丁 = inner；两块补丁之间 = patchRim（片子里那圈紫/品红）；四边格↔三角格 = seam；只有一面 = rim
  const edges = wire.edges.map((e) => {
    const pa = cellPatch.has(e.faces[0]) ? cellPatch.get(e.faces[0]) : null;
    const pb = e.faces.length > 1 && cellPatch.has(e.faces[1]) ? cellPatch.get(e.faces[1]) : null;
    let kind;
    if (e.faces.length === 1) kind = 'rim';
    else if (pa != null && pb != null) kind = pa === pb ? 'inner' : 'patchRim';
    else if (pa == null && pb == null) kind = 'tri';
    else kind = 'seam';
    return { a: e.a, b: e.b, kind, faces: e.faces };
  });
  const edgeKinds = { inner: 0, patchRim: 0, seam: 0, tri: 0, rim: 0, other: 0 };
  for (const e of edges) edgeKinds[e.kind] = (edgeKinds[e.kind] || 0) + 1;
  const famCount = new Map();
  for (const v of family.values()) famCount.set(v, (famCount.get(v) || 0) + 1);
  return {
    patches,
    cellPatch,
    families: [...famCount.entries()].map(([family, cells]) => ({ family, cells })).sort((p, q) => q.cells - p.cells || p.family - q.family),
    edgeKinds,
    edges,
    maxSpreadDeg: patches.reduce((m, p) => Math.max(m, p.spreadDeg), 0),
    triangleCells: grid.cells.filter((c) => c.n === 3).map((c) => c.id),
    patchCount: patches.length,
    largest: patches[0] ? patches[0].size : 0,
  };
}
