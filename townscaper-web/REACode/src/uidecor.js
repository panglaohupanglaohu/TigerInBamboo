// 帖子 1201179450668441600 —— 原文："Icons!"（f00/f02：左侧一列方形按钮底片沿着一条倾斜的轴排下来，
//        每片底片自己再歪一点；图标是纯描边，没有填充，笔画粗细看起来一致）
// 帖子 1024679338292256769 —— 原文："Some UI flair"（f00 是带细纹理的深色圆角面板，f03 是一枚六边形徽记：
//        皇冠 + 两枝月桂 + 环 + 四重对称的内芯，背景还有一圈放射三角）
// 为什么这么做：
//   这两条都停在 partial，缺口是同一类东西 ——「纯描边图形怎么在尺寸/复杂度差别很大时看起来一样重」。
//   ① 图标：8 条描边路径的墨量 = 路径长 × 线宽。天然画出来 CV 很大（叉号最短、笔刷最长）；
//      统一光学框（等比缩到同一边长）只能收窄一部分，真正压平要把线宽按 1/路径长 反解。
//   ② 徽记：花饰不是一张图，是一组同心层的叠加，每层的重复次数必须能整除同一折数（这里是 4），
//      否则转 90° 后对不上。本模块把层半径、角向重复数、最小径向间隙都算出来。
// 差异说明：图标形状是按原片 6 帧的轮廓手绘的近似（不是原资源）；徽记按 f03 的层序重建，尺寸自定。

// ---------------- 图标（单位框 −1..1，纯描边） ----------------
const P = (x, y) => [x, y];
export const ICONS = {
  cursor: [[P(-0.52, -0.80), P(0.30, 0.60), P(0.36, 0.10), P(0.80, 0.00), P(-0.52, -0.80)]],
  brush: [
    [P(-0.66, 0.66), P(-0.16, 0.16)],
    [P(-0.16, 0.16), P(0.10, 0.44), P(0.48, 0.06), P(0.20, -0.22), P(-0.16, 0.16)],
    [P(0.48, 0.06), P(0.70, -0.16)],
  ],
  bucket: [
    [P(-0.52, -0.42), P(0.40, -0.66), P(0.62, 0.10), P(-0.30, 0.34), P(-0.52, -0.42)],
    [P(-0.48, -0.18), P(0.55, 0.02)],
    [P(0.64, 0.44), P(0.72, 0.52)],
  ],
  blob: [[P(-0.62, 0.06), P(-0.40, -0.44), P(0.06, -0.60), P(0.52, -0.36),
          P(0.64, 0.10), P(0.30, 0.52), P(-0.20, 0.54), P(-0.62, 0.06)]],
  undo: [
    [P(0.56, 0.34), P(0.44, -0.04), P(0.10, -0.30), P(-0.34, -0.32)],
    [P(-0.34, -0.32), P(-0.12, -0.60)],
    [P(-0.34, -0.32), P(-0.14, 0.00)],
  ],
  redo: [
    [P(-0.56, 0.34), P(-0.44, -0.04), P(-0.10, -0.30), P(0.34, -0.32)],
    [P(0.34, -0.32), P(0.12, -0.60)],
    [P(0.34, -0.32), P(0.14, 0.00)],
  ],
  close: [
    [P(-0.46, -0.46), P(0.46, 0.46)],
    [P(0.46, -0.46), P(-0.46, 0.46)],
  ],
  eye: [
    [P(-0.68, 0.00), P(-0.34, -0.34), P(0.00, -0.44), P(0.34, -0.34), P(0.68, 0.00),
     P(0.34, 0.34), P(0.00, 0.44), P(-0.34, 0.34), P(-0.68, 0.00)],
    [P(-0.14, 0.00), P(-0.06, -0.12), P(0.06, -0.12), P(0.14, 0.00), P(0.06, 0.12), P(-0.06, 0.12), P(-0.14, 0.00)],
  ],
};
export const ICON_NAMES = Object.keys(ICONS);

