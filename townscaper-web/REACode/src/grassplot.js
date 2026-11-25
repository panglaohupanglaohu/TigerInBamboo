/**
 * grassplot.js — 草地地块：连通的格子并成一块，外圈压一条浅色路缘，最外面一条深色描线
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1178731576982724611（2019-09-30）：
 *     "I made some grassy plots. I'm real happy with the shapes they make.
 *      Eventually, they'll grow some trees and the like."
 *
 *   原文只说了两件事：① 这些是 **plot**（地块，不是一个 tile 一块草）；② 他满意的是
 *   **shape**（形状）—— 不是颜色、不是贴图。所以这条的核心是"形状怎么长出来的"，
 *   颜色只是配套。原文没提路缘，路缘是**画面里量出来的**。
 *
 * ── 帧实测（512²，f012；f000 / f023 复算一致）────────────────────────────
 *   横穿一块地的逐像素剖面（y=254，x 415→430）：
 *       415 (110,111,110)  铺地灰
 *       417 ( 13, 16, 14)  ← **1px 近黑描线**（在外侧）
 *       419 (119,121,117)
 *       420 (141,142,136)
 *       421 (160,159,153)  ┐
 *       422 (149,146,141)  ├ **浅色路缘带，5px**：(156,155,149) 附近
 *       423 (142,139,129)  ┘
 *       424 ( 93, 89, 72)  ← **1px 内侧暗缝**（路缘压草的阴影）
 *       425+ (115,114,81)  草
 *   → 顺序是 铺地 → 深描线 → 浅路缘 → 暗缝 → 草。**路缘在描线里面**，
 *     第一版按"描线在最外圈包住整个地块"画，草就直接贴到深线上了，像贴纸。
 *   草 (115,114,80) #73734F；路缘 (156,155,149) #9B9995；暗缝 (91,88,66) #5B5842
 *   草占画面 10.98%（按 g>r-8 且 g>b+10 的橄榄色统计）
 *   地块形状：**格子并集的边界** —— 每段都是格子边（±30° / 0°），拐角被磨圆
 *     （Chaikin 两次，屏幕定宽 ~3px），凹口保留（不是凸包）。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **地块 = 连通格子集合的边界环**，不是"每格画个圆角方块"。片子里的凹口（两块
 *      地夹出来的楔形缺口）只在并集边界上出现；逐格画会把凹口填平。
 *   ② **路缘必须内缩，不能 stroke 原折线。** stroke 有一半线宽落到地块外面，
 *      路缘会盖住铺地，而且描线跑到路缘外面（顺序反了）。这里用
 *      `fill(odd-even, [外环, 内缩环])` 画出真正的环。
 *   ③ **圆角在屏幕空间做**（Chaikin），不是在格空间：片子里拐角半径是屏幕定宽的，
 *      格空间磨圆会让近处的地块拐角更大。
 */

import { chainLoops } from './rimline.js';

export const MEASURED = {
  frame: 512,
  grass: [115, 114, 80],
  grassSpeckle: 7,          // 草面抖动幅度（±），实测同色像素 std ≈ 3.2
  curb: [156, 155, 149],
  curbLit: [186, 184, 176], // 路缘上沿受光的一条（+30）
  seam: [91, 88, 66],       // 路缘压草的 1px 暗缝
  outline: [28, 30, 29],    // 最外 1px 描线
  pave: [128, 127, 124],
  curbW: 5,                 // px（片中）
  outlineW: 1,
  seamW: 1,
  cornerRound: 2,           // Chaikin 次数
  grassPct: 10.98,          // 片中草地占比 %
  tilePitch: 22,            // 片中一格的屏幕跨度（与 voxdebug 的 22×20 游标同源）
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgbCss = (c) => rgba(c);

/** 等距投影：格空间 → 屏幕。p 是"一格"的屏幕跨度。 */
export function makeCam({ cx, cy, p = MEASURED.tilePitch, scale = 1 } = {}) {
  const k = p * scale;
  return {
    p: k,
    scale,
    pt: (u, v) => [cx + (u - v) * 0.866 * k, cy + (u + v) * 0.5 * k],
  };
}

/**
 * 格子并集 → 边界段。
 * 每格四条边，只有邻居不在集合里时才是一条边界边。
 * ⚠ 段是无向的：相邻两格共享的那条边只属于"在集合里的那一格"，所以不会重复；
 *   但串环时仍要按无向串（chainLoops 已处理），否则环会断成一把短线。
 */
export function plotEdges(tiles) {
  const key = (x, y) => x + ',' + y;
  const has = (x, y) => tiles.has(key(x, y));
  const segs = [];
  for (const t of tiles) {
    const [x, y] = t.split(',').map(Number);
    if (!has(x, y - 1)) segs.push({ x0: x, y0: y, x1: x + 1, y1: y, h: 0 });
    if (!has(x + 1, y)) segs.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1, h: 0 });
    if (!has(x, y + 1)) segs.push({ x0: x + 1, y0: y + 1, x1: x, y1: y + 1, h: 0 });
    if (!has(x - 1, y)) segs.push({ x0: x, y0: y + 1, x1: x, y1: y, h: 0 });
  }
  return segs;
}

