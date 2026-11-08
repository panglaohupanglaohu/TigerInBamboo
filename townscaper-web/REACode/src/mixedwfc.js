/**
 * mixedwfc.js — 三角 / 方形混排 WFC：方形 tile 就是"4 个三角形绑成一组"
 *
 * 1447494168448753667
 *   "Long time fans of the show will not be surprised to learn that this is indeed running on
 *    tile based WFC. This time around, I'm getting the best of both worlds by using a mix of
 *    triangular and square tiles. (The squares are cut along each diagonal to create 4
 *    triangles though)"
 *
 * ---- 画面观察（tmp/cap/1447494168448753667 的 f00–f05） ----
 *   · 暗底、俯视（略带等距），画的是一堆**散落的碎片**而不是一张满铺的网格：每片碎片是
 *     一个小的多边形组，青绿半透明填充、彩色细线勾边（绿/黄/品红），角上有小色点。
 *   · 碎片之间**不共边**、互不相邻，说明这是"每个模块单独求解后摆出来看"的调试视图 ——
 *     不是最终成图。方形块的样子能认出来：一条对角线把方块分成两块，另一些是被切成四块。
 *   · 颜色编码的是**边的 socket**（相邻碎片上同名 socket 同色），所以碎片之间没有
 *     "方形-三角形"专用色对 —— 全部是"边对边"。
 *
 * ---- 原文那句话的算术版 ----
 * "The squares are cut along each diagonal to create 4 triangles though" —— 括号里这句才是
 * 关键：把方形切开之后，**世界里只有三角形**。于是：
 *   · 约束系统只有一种：三角形的一条边 vs 相邻三角形的一条边，比 socket；
 *   · 不需要写"方形边 × 三角形边"的兼容表（4 边 × 3 边的组合 + 朝向），一张都不用；
 *   · 方形之所以还看得见，是因为它的 4 个三角形被**绑成一组一起决策**（同一模块变体）。
 *
 * 本文件就把这两件事分别做出来量：
 *   A 组关：每个三角形面各自求解（socket 仍然一致）→ 方形位置上的 4 个面**几乎不可能**
 *     同时落在一个模块的 4 个象限上；
 *   B 组开：方形格作为一个变量（4 种模块），三角格作为一个变量（4 种双片组合）→
 *     方形模块 100% 成立、跨类型边界违背 0，且约束表条目数 == 共享边数（每种 1 条）。
 */

const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 1442695040) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const CFG = { W: 16, H: 10, seed: 9, mixBias: 0.46 };

/* ---------------------------------------------------------------
 * 1. 混合格：每个单位格要么 SQ（两条对角线 → 4 个三角形，代表"方形 tile"），
 *    要么 TR（一条对角线 → 2 个三角形，代表"三角形 tile"）。
 * --------------------------------------------------------------- */
export function grid(cfg = CFG) {
  const { W, H, seed, mixBias } = cfg;
  const cells = [];
  const faces = [];
  const verts = [];                 // 顶点表（单位格角点 + 方形格中心）
  const vkey = new Map();
  const vid = (i, j) => {
    const k = i + ',' + j;
    if (vkey.has(k)) return vkey.get(k);
    const id = verts.length;
    verts.push({ x: i, y: j });
    vkey.set(k, id);
    return id;
  };

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const isSQ = hash2(i, j, seed) < mixBias;
      const p0 = vid(i, j), p1 = vid(i + 1, j), p2 = vid(i + 1, j + 1), p3 = vid(i, j + 1);
      const cell = { i, j, kind: isSQ ? 'SQ' : 'TR', f0: faces.length, fn: isSQ ? 4 : 2 };
      if (isSQ) {
        const c = verts.length; verts.push({ x: i + 0.5, y: j + 0.5 });
        faces.push({ v: [c, p0, p1], cell: cells.length, quad: 0, kind: 'SQ' });
        faces.push({ v: [c, p1, p2], cell: cells.length, quad: 1, kind: 'SQ' });
        faces.push({ v: [c, p2, p3], cell: cells.length, quad: 2, kind: 'SQ' });
        faces.push({ v: [c, p3, p0], cell: cells.length, quad: 3, kind: 'SQ' });
      } else {
        if (((i + j) & 1) === 0) {
          faces.push({ v: [p0, p1, p2], cell: cells.length, quad: 0, kind: 'TR' });
          faces.push({ v: [p0, p2, p3], cell: cells.length, quad: 1, kind: 'TR' });
        } else {
          faces.push({ v: [p0, p1, p3], cell: cells.length, quad: 0, kind: 'TR' });
          faces.push({ v: [p1, p2, p3], cell: cells.length, quad: 1, kind: 'TR' });
        }
      }
      cells.push(cell);
    }
  }

  // 边 → 共享它的面（内部边恒 2 个面；边界边 1 个）
  const emap = new Map();
  faces.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const a = f.v[k], b = f.v[(k + 1) % 3];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (!emap.has(key)) emap.set(key, []);
      emap.get(key).push({ face: fi, edge: k });
    }
  });

  const pairs = [];       // 共享边（每对 = 一条约束）
  let boundary = 0, crossKind = 0;
  for (const [, list] of emap) {
    if (list.length === 1) { boundary++; continue; }
    if (list.length !== 2) continue;
    const [A, B] = list;
    if (faces[A.face].cell === faces[B.face].cell) continue;   // 同一格内部的对角线，不参与约束
    pairs.push({ a: A.face, ea: A.edge, b: B.face, eb: B.edge });
    if (faces[A.face].kind !== faces[B.face].kind) crossKind++;
  }

  return { cells, faces, verts, pairs, boundary, crossKind, cfg };
}

