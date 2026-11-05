/**
 * archvoid.js — 拱形开口不是"挖掉一个半圆"，是**一圈楔石沿椭圆等角挤出来的**（桥洞 / 穿楼门洞）。
 *
 * 帖子 ID：806904557502464000（2016-12-08，无原文字，仅有视频）
 *   画面：青绿塔城坐在石基上，两座石基之间一道水渠；水渠上方是一座单孔石拱桥——
 *   拱券由一圈楔形石收成，拱顶正中一块键石，桥面平铺在拱背之上，与两岸石基顶面同高，
 *   水从拱洞里穿过去。拱脚直接落在石基立面上，没有另做的桥墩。
 *
 * 帖子 ID：802496920790777856（2016-11-26，无原文字，仅有视频）
 *   画面：粉墙多层塔，底层开一道贯穿整栋的拱形门洞，同样是楔石收边、洞顶比两侧高。
 *   两层白挑檐在这道洞上方继续横穿，说明洞只吃掉楼板以下那一层。
 *
 * 原文：两条都是 2016 老片，只有视频没有文字。所以这里记的是**从画面读出来的几何**，
 * 不是引述：拱的内轮廓是一条椭圆（半圆只是 rise = span/2 的特例），楔石沿这条椭圆
 * **等参角**排布 —— 于是"石缝"天然是一族从内椭圆法向射出的径向线，键石在 θ=90°。
 *
 * 为什么这么做：把拱当成"洞口 + 一圈石头"之后，桥面高度、净空曲线、每块石头的长细比
 * 全都成了 span / riseRatio / 楔数 / 厚度 四个参数的解析后果，可以直接量：
 *   - 净空(0) = rise，净空(±span/2) = 0，形状是椭圆而不是抛物线；
 *   - 楔数 N 决定缝角 180/N，跟跨度无关 —— 所以小桥不换石头数量就会"石头变胖"；
 *   - 半圆拱（rise/span = 0.5）在等参角下**每块石头完全一样**（实测长细比 1.85 恒定），
 *     这正是半圆拱好砌的原因；矢高比一压扁，石头就开始不齐（0.38 → 1.47~1.85，
 *     0.28 → 1.16~1.85），拱脚那块比拱顶细长得多 —— 扁拱的楔石得单独下料。
 */

const TAU = Math.PI * 2;

/** 内轮廓上参数 t∈[0,π] 的点：t=0 左脚，t=π/2 拱顶，t=π 右脚。y 以起拱线为 0。 */
export function archInner(span, rise, t) {
  return [-Math.cos(t) * span * 0.5, Math.sin(t) * rise];
}

/** 外轮廓 = 内轮廓沿椭圆法向外推 thickness。法向用 (cos t / a, sin t / b) 归一化。 */
export function archOuter(span, rise, thickness, t) {
  const p = archInner(span, rise, t);
  const a = span * 0.5;
  let nx = Math.cos(t) / a;
  let ny = Math.sin(t) / rise;
  const l = Math.hypot(nx, ny) || 1;
  return [p[0] + (thickness * nx) / l, p[1] + (thickness * ny) / l];
}

/** 椭圆弧长（数值积分，够用；比 Ramanujan 近似好在能按段算）。 */
export function arcLen(a, b, t0, t1, steps = 64) {
  let s = 0;
  let px = a * Math.cos(t0);
  let py = b * Math.sin(t0);
  for (let i = 1; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const x = a * Math.cos(t);
    const y = b * Math.sin(t);
    s += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return s;
}

function shoelace(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s) * 0.5;
}

