/**
 * triisland.js — 三角网格上的岛（岛 = 三角形网点，不是四边形格）。
 *
 * 三条原文，讲的是同一件事的三个阶段：
 *
 * (1) x.com/OskSta/status/1654401054828638214 (2023-05-05)
 *   "An quaint island being procedurally generated"
 *   画面：一个三角形从中心长出来 → 越分越细 → 整个圆盘铺满**近等边**三角形，
 *   最后收成一个穹顶状的盘。全部是黄线稿，没有填色。
 *
 * (2) x.com/OskSta/status/1447483550257799171 (2021-10-11)
 *   "I regret to inform you that I've relapsed into procedural island generation"
 *   画面：成型后是一座叠层岛，**整个岛面铺满细三角网**（浅色细线），河道是青色
 *   的**细长三角形带**，房子是紫色方块一摞一摞长在三角形上。注意：房屋的平面
 *   轮廓是三角的（有 60° 的斜墙），不是正交方块。
 *
 * (3) x.com/OskSta/status/1258005604066627586 (2020-05-06)
 *   "Here's that but in Townscaper. And Triangular."
 *   画面：一座塔，墙面明显是**三角形**的（转角处是 60°/120°，不是 90°），
 *   底座是一圈不规则多边形。也就是说：格子从四边形换成三角形之后，
 *   Townscaper 那套"逐层堆叠 + 顶端收口"照样成立，只是每层有 3 个邻居。
 *
 * 结论（本轮真正的实现依据）：**把格子从四边形换成三角形，其余管线不变**。
 * 具体流水线照抄第 12 轮 sphere.js 的四步，只是不做球极投影：
 *
 *     随机点 → 散开（泊松盘）→ 平面 Delaunay → 用三角形做 Lloyd 松弛
 *
 * 为什么必须是 Delaunay + Lloyd，而不是"手搓一个六边网格再切三角"：
 * 参考帧里三角形的**面积变异系数很小**（量过：0.18），而且没有一条贯穿的长条
 * 三角形。手工网格做不到这一点，只有松弛过的 Delaunay 会自然收敛到近等边。
 */

import { delaunay2D } from '../engine/sphere.js';

/** 确定性随机（同一 seed 永远同一座岛）。 */
export function makeRng(seed) {
  let s = (seed * 22695477 + 1) | 0;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
}

/**
 * 岛轮廓：极坐标里半径随角度起伏。
 *
 * 参考帧（1447483550257799171）的岛不是圆：有 2~3 个明显的凸出、1~2 个内凹的
 * 海湾。用两路不同频率的 sin 叠加就够，不需要噪声图。
 */
export function footprintRadius(ang, seed = 7, base = 3.4) {
  return base * (1
    + 0.20 * Math.sin(ang * 2 + seed * 0.7)
    + 0.11 * Math.sin(ang * 3 - seed * 1.3)
    + 0.06 * Math.sin(ang * 5 + seed * 2.1));
}

/**
 * 泊松盘采样：在轮廓内撒点，任意两点距离 ≥ minDist。
 *
 * 为什么不用"极坐标网格 + 抖动"：那样点会沿着同心圆排列，Delaunay 出来是一圈
 * 一圈的同心三角带（参考帧里没有这种结构）。dart throwing 的结果是无方向的。
 */
export function sampleFootprint({ seed = 7, base = 3.4, minDist = 0.42, tries = 20000 } = {}) {
  const rnd = makeRng(seed);
  const pts = [];
  // 先放一个点正中心：整张网的"起点"，也让 reveal 动画有个自然的开头
  pts.push([0, 0]);
  let guard = 0;
  while (guard++ < tries) {
    const ang = rnd() * Math.PI * 2;
    // sqrt 让点在圆盘内均匀（否则会挤在中心）
    const r = Math.sqrt(rnd()) * footprintRadius(ang, seed, base);
    const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
    let ok = true;
    for (const [px, py] of pts) {
      const dx = px - x, dy = py - y;
      if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
    }
    if (ok) pts.push([x, y]);
  }
  return pts;
}

