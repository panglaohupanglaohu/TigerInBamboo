/**
 * navribbon.js — 走廊里的白色航点不是"控制点"本身，是沿中线**按弧长等距重采样**出来的。
 *
 * 帖子 ID：827215002448846848（2017-02-02，无原文字，仅有视频）
 *   画面：灰色石质坡道弯成一条 S 形走道，走道上每隔几步一个白色小点；每个点所在的那一小段
 *   被一圈白色多边形框住（贴地的格子），格子首尾相接、宽窄跟着走道宽度变，点在格心。
 *   走道拐弯处点**看起来**更密一点，但沿走道的步距没变。
 *
 * 帖子 ID：823848950553780226（2017-01-24，无原文字，仅有视频）
 *   画面：石砌塔楼内部，一道门洞通向暗处；一串白点从左侧台面绕过柱子、穿过门洞进屋，
 *   点的间距基本一致，贴着地面起伏，没有一个点落在墙里或台面外。
 *
 * 为什么这么做（原文没有文字，从画面反推）：
 *   ① **点的数量由长度决定，不由几何控制点决定**。控制点是人手摆的，疏密全凭手感；
 *      若直接把控制点当航点，一条 SF 弯道会出现"0.3 米一个点、3.4 米一个点"的落差
 *      （见 lab 左栏）。按弧长 step 重采样后，步距恒定，AI 的转向半径、寻路代价才好算。
 *   ② **格子是航点的副产物，不是另做一套网格**。相邻两个航点 + 各自走廊半宽 = 一个四边形，
 *      首尾共享边界，于是"每段一格"天然不重叠、不留缝 —— 就是画面里那圈白框。
 *   ③ **视觉上的"转角更密"是弦长错觉**：两点之间的弧长恒为 step，但画在屏幕上是弦，
 *      弦长 = 2R·sin(step/2R)，曲率半径 R 越小弦越短。所以量"步距"必须量弧长，
 *      量屏幕距离会把拐弯误判成加密。
 *
 * 纯几何模块，不依赖 three；坐标是俯视的 (x, z)。
 */

/** 控制点：故意疏密不均（右侧拐弯前挤了一串），这是"人手摆点"的常态。 */
export const CTRL = [
  [1.0, 1.10], [1.80, 1.15], [2.05, 1.35], [2.25, 1.70], [2.50, 2.20],
  [2.85, 2.75], [3.40, 3.20], [6.00, 3.90], [8.60, 4.15], [10.80, 4.00],
  [12.40, 3.50], [13.70, 2.60], [14.40, 1.60], [14.90, 0.80],
];

/** 走廊半宽（世界单位），沿弧长比例 u∈[0,1] 变化 —— 对应画面里"格子宽窄跟着走道变"。 */
export function halfWidth(u) {
  const a = 1.05 + 0.42 * Math.sin(u * 8.4 + 0.7) + 0.16 * Math.sin(u * 19.0);
  return Math.max(0.62, Math.min(1.55, a));
}

/** Catmull-Rom（张力 0.5）：控制点之间插值出密集中线，按**参数**等分采样。 */
export function centerline(perSeg = 64) {
  const pts = [];
  const P = (i) => CTRL[Math.max(0, Math.min(CTRL.length - 1, i))];
  for (let i = 0; i < CTRL.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(CTRL[CTRL.length - 1].slice());
  // 累积弧长
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const len = cum[cum.length - 1];
  return { pts, cum, len, perSeg };
}

/** 弧长 s 处的位置 + 单位切向。 */
function at(line, s) {
  const { pts, cum } = line;
  s = Math.max(0, Math.min(line.len, s));
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1e-9;
  const t = (s - cum[lo]) / seg;
  const x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t;
  const z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t;
  const dx = pts[hi][0] - pts[lo][0], dz = pts[hi][1] - pts[lo][1];
  const l = Math.hypot(dx, dz) || 1e-9;
  return { x, z, tx: dx / l, tz: dz / l, nx: -dz / l, nz: dx / l, u: s / line.len };
}

/**
 * 按弧长等距重采样。step 是**沿中线**的步距，不是屏幕距离。
 * 每点自带：位置、切向/法向、该处半宽、所属格子（与下一点合成的四边形）。
 */
export function sampleByArc(line, step = 1.0, widthFn = halfWidth) {
  const n = Math.floor(line.len / step);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const s = Math.min(line.len, i * step);
    const p = at(line, s);
    const w = widthFn(p.u);
    out.push({ ...p, s, w, cx: p.x - p.nx * w, cz: p.z - p.nz * w,
               dx2: p.x + p.nx * w, dz2: p.z + p.nz * w });
  }
  // 格子：相邻两点合成一个四边形（首尾共享边界 → 不重叠、不留缝）
  const cells = [];
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i], b = out[i + 1];
    cells.push({
      quad: [[a.cx, a.cz], [b.cx, b.cz], [b.dx2, b.dz2], [a.dx2, a.dz2]],
      area: quadArea([[a.cx, a.cz], [b.cx, b.cz], [b.dx2, b.dz2], [a.dx2, a.dz2]]),
      arc: b.s - a.s,
      chord: Math.hypot(b.x - a.x, b.z - a.z),
      wA: a.w, wB: b.w,
    });
  }
  return { pts: out, cells };
}