export const CFG = {
  W0: 2.0,        // 基准线宽（单位框里）
  BOX: 1.55,      // 统一光学框（最长边占单位框的多少）
  TARGET: 8.48,   // 墨量目标 = 路径长 × 线宽，取"统一光学框"那档的均值
  WCLAMP: [1.55, 2.45],   // 线宽上下限（再粗就成了黑块）
  CHIP: 52, GAP: 14, TILT: 7.0,   // 按钮底片：边长 / 间距 / 最大歪角（度）
};

export function pathLen(paths) {
  let L = 0;
  for (const p of paths) for (let i = 1; i < p.length; i++)
    L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
export function bbox(paths) {
  let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
  for (const p of paths) for (const [x, y] of p) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/** 三种归一化：raw / 统一光学框 / 统一墨量 */
export function iconWeights() {
  const rows = ICON_NAMES.map((n) => {
    const paths = ICONS[n];
    const bb = bbox(paths);
    const L = pathLen(paths);
    const s = CFG.BOX / Math.max(bb.w, bb.h);
    return { name: n, L, s, bb };
  });
  const midL = rows.reduce((a, r) => a + r.L * r.s, 0) / rows.length;
  for (const r of rows) {
    r.wRaw = CFG.W0;
    r.wRawFit = CFG.W0;
    const wIdeal = CFG.TARGET / (r.L * r.s);            // 等墨量的理想线宽
    r.wIdeal = wIdeal;
    r.wEq = Math.max(CFG.WCLAMP[0], Math.min(CFG.WCLAMP[1], wIdeal));
    r.inkRaw = r.L * r.wRaw;
    r.inkFit = r.L * r.s * r.wRawFit;
    r.inkEq = r.L * r.s * r.wEq;
    r.clamped = wIdeal < CFG.WCLAMP[0] || wIdeal > CFG.WCLAMP[1];
  }
  const cv = (key) => {
    const v = rows.map((r) => r[key]);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
    return sd / m;
  };
  return {
    rows,
    cvRaw: cv('inkRaw'), cvFit: cv('inkFit'), cvEq: cv('inkEq'),
    spreadRaw: Math.max(...rows.map((r) => r.inkRaw)) / Math.min(...rows.map((r) => r.inkRaw)),
    spreadFit: Math.max(...rows.map((r) => r.inkFit)) / Math.min(...rows.map((r) => r.inkFit)),
    spreadEq: Math.max(...rows.map((r) => r.inkEq)) / Math.min(...rows.map((r) => r.inkEq)),
    wMin: Math.min(...rows.map((r) => r.wEq)), wMax: Math.max(...rows.map((r) => r.wEq)),
    wIdealMin: Math.min(...rows.map((r) => r.wIdeal)), wIdealMax: Math.max(...rows.map((r) => r.wIdeal)),
    clamped: rows.filter((r) => r.clamped).length,
    midL,
  };
}

/** 按钮底片的倾斜布局：位置只在列上（等距不动），歪角只加在旋转上 */
export function chipLayout(n = ICON_NAMES.length) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = (Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
    const tilt = (h - Math.floor(h) - 0.5) * 2 * CFG.TILT;
    const slotY = i * (CFG.CHIP + CFG.GAP);
    out.push({ i, name: ICON_NAMES[i], cx: 0, cy: slotY, tilt });
  }
  // 旋转后的 AABB
  const half = CFG.CHIP / 2;
  for (const c of out) {
    const a = c.tilt * Math.PI / 180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    c.ext = half * (ca + sa);            // 45° 时最大 = 半边长×√2
    c.aabb = { x0: c.cx - c.ext, y0: c.cy - c.ext, x1: c.cx + c.ext, y1: c.cy + c.ext };
  }
  let minGap = 9e9, overlap = 0;
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i].aabb, b = out[j].aabb;
    const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1);
    const gy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
    const g = Math.max(gx, gy);
    if (g < 0) overlap++;
    minGap = Math.min(minGap, g);
  }
  return { chips: out, minGap, overlap, spanY: out[out.length - 1].cy + CFG.CHIP };
}