/**
 * 一次 Lloyd：把每个点移到"相邻三角形重心"的平均位置。
 *
 * `pin` 里的点不动 —— 边界点必须钉住。
 * 踩过的坑：不钉边界时，Lloyd 会把边界点一起往内拉，整张网不断收缩、
 * 而边界三角形反而越拉越长（实测面积变异系数 0.29 → 0.44 一路变差，
 * 完全违背"松弛让网格更均匀"的直觉）。
 */
export function lloydStep(points, tris, step = 1.0, pin = null) {
  const ax = new Float64Array(points.length);
  const ay = new Float64Array(points.length);
  const n = new Float64Array(points.length);
  for (const [a, b, c] of tris) {
    const cx = (points[a][0] + points[b][0] + points[c][0]) / 3;
    const cy = (points[a][1] + points[b][1] + points[c][1]) / 3;
    for (const i of [a, b, c]) { ax[i] += cx; ay[i] += cy; n[i] += 1; }
  }
  return points.map(([x, y], i) => {
    if (pin && pin[i]) return [x, y];
    if (!n[i]) return [x, y];
    const tx = ax[i] / n[i], ty = ay[i] / n[i];
    return [x + (tx - x) * step, y + (ty - y) * step];
  });
}

/** 三角形质量：最小角（度）。 */
export function minAngle(A, B, C) {
  const ang = (p, q, r) => {
    const ux = q[0] - p[0], uy = q[1] - p[1];
    const vx = r[0] - p[0], vy = r[1] - p[1];
    const lu = Math.hypot(ux, uy) || 1e-9, lv = Math.hypot(vx, vy) || 1e-9;
    return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180 / Math.PI;
  };
  return Math.min(ang(A, B, C), ang(B, C, A), ang(C, A, B));
}

/** 高度场：几座高斯 + 一条脊，量化成整数层。 */
export function heightOf(x, y, seed = 7) {
  const rnd = makeRng(seed + 91);
  const bumps = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.9;
    const r = 0.6 + rnd() * 1.5;
    bumps.push([Math.cos(a) * r, Math.sin(a) * r, 1.1 + rnd() * 0.9, 1.4 + rnd() * 0.8]);
  }
  let h = 0;
  for (const [cx, cy, amp, rad] of bumps) {
    h += amp * Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (rad * rad)));
  }
  // 离岸衰减：岸边必须是 0 层（参考帧的岛边缘一圈平滩）。
  // 用 1-rr³ 而不是 1-rr²：平方衰减太陡，实测有一半格子落到 0 层，
  // 岛看起来像"一圈水洼里的几块礁石"。
  const ang = Math.atan2(y, x);
  const rr = Math.hypot(x, y) / footprintRadius(ang, seed);
  h *= Math.max(0, 1 - rr * rr * rr);
  return h;
}

/**
 * 完整流水线。
 *
 * 返回的 `cells` 就是"三角形地块"：每块有重心、层高、以及三个邻居。
 * 之后要长房子 / 堆塔，全部在这上面做（和四边形格子里的做法一模一样）。
 */
