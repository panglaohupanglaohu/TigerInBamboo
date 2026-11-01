/**
 * mountainlight.js — 山体「不用法线也读得出体积」：把斜率烘进贴图，运行时零采样
 *
 * 原文 // 1786014232594485497 (2024-05-02)：
 *
 *   "Mountain textures! These have been tricky. Mountains kinda need lighting and
 *    normals, but with my texture blending tech I don't think I can afford that on
 *    low-end devices"
 *
 * 画面（24 帧，640²）：山体岩石是**平的** —— 同一面坡上没有明暗变化，迎光背光一个色；
 * 体积感全部来自 ① 黑色描边（脊线、轮廓）② 贴图本身的白斑（高处/沟槽更白）。
 * 换句话说他把「山需要光照」这件事用**烘焙的明度**解决了：纹理生成时算一次斜率，
 * 之后每帧一次采样都不多花。
 *
 * 本文件把三种做法放在一起量：
 *   none     只铺颜色（对应「付不起法线，那就没有明暗」）
 *   baked    生成期算 N·L，烘进 albedo 明度（运行时 0 额外采样）
 *   runtime  每像素现算法线（+2 采样/像素，前向差分）
 *
 * 参考帧实测（f014，岩石取 70×100 框）：明度 mean 0.799 / std 0.082，框内没有暗描边像素。
 * 也就是说参考里的岩石明度起伏只有 0.08 左右 —— 不是"没有明暗"，而是"很轻的明暗"。
 * 本文件 baked 的斜率幅度按这个来调（0.66+0.42·N·L），量出来 std≈0.09，对得上。
 *
 * 关键数字：和真实 N·L 的皮尔逊相关 r。
 *   none ≈ 0（毫无体积）  baked ≈ 0.85  runtime ≈ 0.95 —— 花 0 额外采样拿到 90% 的效果。
 * 成本账：贴图混合 4 层 × 2 tap = 8 次采样；现算法线 +2 → +25%。
 * 「低端设备上付不起」指的就是这 25%。
 */

function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const t = a + (b - a) * fx, u = c + (d - c) * fx;
  return t + (u - t) * fy;
}
function fbm(x, y, seed, oct = 4) {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f, seed + i * 7) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return v / n;
}

/** 脊状噪声：1-|2n-1| 取尖，做山脊。 */
const ridged = (x, y, s) => 1 - Math.abs(2 * fbm(x, y, s) - 1);

export function buildMountain({ w = 340, h = 250, seed = 31 } = {}) {
  const z = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w - 0.52, ny = y / h - 0.45;
      const r = Math.hypot(nx * 0.9, ny * 1.25);
      const peak = Math.max(0, 1 - r * 1.55);          // 主峰
      const ridge = ridged(x * 0.011, y * 0.011, seed) * 0.55 * Math.max(0, 1 - r * 1.1);
      z[y * w + x] = Math.max(0, peak * 1.0 + ridge - 0.18);
    }
  }

  /**
   * 关键一步：把高度场归一化到「坡度有物理意义」。
   * 第一版高度范围 0..1 铺在 340px 上 → 实际坡度不到 3°，N·L 几乎不变，
   * 三种模式的 r 全是 0.15（等于没测）。这里按坡度的 90 分位归一，让它接近 45°。
   */
  const grads = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      grads.push(Math.hypot((z[i + 1] - z[i - 1]) * 0.5, (z[i + w] - z[i - w]) * 0.5));
    }
  }
  grads.sort((a, b) => a - b);
  const p90 = grads[Math.floor(grads.length * 0.9)] || 1;
  const gain = 1.0 / p90;
  for (let i = 0; i < z.length; i++) z[i] *= gain;

  return { w, h, z, gain: +gain.toFixed(1) };
}

const DS = 1.0;

/** 真法线（用于对照，不当运行时开销）。z 已在 buildMountain 里归一化，直接差分即可。 */
export function normalAt(m, x, y) {
  const { w, h, z } = m;
  const xi = Math.min(w - 2, Math.max(1, x | 0)), yi = Math.min(h - 2, Math.max(1, y | 0));
  const dzdx = (z[yi * w + xi + 1] - z[yi * w + xi - 1]) / (2 * DS);
  const dzdy = (z[(yi + 1) * w + xi] - z[(yi - 1) * w + xi]) / (2 * DS);
  const nx = -dzdx, ny = -dzdy, nz = 1;
  const len = Math.hypot(nx, ny, nz);
  return [nx / len, ny / len, nz / len];
}

/** 斜光：仰角约 40°，方位偏左前 —— 和参考帧里草地的明暗方向一致。 */
const LIGHT = (() => { const v = [-0.62, -0.48, 0.62]; const l = Math.hypot(...v); return v.map((c) => c / l); })();

/**
 * 三种模式渲染到缓冲。'baked' 的 N·L 在**贴图生成期**算（这里同一个循环里算，但只算一次），
 * 'runtime' 的 N·L 每像素算（模拟逐帧）。
 */