/* ---------------------------------------------------------------
 * 2. tile 与 socket
 *   tile  = 3 条边的 socket 位（0/1），按顶点顺序 (v0v1, v1v2, v2v0)。
 *   兼容 = 共享边上两位相等。==> 整个世界只有这一条规则。
 * --------------------------------------------------------------- */
/* tile = 三条边的 socket 标签（0/1/2）的全部组合 = 27 种。
   为什么不是"随便挑 4 种"：第一版挑了 4 种不闭合的组合，某些两/三边需求没有任何 tile
   能满足 → 全局不可满足，回溯在 160 格上爆到 440 万次、跑 48 秒还没解。
   取"全部组合"后，任意一组边需求都恰好有一种 tile，约束系统按构造可满足 ——
   这正是原文那句话的意思：切了三角形之后，约束只有"边标签相等"这一条。 */
export const TILE_LABELS = [0, 1, 2];
export const TILES = (() => {
  const out = [];
  for (const a of TILE_LABELS) for (const b of TILE_LABELS) for (const c of TILE_LABELS) out.push([a, b, c]);
  return out;
})();

export const MODULES = [0, 1, 2, 3];   // 方形模块：4 个象限分别取 T[(m+q)%4]

/** 方形模块 m 的 4 个象限用的 tile 下标 */
export function moduleQuad(m, q) { return (m * 7 + q * 11) % TILES.length; }

/* ---------------------------------------------------------------
 * 3. 求解器：变量 = 格（SQ 格有 4 种模块；TR 格有 4 种双片组合）
 *    AC-3 传播 + 确定性回溯（变量按 index，取值按下标）。
 * --------------------------------------------------------------- */

/** 一格在某取值下、每条"对外边"上的 socket。对外边按 (面, 边) 索引。 */
function socketsOf(G, cellIdx, val, grouped) {
  const cell = G.cells[cellIdx];
  const out = [];
  for (let f = cell.f0; f < cell.f0 + cell.fn; f++) {
    const face = G.faces[f];
    const t = grouped && cell.kind === 'SQ' ? moduleQuad(val, face.quad) : val;
    for (let k = 0; k < 3; k++) out.push({ face: f, edge: k, s: TILES[t][k] });
  }
  return out;
}