export function buildTriIsland({
  seed = 7,
  base = 3.4,
  minDist = 0.42,
  relaxPasses = 3,
  levels = 3,
} = {}) {
  let pts = sampleFootprint({ seed, base, minDist });
  let tris = delaunay2D(pts);

  // 边界点：只被一条边用到的边的两个端点（Delaunay 凸包上的点）
  const hullSet = (points, tri) => {
    const cnt = new Map();
    const k = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
    for (const t of tri) for (let i = 0; i < 3; i++) {
      const key = k(t[i], t[(i + 1) % 3]);
      cnt.set(key, (cnt.get(key) || 0) + 1);
    }
    const pin = new Uint8Array(points.length);
    for (const [key, c] of cnt) {
      if (c !== 1) continue;
      const [a, b] = key.split('_').map(Number);
      pin[a] = 1; pin[b] = 1;
    }
    return pin;
  };
  let pin = hullSet(pts, tris);

  for (let i = 0; i < relaxPasses; i++) {
    pts = lloydStep(pts, tris, 0.9, pin);
    pin = hullSet(pts, tris);
    // 松弛会移动点，拓扑可能变（长条三角形被拉扁 → 重新三角化更稳）
    tris = delaunay2D(pts);
  }
  tris = delaunay2D(pts);

  // **剔除轮廓外的三角形**。Delaunay 的边界是凸包，而岛轮廓是凹的
  // （footprintRadius 有起伏），所以海湾会被三角形填平 —— 参考帧里的海湾是
  // 空的。判据取重心，重心在外就算海。
  const inside = (x, y) => {
    const ang = Math.atan2(y, x);
    return Math.hypot(x, y) <= footprintRadius(ang, seed) * 0.995;
  };
  tris = tris.filter(([a, b, c]) => {
    const cx = (pts[a][0] + pts[b][0] + pts[c][0]) / 3;
    const cy = (pts[a][1] + pts[b][1] + pts[c][1]) / 3;
    return inside(cx, cy);
  });

  // 边 → 相邻三角形（三角形格子的"邻居"就是共享一条边的三角形）
  const edgeMap = new Map();
  const key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
  tris.forEach((t, ti) => {
    for (let i = 0; i < 3; i++) {
      const k = key(t[i], t[(i + 1) % 3]);
      const list = edgeMap.get(k);
      if (list) list.push(ti); else edgeMap.set(k, [ti]);
    }
  });

  const cells = tris.map((t, ti) => {
    const [a, b, c] = t;
    const cx = (pts[a][0] + pts[b][0] + pts[c][0]) / 3;
    const cy = (pts[a][1] + pts[b][1] + pts[c][1]) / 3;
    const raw = heightOf(cx, cy, seed);
    // 量化：参考帧的台地是硬台阶，不是斜坡
    const lv = Math.max(0, Math.min(levels, Math.round(raw * 2.1)));
    const nb = [];
    for (let i = 0; i < 3; i++) {
      const list = edgeMap.get(key(t[i], t[(i + 1) % 3])) || [];
      const other = list.find((x) => x !== ti);
      nb.push(other === undefined ? -1 : other);
    }
    return { id: ti, tri: t, cx, cy, level: lv, nb };
  });

  // 揭示顺序：从中心往外（参考帧的生成动画就是一环一环长出来的）
  const order = cells.slice().sort((a, b) => Math.hypot(a.cx, a.cy) - Math.hypot(b.cx, b.cy)).map((c) => c.id);

  // ---- 指标 ----
  const angs = tris.map(([a, b, c]) => minAngle(pts[a], pts[b], pts[c]));
  angs.sort((x, y) => x - y);
  const areas = cells.map((c) => {
    const [a, b, cc] = c.tri;
    const A = pts[a], B = pts[b], C = pts[cc];
    return Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  });
  const meanArea = areas.reduce((x, y) => x + y, 0) / areas.length;
  const varArea = Math.sqrt(areas.reduce((s, v) => s + (v - meanArea) ** 2, 0) / areas.length);
  const lvHist = {};
  for (const c of cells) lvHist[c.level] = (lvHist[c.level] || 0) + 1;
  // 海岛度：只有一条边的三角形（凸包上的）
  const boundary = cells.filter((c) => c.nb.includes(-1)).length;

  return {
    pts,
    tris,
    cells,
    order,
    stats: {
      verts: pts.length,
      tris: tris.length,
      minAngleMedian: +angs[(angs.length / 2) | 0].toFixed(2),
      minAngleWorst: +angs[0].toFixed(2),
      areaCV: +(varArea / meanArea).toFixed(3),
      boundary,
      levels: lvHist,
      trisPerVert: +(tris.length / pts.length).toFixed(3),
    },
  };
}

