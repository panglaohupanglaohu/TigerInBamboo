/**
 * colorvolume.js — 不给每个特征一个颜色，给它**一整块颜色空间**。
 *
 * 帖子 ID：1710031224838771027（2023-10-05，texture）
 *
 *   "Ok here's a probably horrible way to author color volumes. The idea is to
 *    properly define the whole color possibility space for each feature"
 *
 * ---- 画面观察（6 帧，512²；Unity Inspector "Col Vol Test (Script)"） ----
 *   · 面板上是五个特征：Grass / Roof / Cliff / Beach / Flowers；
 *   · 每个特征下面是**一整条色带**（约 12 格），不是一个色块：格与格之间只差一点，
 *     整条合起来才是"这个特征能长成什么样"；
 *   · 五条色带彼此不重叠 —— Grass 那条偏黄绿，Cliff 偏冷灰，Beach 偏沙白，
 *     这正是"possibility space"要保证的东西：草不可能长成沙子的颜色。
 *
 * ---- 为什么不是"每个特征一个颜色" ----
 * 一个色块 = 一片死色，贴到大面积上立刻假。真实材质在同一特征内也有变化
 * （向阳的草更黄、坡底更暗），但变化必须**留在自己的空间里**，不能串到隔壁特征上。
 * 所以这里把颜色写成三个参数的三线性插值：
 *
 *     u = 高度（低 → 高）      v = 坡度（平 → 陡）      w = 变化（干 → 湿）
 *
 * 8 个角点 = 这块空间的八个极端，中间全是插值出来的。作者只需要摆 8 个角，
 * 就定义了"这个特征所有可能的颜色"，而"特征的辨识度"变成一个可以量的东西：
 * 两块空间之间的最小距离。距离 > 0，草就不会长成沙子。
 *
 * 颜色在 OKLab 里插值（线性 RGB 插值会在中间发灰），最后钳色域。
 */

import { rgbToOklab, oklabToRgb, clampToGamut, css } from './contrasttex.js';

export { css };

const hex = (s) => {
  const v = parseInt(s.replace('#', ''), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
};

/** 8 个角点按 (u,v,w) 的二进制下标排：000 001 010 011 100 101 110 111。 */
export function makeVolume(name, corners, opts = {}) {
  if (corners.length !== 8) throw new Error('需要 8 个角点');
  return {
    name,
    corners: corners.map((c) => rgbToOklab(...(typeof c === 'string' ? hex(c) : c))),
    ...opts,
  };
}

/** 三线性插值取色。u/v/w ∈ [0,1]。 */
export function sample(vol, u, v, w) {
  const uu = Math.min(1, Math.max(0, u));
  const vv = Math.min(1, Math.max(0, v));
  const ww = Math.min(1, Math.max(0, w));
  const out = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const bu = i & 1, bv = (i >> 1) & 1, bw = (i >> 2) & 1;
    const wt = (bu ? uu : 1 - uu) * (bv ? vv : 1 - vv) * (bw ? ww : 1 - ww);
    const c = vol.corners[i];
    out[0] += c[0] * wt; out[1] += c[1] * wt; out[2] += c[2] * wt;
  }
  return out;
}

/** 面板上那一条色带：固定 v、w，沿 u 取 n 格。 */
export function strip(vol, n = 12, v = 0.5, w = 0.5) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(sample(vol, n === 1 ? 0.5 : i / (n - 1), v, w));
  return out;
}

const dE = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 100;

/**
 * 两块空间的关系：
 *   minGap = 任意两点之间的最小距离 → 决定特征会不会串色（>8 才算分得开）
 *   extent = 自己内部最远两点距 → 决定这块材质有多少变化（<4 就是一块死色）
 * 用 5×5×5 的采样近似，不做全空间搜索。
 */
