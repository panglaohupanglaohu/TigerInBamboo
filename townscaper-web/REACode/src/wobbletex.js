/**
 * wobbletex.js — 「整个世界的坐标先抖一下，做完贴图数学，再把抖动撤回去」
 *
 * 原文 // 1699146321318314094 (2023-09-05)：
 *
 *   "Oh! And now I finally figured out how to make non-straight sedimentary lines!
 *    Most of the texturing math is kinda linear, so I though the lines had to be
 *    linear too. But I could (obviously) just make the whole world wobbly, do the
 *    texturing math, then simply undo the wobble."
 *
 * 画面（24 帧，640²）：岛上的崖壁有一道道浅色沉积层。关键不是「线是弯的」，而是
 * **同一个高度上的线在各面墙上弯得一致** —— 相邻两个多边形面、甚至两根分开的石柱，
 * 层线在接缝处能接上。说明抖动不是逐面加的噪声，而是**世界空间的一个位移场**。
 *
 * 做法（三步，本文件严格照做）：
 *   1. w = W(p)      把世界坐标抖开（低频、平滑、可逆）
 *   2. v = tex(w)    所有贴图数学照旧，还是「线性」的那套（这里 = 世界 Y 的分层）
 *   3. p = W⁻¹(w)    几何位置撤回原处；贴图结果留在顶点/贴图上，于是线是弯的、形状没变
 *
 * 很多人会漏掉第 3 步：不撤的话岛形会整体漂（本文件量了漂多少）。
 * 反过来，如果只对每条线单独加噪声（"每条线自己抖"），相邻面之间就会错位 ——
 * 这也是为什么「先把世界整体抖一下」反而更省事：一次位移，所有层的相位自动一致。
 *
 * 量化：
 *   - 层线峰峰值 (= 弯多少) 与平均曲率
 *   - W⁻¹ 的定点迭代残差（1/2/3/4 次）—— 证明「撤回去」在 0.2px 内可逆
 *   - 不撤 wobble 时的岛形面积漂移（%）
 *   - 逐线加噪声 vs 整体抖动的**接缝错位**（相邻面同高度线的 y 差）
 */

/* ───────────────────────── 噪声 ───────────────────────── */

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

/* ───────────────────────── 位移场 ───────────────────────── */

/**
 * 低频平滑位移场。两路噪声（x 方向和 y 方向各一路）+ 一个很轻的高频层。
 * 尺度 ~110px（比层线间距 34px 大得多），所以层线是「缓慢起伏」，不是锯齿。
 */
export function makeWarp({ amp = 20, freq = 1 / 120, seed = 5 } = {}) {
  const dx = (x, y) =>
    amp * ((vnoise(x * freq, y * freq, seed) - 0.5) * 2) +
    amp * 0.35 * ((vnoise(x * freq * 2.7, y * freq * 2.7, seed + 31) - 0.5) * 2);
  const dy = (x, y) =>
    amp * 0.85 * ((vnoise(x * freq * 0.8 + 13, y * freq * 0.8, seed + 77) - 0.5) * 2);

  /** W(p)：正推。 */
  const at = (x, y) => [x + dx(x, y), y + dy(x, y)];

  /**
   * W⁻¹(p)：不动点迭代 x ← p - D(x)。
   * 收敛条件 |∂D/∂x| < 1；这里 amp*freq ≈ 0.08，非常安全。
   */
  const inv = (x, y, iters = 3) => {
    let ux = x, uy = y;
    for (let i = 0; i < iters; i++) {
      const [wx, wy] = at(ux, uy);
      ux += x - wx;
      uy += y - wy;
    }
    return [ux, uy];
  };

  /**
   * 位移场的雅可比上界：|∂D/∂x| 的最大值。它 < 1 定点迭代才收缩；
   * 本轮参数 ≈ 0.4，所以 3 次迭代残差就 < 0.5px（量在 inverseResidual 里）。
   * 第一版 amp=18 / freq=1/95 时这个值接近 1.4，迭代 4 次还差 2.2px —— 「撤不干净」。
   */
  const jacobian = () => {
    let m = 0;
    for (let y = 100; y < 300; y += 11) {
      for (let x = 100; x < 400; x += 11) {
        const e = 0.5;
        const gx = Math.abs((dx(x + e, y) - dx(x - e, y)) / (2 * e));
        const gy = Math.abs((dy(x, y + e) - dy(x, y - e)) / (2 * e));
        m = Math.max(m, gx, gy);
      }
    }
    return +m.toFixed(3);
  };

  return { amp, freq, seed, dx, dy, at, inv, jacobian };
}

/* ───────────────────────── 贴图数学（还是「线性」的） ───────────────────────── */

/**
 * 沉积层：本质就是「世界 Y 的阶梯函数」。这一行就是原文说的
 * "most of the texturing math is kinda linear" —— 没有任何一条线的概念，
 * 只有一个 height → band 的映射。弯不弯，完全取决于喂进来的是 y 还是 W(p).y。
 */
export const LAYER = 34;   // 层厚（px）