function chaikin(pts, closed, iters = 1) {
  let out = pts;
  for (let it = 0; it < iters; it++) {
    const n = out.length;
    if (n < 3) return out;
    const acc = [];
    for (let i = 0; i < n; i++) {
      const a = out[i];
      const b = out[(i + 1) % n];
      acc.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      acc.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out = closed ? acc : acc;
  }
  return out;
}

/**
 * 多边形内缩。用顶点处两条边的平均法线（miter），并夹住 miter 长度，
 * 免得凹角处甩出一根长刺。
 */
export function insetLoop(pts, w) {
  const n = pts.length;
  const out = [];
  const mid = 1.6; // miter 上限倍数
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const n1 = norm(perp(b, a));  // 指向前一条边的行进方向右侧 = 内侧（环是顺时针时）
    const n2 = norm(perp(c, b));
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const len = Math.hypot(mx, my) || 1;
    mx /= len; my /= len;
    const cosHalf = Math.max(0.35, (n1[0] * mx + n1[1] * my));
    const s = Math.min(w / cosHalf, w * mid);
    out.push([b[0] + mx * s, b[1] + my * s]);
  }
  return out;
}
const perp = (a, b) => [-(b[1] - a[1]), b[0] - a[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** 草面抖动：片子里的草不是纯色，是同色系 ±7 的颗粒。 */
function speckle(ctx, loop, c, seed = 3) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.save();
  path(ctx, loop);
  ctx.clip();
  const bb = bbox(loop);
  const n = Math.round(bb.w * bb.h * 0.06);
  for (let i = 0; i < n; i++) {
    const x = bb.x + rnd() * bb.w;
    const y = bb.y + rnd() * bb.h;
    const d = (rnd() * 2 - 1) * MEASURED.grassSpeckle;
    ctx.fillStyle = rgba([c[0] + d, c[1] + d, c[2] + d * 0.7], 1);
    ctx.fillRect(x, y, 1.2 * (1 + rnd()), 1.2 * (1 + rnd()));
  }
  ctx.restore();
}

function bbox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * 把一组格子画成草地地块。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{tiles:Set<string>, cam:object, scale?:number, naive?:boolean, seed?:number}} o
 *   naive=true 走"典型错法"：直接 stroke 原折线、不内缩、不磨圆，
 *   用来做同机位 A/B（见 grassplotlab.html 的 ②）。
 */
