/**
 * mipcustom.js — 自己做 mipmap 过滤（不是 `glGenerateMipmap` 那个默认盒式滤波）。
 *
 * 原文（x.com/OskSta/status/777596437534240768, 2016-09-18）：
 *
 *   "@1bardesign I tried out some custom mipmap filtering. I'm def on to something.
 *    Not entirely sure what."
 *
 * 原文几乎没信息量（他自己都说"不确定到底撞上了什么"），所以这一条**主要靠画面**：
 *
 * 画面（24 帧，看总览图）：一块斜插进画面深处的平面，左半和右半用同一张贴图；
 * 远处两侧都糊，但**近中景有明显差异** —— 一侧在地面往远处收的时候出现规则波纹
 * （棋盘纹的摩尔纹），另一侧干净但更"发灰"；远到极限两侧都变成一块平色。
 * 没有 UI、没有标注，纯 A/B。
 *
 * 画面里能读出来的三件事，正好是 mip 过滤的三个坑：
 *
 *   1. **远处必须收敛到一个常数**（棋盘的平均灰度），否则就是摩尔纹。
 *      盒式滤波（2×2 平均）能做到这点，但会把中景的细节一起吃掉 —— 于是"干净但发灰"。
 *   2. **中景想保住细节，就得在降采样时把对比度还回去**（unsharp / 加权核）。
 *      代价是远处不再收敛，波纹回来了 —— 这就是左右两侧的分歧。
 *   3. **必须在"线性空间"里平均**。这条最容易漏：棋盘是 0 和 1 两支，
 *      在 sRGB 数值上平均得 0.5，可人眼看到的亮度是 0.5^2.2 ≈ 0.22 —— 明显偏暗。
 *      正确做法是先解码到线性、平均、再编码回去。片子里那种"发灰"其实有一半是这个原因。
 *
 * 所以这个模块给四档过滤，全部在 CPU 上实现，能在 node 里量：
 *   box       — 朴素 2×2 平均（GPU 默认那条路）
 *   linear    — box，但在线性空间做（正确的那条路）
 *   kaiser    — 4×4 Kaiser 窗加权（降采样时带通更宽，细节留得多）
 *   sharp     — box + unsharp（把对比度还回去，远处会波纹）
 *
 * 量化口径（`selfCheck`）：棋盘降到各级后
 *   · meanErr —— 平均亮度与"真值（线性 0.5）"的差（%），衡量"偏暗"；
 *   · amp     —— 该级内 max−min，衡量"还剩多少纹路"（远处应该趋于 0，>0 就是摩尔纹）。
 */

/* ------------------------------------------------------------ 色彩空间 */

export function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v) {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/* ------------------------------------------------------------ 建链 */

/**
 * @param {{w:number,h:number,data:Float32Array}} img 三通道，0..1，**sRGB 数值**
 * @param {object} opts
 * @param {'box'|'linear'|'kaiser'|'sharp'} opts.filter
 * @param {boolean} [opts.linearSpace] 是否解码到线性再平均（filter==='linear' 时强制 true）
 * @param {number} [opts.levels] 0 = 一直降到 1×1
 * @returns {Array<{w,h,data:Float32Array}>} 第 0 级是原图
 */
export function buildMips(img, { filter = 'linear', linearSpace, levels = 0 } = {}) {
  // sharp 也必须在线性空间里做，否则会把 box 的偏暗一起继承下来，
  // 那就分不清「细节留了多少」和「颜色错多少」这两件事了（第一版就是混在一起的）。
  const useLinear = linearSpace !== undefined ? linearSpace
    : (filter === 'linear' || filter === 'kaiser' || filter === 'sharp');
  const tag = filter;
  const mips = [{ w: img.w, h: img.h, data: Float32Array.from(img.data) }];

  const maxLevels = levels > 0 ? levels : Math.ceil(Math.log2(Math.max(img.w, img.h)));
  for (let l = 1; l <= maxLevels; l++) {
    const prev = mips[l - 1];
    const w = Math.max(1, prev.w >> 1);
    const h = Math.max(1, prev.h >> 1);
    const out = new Float32Array(w * h * 3);
    const taps = tag === 'kaiser' ? kaiserTaps(prev, w, h, useLinear) : boxDown(prev, w, h, useLinear, tag);
    out.set(taps);
    mips.push({ w, h, data: out });
    if (w === 1 && h === 1) break;
  }
  return mips;
}

function fetch3(img, x, y) {
  const xx = Math.max(0, Math.min(img.w - 1, x));
  const yy = Math.max(0, Math.min(img.h - 1, y));
  const i = (yy * img.w + xx) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

function boxDown(prev, w, h, useLinear, tag) {
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const c = fetch3(prev, x * 2 + dx, y * 2 + dy);
          for (let k = 0; k < 3; k++) acc[k] += useLinear ? srgbToLinear(c[k]) : c[k];
        }
      }
      for (let k = 0; k < 3; k++) {
        const v = acc[k] / 4;
        out[(y * w + x) * 3 + k] = useLinear ? linearToSrgb(v) : v;
      }
    }
  }
  if (tag !== 'sharp') return out;
  // unsharp：box 之后把"和 4×4 均值之差"放大 0.55 倍还回去。
  // 系数 0.55 是扫出来的：0.3 时中景细节只回来一半，0.8 时远处已经起波纹。
  const wide = new Float32Array(out);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const c = fetch3({ w, h, data: out }, x + dx, y + dy);
        for (let k = 0; k < 3; k++) acc[k] += c[k];
        n++;
      }
      for (let k = 0; k < 3; k++) {
        const i = (y * w + x) * 3 + k;
        wide[i] = Math.max(0, Math.min(1, out[i] + 0.55 * (out[i] - acc[k] / n)));
      }
    }
  }
  return wide;
}

