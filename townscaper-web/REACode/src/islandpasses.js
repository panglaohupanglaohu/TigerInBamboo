/**
 * islandpasses.js — 同一套格子画三遍：等高线 / 线框 / 成图，三遍共用同一批格边。
 *
 * 帖子 ID：1669315384619540487（2017-01-11）
 *   原文：“The generator consistently spits out pretty cool islands now”
 *   画面（6 帧，640×640）：f00 是成图（黄绿台地岛、竖直崖壁、水线白沫）；
 *   f03 是一遍**纯等高线**——整张画布只有平底色 + 土黄色的一条条闭合线，连贴图
 *   和光照都没有：外圈那圈就是岸线，里面几条是台地之间的层界；线是**跟着格子
 *   走的折线**，不是光滑的插值曲线。f05 是贴近镜头的成图。
 *   也就是说"成图"不是一次画出来的，而是同一份高度场被过了三遍（轮廓 / 线框 / 填色）。
 *
 * 为什么值得单独写：
 *   台地地形的等高线与"层界"是同一个东西 —— 两条相邻格的取值只差一层 step，
 *   层界就落在它们共享的那条格边上。所以等高线这一遍**不需要另一套几何**：
 *   把所有"相邻两格层号不同"的格边挑出来，连起来就是等高线；挑出来再加一遍
 *   顶面边就是线框；填上颜色就是成图。三遍能对齐，靠的就是这套格边。
 *
 * 反面做法（下面也量了）：用 marching squares 在格心之间做线性插值求等值线。
 *   取样值只有层高的整数倍，插值点永远落在两格心的**中点**，于是等高线斜着切过
 *   格子内部、把直角台沿倒成 45° 斜角，总长也变短 —— 台地地形上这是错的。
 */

import { heights, CFG as TC } from './terracecliff.js';

export const CFG = {
  WATER: TC.WATER,
  STEP: TC.STEP,
  levels: 6,           // 层号上限（超过的忽略，画面里没有更高）
};

/** 量化台地高度场（复用 terracecliff 的同一座岛，不另造地形） */
export const grid = () => heights('terrace');

/** 层号：海 = -1，其余 = round(z / STEP) */
export function levelOf(z) {
  return z <= CFG.WATER ? -1 : Math.round(z / CFG.STEP);
}

/**
 * 等高线段 = 相邻两格层号不同时，它们共享的那条格边。
 * 返回的每条段都是格边本身（格角坐标 (i,j) 两点），所以"等高线贴在层界上"
 * 是构造保证，而不是拟合出来的。
 */
export function contourSegs(h) {
  const n = h.length;
  const L = h.map((row) => row.map(levelOf));
  const out = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // 与右邻的竖直格边：(x+1,y)-(x+1,y+1)
      if (x + 1 < n && L[y][x] !== L[y][x + 1])
        out.push({ a: [x + 1, y], b: [x + 1, y + 1], k: Math.max(L[y][x], L[y][x + 1]) });
      // 与下邻的水平格边：(x,y+1)-(x+1,y+1)
      if (y + 1 < n && L[y][x] !== L[y + 1][x])
        out.push({ a: [x, y + 1], b: [x + 1, y + 1], k: Math.max(L[y][x], L[y + 1][x]) });
    }
  }
  return out;
}

/** 把格边连成环：度 2 的连通块是闭合环，出现端点的是开口（触水 / 触边界） */
export function traceRings(segs) {
  const nb = new Map();
  const key = (p) => p[0] + ',' + p[1];
  for (const s of segs) {
    const a = key(s.a), b = key(s.b);
    if (!nb.has(a)) nb.set(a, []);
    if (!nb.has(b)) nb.set(b, []);
    nb.get(a).push(b); nb.get(b).push(a);
  }
  const seen = new Set();
  const rings = [];
  for (const start of nb.keys()) {
    if (seen.has(start)) continue;
    // BFS 取连通块
    const comp = []; const q = [start]; seen.add(start);
    while (q.length) {
      const v = q.pop(); comp.push(v);
      for (const w of nb.get(v)) if (!seen.has(w)) { seen.add(w); q.push(w); }
    }
    const openEnds = comp.filter((v) => nb.get(v).length === 1).length;
    rings.push({ size: comp.length, closed: openEnds === 0, openEnds });
  }
  return rings;
}

