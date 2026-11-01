/**
 * repeatbreak.js — 同一张贴图，用"几套不同设置"打散平铺重复。
 *
 * 原文（x.com/OskSta/status/1061229717582475264, 2018-11-10）：
 *
 *   "But you can break up that repetition by using a few different ones with
 *    different settings (all still using the same texture)"
 *
 * 前一条（x.com/OskSta/status/1061227418961219585, 2018-11-10）：
 *
 *   "Obviously, if you stretch it too far, you will start to notice the repetition"
 *
 * 画面实测（两条是连发的同一组 UI 贴图）：把一张装饰图拉得很宽时，肉眼立刻能
 * 看出"每隔一段就重复一次"；换成几块**同源但设置不同**的（缩放不同、翻转不同、
 * 相位不同）拼在一起，重复就散了 —— 但注意原文强调 "all still using the same
 * texture"：不是多画几张图，是同一张换参数。
 *
 * 为什么这招有效：人眼抓的是**自相关峰**。单一平铺在周期 P 处有一个很强的峰；
 * 把 N 套不同尺度的平铺按低频掩码混起来，原来那个峰会被摊成几个弱峰，而低频
 * 结构（亮暗大块）还在。所以这里不量"好不好看"，直接量**自相关峰**掉多少。
 *
 * 本文件不 import three，纯 CPU。
 */

import { rng } from './bouncegi.js';

/** 生成一张"有明确周期"的测试贴图（棋盘 + 斜纹），重复最好认。 */
export function makePeriodicTexture({ size = 64, period = 16, seed = 3 } = {}) {
  const data = new Float32Array(size * size);
  const n = rng(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / period), cy = Math.floor(y / period);
      const checker = (cx + cy) % 2;
      const stripe = ((x + y) % (period / 2)) < 2 ? 1 : 0;
      data[y * size + x] = 0.35 + 0.4 * checker + 0.18 * stripe + 0.05 * n();
    }
  }
  return { size, period, data };
}

/**
 * 采样（可指定缩放 / 翻转 / 相位），坐标是**世界**坐标（单位=贴图宽）。
 * 多套设置共用同一张贴图 —— 照原文。
 */
function sampleVariant(tex, wx, wy, v) {
  const s = tex.size;
  let u = (wx * v.scale + v.ox) % 1;
  let w = (wy * v.scale + v.oy) % 1;
  if (u < 0) u += 1;
  if (w < 0) w += 1;
  if (v.flipU) u = 1 - u;
  if (v.flipV) w = 1 - w;
  const x = Math.min(s - 1, Math.floor(u * s));
  const y = Math.min(s - 1, Math.floor(w * s));
  return tex.data[y * s + x];
}

/**
 * 铺一片地：`variants` 套设置，用一张低频掩码在场内切换（不是每像素混，
 * 混会把两种周期叠成一层平均色，反而糊；参考片是"这一片用这套、那一片用那套"）。
 *
 * @param opts.variants 每套 {scale, ox, oy, flipU, flipV}
 * @param opts.maskScale 掩码的低频尺度（世界单位，越大块越大）
 * @param opts.blend 掩码过渡带（0=硬切，0.3=柔一点）
 */