function kaiserTaps(prev, w, h, useLinear) {
  // 4×4 支撑、Kaiser(β=6) 窗近似：用解析窗函数直接算权重，不建表（这里只跑 CPU demo）
  const out = new Float32Array(w * h * 3);
  const beta = 6, R = 2;
  const wk = (d) => {
    const t = d / R;
    if (Math.abs(t) >= 1) return 0;
    return besselI0(beta * Math.sqrt(1 - t * t)) / besselI0(beta);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      let sum = 0;
      for (let dy = -R + 1; dy <= R; dy++) {
        for (let dx = -R + 1; dx <= R; dx++) {
          const wx = wk(dx - 0.5), wy = wk(dy - 0.5);
          const wt = wx * wy;
          if (wt <= 0) continue;
          const c = fetch3(prev, x * 2 + dx, y * 2 + dy);
          for (let k = 0; k < 3; k++) acc[k] += wt * (useLinear ? srgbToLinear(c[k]) : c[k]);
          sum += wt;
        }
      }
      for (let k = 0; k < 3; k++) {
        const v = acc[k] / (sum || 1);
        out[(y * w + x) * 3 + k] = useLinear ? linearToSrgb(v) : v;
      }
    }
  }
  return out;
}

function besselI0(x) {
  // 级数展开，|x| ≤ 8 足够（β=6）
  let s = 1, t = 1;
  for (let k = 1; k < 12; k++) {
    t *= (x / (2 * k)) * (x / (2 * k));
    s += t;
  }
  return s;
}

/* ------------------------------------------------------------ 采样 */

/**
 * 三线性采样：lod 是连续的（0 = 原图）。
 * 这里刻意写"逐像素 CPU 版"而不是交给 GPU —— 片子比的就是**过滤本身**，
 * 交给 `glGenerateMipmap` 就变成在比驱动了。
 */
export function sampleTri(mips, u, v, lod) {
  const L = Math.max(0, Math.min(mips.length - 1, lod));
  const l0 = Math.floor(L), l1 = Math.min(mips.length - 1, l0 + 1);
  const f = L - l0;
  const a = sampleBilinear(mips[l0], u, v);
  if (f <= 0 || l1 === l0) return a;
  const b = sampleBilinear(mips[l1], u, v);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function sampleBilinear(mip, u, v) {
  const x = u * mip.w - 0.5, y = v * mip.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const c00 = fetch3(mip, x0, y0), c10 = fetch3(mip, x0 + 1, y0);
  const c01 = fetch3(mip, x0, y0 + 1), c11 = fetch3(mip, x0 + 1, y0 + 1);
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const top = c00[k] + (c10[k] - c00[k]) * fx;
    const bot = c01[k] + (c11[k] - c01[k]) * fx;
    out[k] = top + (bot - top) * fy;
  }
  return out;
}

/** 由屏幕上的 uv 导数推 lod：log2(纹理像素/屏幕像素)。 */
export function footprintLod(du, dv, w, h) {
  const px = Math.hypot(du[0] * w, du[1] * h);   // u 方向一步跨几个纹素
  const py = Math.hypot(dv[0] * w, dv[1] * h);
  return Math.log2(Math.max(1e-6, Math.max(px, py)));
}

/* ------------------------------------------------------------ 自检 */

/**
 * 造一张棋盘，看各级滤波后的「平均亮度误差」和「残留纹路幅度」。
 * @returns 每一级的 {level,w,h,meanErr,amp}
 */
// cell=3 是特意选的：周期 3 在 2 的幂降采样下**不能整除**，
// 所以每一级都会残留一些纹路，四档滤波的差别才看得出来。
// 用 cell=1（1 像素棋盘）时 L1 就彻底平了，kaiser/sharp 与 box 完全同分 —— 那样测不出东西。
export function selfCheck({ size = 192, cell = 3, filters = ['box', 'linear', 'kaiser', 'sharp'] } = {}) {
  const img = { w: size, h: size, data: new Float32Array(size * size * 3) };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = ((x / cell) | 0) % 2 === ((y / cell) | 0) % 2 ? 1 : 0;
      const i = (y * size + x) * 3;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = on;
    }
  }
  const truth = 0.5;   // 线性空间下的真值：一半 0、一半 1

  const report = {};
  for (const f of filters) {
    const mips = buildMips(img, { filter: f });
    report[f] = mips.map((m, l) => {
      let mn = 1, mx = 0, sum = 0;
      for (let k = 0; k < m.data.length; k += 3) {
        const lin = srgbToLinear(m.data[k]);
        mn = Math.min(mn, lin); mx = Math.max(mx, lin); sum += lin;
      }
      const mean = sum / (m.data.length / 3);
      return {
        level: l, w: m.w, h: m.h,
        meanErr: +(((mean - truth) / truth) * 100).toFixed(2),
        amp: +(mx - mn).toFixed(4),
      };
    });
  }
  return { size, cell, truth, report };
}