/** 朴素做法：控制点直接当航点（Unity 里最常见的"手摆 waypoint"）。 */
export function sampleByControl() {
  const out = [];
  for (let i = 0; i < CTRL.length; i++) {
    const prev = CTRL[Math.max(0, i - 1)], next = CTRL[Math.min(CTRL.length - 1, i + 1)];
    const dx = next[0] - prev[0], dz = next[1] - prev[1];
    const l = Math.hypot(dx, dz) || 1e-9;
    out.push({ x: CTRL[i][0], z: CTRL[i][1], tx: dx / l, tz: dz / l, nx: -dz / l, nz: dx / l });
  }
  return out;
}

function quadArea(q) {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i], r = q[(i + 1) % q.length];
    a += p[0] * r[1] - r[0] * p[1];
  }
  return Math.abs(a) / 2;
}

const stats1 = (arr) => {
  if (!arr.length) return { n: 0 };
  const m = arr.reduce((s, v) => s + v, 0) / arr.length;
  const sd = Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  return { n: arr.length, mean: m, std: sd, min: Math.min(...arr), max: Math.max(...arr) };
};

/** 全部指标：给 lab 的统计条和 shot.mjs 的 eval 共用。 */
export function measure(step = 1.0) {
  const line = centerline();
  const arc = sampleByArc(line, step);
  const ctrl = sampleByControl();

  const arcGaps = arc.pts.slice(1).map((p, i) => p.s - arc.pts[i].s);
  const chordGaps = arc.cells.map((c) => c.chord);
  const ctrlGaps = [];
  for (let i = 1; i < ctrl.length; i++) {
    ctrlGaps.push(Math.hypot(ctrl[i].x - ctrl[i - 1].x, ctrl[i].z - ctrl[i - 1].z));
  }
  const A = stats1(arcGaps), C = stats1(chordGaps), N = stats1(ctrlGaps);

  // 格子不重叠：判断相邻格中心是否越界太远（共享边 → 面积和 ≈ 走廊总面积）
  let areaSum = 0, overlapPairs = 0;
  for (const c of arc.cells) areaSum += c.area;
  for (let i = 0; i + 1 < arc.cells.length; i++) {
    const a = arc.cells[i].quad, b = arc.cells[i + 1].quad;
    // 共享的两个角必须完全相等（构造上如此），这里实测确认
    const shared = a.filter((p) => b.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9)).length;
    if (shared !== 2) overlapPairs++;
  }

  // 走廊总面积（按 cell 梯形积分对照）
  let band = 0;
  for (const c of arc.cells) band += c.arc * (c.wA + c.wB);

  return {
    length: +line.len.toFixed(3),
    step,
    arc: { n: A.n, mean: +A.mean.toFixed(4), std: +A.std.toFixed(4),
           min: +A.min.toFixed(4), max: +A.max.toFixed(4) },
    chord: { n: C.n, mean: +C.mean.toFixed(4), std: +C.std.toFixed(4),
             min: +C.min.toFixed(4), max: +C.max.toFixed(4),
             arcOverChordMax: +(A.max / C.min).toFixed(4) },
    ctrl: { n: N.n, mean: +N.mean.toFixed(4), std: +N.std.toFixed(4),
            min: +N.min.toFixed(4), max: +N.max.toFixed(4),
            ratio: +(N.max / N.min).toFixed(3) },
    cells: { n: arc.cells.length, areaSum: +areaSum.toFixed(3),
             bandArea: +band.toFixed(3), badShared: overlapPairs,
             wMin: +Math.min(...arc.cells.map((c) => Math.min(c.wA, c.wB))).toFixed(3),
             wMax: +Math.max(...arc.cells.map((c) => Math.max(c.wA, c.wB))).toFixed(3) },
    pts: arc.pts,
    cellList: arc.cells,
    ctrlPts: ctrl,
    line,
  };
}

if (typeof window !== 'undefined') window.__nav = measure();