export function tileField(tex, {
  w = 256, h = 256, worldW = 4, variants = null, maskScale = 2.2, blend = 0.25, seed = 17,
} = {}) {
  const V = variants || [
    { scale: 1.0, ox: 0.00, oy: 0.00 },
    { scale: 0.62, ox: 0.37, oy: 0.61, flipU: true },
    { scale: 1.55, ox: 0.71, oy: 0.19 },
    { scale: 0.83, ox: 0.13, oy: 0.44, flipV: true },
  ];
  const out = new Float32Array(w * h);
  const rnd = rng(seed);
  // 每套设置一个随机相位的低频掩码（正弦叠加，够"块状"了）
  const masks = V.map(() => ({
    ax: 0.6 + rnd() * 0.9, ay: 0.6 + rnd() * 0.9,
    px: rnd() * 6.28, py: rnd() * 6.28,
  }));
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const wx = (px / w) * worldW;
      const wy = (py / h) * worldW;
      // 选哪一套：按掩码最大者
      let best = -1e9, bi = 0, second = -1e9;
      for (let k = 0; k < V.length; k++) {
        const m = masks[k];
        const v = Math.sin((wx / maskScale) * m.ax * 6.28 + m.px) + Math.sin((wy / maskScale) * m.ay * 6.28 + m.py);
        if (v > best) { second = best; best = v; bi = k; }
        else if (v > second) second = v;
      }
      const edge = Math.min(1, Math.max(0, (best - second) / Math.max(1e-6, blend * 2)));
      const a = sampleVariant(tex, wx, wy, V[bi]);
      if (edge >= 1) { out[py * w + px] = a; continue; }
      // 过渡带里和"次优那套"混一下（只在窄带里混，不是全局混合）
      let bj = 0, bv = -1e9;
      for (let k = 0; k < V.length; k++) {
        if (k === bi) continue;
        const m = masks[k];
        const v = Math.sin((wx / maskScale) * m.ax * 6.28 + m.px) + Math.sin((wy / maskScale) * m.ay * 6.28 + m.py);
        if (v > bv) { bv = v; bj = k; }
      }
      const b = sampleVariant(tex, wx, wy, V[bj]);
      out[py * w + px] = a * edge + b * (1 - edge);
    }
  }
  return { w, h, data: out, worldW };
}

/** 单一平铺（对照）。 */
export function tileSingle(tex, { w = 256, h = 256, worldW = 4, scale = 1 } = {}) {
  const out = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      out[py * w + px] = sampleVariant(tex, (px / w) * worldW, (py / h) * worldW, { scale, ox: 0, oy: 0 });
    }
  }
  return { w, h, data: out, worldW };
}

/**
 * 自相关（沿 x 方向，行平均）：返回 lag=1..maxLag 的相关系数。
 * 周期 P 处会有一个峰 —— 这个峰的**高度**就是"重复有多明显"。
 */
export function autocorrX(img, { maxLag = 64 } = {}) {
  const { w, h, data } = img;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const out = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0, d1 = 0, d2 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x + lag < w; x++) {
        const a = data[y * w + x] - mean;
        const b = data[y * w + x + lag] - mean;
        num += a * b; d1 += a * a; d2 += b * b;
      }
    }
    out.push(num / Math.sqrt(Math.max(1e-9, d1 * d2)));
  }
  return out;
}

/** 峰高（排除 lag 太小的一段，那段任何图都很高）。 */
export function peakCorr(ac, { from = 4 } = {}) {
  let mx = -1, at = from;
  for (let i = from; i < ac.length; i++) {
    if (ac[i] > mx) { mx = ac[i]; at = i + 1; }
  }
  return { peak: +mx.toFixed(3), lag: at };
}

/**
 * 验收：单一平铺 vs 四套设置混合，同一张贴图、同一世界尺寸。
 * 量的是自相关峰（越小越"看不出重复"）与低频结构保留（标准差）。
 */
export function audit({ size = 64, period = 16, w = 256, worldW = 4 } = {}) {
  const tex = makePeriodicTexture({ size, period });
  const rows = [];
  for (const [name, img] of [
    ['单套（scale 1.0）', tileSingle(tex, { w, h: w, worldW })],
    ['四套（同贴图换参数）', tileField(tex, { w, h: w, worldW })],
  ]) {
    const ac = autocorrX(img, { maxLag: 80 });
    const p = peakCorr(ac);
    const mean = img.data.reduce((a, b) => a + b, 0) / img.data.length;
    const std = Math.sqrt(img.data.reduce((a, b) => a + (b - mean) * (b - mean), 0) / img.data.length);
    rows.push({ name, ...p, std: +std.toFixed(3), mean: +mean.toFixed(3) });
  }
  return { rows, texPeriodPx: period, worldW };
}