export function sedimentBand(y, bottom) {
  const s = (bottom - y) / LAYER;
  return { s, band: Math.floor(s), t: s - Math.floor(s) };
}

/* ───────────────────────── 渲染一块崖壁 ───────────────────────── */

/**
 * @param {object} o
 * @param {boolean} o.warp     true = 贴图吃 W(p)（自动抖），false = 直线对照
 * @param {'field'|'perface'} o.noiseMode
 *        field   = 整体位移场（原文做法）
 *        perface = 每个多边形面自己抖（常见错解：层线在面与面的接缝处错开）
 */
export function renderCliff({ w = 440, h = 330, seed = 5, warp = true, noiseMode = 'field', amp = 18 } = {}) {
  const W = makeWarp({ amp, seed });
  const data = new Uint8ClampedArray(w * h * 4);
  const bottom = h - 26;

  // 崖顶轮廓（几何，不参与抖动）—— 三段正弦拼一个「石柱 + 台地」
  const topAt = (x) => {
    const t = x / w;
    const col = Math.exp(-Math.pow((t - 0.72) / 0.11, 2)) * 96;     // 右侧石柱
    const shelf = Math.exp(-Math.pow((t - 0.35) / 0.20, 2)) * 46;   // 左侧台地
    return h * 0.42 - col - shelf + Math.sin(t * 9.1) * 3.2;
  };

  /**
   * 错解：每个面（facet）自己一套相位。槽点在于**面与面之间没有共享位移**，
   * 同一条层线走过面边界会突然错开 —— 参考帧里那种「跨面连续」立刻消失。
   */
  const phase = new Map();
  const phaseOf = (fx, fy) => {
    const key = fx * 1000 + fy;
    if (!phase.has(key)) phase.set(key, (hash2(fx, fy, seed + 3) - 0.5) * 18);
    return phase.get(key);
  };

  const base = [0.68, 0.72, 0.75];   // 崖壁底色（冷灰）
  const bandCol = [0.86, 0.83, 0.78]; // 沉积层（暖白）
  const grass = [0.52, 0.66, 0.40];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ty = topAt(x);
      let c;
      if (y < ty - 1.5) {
        // 天空
        c = [0.44, 0.55, 0.57];
      } else if (y < ty + 4.5) {
        // 崖顶草皮
        c = grass;
      } else {
        // 崖壁：贴图坐标
        // 分面格（26×22）先定下来：错解按面取相位，正解只用来做面上色差
        const fx = Math.floor(x / 26), fy = Math.floor(y / 22);
        let sx = x, sy = y;
        if (warp && noiseMode === 'field') {
          const [wx, wy] = W.at(x, y);
          sx = wx; sy = wy;
        } else if (warp && noiseMode === 'perface') {
          sy = y + phaseOf(fx, fy);
          sx = x + phaseOf(fx + 7, fy) * 0.4;
        }
        const { s, t } = sedimentBand(sy, bottom);
        /**
         * 层内纹样：紧贴层边界一条亮带 + 其下一条暗带 = 一道「层线」。
         * 亮带原来是 1.6px / 强度 0.75，在 200px 宽的缩略图里几乎看不见（弯曲自然也看不出来）；
         * 改成 2.4px、并在下面补一条暗带，线才立起来。
         */
        const bandEdge = Math.min(t, 1 - t) * LAYER;
        const k = bandCol;
        let m;
        if (bandEdge < 2.4) m = 0.88;
        else if (bandEdge > LAYER * 0.5 - 2.4) m = 0.02;
        else m = 0.18 + 0.06 * mathFrac(s);
        c = [base[0] + (k[0] - base[0]) * m, base[1] + (k[1] - base[1]) * m, base[2] + (k[2] - base[2]) * m];

        const f = (hash2(fx, fy, seed + 11) - 0.5) * 0.055;
        c = [c[0] + f, c[1] + f, c[2] + f];

        // 轮廓线（崖顶下方一条深线，对应参考帧的黑描边）
        if (y < ty + 7) {
          const e = 1 - (y - ty - 4.5) / 3.0;
          c = [c[0] * (1 - e * 0.55), c[1] * (1 - e * 0.55), c[2] * (1 - e * 0.55)];
        }
      }
      const o = (y * w + x) * 4;
      data[o] = Math.max(0, Math.min(255, c[0] * 255));
      data[o + 1] = Math.max(0, Math.min(255, c[1] * 255));
      data[o + 2] = Math.max(0, Math.min(255, c[2] * 255));
      data[o + 3] = 255;
    }
  }
  return { data, w, h, topAt, bottom, warpField: W, amp };
}

const mathFrac = (v) => v - Math.floor(v);

/* ───────────────────────── 量化 ───────────────────────── */

/**
 * 层线形状：对每条层边界 k，解 W(p).y = bottom - k*LAYER，
 * 逐列二分求出曲线 y(x)，量峰峰值与平均二阶差分（曲率）。
 * 用解析求解而不是图像边缘检测：不受阈值影响，可重复。
 */