export function volumeStats(vols, n = 5) {
  const pts = vols.map((vol) => {
    const arr = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++)
          arr.push(sample(vol, i / (n - 1), j / (n - 1), k / (n - 1)));
    return arr;
  });

  const extent = pts.map((arr) => {
    let m = 0;
    for (let i = 0; i < arr.length; i += 3)
      for (let j = i; j < arr.length; j += 3) m = Math.max(m, dE(arr[i], arr[j]));
    return m;
  });

  let minGap = 1e9, pair = [0, 1];
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      let m = 1e9;
      for (const p of pts[a]) for (const q of pts[b]) m = Math.min(m, dE(p, q));
      if (m < minGap) { minGap = m; pair = [a, b]; }
    }
  }
  return { extents: extent, minGap, closestPair: pair };
}

/** 把整块空间压成一张方块图：每一行固定 v，横轴 u，行内再按 w 抖一点。 */
export function volumeSheet(vol, n = 12, rows = 5) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const v = rows === 1 ? 0.5 : r / (rows - 1);
    out.push(strip(vol, n, v, 0.5));
  }
  return out;
}

// ---------- 预览用的地形：高度/坡度 → 特征 → 该特征空间里的颜色 ----------

function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  // (h^h>>16) 在 JS 里是 int32，最高位被符号吃掉，所以只能除 2^31 —— 除 2^32 会永远落在 0..0.5
  return (((h ^ (h >> 16)) >>> 0) % 2147483648) / 2147483648;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = s(xf), v = s(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}

/**
 * 一块岛坡：高度场 → 坡度 → 四个特征（Beach 在水线附近、Cliff 在陡处、
 * Grass 在缓坡、Flowers 在草丛里随机开花）。颜色从各自的空间里取，
 * 所以同一片草有明暗、却不会被误认成沙滩。
 */
export function terrain(w, h, vols, opts = {}) {
  const { scale = 6, seed = 1, out = new Float32Array(w * h * 3) } = opts;
  const hs = new Float32Array(w * h);
  let lo = 1e9, hi = -1e9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w, ny = y / h;
      // 径向衰减做岛 + fbm 做起伏；先算原始高度，后面统一归一化
      const d = Math.hypot((nx - 0.5) * 1.6, (ny - 0.46) * 1.9);
      const base = Math.max(0, 1 - d * d * 1.05);
      const v = base * 0.9 + (fbm(nx * scale + seed * 7.3, ny * scale + seed * 3.1) - 0.5) * 0.55;
      hs[y * w + x] = v;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
  }
  const span = Math.max(1e-6, hi - lo);
  for (let i = 0; i < hs.length; i++) hs[i] = (hs[i] - lo) / span;

  const at = (x, y) => hs[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  // 坡度也要先看全场最大梯度，否则阈值是拍脑袋的
  let gmax = 1e-6;
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const gy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      gmax = Math.max(gmax, Math.hypot(gx, gy));
    }

  const used = { Beach: 0, Cliff: 0, Grass: 0, Flowers: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hh = at(x, y);
      const gx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const gy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      const slope = Math.min(1, Math.hypot(gx, gy) / gmax);
      const u = hh;
      const wob = hash2(x * 3 + seed, y * 5 - seed);
      let vol;
      if (hh < 0.13) { vol = vols.Beach; used.Beach++; }
      else if (slope > 0.55) { vol = vols.Cliff; used.Cliff++; }
      else if (wob > 0.90 && hh > 0.30) { vol = vols.Flowers; used.Flowers++; }
      else { vol = vols.Grass; used.Grass++; }
      const c = sample(vol, u, slope, wob);
      const [r, g, b] = oklabToRgb(c[0], c[1], c[2]);
      const i = (y * w + x) * 3;
      out[i] = Math.min(1, Math.max(0, r));
      out[i + 1] = Math.min(1, Math.max(0, g));
      out[i + 2] = Math.min(1, Math.max(0, b));
    }
  }
  return { rgb: out, used, w, h };
}

export { oklabToRgb, dE };