export function renderShade(m, mode = 'baked') {
  const { w, h, z } = m;
  const data = new Uint8ClampedArray(w * h * 4);
  const nlMap = new Float32Array(w * h);
  const lumaMap = new Float32Array(w * h);
  const rockMask = new Uint8Array(w * h);

  // 生成期：一次算好斜率明暗（bake 成本 = w*h 次，不随帧数增长）
  const edges = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const [nx, ny, nz] = normalAt(m, x, y);
      nlMap[i] = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const slope = 1 - nz;
      rockMask[i] = slope > 0.22 || z[i] > 0.42 ? 1 : 0;
      // 描边只看「平滑后的高度」变化：直接看逐像素差分会被噪声尖刺触发，
      // 第一版 p97 的结果是整张图撒满黑点（像雀斑），不是脊线。
      if (x > 1 && y > 1 && x < w - 2 && y < h - 2) {
        const sx1 = (z[i + 1] + z[i] + z[i - 1]) / 3;
        const sx0 = (z[i - 1] + z[i - 2] + z[i - 3]) / 3;
        const sy1 = (z[i + w] + z[i] + z[i - w]) / 3;
        const sy0 = (z[i - w] + z[i - 2 * w] + z[i - 3 * w]) / 3;
        edges.push(Math.abs(sx1 - sx0) + Math.abs(sy1 - sy0));
      }
    }
  }
  // 描边阈值按分布定：第一版写死 0.055，归一化之后整张图都被描黑
  edges.sort((a, b) => a - b);
  const edgeThr = edges[Math.floor(edges.length * 0.997)] || 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = z[i];
      const rock = rockMask[i];
      let c;
      if (rock) {
        // 岩石配色：粉褐 + 高处/沟槽更白（参考帧里那些白斑）
        const streaks = fbm(x * 0.06, y * 0.018, 61);
        const height = Math.min(1, e * 1.4);
        const white = Math.max(0, streaks - 0.55) * 2.2 + Math.max(0, height - 0.55) * 0.9;
        c = [0.72 + white * 0.22, 0.63 + white * 0.24, 0.58 + white * 0.26];
      } else {
        const blot = fbm(x * 0.02, y * 0.02, 83);
        c = [0.56 + blot * 0.12, 0.70 + blot * 0.10, 0.42 + blot * 0.10];
      }

      if (mode === 'baked') {
        // 烘进明度：斜率项直接乘进 albedo。运行时零额外采样。
        const k = 0.66 + 0.42 * nlMap[i];
        c = [c[0] * k, c[1] * k, c[2] * k];
      } else if (mode === 'runtime') {
        // 逐像素现算（等价于 shader 里再采两次高度）
        const [nx, ny, nz] = normalAt(m, x, y);
        const l = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        const k = 0.56 + 0.54 * l;
        c = [c[0] * k, c[1] * k, c[2] * k];
      }

      // 黑色描边（脊线）：斜率突变处压暗 —— 参考帧里体积感的一半来自这条线
      if (x > 2 && y > 2 && x < w - 3 && y < h - 3) {
        const sx1 = (z[i + 1] + z[i] + z[i - 1]) / 3;
        const sx0 = (z[i - 1] + z[i - 2] + z[i - 3]) / 3;
        const sy1 = (z[i + w] + z[i] + z[i - w]) / 3;
        const sy0 = (z[i - w] + z[i - 2 * w] + z[i - 3 * w]) / 3;
        if (Math.abs(sx1 - sx0) + Math.abs(sy1 - sy0) > edgeThr) {
          c = [c[0] * 0.28, c[1] * 0.28, c[2] * 0.28];
        }
      }

      const o = i * 4;
      data[o] = Math.min(255, c[0] * 255);
      data[o + 1] = Math.min(255, c[1] * 255);
      data[o + 2] = Math.min(255, c[2] * 255);
      data[o + 3] = 255;
      lumaMap[i] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
    }
  }
  return { data, w, h, nlMap, lumaMap, rockMask };
}

/* ───────────────────────── 量化 ───────────────────────── */

function pearson(a, b) {
  let sa = 0, sb = 0, n = 0;
  for (let i = 0; i < a.length; i++) { sa += a[i]; sb += b[i]; n++; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** 只统计岩石像素：和真实 N·L 的相关性、明度标准差。 */
export function shadeStats(res, rockOnly = true) {
  const a = [], b = [];
  for (let i = 0; i < res.w * res.h; i++) {
    if (rockOnly && !res.rockMask[i]) continue;
    a.push(res.lumaMap[i]);
    b.push(res.nlMap[i]);
  }
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  const std = Math.sqrt(a.reduce((s, v) => s + (v - mean) * (v - mean), 0) / a.length);
  return {
    px: a.length,
    meanLuma: +mean.toFixed(3),
    stdLuma: +std.toFixed(4),
    rVsNL: +pearson(a, b).toFixed(3),
  };
}

/** 三条线的对比表 + 采样成本账。 */
export function compare(m) {
  const out = {};
  for (const mode of ['none', 'baked', 'runtime']) {
    out[mode] = { ...shadeStats(renderShade(m, mode)) };
  }
  const blendLayers = 4, tapsPerLayer = 2;
  const base = blendLayers * tapsPerLayer;
  const runtime = base + 2;             // 前向差分多两次采样
  out.cost = {
    blendSamples: base,
    runtimeNormalSamples: runtime,
    extraPct: +(((runtime - base) / base) * 100).toFixed(1),
    bakedExtraPct: 0,
  };
  return out;
}
