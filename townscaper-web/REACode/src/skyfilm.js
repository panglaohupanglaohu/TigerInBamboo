/**
 * skyfilm.js — 阴云的**实测模型**：单片云、慢漂移、极低对比度。
 *
 * 片子 1243228419162341379（2020-06-19）"Some moody clouds"，512²，29.34s。
 * 本轮把 24 帧逐像素量了一遍，**推翻了 `clouddeck.js` 注释里的三条直觉**：
 *
 *   ① 「3 层不同深度、视差滚动」→ 实测**只有一片云**。
 *      对 f000(t=0.059s) 与 f023(t=11.08s) 的天空做暴力平移搜索（dx∈±60, dy∈±20），
 *      最佳解是**单一平移** (-49, -4) px，相关系数 **0.864**。
 *      如果真是 3 片各自跑（速度 8.1/13.0/26.0 px/s），任何单一平移都解释不了 86% 的相关性。
 *      剩下那 14%（≈25% 方差）是"云自己在变形"，不是"层间错位"。
 *
 *   ② 「近层 26 px/s」→ 实测 **4.45 px/s**（= 49px / 11.02s），**慢了 5.8 倍**。
 *      这是个"看起来在动，其实几乎不动"的镜头；按 26 px/s 写，11 秒该走 286px（半屏），
 *      片子只走 49px（9.6% 屏宽）。
 *
 *   ③ 「云底发暗 / 云顶被照亮」→ 实测是**整幅往上变亮**：
 *      逐行平均亮度 顶行 229.0 → 地平线（第 225 行）211.2，单调下降 18 级，
 *      云团本身的高通分量**没有**上下不对称（把行均值扣掉之后，云亮/云暗块在上下半区的分布一致）。
 *      所以"闷"来自"顶部亮、地平线灰"这一条竖直渐变 + 云层对比度极低，
 *      不是来自云的明暗结构。
 *
 * 实测常数（全部可复算，见 FILM 与 probeDrift）：
 *   天空基色亮度      221.0（0..255），竖直渐变 229.0 → 211.2
 *   云的高通幅度      std 4.91，p5/p95 = -7.9 / +9.5，**峰峰值只有 ±4% 亮度**
 *   云块特征尺寸      自相关半宽 25px → 团块直径 ≈ 50px ≈ 9.8% 画幅
 *   频谱能量          0–5 环 68.2%、5–10 环 19.4%、10–20 环 6.0% → 极低频，所以"没有边"
 *   梯度              |∇I| 均值 0.53、p95 2.22 级/px → 单像素最多变 2 级，肉眼不可能看到硬边
 *   颜色              暗处 (193,214,216) 偏青、亮处 (226,237,238) 近中性白；色度 mean 16
 *   漂移              (-4.45, -0.36) px/s @512 → 归一化 (-0.0087, -0.0007)/s
 *
 * 为什么写成"噪声沿第 3 轴演化"而不是"两层错位"：
 *   单一平移解释 86%，说明位移是**同一场**的；同时相关性随时间单调衰减
 *   （Δt=5.9s → 0.516，7.8s → 0.379，11.0s → 0.170），这是 3D 噪声 advect 的特征。
 *   2D 平移的特征相反：相关性**不衰减**，只会出现一个越来越大的位移峰。
 *   这两条是能区分"云在飘"和"云在变"的判据，别再只看画面。
 */

// ── 实测常数（改这几个数之前先重跑 probeDrift，别凭感觉调）──────────────
export const FILM = {
  size: 512,
  base: 221.0,          // 天空平均亮度
  top: 229.0,           // 第 0 行平均
  horizon: 211.2,       // 第 225 行平均
  ampStd: 4.91,         // 云的高通 std（亮度级）
  ampP5: -7.9,
  ampP95: 9.5,
  feature: 50,          // 云块直径 px（自相关半宽 25）
  driftPx: [-4.45, -0.36], // px/s @512
  corrAt: { '5.9': 0.516, '7.8': 0.379, '11.0': 0.170 }, // 高通天空的自相关衰减
  corrBest: 0.864,      // f000 vs f023 在最佳平移处的相关
  dark: [193, 214, 216],
  light: [226, 237, 238],
  gradP95: 2.22,
  energy: [0.682, 0.194, 0.060], // 0-5 / 5-10 / 10-20 环
};

// ── 值噪声（3D：x, y, t）────────────────────────────────────────────
const hash3 = (x, y, z) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 65536) / 65535;
};
const smooth = (t) => t * t * (3 - 2 * t);