export function paintPlot(ctx, { tiles, cam, scale = 1, naive = false, seed = 3, m = MEASURED }) {
  const segs = plotEdges(tiles);
  const loops = chainLoops(segs);
  const polys = [];
  for (const lp of loops) {
    let pts = lp.pts.map(([u, v]) => cam.pt(u, v));
    if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length < 3) continue;
    if (!naive) pts = chaikin(pts, true, m.cornerRound);
    polys.push(pts);
  }

  const cw = m.curbW * scale;

  // 铺地（地块脚下的地面），单独一块底色，好让"描线"有东西可压
  ctx.save();
  ctx.fillStyle = rgba(m.pave, 1);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();

  if (naive) {
    // 错法：草直接铺到底，然后拿 stroke 画路缘 —— 一半线宽落到外面，描线也被盖住
    for (const p of polys) {
      path(ctx, p);
      ctx.fillStyle = rgba(m.grass, 1);
      ctx.fill();
      speckle(ctx, p, m.grass, seed);
      ctx.lineWidth = cw;
      ctx.strokeStyle = rgba(m.curb, 1);
      ctx.stroke();
      ctx.lineWidth = m.outlineW * scale;
      ctx.strokeStyle = rgba(m.outline, 1);
      ctx.stroke();
    }
    return { polys, rings: [] };
  }

  const rings = [];
  for (const p of polys) {
    const inner = insetLoop(p, cw);
    rings.push(inner);
    // ① 草
    path(ctx, inner);
    ctx.fillStyle = rgba(m.grass, 1);
    ctx.fill();
    speckle(ctx, inner, m.grass, seed);
    // ② 路缘环：外环 + 内缩环，even-odd 填出真正的环带
    ctx.beginPath();
    traceInto(ctx, p);
    traceInto(ctx, inner);
    ctx.fillStyle = rgba(m.curb, 1);
    ctx.fill('evenodd');
    // ②b 路缘上沿受光：把环的上半边提亮一点点（片子里 145→163 的起伏）
    ctx.save();
    ctx.beginPath();
    traceInto(ctx, p);
    traceInto(ctx, inner);
    ctx.clip('evenodd');
    ctx.lineWidth = cw * 0.26;
    ctx.strokeStyle = rgba(m.curbLit, 1);
    ctx.stroke();
    ctx.restore();
    // ③ 内侧暗缝（路缘压在草上的阴影）
    //    ⚠ lineWidth = 0 在 canvas 里**不是"不画"**，而是忽略这次赋值、沿用上一个线宽。
    //      对照组的 seamW/outlineW 传 0，结果还是描了 1px 线，"只填草"那格看着仍有环。
    if (m.seamW > 0) {
      ctx.lineWidth = m.seamW * scale;
      ctx.strokeStyle = rgba(m.seam, 1);
      path(ctx, inner);
      ctx.stroke();
    }
    // ④ 最外 1px 描线
    if (m.outlineW > 0) {
      ctx.lineWidth = m.outlineW * scale;
      ctx.strokeStyle = rgba(m.outline, 1);
      path(ctx, p);
      ctx.stroke();
    }
  }
  return { polys, rings };
}
function traceInto(ctx, pts) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/**
 * 反测：沿一条水平线横穿地块，量环带的游程结构。
 * 期望（由外向内）：描线 1px → 路缘 5px → 暗缝 1px → 草一大片。
 */
export function probeRing(ctx, y, m = MEASURED, scale = 1) {
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
  const W = ctx.canvas.width;
  const near = (c, t, tol) => Math.abs(c[0] - t[0]) < tol && Math.abs(c[1] - t[1]) < tol && Math.abs(c[2] - t[2]) < tol;
  const at = (x) => { const i = (y * W + x) * 4; return [img[i], img[i + 1], img[i + 2]]; };
  const cls = (c) => {
    if (c[0] < 60 && c[1] < 60) return 'o';
    if (near(c, m.curb, 26) && c[0] > 130) return 'c';
    if (near(c, m.seam, 22)) return 's';
    if (near(c, m.grass, 16)) return 'g';
    return '.';
  };
  const runs = [];
  let cur = null, n = 0;
  for (let x = 0; x < W; x++) {
    const k = cls(at(x));
    if (k === cur) n++;
    else { if (cur && cur !== '.') runs.push({ k: cur, n: n / scale }); cur = k; n = 1; }
  }
  if (cur && cur !== '.') runs.push({ k: cur, n: n / scale });
  // 相邻同类游程先并起来：路缘上沿那一道提亮会被判成两段 'c'，
  // 于是顺序读成 "描线→路缘→路缘"，明明对也被判错（第一版就是这么红的）。
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.k === r.k) last.n += r.n;
    else merged.push({ ...r });
  }
  runs.length = 0;
  runs.push(...merged);
  // 找第一条 "o → c" 的接续
  let curbW = null, order = '';
  for (let i = 0; i < runs.length - 1; i++) {
    if (runs[i].k === 'o' && runs[i + 1].k === 'c') {
      curbW = runs[i + 1].n;
      order = runs.slice(i, i + 3).map((r) => r.k).join('');
      break;
    }
  }
  const grassRun = Math.max(0, ...runs.filter((r) => r.k === 'g').map((r) => r.n));
  return { runs, curbW, order, grassRun };
}