// ---------------- 徽记（同心层） ----------------
export const EMB = {
  R: 1.0,                 // 六边底片外接圆
  hatch: 24,              // 放射三角
  leaves: 9,              // 每枝叶数（两枝 = 18，可被 4 整除不了 → 见 metrics）
  fold: 4,
  rHatch: [0.60, 0.86],
  rWreath: 0.66,
  rRing: [0.40, 0.47],
  rKnot: 0.22, kd: 0.15,
  crown: 0.30,
};
export function emblem() {
  const hex = [];
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3;                 // 尖在左右
    hex.push([Math.cos(a) * EMB.R, Math.sin(a) * EMB.R]);
  }
  const hatch = [];
  for (let k = 0; k < EMB.hatch; k++) {
    const a0 = (k / EMB.hatch) * Math.PI * 2, a1 = ((k + 0.5) / EMB.hatch) * Math.PI * 2;
    hatch.push([[Math.cos(a0) * EMB.rHatch[0], Math.sin(a0) * EMB.rHatch[0]],
                [Math.cos(a1) * EMB.rHatch[1], Math.sin(a1) * EMB.rHatch[1]],
                [Math.cos(a0 + 2 * Math.PI / EMB.hatch) * EMB.rHatch[0], Math.sin(a0 + 2 * Math.PI / EMB.hatch) * EMB.rHatch[0]]]);
  }
  const leaves = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let k = 0; k < EMB.leaves; k++) {
      const t = k / (EMB.leaves - 1);
      const a = Math.PI / 2 * side * (1 - t * 1.55) + Math.PI;      // 沿下半弧排布
      const r = EMB.rWreath;
      leaves.push({ a, r, x: Math.cos(a) * r, y: -Math.sin(a) * r, rot: a + side * 0.7, s: 0.15 - t * 0.05 });
    }
  }
  const knot = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    knot.push([Math.cos(a) * EMB.kd, Math.sin(a) * EMB.kd]);
  }
  return { hex, hatch, leaves, knot, ring: EMB.rRing };
}

/** 层半径与角向重复数：能整除 fold 的层才在 90° 旋转下闭合 */
export function emblemMetrics() {
  const E = emblem();
  const layers = [
    { name: '皇冠', rep: 1, r: EMB.R + EMB.crown },
    { name: '六边底片', rep: 6, r: EMB.R },
    { name: '放射三角', rep: EMB.hatch, r: EMB.rHatch[1] },
    { name: '月桂', rep: EMB.leaves * 2, r: EMB.rWreath + 0.08 },
    { name: '环', rep: 0, r: EMB.rRing[1] },
    { name: '内芯', rep: 4, r: EMB.kd + EMB.rKnot },
  ];
  const radii = layers.map((l) => l.r);
  let mono = true;
  for (let i = 1; i < radii.length; i++) if (radii[i] >= radii[i - 1]) mono = false;
  const closed = layers.filter((l) => l.rep > 0 && l.rep % EMB.fold === 0).map((l) => l.name);
  const open = layers.filter((l) => l.rep > 0 && l.rep % EMB.fold !== 0).map((l) => `${l.name}(${l.rep})`);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const order = layers.filter((l) => l.rep > 0).map((l) => l.rep).reduce((a, b) => gcd(a, b));
  const gaps = [];
  for (let i = 1; i < radii.length; i++) gaps.push(radii[i - 1] - radii[i]);
  return {
    layers, closed, open, mono, fold: EMB.fold, order,
    minGap: Math.min(...gaps),
    nLeaves: E.leaves.length, nHatch: E.hatch.length, nKnot: E.knot.length,
  };
}

export function measure() {
  const W = iconWeights();
  const L = chipLayout();
  const E = emblemMetrics();
  return { W, L, E };
}