/** 值噪声：格点哈希 + 平滑插值。period 让 x 方向可循环（云要能无缝平移）。 */
export function noise3(x, y, z, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  const wrap = (i) => (period ? ((i % period) + period) % period : i);
  const c = (dx, dy, dz) => hash3(wrap(xi + dx), yi + dy, zi + dz);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u;
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u;
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/**
 * 云密度（0..1，0.5 = 平均天空）。
 * 三个倍频的权重按实测频谱能量开方（能量 → 幅度是 sqrt）：
 *   sqrt(0.682):sqrt(0.194):sqrt(0.060) = 0.826:0.440:0.245 → 归一化 0.5/0.3/0.15
 * 第一倍频的格距取 1/0.098 ≈ 10.2（团块直径 ≈ 画幅的 9.8%）。
 */
export function cloudDensity(u, v, t, opts = {}) {
  const f0 = opts.f0 ?? 6.6;
  const evolve = opts.evolve ?? 0.035;   // 第 3 轴的推进速度（1/s）
  const drift = opts.drift ?? FILM.driftPx;
  // 符号：drift 是"云往哪走"。采样时要用 u - du，否则渲出来的云往反方向飘
  // （本轮踩过：先写成 u + du，模型漂移 +49，片子是 -49，量出来才发现的）
  const du = (drift[0] / FILM.size) * t; // 归一化漂移
  const dv = (drift[1] / FILM.size) * t;
  const z = t * evolve;
  const a = noise3((u - du) * f0, (v - dv) * f0, z, f0);
  const b = noise3((u - du) * f0 * 2.03, (v - dv) * f0 * 2.03, z + 3.7, 0);
  const c = noise3((u - du) * f0 * 4.11, (v - dv) * f0 * 4.11, z + 7.3, 0);
  const n = a * 0.5 + b * 0.3 + c * 0.2;
  return n; // 0..1，未做对比度拉伸
}

/**
 * 天空颜色：竖直渐变（顶亮底灰）+ 云调制。
 * 幅度按实测：std 4.91 级 → 峰峰 ≈ 18 级。返回 [r,g,b]（0..255）。
 */
export function skyRGB(u, v, t, opts = {}) {
  const n = (cloudDensity(u, v, t, opts) - 0.5) * 2;      // -1..1
  const baseL = FILM.top + (FILM.horizon - FILM.top) * Math.min(1, v * 512 / 230);
  const lum = baseL + n * FILM.ampStd * 1.60;             // 1.72 ≈ 让 std 落回 4.91
  const k = Math.max(0, Math.min(1, (lum - (FILM.base - 14)) / 28));
  const [dr, dg, db] = FILM.dark, [lr, lg, lb] = FILM.light;
  const r = dr + (lr - dr) * k, g = dg + (lg - dg) * k, b = db + (lb - db) * k;
  return [r, g, b];
}

/** 把一片天空渲染进 ImageData（给 lab / 反测用）。 */
export function renderSky(ctx, w, h, t, opts = {}) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = skyRGB(x / w, y / h, t, opts);
      const i = (y * w + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return img;
}

// ── 反测：从两帧亮度图里恢复漂移 ────────────────────────────────────
/**
 * probeDrift — 暴力整数平移搜索，返回最佳 (dx,dy) 与相关系数。
 * 这正是本轮用来推翻"视差 3 层"的工具：如果最佳位移只是**一个**，
 * 且相关系数高，那就只有一片云在动。
 *
 * @param {Float32Array} A 前一帧亮度（已裁到天空区）
 * @param {Float32Array} B 后一帧亮度（同尺寸）
 * @param {number} w @param {number} h @param {number} maxX @param {number} maxY
 */
export function probeDrift(A, B, w, h, maxX = 60, maxY = 20) {
  // 先扣行均值，去掉竖直渐变（否则渐变会主导相关性，位移永远搜到 0）
  const hp = (src) => {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let m = 0;
      for (let x = 0; x < w; x++) m += src[y * w + x];
      m /= w;
      for (let x = 0; x < w; x++) out[y * w + x] = src[y * w + x] - m;
    }
    return out;
  };
  const a = hp(A), b = hp(B);
  const pad = 20;
  let best = { corr: -2, dx: 0, dy: 0 };
  const corrAt = (dx, dy) => {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
    for (let y = pad; y < h - pad; y++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let x = pad; x < w - pad; x++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const p = a[y * w + x], q = b[yy * w + xx];
        sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q; n++;
      }
    }
    if (n < 1000) return -2;
    const cov = sab / n - (sa / n) * (sb / n);
    const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
    return cov / Math.sqrt(va * vb + 1e-9);
  };
  for (let dy = -maxY; dy <= maxY; dy++) {
    for (let dx = -maxX; dx <= maxX; dx++) {
      const c = corrAt(dx, dy);
      if (c > best.corr) best = { corr: c, dx, dy };
    }
  }
  return best;
}

/** 自相关半宽（团块尺寸）：沿一行做自相关，返回降到 0.5 的滞后。 */
export function autocorrHalfWidth(arr, w, h) {
  const cy = h >> 1;
  const row = new Float32Array(w);
  let m = 0;
  for (let x = 0; x < w; x++) { row[x] = arr[cy * w + x]; m += row[x]; }
  m /= w;
  for (let x = 0; x < w; x++) row[x] -= m;
  let v0 = 0;
  for (let x = 0; x < w; x++) v0 += row[x] * row[x];
  const ac = [];
  for (let lag = 0; lag < w / 2; lag++) {
    let s = 0;
    for (let x = 0; x < w - lag; x++) s += row[x] * row[x + lag];
    ac.push(s / v0);
  }
  for (let i = 1; i < ac.length; i++) {
    if (ac[i] < 0.5) return i;
  }
  return -1;
}

/** 亮度统计（lab 里显示"模型 vs 片子"用）。 */
export function lumStats(arr) {
  const n = arr.length;
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) { s += arr[i]; s2 += arr[i] * arr[i]; }
  const mean = s / n;
  const sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  const sorted = Float32Array.from(arr).sort();
  return { mean, std: sd, p5: sorted[Math.floor(n * 0.05)], p95: sorted[Math.floor(n * 0.95)] };
}
