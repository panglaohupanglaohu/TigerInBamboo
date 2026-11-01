/**
 * noise.js — 带种子的 value noise / fbm / ridged + 随机数。
 * 移植自 REACode/engine/noise.js（确定性：同一个种子永远生成同一座岛）。
 */

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  return lerp(
    lerp(hash2(xi, yi, seed), hash2(xi + 1, yi, seed), xf),
    lerp(hash2(xi, yi + 1, seed), hash2(xi + 1, yi + 1, seed), xf),
    yf,
  );
}

export function fbm(x, y, { octaves = 4, freq = 4, gain = 0.5, lacunarity = 2, seed = 0 } = {}) {
  let sum = 0, amp = 1, norm = 0, f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 131) * amp;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** 脊线噪声：0.5 附近的等值线变成 1 的山脊，用来切峡谷。 */
export function ridged(x, y, opts = {}) {
  return 1 - Math.abs(fbm(x, y, opts) * 2 - 1);
}

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 整数哈希 → [0,1)，给逐格 / 逐面的小变化用。 */
export function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v) => clamp(v, 0, 1);
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-9));
  return t * t * (3 - 2 * t);
};