function centroid(pts) {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** 点在凸多边形内（拱券每块在参数空间里都是凸的）。 */
export function pointInPoly(pt, poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (Math.abs(cross) < 1e-12) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * 生成一孔拱。
 * @param {object} o
 * @param {number} o.span       洞口净跨（起拱线处左右脚的距离）
 * @param {number} o.riseRatio  rise / span。0.5 = 半圆拱，0.35 左右是常见的平拱
 * @param {number} o.thickness  拱券厚度（沿法向）
 * @param {number} o.count      楔石数，取奇数才有正中一块键石
 * @param {number} o.deck       桥面板厚（压在拱背上，与两岸同高）
 */
export function makeArch(o = {}) {
  const span = o.span ?? 9;
  const riseRatio = o.riseRatio ?? 0.5;
  const thickness = o.thickness ?? 0.55;
  const count = o.count ?? 15;
  const deck = o.deck ?? 0.9;
  const rise = span * riseRatio;

  const wedges = [];
  for (let i = 0; i < count; i++) {
    const t0 = (i / count) * Math.PI;
    const t1 = ((i + 1) / count) * Math.PI;
    const quad = [
      archInner(span, rise, t0),
      archOuter(span, rise, thickness, t0),
      archOuter(span, rise, thickness, t1),
      archInner(span, rise, t1),
    ];
    wedges.push({
      i,
      t0,
      t1,
      quad,
      centre: (t0 + t1) * 0.5,
      innerArc: arcLen(span * 0.5, rise, t0, t1),
      outerArc: arcLen(span * 0.5 + thickness, rise + thickness, t0, t1),
      radial: Math.hypot(
        quad[1][0] - quad[0][0],
        quad[1][1] - quad[0][1],
      ),
      area: shoelace(quad),
    });
  }
  const keystone = wedges.find((w) => w.t0 < Math.PI / 2 && w.t1 > Math.PI / 2) ??
    wedges[Math.floor(count / 2)];

  return {
    span, rise, riseRatio, thickness, count, deck, wedges, keystone,
    springY: 0,
    crownInner: rise,
    crownOuter: rise + thickness,       // 拱背
    deckTop: rise + thickness + deck,   // 桥面
  };
}

/** 拱下净空（距起拱线的高度）。x 超出洞口就返回 0。 */
export function clearance(arch, x) {
  const half = arch.span * 0.5;
  if (Math.abs(x) > half) return 0;
  return arch.rise * Math.sqrt(1 - (x / half) ** 2);
}

/**
 * 量一遍这孔拱到底"对不对"。
 * jointGapMax     相邻楔石共享顶点之间的距离（应当恰好 0，缝是共用的，不是画出来的）
 * overlapPairs    某块的重心落进别人家 = 石头互相插进去了，应当 0
 * aspectMin/Max   每块石头的外弧长 / 径向厚，看石料从拱脚到拱顶胖瘦差多少
 * footInset       拱脚落点离桥台内缘的水平距离（应 = thickness）
 */
export function measure(arch) {
  const { wedges, span, rise, thickness, deck } = arch;
  let jointGapMax = 0;
  // 拱是一条**开口**弧，首尾两块并不相邻（一个在左脚一个在右脚），所以不绕圈比较
  for (let i = 0; i < wedges.length - 1; i++) {
    const a = wedges[i];
    const b = wedges[i + 1];
    const ga = Math.hypot(a.quad[2][0] - b.quad[1][0], a.quad[2][1] - b.quad[1][1]);
    const gb = Math.hypot(a.quad[3][0] - b.quad[0][0], a.quad[3][1] - b.quad[0][1]);
    jointGapMax = Math.max(jointGapMax, ga, gb);
  }
  let overlapPairs = 0;
  for (const a of wedges) {
    const c = centroid(a.quad);
    for (const b of wedges) {
      if (a === b) continue;
      if (pointInPoly(c, b.quad)) overlapPairs++;
    }
  }
  const aspects = wedges.map((w) => w.outerArc / w.radial);
  const innerArcTotal = wedges.reduce((s, w) => s + w.innerArc, 0);
  const outerArcTotal = wedges.reduce((s, w) => s + w.outerArc, 0);
  const areaTotal = wedges.reduce((s, w) => s + w.area, 0);
  const aspectMin = Math.min(...aspects);
  const aspectMax = Math.max(...aspects);

  return {
    span, rise, riseRatio: arch.riseRatio,
    count: arch.count,
    jointAngleDeg: 180 / arch.count,
    jointGapMax,
    overlapPairs,
    innerArcTotal, outerArcTotal,
    arcRatio: outerArcTotal / innerArcTotal,
    areaTotal,
    aspectMin, aspectMax,
    aspectSpread: aspectMax / aspectMin,
    clearCenter: clearance(arch, 0),
    clearQuarter: clearance(arch, span * 0.25),
    clearAt40: clearance(arch, span * 0.4),
    deckTop: arch.deckTop,
    deckVsAbutment: arch.deckTop - (rise + thickness + deck),
    footInset: thickness,
  };
}

/** 桥面：压在拱背上的那块板，左右各外挑出桥台。 */
export function deckSlab(arch, abutmentW) {
  const half = arch.span * 0.5 + arch.thickness + abutmentW;
  return [
    [-half, arch.crownOuter],
    [half, arch.crownOuter],
    [half, arch.deckTop],
    [-half, arch.deckTop],
  ];
}

/** 桥台（石基）外轮廓，顶面必须与桥面同高。 */
export function abutment(arch, abutmentW, side = -1) {
  const inner = side * (arch.span * 0.5 + arch.thickness);
  const outer = inner + side * abutmentW;
  return [
    [inner, -0.1],
    [outer, -0.1],
    [outer, arch.deckTop],
    [inner, arch.deckTop],
  ];
}

export const ARCH_PRESETS = [
  { name: '半圆拱', riseRatio: 0.5 },
  { name: '平拱', riseRatio: 0.38 },
  { name: '扁拱', riseRatio: 0.28 },
];

export { TAU };