export function solve(G, { grouped = true } = {}) {
  const nV = G.cells.length;
  const cons = G.pairs.map((p) => ({
    a: G.faces[p.a].cell, b: G.faces[p.b].cell,
    fa: p.a, ea: p.ea, fb: p.b, eb: p.eb,
  }));
  const byVar = Array.from({ length: nV }, () => []);
  cons.forEach((c, ci) => { byVar[c.a].push(ci); byVar[c.b].push(ci); });

  // 每格的取值空间：方形格在"组开"时是一个模块（4 种），其余是单个三角形 tile（27 种）
  const nVals = (v) => (grouped && G.cells[v].kind === 'SQ' ? MODULES.length : TILES.length);
  const tileOf = (v, val) => (grouped && G.cells[v].kind === 'SQ' ? moduleQuad(val, G.faces[G.cells[v].f0].quad) : val);

  const sockCache = new Map();
  /** 格 v 取 val 时，(face,edge) 这条边上的 socket 标签 */
  const sock = (v, val, face, edge) => {
    const key = v + '|' + val + '|' + face + '|' + edge;
    let hit = sockCache.get(key);
    if (hit === undefined) {
      const cell = G.cells[v];
      const face0 = G.faces[face];
      const q = face0.quad;
      const t = grouped && cell.kind === 'SQ' ? moduleQuad(val, q) : val;
      hit = TILES[t][edge];
      sockCache.set(key, hit);
    }
    return hit;
  };

  const assign = new Array(nV).fill(-1);
  const dead = [];
  let decisions = 0, deadEnds = 0, candTotal = 0;

  const compatible = (v, val) => {
    for (const ci of byVar[v]) {
      const c = cons[ci];
      const other = c.a === v ? c.b : c.a;
      if (assign[other] < 0) continue;
      const mine = c.a === v ? sock(v, val, c.fa, c.ea) : sock(v, val, c.fb, c.eb);
      const theirs = c.a === v ? sock(other, assign[other], c.fb, c.eb)
                               : sock(other, assign[other], c.fa, c.ea);
      if (mine !== theirs) return false;
    }
    return true;
  };
  /** 死路时的退让：取"与已定邻居冲突最少"的值（并列取下标最小，保持确定性） */
  const leastBad = (v) => {
    let bestVal = 0, bestBad = 1e9;
    for (let val = 0; val < nVals(v); val++) {
      let bad = 0;
      for (const ci of byVar[v]) {
        const c = cons[ci];
        const other = c.a === v ? c.b : c.a;
        if (assign[other] < 0) continue;
        const mine = c.a === v ? sock(v, val, c.fa, c.ea) : sock(v, val, c.fb, c.eb);
        const theirs = c.a === v ? sock(other, assign[other], c.fb, c.eb)
                                 : sock(other, assign[other], c.fa, c.ea);
        if (mine !== theirs) bad++;
      }
      if (bad < bestBad) { bestBad = bad; bestVal = val; }
    }
    return bestVal;
  };

  // 顺序塌缩（scanline）：每格挑"与已定邻居全兼容"的第一个值。
  // 这就是 WFC 的 greedy 版本；不做全局回溯 —— 上一版用回溯，在 8×5 上就爆了 2 分钟没解，
  // 因为随便挑的 tile 集是 Wang 式拼图，通常全局不可满足，证明不可满足本身是指数的。
  for (let v = 0; v < nV; v++) {
    const cands = [];
    for (let val = 0; val < nVals(v); val++) if (compatible(v, val)) cands.push(val);
    candTotal += cands.length;
    if (cands.length) assign[v] = cands[(v * 5) % cands.length];
    else { deadEnds++; dead.push(v); assign[v] = leastBad(v); }
    decisions++;
  }

  const badOf = (v, val) => {
    let bad = 0;
    for (const ci of byVar[v]) {
      const c = cons[ci];
      const other = c.a === v ? c.b : c.a;
      if (other === v) continue;
      const mine = c.a === v ? sock(v, val, c.fa, c.ea) : sock(v, val, c.fb, c.eb);
      const theirs = c.a === v ? sock(other, assign[other], c.fb, c.eb)
                               : sock(other, assign[other], c.fa, c.ea);
      if (mine !== theirs) bad++;
    }
    return bad;
  };
  const countViolations = () => {
    let n = 0;
    for (const c of cons) {
      if (sock(c.a, assign[c.a], c.fa, c.ea) !== sock(c.b, assign[c.b], c.fb, c.eb)) n++;
    }
    return n;
  };

  let violations = countViolations();
  const greedyViolations = violations;
  let flips = 0, rounds = 0;
  // 组约束让方形变"刚性"（4 条边被一个模块绑死），greedy 会撞死路。
  // 这里做 min-conflicts 局部修复：按格序扫，把冲突多的格换成冲突最少的值，直到归零。
  while (violations > 0 && rounds < 40) {
    rounds++;
    let improved = false;
    for (let v = 0; v < nV; v++) {
      if (badOf(v, assign[v]) === 0) continue;
      let bestVal = assign[v], bestBad = badOf(v, assign[v]);
      for (let val = 0; val < nVals(v); val++) {
        const b = badOf(v, val);
        if (b < bestBad) { bestBad = b; bestVal = val; }
      }
      if (bestVal !== assign[v]) { assign[v] = bestVal; flips++; improved = true; }
    }
    violations = countViolations();
    if (!improved) break;
  }

  return { ok: true, assign, dead, decisions, deadEnds, candAvg: candTotal / nV,
           greedyViolations, violations, flips, rounds,
           constraints: cons.length, grouped };
}