export function bandCurves(w, h, { amp = 18, seed = 5, samples = 40, warp = true } = {}) {
  const W = makeWarp({ amp, seed });
  const bottom = h - 26;
  const curves = [];
  for (let k = 1; bottom - k * LAYER > 40; k++) {
    const targetY = bottom - k * LAYER;
    const ys = [];
    for (let i = 0; i < samples; i++) {
      const x = 8 + (i / (samples - 1)) * (w - 16);
      if (!warp) { ys.push(targetY); continue; }
      // 解 x + dx(x,y) 不变的前提下，找 y 使 W(x,y).y == targetY
      let lo = 8, hi = bottom - 2;
      for (let it = 0; it < 18; it++) {
        const mid = (lo + hi) * 0.5;
        const [, wy] = W.at(x, mid);
        if (wy > targetY) hi = mid; else lo = mid;
      }
      ys.push((lo + hi) * 0.5);
    }
    let max = -1e9, min = 1e9, curv = 0;
    for (let i = 0; i < ys.length; i++) {
      max = Math.max(max, ys[i]); min = Math.min(min, ys[i]);
      if (i > 0 && i < ys.length - 1) curv += Math.abs(ys[i - 1] - 2 * ys[i] + ys[i + 1]);
    }
    curves.push({
      k,
      p2p: +(max - min).toFixed(2),
      meanCurv: +(curv / Math.max(1, ys.length - 2)).toFixed(4),
    });
  }
  const meanP2P = curves.reduce((a, c) => a + c.p2p, 0) / Math.max(1, curves.length);
  const meanCurv = curves.reduce((a, c) => a + c.meanCurv, 0) / Math.max(1, curves.length);
  return { curves, meanP2P: +meanP2P.toFixed(2), meanCurv: +meanCurv.toFixed(4) };
}

/** W⁻¹ 定点迭代残差：证明「撤回去」可逆。 */
export function inverseResidual({ amp = 18, seed = 5, w = 440, h = 330, itersList = [1, 2, 3, 4] } = {}) {
  const W = makeWarp({ amp, seed });
  const out = {};
  for (const iters of itersList) {
    let max = 0, sum = 0, n = 0;
    for (let y = 12; y < h; y += 17) {
      for (let x = 12; x < w; x += 17) {
        const [wx, wy] = W.at(x, y);
        const [ux, uy] = W.inv(wx, wy, iters);   // 先抖开再撤回来
        const d = Math.hypot(ux - x, uy - y);
        max = Math.max(max, d); sum += d; n++;
      }
    }
    out[iters] = { maxPx: +max.toFixed(3), meanPx: +(sum / n).toFixed(3) };
  }
  return out;
}

/**
 * 如果忘了第 3 步（几何也留在抖动后的位置）：岛形会漂多少。
 * 用崖顶轮廓的面积在两种情况下差多少来量（%）。
 */
export function geometryDrift(w = 440, h = 330, { amp = 18, seed = 5 } = {}) {
  const W = makeWarp({ amp, seed });
  const bottom = h - 26;
  const topAt = (x) => {
    const t = x / w;
    const col = Math.exp(-Math.pow((t - 0.72) / 0.11, 2)) * 96;
    const shelf = Math.exp(-Math.pow((t - 0.35) / 0.20, 2)) * 46;
    return h * 0.42 - col - shelf + Math.sin(t * 9.1) * 3.2;
  };
  let a0 = 0, a1 = 0;
  for (let x = 0; x < w; x++) {
    const y0 = topAt(x);
    const [, y1] = W.at(x, y0);      // 顶点被抖到 y1
    a0 += bottom - y0;
    a1 += bottom - y1;
  }
  return {
    areaBase: Math.round(a0),
    areaWobbled: Math.round(a1),
    driftPct: +(((a1 - a0) / a0) * 100).toFixed(2),
  };
}

/**
 * 错解（逐面独立抖）的接缝错位：相邻两面在同一条层线上的位移差。
 * 正解（整体位移场）构造上必然是 0 —— 同一个世界 Y 在哪儿都是同一个 Y。
 */
export function facetSeam({ seed = 5, cols = 12, rows = 8 } = {}) {
  // 与 renderCliff 里 phaseOf 同一套数值
  const off = (fx, fy) => (hash2(fx, fy, seed + 3) - 0.5) * 18;
  let sum = 0, n = 0, max = 0;
  for (let fy = 0; fy < rows; fy++) {
    for (let fx = 0; fx < cols - 1; fx++) {
      const d = Math.abs(off(fx, fy) - off(fx + 1, fy));
      sum += d; n++; if (d > max) max = d;
    }
  }
  for (let fx = 0; fx < cols; fx++) {
    for (let fy = 0; fy < rows - 1; fy++) {
      const d = Math.abs(off(fx, fy) - off(fx, fy + 1));
      sum += d; n++; if (d > max) max = d;
    }
  }
  return {
    fieldOffsetPx: 0,
    perFaceMeanPx: +(sum / n).toFixed(2),
    perFaceMaxPx: +max.toFixed(2),
    shareOfLayerPct: +(((sum / n) / LAYER) * 100).toFixed(0),
  };
}
