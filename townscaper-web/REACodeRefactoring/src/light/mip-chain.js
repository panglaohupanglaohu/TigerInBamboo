/**
 * mip-chain.js — 自定义 mipmap 生成与采样（777596437534240768，第 51 轮迁自 REACode src/mipcustom.js + src/mipfilter.js）
 *
 * README 原文：「@1bardesign I tried out some custom mipmap filtering. I'm def on to something. Not entirely sure what.」
 * 原版两个实验把「好不好」变成能算的数（纯 CPU，可单测）：
 *   ① 平均必须在线性空间：棋盘 0/1 在 sRGB 数值上平均得 0.5，人眼亮度只有 ≈0.22（「发灰偏暗」的一半原因）；
 *   ② 远处必须收敛到常数，否则就是摩尔纹；想保中景细节要把对比度还回去（unsharp / Kaiser 宽核），代价是远处波纹回来；
 *   ③ 放大要 trilinear 且按 0.5 像素对齐；地面透视下纵横压缩不同，沿主轴多取几 tap（各向异性）才能既有细节又不闪。
 * 重构：两份实验合成一个共享模块（RGB Float32 0..1 sRGB 数值），四档过滤 + 双 / 三线性 + 各向异性 + 度量，供贴图实验与图集 mip 复用。
 */
export const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const linearToSrgb = (v) => { const c = Math.max(0, Math.min(1, v)); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
const KAISER = [0.11, 0.39, 0.39, 0.11];   // 4 tap（中心两点权重大），各维可分离

/** img = { w, h, data: Float32Array(w·h·3) }（sRGB 数值 0..1）。filter: 'box'（sRGB 直接平均）| 'linear' | 'kaiser' | 'sharp'。 */
export function buildMips(img, { filter = 'linear', levels = 0, sharpen = 0.6 } = {}) {
  if (!['box', 'linear', 'kaiser', 'sharp'].includes(filter)) throw new RangeError('unknown mip filter');
  if (!img || !Number.isInteger(img.w) || !Number.isInteger(img.h) || img.data.length !== img.w * img.h * 3) throw new TypeError('img {w,h,data[w*h*3]} required');
  const lin = filter !== 'box', chain = [img];
  const dec = (v) => (lin ? srgbToLinear(v) : v), enc = (v) => (lin ? linearToSrgb(v) : Math.max(0, Math.min(1, v)));
  let cur = img;
  while ((cur.w > 1 || cur.h > 1) && (!levels || chain.length <= levels)) {
    const W = Math.max(1, cur.w >> 1), H = Math.max(1, cur.h >> 1), out = new Float32Array(W * H * 3);
    const at = (x, y, k) => dec(cur.data[(Math.min(cur.h - 1, Math.max(0, y)) * cur.w + Math.min(cur.w - 1, Math.max(0, x))) * 3 + k]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) {
      let v;
      if (filter === 'kaiser') { v = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) v += KAISER[i] * KAISER[j] * at(2 * x - 1 + i, 2 * y - 1 + j, k); }
      else v = (at(2 * x, 2 * y, k) + at(2 * x + 1, 2 * y, k) + at(2 * x, 2 * y + 1, k) + at(2 * x + 1, 2 * y + 1, k)) / 4;
      if (filter === 'sharp') { let ring = 0; for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [0, 2], [-1, 1], [2, 1], [1, -1], [1, 2]]) ring += at(2 * x + dx, 2 * y + dy, k); v = v + sharpen * (v - ring / 8); }
      out[(y * W + x) * 3 + k] = enc(v);
    }
    cur = { w: W, h: H, data: out }; chain.push(cur);
  }
  return chain;
}

/** 双线性（像素中心在 +0.5；u,v ∈ [0,1]，重复寻址）。 */
export function sampleBilinear(m, u, v) {
  const x = u * m.w - 0.5, y = v * m.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, out = [0, 0, 0];
  const px = (xx, yy, k) => m.data[(((yy % m.h) + m.h) % m.h * m.w + (((xx % m.w) + m.w) % m.w)) * 3 + k];
  for (let k = 0; k < 3; k++) out[k] = (px(x0, y0, k) * (1 - fx) + px(x0 + 1, y0, k) * fx) * (1 - fy) + (px(x0, y0 + 1, k) * (1 - fx) + px(x0 + 1, y0 + 1, k) * fx) * fy;
  return out;
}
/** 三线性：lod 为浮点级别，在线性空间插两级。 */
export function sampleTrilinear(chain, u, v, lod) {
  const l = Math.max(0, Math.min(chain.length - 1, lod)), a = Math.floor(l), b = Math.min(chain.length - 1, a + 1), t = l - a;
  const A = sampleBilinear(chain[a], u, v), B = sampleBilinear(chain[b], u, v);
  return A.map((x, k) => linearToSrgb(srgbToLinear(x) * (1 - t) + srgbToLinear(B[k]) * t));
}
/** 各向异性：足迹 (du, dv)（每屏幕像素的纹理坐标跨度），短轴定 lod、长轴方向取 n 个 tap 平均（线性空间）。 */
export function sampleAniso(chain, u, v, du, dv, { maxTaps = 8 } = {}) {
  const W = chain[0].w, H = chain[0].h, lu = Math.hypot(du[0] * W, du[1] * H), lv = Math.hypot(dv[0] * W, dv[1] * H);
  const major = lu >= lv ? du : dv, minorLen = Math.max(1e-6, Math.min(lu, lv)), majorLen = Math.max(lu, lv);
  const taps = Math.max(1, Math.min(maxTaps, Math.ceil(majorLen / minorLen))), lod = Math.log2(Math.max(1, majorLen / taps)), acc = [0, 0, 0];
  for (let i = 0; i < taps; i++) { const s = (i + 0.5) / taps - 0.5, c = sampleTrilinear(chain, u + major[0] * s, v + major[1] * s, lod); for (let k = 0; k < 3; k++) acc[k] += srgbToLinear(c[k]); }
  return acc.map((x) => linearToSrgb(x / taps));
}
/** 一级图的度量：线性平均亮度、振幅（max−min，剩多少纹路）、拉普拉斯能量（高频 → 闪烁倾向）。 */
export function levelStats(m) {
  let sum = 0, lo = Infinity, hi = -Infinity, lap = 0; const L = (x, y) => srgbToLinear(m.data[((((y % m.h) + m.h) % m.h) * m.w + (((x % m.w) + m.w) % m.w)) * 3]);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const v = L(x, y); sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v); lap += Math.abs(4 * v - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); }
  const n = m.w * m.h; return { meanLinear: sum / n, amp: hi - lo, laplacian: lap / n };
}