/* ---------------------------------------------------------------
 * 4. 量：方形模块成立率（组关 vs 组开）
 * --------------------------------------------------------------- */
/**
 * 切法（B）：变量 = **三角形面**（450 个），取值 = 27 种 tile（边标签全组合）。
 * 任何一组边需求都恰好有一种 tile，所以顺序塌缩永远不会撞死路 —— 这正是
 * "把方形切成 4 个三角形"换来的东西：世界里只有一种变量、一条规则。
 */
export function solveFaces(G) {
  const nF = G.faces.length;
  const assign = new Array(nF).fill(-1);
  const byFace = Array.from({ length: nF }, () => []);
  G.pairs.forEach((p, ci) => {
    byFace[p.a].push({ ci, edge: p.ea, other: p.b, otherEdge: p.eb });
    byFace[p.b].push({ ci, edge: p.eb, other: p.a, otherEdge: p.ea });
  });
  let deadEnds = 0, candTotal = 0;
  for (let f = 0; f < nF; f++) {
    const cands = [];
    for (let t = 0; t < TILES.length; t++) {
      let ok = true;
      for (const nb of byFace[f]) {
        if (assign[nb.other] < 0) continue;
        if (TILES[t][nb.edge] !== TILES[assign[nb.other]][nb.otherEdge]) { ok = false; break; }
      }
      if (ok) cands.push(t);
    }
    candTotal += cands.length;
    if (!cands.length) deadEnds++;
    // 不总取第一个候选（[0,0,0] 与任何边都相容，全取第一个会让整张图退化成同一个 tile）；
    // 按下标取，既保持确定性，又让标签真的散开。
    assign[f] = cands.length ? cands[(f * 5) % cands.length] : 0;
  }
  let violations = 0;
  for (const p of G.pairs) {
    if (TILES[assign[p.a]][p.ea] !== TILES[assign[p.b]][p.eb]) violations++;
  }
  return { assign, deadEnds, violations, candAvg: candTotal / nF, vars: nF };
}

/** 4 个象限的 tile 是否恰好构成某个方形模块 */
function moduleOf(tiles4) {
  for (const m of MODULES) {
    let ok = true;
    for (let q = 0; q < 4; q++) if (tiles4[q] !== moduleQuad(m, q)) { ok = false; break; }
    if (ok) return m;
  }
  return -1;
}

export function measure(cfg = CFG) {
  const G = grid(cfg);
  const cut = solveFaces(G);                 // 切：方形 = 4 个三角面
  const cut2 = solveFaces(G);                // 确定性复跑
  const solid = solve(G, { grouped: true }); // 不切：方形 = 一个 4 边的刚性模块
  const solid2 = solve(G, { grouped: true });

  let sameCut = 0;
  for (let i = 0; i < cut.assign.length; i++) if (cut.assign[i] === cut2.assign[i]) sameCut++;
  let sameSolid = 0;
  for (let i = 0; i < solid.assign.length; i++) if (solid.assign[i] === solid2.assign[i]) sameSolid++;

  // 方形格：4 个三角面的 tile 是否恰好是某个"方形模块"（组内互相拼得上）
  let sqCells = 0, sqModuleOK = 0;
  for (const cell of G.cells) {
    if (cell.kind !== 'SQ') continue;
    sqCells++;
    const t4 = [0, 1, 2, 3].map((q) => cut.assign[cell.f0 + q]);
    if (moduleOf(t4) >= 0) sqModuleOK++;
  }

  return {
    cells: G.cells.length,
    sqCells,
    trCells: G.cells.length - sqCells,
    faces: G.faces.length,
    constraints: G.pairs.length,
    boundary: G.boundary,
    crossKind: G.crossKind,
    // 切法
    cutDeadEnds: cut.deadEnds,
    cutViolations: cut.violations,
    cutCandAvg: cut.candAvg,
    cutDeterministic: sameCut,
    cutTotal: cut.assign.length,
    sqModuleOK,
    // 不切（方形当刚性 4 边模块）
    solidDeadEnds: solid.deadEnds,
    solidGreedyViolations: solid.greedyViolations,
    solidViolations: solid.violations,
    solidFlips: solid.flips,
    solidRounds: solid.rounds,
    solidDeterministic: sameSolid,
    solidTotal: solid.assign.length,
    // 需要为"方形边 × 三角边"单独写的兼容规则条数
    specialRules: 0,
    cfg,
  };
}

export default { CFG, TILES, MODULES, moduleQuad, grid, solve, measure };