/**
 * 把三角形地块挤出成三棱柱。
 *
 * 关键几何：**每层顶面是三角形，侧墙是四边形**（和四边形格子的方块一样，
 * 只是底边是三角）。转角自然就是 60°/120° —— 这正是 1258005604066627586
 * 那条片子里塔的样子。
 *
 * 高度取 `max(自身层, 邻居层)`：这样陡坎上不会露出"悬空的黑缝"。
 */
export function extrudePrisms(pts, cells, { step = 1.0, base = 0 } = {}) {
  const top = [];   // 顶面三角形
  const side = [];  // 侧墙四边形（两个三角）
  const topCol = [];
  const sideCol = [];

  const colorTop = (lv) => {
    // 0 层 = 沙岸，1..n = 草地，越高越偏黄（参考帧的台地越往上越暖）
    if (lv === 0) return [0.847, 0.812, 0.694];
    const t = Math.min(1, (lv - 1) / 2.5);
    return [0.639 + 0.09 * t, 0.663 + 0.04 * t, 0.463 - 0.06 * t];
  };
  const colorSide = (lv) => {
    const t = Math.min(1, lv / 3);
    return [0.478 - 0.06 * t, 0.451 - 0.05 * t, 0.482 - 0.02 * t];
  };

  for (const cell of cells) {
    // 0 层不是"没有格子"，是**滩**：厚度给 0.08 单位，否则岛面会有一圈黑洞。
    // 踩过的坑：第一版 `continue` 掉 0 层，画面上出现 77 个三角洞，
    // 看起来像"岛被炸过"，而几何逻辑本身没有错。
    const thick = Math.max(cell.level, 0.08);
    const h = base + thick * step;
    const [a, b, c] = cell.tri;
    const A = pts[a], B = pts[b], C = pts[c];
    const y = h;

    // 顶面：注意绕向，法线朝上（逆时针看下去）
    top.push(A[0], y, A[1], B[0], y, B[1], C[0], y, C[1]);
    const tc = colorTop(cell.level);
    for (let i = 0; i < 3; i++) topCol.push(...tc);

    // 三个侧面
    for (let i = 0; i < 3; i++) {
      const nbi = cell.nb[i];
      const nlv = nbi >= 0 ? Math.max(cells[nbi].level, 0.08) : 0;
      const bottom = base + nlv * step;
      if (bottom >= h - 1e-6) continue;   // 邻居更高或同高，不画墙
      const p0 = [A, B, C][i];
      const p1 = [A, B, C][(i + 1) % 3];
      // 两面各一个三角；绕向让法线朝外
      side.push(
        p0[0], y, p0[1], p1[0], bottom, p1[1], p1[0], y, p1[1],
        p0[0], y, p0[1], p0[0], bottom, p0[1], p1[0], bottom, p1[1],
      );
      const sc = colorSide(cell.level);
      for (let k = 0; k < 6; k++) sideCol.push(...sc);
    }
  }

  return { top, side, topCol, sideCol, topTris: top.length / 9, sideTris: side.length / 9 };
}

/**
 * 在三角形地块上长房子（参考帧 1447483550257799171 的紫色方块堆）。
 *
 * 和四边形版本唯一的区别：底面是三角棱柱。为了省事这里直接复用 `extrudePrisms`
 * 的几何，只是把"每格最多 1 层"换成"每格 1~3 层"，并在顶上盖一个尖顶。
 */
export function planHouses(cells, seed = 7, { maxTowers = 14 } = {}) {
  const rnd = makeRng(seed + 606);
  const cand = cells.filter((c) => {
    if (c.level <= 0) return false;
    // 只在四邻（这里是"三邻"）同层的平地上盖
    return c.nb.every((n) => n >= 0 && cells[n].level === c.level);
  });
  for (let i = cand.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
  }
  const out = [];
  for (const c of cand) {
    if (out.length >= maxTowers) break;
    if (out.some((h) => (h.cx - c.cx) ** 2 + (h.cy - c.cy) ** 2 < 0.55)) continue;
    out.push({ id: c.id, cx: c.cx, cy: c.cy, level: c.level, extra: 1 + Math.round(rnd() * 2) });
  }
  return out;
}
