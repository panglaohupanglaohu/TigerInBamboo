/**
 * loop-lift.js — 完美环抬升成"飞岛"（1313837640366596096）
 *
 * 依据：2020-10-07 "I just pushed an update to Townscaper. You can now build flying towns
 *   (if you find any of the perfect loops I've scattered across the grid)"。
 * 片子是转台：一块城镇整片离开水面悬空，底面是一圈亮黄的船壳，四五根极细的腿一直伸到水面，
 * 腿脚处有圆形涟漪；相机绕 360° 转一圈，岛本身不建不拆。
 *
 * 环本身由 core/grid.js 的 traceStraightReport 判（seen 里回到起点 → reason='loop'，closed=true）。
 * 本模块只做"环 → 圈内区域 → 抬升场 → 支撑腿"这三步几何，不含飞行操控（那是玩法层，本仓没有）。
 *
 * 口径：抬升场是"离环越远抬得越高"的平滑坡（船壳边沿贴水，中心最厚），
 *       腿从船壳底面竖直落到水面（y=0），落脚点带一圈涟漪半径。
 */

import { traceStraightReport } from './grid.js';

const EPS = 1e-9;

function num(v, name) {
  if (!Number.isFinite(v)) throw new RangeError('Invalid ' + name);
  return v;
}

/** 闭环 report → 环的中心线折线（首尾闭合，不自重复最后一个点）。非闭环返回 null。 */
export function loopPolygon(report) {
  if (!report || !report.closed || report.reason !== 'loop' || !Array.isArray(report.segments) || report.segments.length < 2) return null;
  const pts = [];
  for (const s of report.segments) {
    if (!Array.isArray(s.a) || !Array.isArray(s.b)) return null;
    if (!s.a.every(Number.isFinite) || !s.b.every(Number.isFinite)) return null;
    // 每段 a→b；下一段的 a 就是本段的 b（同一条边中点），只收 b 即可
    pts.push([s.b[0], s.b[1]]);
  }
  // 去掉相邻重复点（三角格段 b 取格心时会与下一段 a 不同，保留原样）
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > EPS || Math.abs(q[1] - p[1]) > EPS) out.push(p);
  }
  if (out.length < 3) return null;
  const first = out[0], last = out[out.length - 1];
  if (Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS) out.pop();
  return out;
}

/** 折线围成的面积（绝对值，鞋带公式）。 */
export function polygonArea(poly) {
  if (!Array.isArray(poly) || poly.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

/** 点到折线（闭合）的最近距离。 */
export function distanceToPolygon(poly, x, z) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const L = dx * dx + dz * dz;
    let t = L > EPS ? ((x - a[0]) * dx + (z - a[1]) * dz) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, pz = a[1] + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

/** 射线法：点是否在闭合折线内。 */
export function pointInPolygon(poly, x, z) {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + EPS) + xi) inside = !inside;
  }
  return inside;
}

/** 环 → 圈内的格（按格心判）。 */
export function loopRegion(grid, report, { minCells = 1 } = {}) {
  if (!grid || !Array.isArray(grid.cells)) throw new TypeError('Invalid grid');
  const polygon = loopPolygon(report);
  if (!polygon) return { closed: false, polygon: null, cells: [], area: 0, bbox: null };
  const cells = [];
  for (const c of grid.cells) {
    if (pointInPolygon(polygon, c.cx, c.cz)) cells.push({ id: c.id, cx: c.cx, cz: c.cz });
  }
  const xs = polygon.map((p) => p[0]), zs = polygon.map((p) => p[1]);
  const bbox = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  const area = polygonArea(polygon);
  return { closed: cells.length >= minCells, polygon, cells, area, bbox };
}

/**
 * 扫全网格找完美环（按"圈的格集合"去重）。返回 [{report, polygon, cells, area}] 按面积降序。
 * 这是片子里"我把完美环散在网格各处"的那一层；本仓网格半径 10 时有 12 个不重复的环。
 */
export function findLoops(grid, { max = 400, minArea = 0 } = {}) {
  if (!grid || !Array.isArray(grid.cells)) throw new TypeError('Invalid grid');
  num(max, 'max'); num(minArea, 'minArea');
  const seen = new Set(), out = [];
  for (const c of grid.cells) {
    for (let i = 0; i < c.n; i++) {
      const r = traceStraightReport(grid, c, i, max);
      if (r.reason !== 'loop' || !r.closed) continue;
      const key = r.cells.map((x) => x.id).sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const reg = loopRegion(grid, r);
      if (!reg.closed || reg.area < minArea) continue;
      out.push({ report: r, polygon: reg.polygon, cells: reg.cells, area: reg.area, bbox: reg.bbox });
    }
  }
  out.sort((a, b) => b.area - a.area);
  return out;
}

