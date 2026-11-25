/**
 * island-passes.js — 同一套格边画三遍：等高线 / 线框 / 成图（R43 嫁接自 REACode/src/islandpasses.js，原版只读不改）。
 *
 * 名字说明：Guide §10 把它记作「岛屿通道」，读原文后确认它不是「通道 / 航道」，而是 passes = 「遍」：
 * 同一份台地高度场被过三遍（轮廓 / 线框 / 填色）。帖子 1669315384619540487（2017-01-11）
 * "The generator consistently spits out pretty cool islands now"：f03 是一遍纯等高线，线跟着格子走、是折线不是插值曲线。
 *
 * 原版做的事（行为照搬，默认参数下与原版逐值一致）：
 *   contourSegs 相邻两格层号不同 → 它们共享的那条格边就是等高线段（「贴在层界上」是构造保证）；
 *   traceRings  把格边连成环：度 2 的连通块是闭合环，有端点的是开口；
 *   wireSegs    陆地格全部顶面边（共享边去重）= 线框那一遍；shoreSegs 陆地与海相邻的边 = 外圈等高线；
 *   interpContour 反面对照：marching squares 中点插值，会把直角台沿倒成 45° 斜角、总长变短。
 * 和原版不同（登记在 catalog/parity/relief.passes.json）：
 *   - 原版 levelOf / contourSegs / wireSegs / shoreSegs 读模块常量 CFG（WATER 0.35、STEP 0.9）；这里多一个可选 cfg 参数，
 *     可以对任意高度场（例如地貌管线的米制高度 + 层高）用；不传时与原版一致。
 *   - 原版 measure() 只能量自己的演示岛；这里 measure(h = grid(), cfg) 可以量任意场。
 *   - 原版 traceRings 用 Map 的插入顺序遍历，环的顺序依赖格边顺序；这里不变（对照里比的是排序后的环大小）。
 */
import { heights, CFG as TC } from './terrace-field.js';

export const CFG = Object.freeze({
  WATER: TC.WATER,
  STEP: TC.STEP,
  levels: 6,
});

export const grid = () => heights('terrace');

export function levelOf(z, cfg = CFG) {
  return z <= cfg.WATER ? -1 : Math.round(z / cfg.STEP);
}

export function contourSegs(h, cfg = CFG) {
  const n = h.length;
  const L = h.map((row) => row.map((z) => levelOf(z, cfg)));
  const out = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (x + 1 < n && L[y][x] !== L[y][x + 1])
        out.push({ a: [x + 1, y], b: [x + 1, y + 1], k: Math.max(L[y][x], L[y][x + 1]) });
      if (y + 1 < n && L[y][x] !== L[y + 1][x])
        out.push({ a: [x, y + 1], b: [x + 1, y + 1], k: Math.max(L[y][x], L[y + 1][x]) });
    }
  }
  return out;
}

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

export function wireSegs(h, cfg = CFG) {
  const n = h.length;
  const land = (x, y) => x >= 0 && y >= 0 && x < n && y < n && h[y][x] > cfg.WATER;
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

export function shoreSegs(h, cfg = CFG) {
  const n = h.length;
  const land = (x, y) => x >= 0 && y >= 0 && x < n && y < n && h[y][x] > cfg.WATER;
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

export function measure(h = grid(), cfg = CFG) {
  const n = h.length;
  const segs = contourSegs(h, cfg);
  const rings = traceRings(segs);
  const wire = wireSegs(h, cfg);

  let land = 0;
  const lv = new Set();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const k = levelOf(h[y][x], cfg);
      if (k >= 0) { land++; lv.add(k); }
    }

  const closed = rings.filter((r) => r.closed).length;
  const open = rings.length - closed;
  const onGrid = segs.filter((s) => s.a.every(Number.isInteger) && s.b.every(Number.isInteger)).length;

  const crispLen = segs.length;
  const interp = [];
  for (const k of [-1, ...[...lv].sort((a, b) => a - b)]) interp.push(...interpContour(h, (k + 1) * cfg.STEP));
  const interpLen = interp.reduce((s, [a, b]) => s + Math.hypot(a[0] - b[0], a[1] - b[1]), 0);

  return {
    n,
    grid_edges: n * (n - 1) * 2,
    land, levels: lv.size,
    contourSegs: segs.length,
    onGridPct: +(onGrid / segs.length * 100).toFixed(1),
    rings: rings.length,
    closed, open,
    ringSizes: rings.map((r) => r.size).sort((a, b) => b - a).slice(0, 6),
    wireEdges: wire.length,
    shoreEdges: shoreSegs(h, cfg).length,
    interpLen: +interpLen.toFixed(1),
    crispLen: +crispLen.toFixed(1),
    lenRatio: +(interpLen / crispLen).toFixed(3),
    interpSegs: interp.length,
  };
}

/** 地貌管线用：行优先一维高度（米，海 = NaN / ≤ 0）→ 二维行数组（海写成 water − 1，与原版海格一样低于水线） */
export function rowsOf(h, n, water = 0) {
  const rows = [];
  for (let y = 0; y < n; y++) { const r = []; for (let x = 0; x < n; x++) { const v = h[y * n + x]; r.push(Number.isFinite(v) && v > water ? v : water - 1); } rows.push(r); }
  return rows;
}
