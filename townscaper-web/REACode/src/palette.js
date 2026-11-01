/**
 * palette.js — 调色板与"跨调色板过渡"。
 *
 * 三条原文：
 *
 * (1) x.com/OskSta/status/1200520827898343425 (2019-11-29)
 *   "DnD hopefulls needn't fear no more, for I've now made the backend of
 *    letting you tune your town to your favorite palette."
 *   画面：同一座城镇，先是一套**高饱和**的调色板（红 / 绿 / 蓝 / 橙，纯度很高），
 *   然后**整城一起**渐变到一套灰白米色系 —— 注意是渐变（~1.5s），不是切换。
 *   屋顶始终保持暖橙，只有墙面在变。
 *
 * (2) x.com/OskSta/status/1371460793032716290 (2021-03-15)
 *   "I got it working within the duration of exactly 1 kid nap"
 *   画面：左边缘露出一列 **色块表**（两列小方块），城镇的墙色与色块一一对应。
 *   也就是说：palette 不是"几个颜色"，是**一张与建筑编号同长的表**。
 *
 * (3) x.com/OskSta/status/1344290848180203523 (2020-12-30)
 *   "A rare look at Townscapers sophisticated QA process"
 *   画面：整城每个模块一个**极端饱和色**，互相撞色。这不是美术，是调试：
 *   颜色一乱，哪块几何错位/漏面立刻看得出来。所以 palette 要能切到"调试配色"。
 *
 * 本模块只做三件事：定义几套调色板、给出**色相最短路径**的插值、给出调试配色。
 */

/**
 * 调色板。前两套来自参考帧的取色（在 1200520827898343425 的第 0 帧和第 14 帧上
 * 各取了 6 个墙面色），第三套是 QA 用的高饱和色。
 */
export const PALETTES = {
  // 高饱和：参考帧第 0 帧（红/绿/蓝/橙 纯度高，明度中等）
  vivid: {
    label: '高饱和',
    walls: ['#e05a4f', '#5cc06a', '#4f7fd0', '#e8a13c', '#a95fb0', '#3fb8b0'],
    roof: '#e2703a',
    trim: '#f3ece0',
  },
  // 灰白米：参考帧第 14 帧（墙几乎无彩，只有明度差）
  stone: {
    label: '灰白米',
    walls: ['#cfc8bb', '#d8d2c6', '#c3bdae', '#e0dacd', '#cbc5b6', '#d3ccbe'],
    roof: '#c9693c',
    trim: '#f7f3ea',
  },
  // 粉紫（1727324352264474664 那条岛用的色系）
  blush: {
    label: '粉紫',
    walls: ['#e7b9b4', '#dcc3d6', '#c9b7d8', '#e8cdb4', '#bfc9d8', '#e2c4c8'],
    roof: '#b4644a',
    trim: '#f6eef0',
  },
  // QA：每个编号一个极端色，肉眼就能分辨"这是第几种模块"
  debug: {
    label: 'QA 撞色',
    walls: ['#ff2d55', '#00e05a', '#0a84ff', '#ffd60a', '#bf5af2', '#00e0d0',
      '#ff9f0a', '#ff375f', '#5e5ce6', '#32d74b', '#64d2ff', '#ff6b22'],
    roof: '#ffffff',
    trim: '#000000',
  },
};

/* ------------------------------------------------------------ 颜色工具 */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

export function hslToRgb([h, s, l]) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

/**
 * 色相最短路径插值。
 *
 * 为什么不用 RGB 直插：以 #e05a4f → #5cc06a（红→绿）为例，
 * RGB 中点是 #9e8d5d，饱和度只有 **0.259**（一坨土黄）；
 * HSL 走短弧的钟点是 #c3d155，饱和度 **0.574** —— 差 2.2 倍。
 * 整城切调色板时，那 0.5 秒会是"全部变色成泥"还是"颜色平滑地滑过去"，
 * 就取决于这一步。
 */
export function mixHsl(a, b, t) {
  const [h1, s1, l1] = rgbToHsl(hexToRgb(a));
  const [h2, s2, l2] = rgbToHsl(hexToRgb(b));
  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = (h1 + dh * t + 1) % 1;
  return rgbToHex(hslToRgb([h, s1 + (s2 - s1) * t, l1 + (l2 - l1) * t]));
}

/**
 * 两套调色板之间插值。
 *
 * 表的长度不同时按**下标取模**对齐 —— 参考帧里 vivid 和 stone 的墙都是 6 个槽，
 * 但 debug 有 12 个；取模之后 12 槽的过渡仍然连续（只是每两槽共用一条轨迹）。
 */
export function mixPalette(a, b, t) {
  const n = Math.max(a.walls.length, b.walls.length);
  const walls = [];
  for (let i = 0; i < n; i++) {
    walls.push(mixHsl(a.walls[i % a.walls.length], b.walls[i % b.walls.length], t));
  }
  return {
    label: `${a.label} → ${b.label}`,
    walls,
    roof: mixHsl(a.roof, b.roof, t),
    trim: mixHsl(a.trim, b.trim, t),
  };
}

/** 按编号取墙色（参考帧里编号是"第几栋楼"，即 modulo）。 */
export function wallColor(palette, index) {
  return palette.walls[((index % palette.walls.length) + palette.walls.length) % palette.walls.length];
}

/** 一批颜色的平均饱和度，用来量化"这套板有多艳"。 */
export function meanSaturation(palette) {
  const s = palette.walls.map((c) => rgbToHsl(hexToRgb(c))[1]);
  return +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3);
}

/** 两套板之间的平均色相距离（度），用来量化"差多远"。 */
export function hueDistance(a, b) {
  const n = Math.min(a.walls.length, b.walls.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const h1 = rgbToHsl(hexToRgb(a.walls[i]))[0] * 360;
    const h2 = rgbToHsl(hexToRgb(b.walls[i]))[0] * 360;
    let d = Math.abs(h1 - h2);
    if (d > 180) d = 360 - d;
    sum += d;
  }
  return +(sum / n).toFixed(1);
}