const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * 抬升场：圈内每格一个高度。船壳边沿贴水（rim），越往圈心越厚（peak）。
 * d = 格心到环的距离，dmax = 圈内最大 d，h = rim + (peak-rim)*smoothstep(d/dmax)。
 */
export function liftField(region, { peak = 2.4, rim = 0.02 } = {}) {
  num(peak, 'peak'); num(rim, 'rim');
  if (peak < rim) throw new RangeError('peak must be >= rim');
  if (!region || !region.polygon) return { heights: new Map(), dmax: 0, stats: { cells: 0, peak: rim, rim } };
  const ds = region.cells.map((c) => ({ id: c.id, d: distanceToPolygon(region.polygon, c.cx, c.cz) }));
  const dmax = ds.reduce((m, e) => Math.max(m, e.d), 0);
  const heights = new Map();
  for (const e of ds) {
    const t = dmax > EPS ? smoothstep(e.d / dmax) : 0;
    heights.set(e.id, rim + (peak - rim) * t);
  }
  const vals = [...heights.values()];
  return {
    heights,
    dmax,
    stats: {
      cells: heights.size,
      peak: vals.length ? Math.max(...vals) : rim,
      rim: vals.length ? Math.min(...vals) : rim,
    },
  };
}

/** 船壳（岛底面）厚度：按面积开方缩放，越大的岛越厚，但有上限。 */
export function hullDepth(area, { perArea = 0.30, max = 1.2, min = 0.3 } = {}) {
  num(area, 'area'); num(perArea, 'perArea'); num(max, 'max'); num(min, 'min');
  if (area <= 0) return min;
  return Math.min(max, Math.max(min, perArea * Math.sqrt(area)));
}

/**
 * 支撑腿：沿环按弧长等距取点，从船壳底（-depth）竖直落到水面（0）。
 * 片子里腿极细、直、等距，落脚处一圈涟漪（splash 半径）。返回 { legs, perimeter, spacing }。
 */
export function supportLegs(region, { spacing = 1.1, depth = 0.9, radius = 0.05, splash = 0.14 } = {}) {
  num(spacing, 'spacing'); num(depth, 'depth'); num(radius, 'radius'); num(splash, 'splash');
  if (spacing <= 0) throw new RangeError('spacing must be > 0');
  if (!region || !region.polygon) return [];
  const poly = region.polygon;
  // 累计弧长
  const cum = [0];
  for (let i = 1; i <= poly.length; i++) {
    const a = poly[i - 1], b = poly[i % poly.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const perim = cum[cum.length - 1];
  const n = Math.max(3, Math.round(perim / spacing));
  const step = perim / n;
  const legs = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (seg < poly.length - 1 && cum[seg + 1] < target) seg++;
    const a = poly[seg], b = poly[(seg + 1) % poly.length];
    const len = cum[seg + 1] - cum[seg];
    const t = len > EPS ? (target - cum[seg]) / len : 0;
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    legs.push({ x, z, top: -depth, bottom: 0, radius, splash });
  }
  return { legs, perimeter: perim, spacing: step };
}

/**
 * 一体化：给一条闭合直线，返回整座飞岛（环、圈内格、抬升场、船壳、腿）。
 * 非闭环就只回 closed:false，调用方按"没找到环"处理。
 */
export function buildFlyingTown(grid, { startCell, edge = 0, peak = 2.4, rim = 0.02, spacing = 1.1 } = {}) {
  if (!grid || !Array.isArray(grid.cells)) throw new TypeError('Invalid grid');
  const cell = startCell || grid.cells[0];
  const report = traceStraightReport(grid, cell, edge, 400);
  const region = loopRegion(grid, report);
  if (!report.closed || !region.closed) {
    return { closed: false, reason: report.reason, region, report };
  }
  const field = liftField(region, { peak, rim });
  const depth = hullDepth(region.area);
  const legOut = supportLegs(region, { spacing, depth });
  return {
    closed: true,
    reason: 'loop',
    report,
    region,
    field,
    depth,
    legs: legOut.legs,
    stats: {
      loopCells: region.cells.length,
      area: +region.area.toFixed(3),
      peak: +field.stats.peak.toFixed(3),
      rim: +field.stats.rim.toFixed(3),
      depth: +depth.toFixed(3),
      legs: legOut.legs.length,
      perimeter: +legOut.perimeter.toFixed(3),
    },
  };
}
