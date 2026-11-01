/**
 * adjacency.js — 从网格本身抽邻接（不靠命名约定），以及"哪些装得上"的查询。
 *
 * 原文（x.com/OskSta/status/795010582239997952, 2016-11-05）：
 *
 *   "I extract my adjacency data from the mesh (no tedious naming conventions
 *    needed) Plus I wrote a little tool to show which ones fit"
 *
 * 画面（24 帧，436×460，近景）：
 *   · 灰白的一栋房子转角，有窗、有落水管、有一圈檐口；
 *   · 选中的那个小模块（一个窗户/阳台）外面套着一层**线框盒子**，
 *     盒子的八个角上各有一个白点（顶点标记），边框是细白线；
 *   · 线框外还有几根**黄绿色短线**沿着某些边描出去（第 3~7 帧沿竖向、
 *     第 9~14 帧沿横向的窗台），像在说"这条边能接"；
 *   · 镜头围着转角缓慢推近，没有别的 UI —— 就是一个建模工具里的选中断言。
 *
 * 这两件事的关系：
 *   "从网格里抽邻接"是数据，"哪些装得上"是这个数据的查询界面。
 *   原文强调 "no tedious naming conventions"：他没有给每个插槽起名
 *   （`wall_left_socket_a`），而是**拿几何当契约** —— 两条边如果
 *   「长度相同、方向同一类、顶点数相同」，它们就装得上。所以插槽不需要人工登记，
 *   新做一个模块，丢进去自动就知道它能接哪。
 *
 * 为什么本项目需要它：
 *   项目里现在的格子邻接是 `grid.js` 在生成时顺手塞进 `cell.edgeNeighbors` 的
 *   （靠下标对齐）。这有个隐患：任何一步改动（松弛、修复翻转、按需重建）
 *   只要顶点顺序变了，`edgeNeighbors[i]` 就悄悄错位，而错误不会报，
 *   只会在画面里表现为"某几格道具朝错方向"。
 *   这里改用**几何**重新抽一遍，并和 `edgeNeighbors` 对账 —— 对不上就是上面那种错位。
 *
 * 这个文件不 import three；网格用 {verts:[{x,y,z}], tris:[[i,j,k]]} 或格子 pts 都可以。
 * `selfCheck()` 会真的建一次网格、抽出邻接、和 cell.edgeNeighbors 逐条比对，
 * 并统计"哪些装得上"的插槽数。
 */

const EPS = 1e-4;

