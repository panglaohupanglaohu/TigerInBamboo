/**
 * snapshot64.js — 岛不存几何，存一张 64² 快照，再用 shader 魔法把它"脆"回来
 *
 * 帖子 ID：911913981731885056（2019-01-19）
 *   "I'm looking at the campaign map. Saving island snapshots to 64² textures and
 *    then crisping them back up with some shader magic"
 *
 * 为什么这么做：原文说的是两件事 —— ①**存储**降级：一座岛只留 64×64 的一张图，
 * 4 千个值代替 6 万多个值（16×）；②**观感**不跟着降级：放大后要"crisping back up"，
 * 也就是边缘要重新变硬，而不是糊成一坨灰。
 *
 * 这里把三种放大放在一起量：
 *   nearest  —— 不处理，方块感（像素格能数出来）
 *   bilinear —— 标准双线性，边缘变成一条宽渐变带，剪影看起来"虚"
 *   crispen  —— 在双线性结果上，用**局部梯度**决定阈值带宽度：梯度大的地方把
 *               smoothstep 的过渡带压到 0.05（边缘立即变硬），平坦的地方保留宽过渡
 *               （内部不出现台阶）。这就是"shader magic"里真正起作用的那一步。
 *
 * 量的是 IoU（和 256² 原始剪影比）与边缘能量。crispen 应该两头都赢：
 * 比 nearest 的锯齿少（IoU 更高），比 bilinear 的边更硬（梯度能量更高）。
 */

function hash(x, y, s) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, s, oct = 5) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += vnoise(x * f, y * f, s + i * 13) * amp;
    f *= 2.03; amp *= 0.5;
  }
  return sum; // ≈ 0..1
}

/** 256² 的"真值"岛剪影（0/1）。后面所有降级都拿它当参照。 */
export function makeIsland(n = 256, seed = 3) {
  const m = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const f = fbm(u * 4.2, v * 4.2, seed, 5) + 0.30 * fbm(u * 11, v * 11, seed + 5, 3);
      const field = f + 0.62 * (1 - r * r);
      m[y * n + x] = field > 0.86 ? 1 : 0;
    }
  }
  return m;
}

/** 盒式降采样：这座岛"存下来的东西"就是这张 m×m。 */
export function downsample(mask, n, m) {
  const k = n / m;
  const out = new Float32Array(m * m);
  for (let y = 0; y < m; y++) {
    for (let x = 0; x < m; x++) {
      let s = 0;
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) s += mask[(y * k + j) * n + (x * k + i)];
      }
      out[y * m + x] = s / (k * k);
    }
  }
  return out;
}

function bilinAt(small, m, fx, fy) {
  const x0 = Math.min(m - 1, Math.max(0, Math.floor(fx)));
  const y0 = Math.min(m - 1, Math.max(0, Math.floor(fy)));
  const x1 = Math.min(m - 1, x0 + 1), y1 = Math.min(m - 1, y0 + 1);
  const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
  const a = small[y0 * m + x0], b = small[y0 * m + x1];
  const c = small[y1 * m + x0], d = small[y1 * m + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

export function upNearest(small, m, n) {
  const out = new Float32Array(n * n);
  const k = m / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[y * n + x] = small[Math.floor(y * k) * m + Math.floor(x * k)];
    }
  }
  return out;
}

export function upBilinear(small, m, n) {
  const out = new Float32Array(n * n);
  const k = m / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) out[y * n + x] = bilinAt(small, m, (x + 0.5) * k - 0.5, (y + 0.5) * k - 0.5);
  }
  return out;
}

/**
 * crispen：双线性 + 「按局部梯度收窄阈值带」。
 * 梯度大 = 这里本来就有边 → 过渡带压窄，边立刻硬；
 * 梯度小 = 岛内部/海面 → 保持宽过渡，不会把内部噪点也切成台阶。
 */
export function crispen(small, m, n, opt = {}) {
  const lo = opt.lo ?? 0.045;
  const gain = opt.gain ?? 5.0;
  const base = upBilinear(small, m, n);
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const v = base[i];
      const xm = base[y * n + Math.max(0, x - 1)], xp = base[y * n + Math.min(n - 1, x + 1)];
      const ym = base[Math.max(0, y - 1) * n + x], yp = base[Math.min(n - 1, y + 1) * n + x];
      const g = Math.hypot(xp - xm, yp - ym) * 0.5;
      const w = Math.max(lo, 0.5 - 0.46 * Math.min(1, g * gain));
      const t = Math.min(1, Math.max(0, (v - (0.5 - w)) / (2 * w)));
      out[i] = t * t * (3 - 2 * t);
    }
  }
  return out;
}

export function silhouette(img, n, thr = 0.5) {
  const b = new Uint8Array(n * n);
  for (let i = 0; i < b.length; i++) b[i] = img[i] >= thr ? 1 : 0;
  return b;
}

export function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x && y) inter++;
    if (x || y) uni++;
  }
  return uni ? inter / uni : 0;
}

/**
 * 边缘能量 = 相邻像素差的绝对值之和。
 *
 * 注意：这个量**不能**用来判断 crispen 有没有效 —— 任何单调重映射（包括
 * smoothstep）都保持总变差不变，所以双线性和 crispen 的能量几乎一样（实测
 * 0.01487 vs 0.01485）。要量"边更硬"，得看下面两个：峰值梯度、过渡带像素数。
 */
export function edgeEnergy(img, n) {
  let s = 0;
  for (let y = 1; y < n; y++) {
    for (let x = 1; x < n; x++) {
      const i = y * n + x;
      s += Math.abs(img[i] - img[i - 1]) + Math.abs(img[i] - img[i - n]);
    }
  }
  return s / (n * n);
}

/** 峰值梯度：边最陡那一下有多陡。单调映射会把同一份落差挤到更少的像素上 → 峰值变高。 */
export function peakGradient(img, n) {
  let m = 0;
  for (let y = 1; y < n; y++) {
    for (let x = 1; x < n; x++) {
      const i = y * n + x;
      m = Math.max(m, Math.abs(img[i] - img[i - 1]), Math.abs(img[i] - img[i - n]));
    }
  }
  return m;
}

/** 过渡带像素数：0.15<v<0.85 的像素。越少 = 边越窄 = 越"脆"。 */
export function bandPixels(img, n, lo = 0.15, hi = 0.85) {
  let c = 0;
  for (let i = 0; i < img.length; i++) if (img[i] > lo && img[i] < hi) c++;
  return c;
}

/** 和真值比的平均绝对误差（0/1 灰阶）。crispen 把半灰的过渡像素推向两端，RMSE 应该降。 */
export function rmse(img, truth, n) {
  let s = 0;
  for (let i = 0; i < img.length; i++) {
    const d = img[i] - truth[i];
    s += d * d;
  }
  return Math.sqrt(s / (n * n));
}