/** 线框：陆地格的**全部**顶面边（共享边去重），这是"线框那一遍"的全部几何 */
export function wireSegs(h) {
  const n = h.length;
  const land = (x, y) => x >= 0 && y >= 0 && x < n && y < n && h[y][x] > CFG.WATER;
  const seen = new Set();
  const out = [];
  const push = (a, b, z) => {
    const k = `${Math.min(a[0], b[0])},${Math.min(a[1], b[1])}-${Math.max(a[0], b[0])},${Math.max(a[1], b[1])}-${z.toFixed(3)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ a, b, z });
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!land(x, y)) continue;
      const z = h[y][x];
      push([x, y], [x + 1, y], z);
      push([x, y + 1], [x + 1, y + 1], z);
      push([x, y], [x, y + 1], z);
      push([x + 1, y], [x + 1, y + 1], z);
    }
  return out;
}

/** 岸线一圈：陆地格与海相邻的那几条边（= 外圈等高线） */
export function shoreSegs(h) {
  const n = h.length;
  const land = (x, y) => x >= 0 && y >= 0 && x < n && y < n && h[y][x] > CFG.WATER;
  const out = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!land(x, y)) continue;
      if (!land(x, y - 1)) out.push({ a: [x, y], b: [x + 1, y] });
      if (!land(x, y + 1)) out.push({ a: [x, y + 1], b: [x + 1, y + 1] });
      if (!land(x - 1, y)) out.push({ a: [x, y], b: [x, y + 1] });
      if (!land(x + 1, y)) out.push({ a: [x + 1, y], b: [x + 1, y + 1] });
    }
  return out;
}

/**
 * 对照：marching squares 的中点插值等高线。
 * 取样值只有层高的整数倍，跨边的插值点恒落在两格心的**中点**，
 * 于是等高线斜着切过格子内部、把直角台沿倒成斜角。
 * 坐标用格心系（格心在整数点），所以中点就是 x+0.5 / y+0.5。
 */
export function interpContour(h, t) {
  const n = h.length, out = [];
  for (let y = 0; y + 1 < n; y++)
    for (let x = 0; x + 1 < n; x++) {
      const c = [h[y][x], h[y][x + 1], h[y + 1][x + 1], h[y + 1][x]];
      const mids = [
        [x + 0.5, y], [x + 1, y + 0.5], [x + 0.5, y + 1], [x, y + 0.5],
      ];
      const cr = [];
      for (let e = 0; e < 4; e++) {
        const v0 = c[e], v1 = c[(e + 1) % 4];
        if ((v0 - t) * (v1 - t) < 0) cr.push(mids[e]);
      }
      if (cr.length === 2) out.push([cr[0], cr[1]]);
      else if (cr.length === 4) { out.push([cr[0], cr[1]]); out.push([cr[2], cr[3]]); }
    }
  return out;
}

export function measure() {
  const h = grid();
  const n = h.length;
  const segs = contourSegs(h);
  const rings = traceRings(segs);
  const wire = wireSegs(h);

  let land = 0;
  const lv = new Set();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const k = levelOf(h[y][x]);
      if (k >= 0) { land++; lv.add(k); }
    }

  const closed = rings.filter((r) => r.closed).length;
  const open = rings.length - closed;

  // 每条等高线段都必须是格边：端点都在整数格角上
  const onGrid = segs.filter((s) => s.a.every(Number.isInteger) && s.b.every(Number.isInteger)).length;

  // 插值版对照：同一层界阈值下的总长
  const crispLen = segs.length;                       // 每段长 1
  const interp = [];
  // 海面也是"层"（层号 -1），岸线那圈等高线就是 -1 → 0 的边界，别漏
  for (const k of [-1, ...[...lv].sort((a, b) => a - b)]) interp.push(...interpContour(h, (k + 1) * CFG.STEP));
  const interpLen = interp.reduce((s, [a, b]) => s + Math.hypot(a[0] - b[0], a[1] - b[1]), 0);

  return {
    n,
    grid_edges: n * (n - 1) * 2,           // 整个场里的格边总数
    land, levels: lv.size,
    contourSegs: segs.length,
    onGridPct: +(onGrid / segs.length * 100).toFixed(1),
    rings: rings.length,
    closed, open,
    ringSizes: rings.map((r) => r.size).sort((a, b) => b - a).slice(0, 6),
    wireEdges: wire.length,
    shoreEdges: shoreSegs(h).length,
    interpLen: +interpLen.toFixed(1),
    crispLen: +crispLen.toFixed(1),
    lenRatio: +(interpLen / crispLen).toFixed(3),
    interpSegs: interp.length,
  };
}