/** 量化坐标做 key：直接拼浮点数会把同一条边拆成两条。 */
function vkey(x, y, z, eps = EPS) {
  return `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
}

function ekey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * 从三角形汤里抽边表。
 * @returns {{edges:Map<string,{a:number,b:number,faces:number[]}>, pairs:Array<[number,number,string]>, boundary:string[]}}
 */
export function meshEdges(verts, tris, eps = EPS) {
  // 先把"坐标相同但索引不同"的顶点合并（导出/合并网格后极常见）
  const canon = new Map();
  const remap = new Int32Array(verts.length);
  const pos = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const k = vkey(v.x, v.y, v.z, eps);
    if (!canon.has(k)) { canon.set(k, pos.length); pos.push({ x: v.x, y: v.y, z: v.z }); }
    remap[i] = canon.get(k);
  }

  const edges = new Map();
  for (let f = 0; f < tris.length; f++) {
    const t = tris[f];
    for (let i = 0; i < 3; i++) {
      const a = remap[t[i]], b = remap[t[(i + 1) % 3]];
      if (a === b) continue;                  // 退化边
      const k = ekey(a, b);
      let e = edges.get(k);
      if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] }; edges.set(k, e); }
      if (!e.faces.includes(f)) e.faces.push(f);
    }
  }

  const pairs = [];
  const boundary = [];
  for (const [k, e] of edges) {
    if (e.faces.length === 2) pairs.push([e.faces[0], e.faces[1], k]);
    else if (e.faces.length === 1) boundary.push(k);
    // >2 = 非流形，留着不报错，交给调用方看 boundary/nonManifold 计数
  }
  return { edges, pairs, boundary, merged: pos, remap };
}

/**
 * 边的"契约"签名：方向和长度分桶。
 * 这就是原文说的"没有命名约定" —— 两条边签名相同即为可对接。
 */
export function edgeSignature(pos, a, b, { lenBucket = 0.05, dirBucket = 0.13 } = {}) {
  const p = pos[a], q = pos[b];
  const d = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
  const len = Math.hypot(d.x, d.y, d.z) || 1e-9;
  // 方向取"无向"（±v 视为同一轴），否则镜像模块永远装不上
  const ax = Math.abs(d.x / len), ay = Math.abs(d.y / len), az = Math.abs(d.z / len);
  const dirKey = [ax, ay, az].map((v) => Math.round(v / dirBucket)).join(',');
  return { lenKey: Math.round(len / lenBucket), len, dirKey, a, b };
}

/**
 * 造一张"谁能接谁"的表：把模块库里所有模块的所有边签名分桶。
 * @param {Array<{name:string, verts:Array, tris:Array}>} modules
 */
export function buildFitTable(modules, opts) {
  const buckets = new Map();
  const table = modules.map((m, mi) => {
    const { edges, merged } = meshEdges(m.verts, m.tris);
    const sigs = [];
    for (const [k, e] of edges) {
      const s = edgeSignature(merged, e.a, e.b, opts);
      const bk = `${s.lenKey}|${s.dirKey}`;
      if (!buckets.has(bk)) buckets.set(bk, []);
      buckets.get(bk).push({ module: mi, edge: k });
      sigs.push({ key: k, ...s });
    }
    return { name: m.name, edges: sigs, merged };
  });
  return { buckets, table };
}

/**
 * "哪些装得上"：给定模块 m 的某条边，列出模块库里所有能接上的（模块, 边）。
 */
export function whichFits(fit, moduleIdx, edgeKey) {
  const m = fit.table[moduleIdx];
  const sig = m.edges.find((e) => e.key === edgeKey);
  if (!sig) return [];
  const bk = `${sig.lenKey}|${sig.dirKey}`;
  return (fit.buckets.get(bk) || []).filter((c) => !(c.module === moduleIdx && c.edge === edgeKey));
}

/**
 * 格子版的插槽：每个四边形格子的 4 条边就是一个插槽。
 * 全部从 `cell.pts` 的几何抽，不看 `edgeNeighbors`。
 *
 * @returns {Array<{cell:number, edge:number, a:{x,z}, b:{x,z}, len:number, neighbor:number, dh:number}>}
 */
export function gridEdgeSlots(grid, town, { maxDelta = 1 } = {}) {
  // 几何邻接：共享一条边（两个端点坐标都相同）的两个格子。
  const byEdge = new Map();
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const pts = cells[i].pts;
    const n = pts.length;                       // 四边形 = 4
    for (let e = 0; e < n; e++) {
      const p = pts[e], q = pts[(e + 1) % n];
      const ka = vkey(p.x, 0, p.z);
      const kb = vkey(q.x, 0, q.z);
      const k = ka < kb ? `${ka}#${kb}` : `${kb}#${ka}`;
      if (!byEdge.has(k)) byEdge.set(k, []);
      byEdge.get(k).push({ cell: i, edge: e });
    }
  }

  const slots = [];
  for (const [, users] of byEdge) {
    for (const u of users) {
      const other = users.find((v) => v.cell !== u.cell);
      const pts = cells[u.cell].pts;
      const p = pts[u.edge], q = pts[(u.edge + 1) % pts.length];
      const dh = other ? Math.abs(town.top(cells[other.cell]) - town.top(cells[u.cell])) : Infinity;
      slots.push({
        cell: u.cell, edge: u.edge,
        a: { x: p.x, z: p.z }, b: { x: q.x, z: q.z },
        len: Math.hypot(q.x - p.x, q.z - p.z),
        neighbor: other ? other.cell : -1,
        neighborEdge: other ? other.edge : -1,
        dh,
        fits: other ? dh <= maxDelta : false,
      });
    }
  }
  return slots;
}

/**
 * 自检：几何抽出来的邻接 vs `cell.edgeNeighbors`（网格生成时塞的那份）。
 * 两者不一致 = 顶点顺序被某一步改过，画面里会表现为道具朝向错。
 */
export function selfCheck(grid, town, { maxDelta = 1 } = {}) {
  const cells = grid.cells;

  const slots = gridEdgeSlots(grid, town, { maxDelta });

  // 逐格逐边对账
  let checked = 0, mismatched = 0;
  const bad = [];
  for (const s of slots) {
    const claimed = cells[s.cell].edgeNeighbors?.[s.edge] ?? -1;
    const geo = s.neighbor;
    if (geo === -1) continue;                   // 边界边，没有声明可比
    checked++;
    if (claimed !== geo) {
      mismatched++;
      if (bad.length < 5) bad.push({ cell: s.cell, edge: s.edge, claimed, geo });
    }
  }

  const fitCount = slots.filter((s) => s.fits).length;
  const lens = slots.map((s) => s.len).sort((a, b) => a - b);
  return {
    cells: cells.length,
    slots: slots.length,
    slotsPerCell: +(slots.length / cells.length).toFixed(2),
    edgesChecked: checked,
    mismatched,
    mismatchRate: checked ? +(mismatched / checked).toFixed(4) : 0,
    samples: bad,
    fitSlots: fitCount,
    fitRate: slots.length ? +(fitCount / slots.length).toFixed(3) : 0,
    edgeLenMedian: lens.length ? +lens[lens.length >> 1].toFixed(3) : 0,
    edgeLenCv: (() => {
      const m = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
      const sd = Math.sqrt(lens.reduce((a, b) => a + (b - m) ** 2, 0) / (lens.length || 1));
      return +(sd / (m || 1)).toFixed(3);
    })(),
  };
}
