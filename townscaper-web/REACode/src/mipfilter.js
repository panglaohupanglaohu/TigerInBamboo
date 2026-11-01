/**
 * mipfilter.js — 自己写 mipmap 生成与采样：为什么"自定义过滤"值一条推文。
 *
 * 原文（x.com/OskSta/status/777596437534240768, 2016-09-18）：
 *
 *   "@1bardesign I tried out some custom mipmap filtering. I'm def on to something.
 *    Not entirely sure what."
 *
 * 画面（这条片子只有 0.6 秒 / 3 帧）：三栋低多边形小楼站在一块绿地毯上（等距视角、深灰背景）。
 * 楼是砖墙 + 白窗框 + 橙屋顶 + 深色描边，**细节全是 1~2 像素宽的细线**（砖缝、窗棂、屋顶瓦缝）。
 * 这种内容正是 mipmap 最要命的地方：镜头一推远，砖缝就会跳成一片闪烁的摩尔纹。
 * 原文那句 "not entirely sure what" 很诚实 —— 自定义过滤器的效果很难用眼睛判定，
 * 所以下面把"好不好"变成两个能算的数。
 *
 * 三件事分开：
 *   ① **生成**：每层 2×2 降采样。默认的 box（四点平均）在 sRGB 空间做平均本身就是错的，
 *      因为感知亮度不是线性的；先把像素搬回近似线性再平均、再转回去，暗部细节会明显不同。
 *   ② **放大**：层与层之间 trilinear，纹理坐标要按 0.5 像素偏移（不然整体会偏半个像素，
 *      在细线纹理上会被误读成"锐度不同"）。
 *   ③ **各向异性**：地面透视下纵向压缩远大于横向，纯各向同性 mip 只能取最糊的那一层；
 *      沿主轴多取几 tap 才能既有细节又不闪。
 *
 * 本文件不依赖 WebGL，纯 CPU 实现，所以每个数字都可复现、可单测。
 */

/* ------------------------------------------------------------ 线性空间近似 */

/** sRGB→线性（近似 gamma 2.2，够用且比查表便宜）。 */
export function srgbToLinear(c) { return Math.pow(c / 255, 2.2); }
/** 线性→sRGB。 */
export function linearToSrgb(v) { return 255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2); }

/**
 * 源纹理：一条"砖墙 + 瓦顶 + 窗棂"式的高频图案。
 * 刻意做成 1~2px 的细线，对应帧里那些砖缝/窗框 —— 低频图案测不出过滤器的差别。
 */
export function makeTestTexture(w = 256, h = 256, { seed = 7 } = {}) {
  const buf = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // 砖：每 8px 一行、每 16px 一列，错缝；砖缝 1px 暗线
      const row = (y / 8) | 0;
      const off = row % 2 ? 8 : 0;
      const bx = ((x + off) % 16);
      const mortar = (y % 8 === 0) || (bx === 0);
      // 瓦：斜向 3px 条纹
      const tile = ((x + y) % 3 === 0);
      // 窗棂：稀疏的白色 1px 十字
      const win = (x % 37 === 0 && y % 29 < 11) || (y % 29 === 0 && x % 37 < 9);
      let r = mortar ? 92 : 168 + (rnd() * 12 - 6);
      let g = mortar ? 84 : 120 + (rnd() * 10 - 5);
      let b = mortar ? 78 : 96 + (rnd() * 8 - 4);
      if (tile) { r *= 0.82; g *= 0.78; b *= 0.80; }
      if (win) { r = 236; g = 232; b = 220; }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return { w, h, data: buf };
}

/* ------------------------------------------------------------ 生成 mip 链 */

/**
 * 2×2 降采样。三种 filter：
 *   box   —— 直接在 sRGB 数值上平均（大多数引擎的默认，也是"错"的那种）
 *   gamma —— 先转近似线性平均，再转回 sRGB
 *   kaiser—— 4×4 加权（中心权重大），在线性空间做，压制高频更狠
 *
 * 为什么不给 lanczos：负数瓣会在细线纹理上振铃，出黑边，比糊更难看。这里不提供。
 */
export function downsample(src, filter = 'box') {
  const w = src.w, h = src.h;
  const ow = Math.max(1, w >> 1), oh = Math.max(1, h >> 1);
  const out = new Uint8ClampedArray(ow * oh * 4);
  const linear = filter !== 'box';
  const K = [0.0625, 0.25, 0.375, 0.25, 0.0625];  // 近似 Kaiser(α=4) 的 5 tap
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      if (filter === 'kaiser') {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const sx = Math.min(w - 1, Math.max(0, x * 2 + dx));
            const sy = Math.min(h - 1, Math.max(0, y * 2 + dy));
            const k = K[dx + 2] * K[dy + 2];
            const i = (sy * w + sx) * 4;
            r += srgbToLinear(src.data[i]) * k;
            g += srgbToLinear(src.data[i + 1]) * k;
            b += srgbToLinear(src.data[i + 2]) * k;
            a += src.data[i + 3] * k;
            wsum += k;
          }
        }
        const o = (y * ow + x) * 4;
        out[o] = linearToSrgb(r / wsum);
        out[o + 1] = linearToSrgb(g / wsum);
        out[o + 2] = linearToSrgb(b / wsum);
        out[o + 3] = a / wsum;
      } else {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(w - 1, x * 2 + dx);
            const sy = Math.min(h - 1, y * 2 + dy);
            const i = (sy * w + sx) * 4;
            if (linear) {
              r += srgbToLinear(src.data[i]);
              g += srgbToLinear(src.data[i + 1]);
              b += srgbToLinear(src.data[i + 2]);
            } else {
              r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2];
            }
            a += src.data[i + 3];
          }
        }
        const o = (y * ow + x) * 4;
        if (linear) {
          out[o] = linearToSrgb(r / 4);
          out[o + 1] = linearToSrgb(g / 4);
          out[o + 2] = linearToSrgb(b / 4);
        } else {
          out[o] = r / 4; out[o + 1] = g / 4; out[o + 2] = b / 4;
        }
        out[o + 3] = a / 4;
      }
    }
  }
  return { w: ow, h: oh, data: out };
}

/** 整条链，直到 1×1。 */
export function buildChain(tex, { filter = 'box', levels = 0 } = {}) {
  const t0 = performance.now();
  const chain = [{ w: tex.w, h: tex.h, data: tex.data }];
  const maxLevels = levels || Math.floor(Math.log2(Math.max(tex.w, tex.h))) + 1;
  while (chain.length < maxLevels && (chain[chain.length - 1].w > 1 || chain[chain.length - 1].h > 1)) {
    chain.push(downsample(chain[chain.length - 1], filter));
  }
  const bytes = chain.reduce((s, l) => s + l.w * l.h * 4, 0);
  return { chain, filter, ms: performance.now() - t0, bytes, levels: chain.length };
}

/* ------------------------------------------------------------ 采样 */

/**
 * 双线性。**uv 要减半个像素**：不加这半步，整张图会偏 (0.5,0.5) 像素，
 * 在 1px 细线上等于半条线宽，"哪种过滤更锐"就直接比错了。
 */
export function sampleBilinear(lv, u, v) {
  const x = u * lv.w - 0.5, y = v * lv.h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const cx0 = Math.min(lv.w - 1, Math.max(0, x0));
  const cx1 = Math.min(lv.w - 1, Math.max(0, x0 + 1));
  const cy0 = Math.min(lv.h - 1, Math.max(0, y0));
  const cy1 = Math.min(lv.h - 1, Math.max(0, y0 + 1));
  const i00 = (cy0 * lv.w + cx0) * 4, i10 = (cy0 * lv.w + cx1) * 4;
  const i01 = (cy1 * lv.w + cx0) * 4, i11 = (cy1 * lv.w + cx1) * 4;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const a = lv.data[i00 + c] * (1 - fx) + lv.data[i10 + c] * fx;
    const b = lv.data[i01 + c] * (1 - fx) + lv.data[i11 + c] * fx;
    out[c] = a * (1 - fy) + b * fy;
  }
  return out;
}

/** 从浮点 lod 采样（trilinear）。 */
export function sampleTrilinear(built, u, v, lod) {
  const n = built.levels;
  const l = Math.max(0, Math.min(n - 1, lod));
  const l0 = Math.floor(l), l1 = Math.min(n - 1, l0 + 1);
  const f = l - l0;
  const a = sampleBilinear(built.chain[l0], u, v);
  if (f <= 1e-4) return a;
  const b = sampleBilinear(built.chain[l1], u, v);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}

/**
 * 各向异性：沿 u 方向多取 taps，lod 用"短轴"决定，长轴靠 tap 密度补。
 * `ratio` 是长轴压缩比；taps = clamp(ceil(ratio), 1, maxTaps)。
 */
export function sampleAniso(built, u, v, lod, du, dv, ratio, maxTaps = 8) {
  const taps = Math.max(1, Math.min(maxTaps, Math.ceil(ratio)));
  if (taps === 1) return sampleTrilinear(built, u, v, lod);
  let r = 0, g = 0, b = 0, a = 0;
  for (let i = 0; i < taps; i++) {
    const t = (i + 0.5) / taps - 0.5;
    const s = sampleTrilinear(built, u + du * t, v + dv * t, lod);
    r += s[0]; g += s[1]; b += s[2]; a += s[3];
  }
  return [r / taps, g / taps, b / taps, a / taps];
}

/* ------------------------------------------------------------ 量化 */

/**
 * 高频能量：拉普拉斯方差。闪烁/摩尔纹的本质就是"本不该有的高频"，这个数越大越糟。
 * 只统计亮度，且**只看内部行**（跳过 1px 边界）。
 */
export function laplacianEnergy(img, { y0 = 1, y1 = -1 } = {}) {
  const w = img.w, h = img.h, d = img.data;
  const Y = (x, y) => {
    const i = (y * w + x) * 4;
    return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  };
  const ya = Math.max(1, y0), yb = y1 < 0 ? h - 1 : y1;
  let s = 0, s2 = 0, n = 0;
  for (let y = ya; y < yb; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap = 4 * Y(x, y) - Y(x - 1, y) - Y(x + 1, y) - Y(x, y - 1) - Y(x, y + 1);
      s += lap; s2 += lap * lap; n++;
    }
  }
  const mean = s / Math.max(1, n);
  return { energy: +(s2 / Math.max(1, n)).toFixed(2), mean: +mean.toFixed(3) };
}

/**
 * 把源纹理按透视铺到一块"地面"上（对应帧里那块绿地毯），逐行算 lod。
 *
 * 透视：屏幕行 y 对应世界距离 t = 1/(y - horizon)，越靠上越远 → lod 越大。
 * 这正是各向异性会被拉开的地方：纵向变化率是横向的 `ratio` 倍。
 */
export function renderGround(built, W = 480, H = 240, { mode = 'trilinear', horizon = 0.42, tiles = 3, maxAniso = 8, zoom = 1, offsetU = 0, offsetV = 0 } = {}) {
  const out = new Uint8ClampedArray(W * H * 4);
  const hy = H * horizon;
  // 地面透视下，纵向纹理坐标的变化率 ∝ 1/(y-horizon)²：
  //   du/dy = -f·h·texScale / (y-hy)²
  // 所以"每像素覆盖多少 texel"也按 1/dy² 长。常数 170 是按本机位（H=240、tiles=3、256² 纹理）
  // 反推的：dy=2（贴着地平线）时 lod≈5.4，dy=139（画面底）时 lod<0 被夹到 0。
  // 第一版把常数写成了 0.0006 那一套，导致整幅图的 lod 都在 0 附近 ——
  // **mip 链根本没被用上**，三种过滤器的远景能量几乎一样（3655 vs 3603），白白看不出差别。
  const C = 170 * zoom;
  for (let y = 0; y < H; y++) {
    const dy = y - hy;
    if (dy <= 0.5) continue;
    const texelsPerPixel = C / (dy * dy);
    const lod = Math.max(0, Math.log2(Math.max(1e-6, texelsPerPixel)));
    const ratio = Math.min(16, 1 + 18 / Math.max(1, dy));   // 越靠地平线，纵横向压缩比越大
    const v = (tiles * 0.5) / Math.max(0.02, dy / H) % 1;
    for (let x = 0; x < W; x++) {
      const u = ((x / W) * tiles + 0.5 + offsetU) % 1;
      const vv = (v + (x / W) * 0.02 + offsetV) % 1;
      let c;
      if (mode === 'none') c = sampleBilinear(built.chain[0], u, vv);
      else if (mode === 'aniso') c = sampleAniso(built, u, vv, Math.max(0, lod - 0.75), 1 / built.chain[0].w, 0, ratio, maxAniso);
      else c = sampleTrilinear(built, u, vv, lod);
      const o = (y * W + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
  }
  return { w: W, h: H, data: out, horizon };
}

/**
 * A/B：同一个源纹理、同一个机位，只换 mip 生成/采样方式，比三件事 ——
 *   远景闪烁（远处行的拉普拉斯能量，越小越好）
 *   近景锐度（近处行的拉普拉斯能量，越大越好）
 *   均值漂移（过滤是否把整体亮度搞偏）
 */
export function compareFilters({ size = 256, W = 480, H = 240, filters = ['box', 'gamma', 'kaiser'] } = {}) {
  const tex = makeTestTexture(size, size);
  const rows = [];
  for (const filter of filters) {
    const built = buildChain(tex, { filter });
    const none = renderGround(built, W, H, { mode: 'none' });
    const tri = renderGround(built, W, H, { mode: 'trilinear' });
    const an = renderGround(built, W, H, { mode: 'aniso' });
    const hy = Math.round(H * 0.42);
    const far = { y0: hy + 2, y1: hy + Math.round(H * 0.14) };   // 远处（画面靠上）
    const near = { y0: Math.round(H * 0.78), y1: H - 1 };        // 近处（画面靠下）
    const mean = (img) => {
      let s = 0, n = 0;
      for (let i = 0; i < img.data.length; i += 4) { s += img.data[i] + img.data[i + 1] + img.data[i + 2]; n += 3; }
      return s / n;
    };
    rows.push({
      filter,
      levels: built.levels,
      buildMs: +built.ms.toFixed(2),
      bytes: built.bytes,
      farNoMip: laplacianEnergy(none, far).energy,
      farTri: laplacianEnergy(tri, far).energy,
      farAniso: laplacianEnergy(an, far).energy,
      nearTri: laplacianEnergy(tri, near).energy,
      meanNone: +mean(none).toFixed(2),
      meanTri: +mean(tri).toFixed(2),
    });
  }
  return { tex, rows, W, H };
}

/**
 * 单测用：box 过滤必须**保均值**（误差 < 1.0/255 量级的累积偏差）。
 * gamma 过滤会故意改变均值（因为在线性空间平均），所以它不该通过这条 ——
 * 这不是 bug，是"你想要哪种"的选择，测试里分开断言。
 */
export function checkMeanPreserved(tex) {
  const box = buildChain(tex, { filter: 'box' });
  const gamma = buildChain(tex, { filter: 'gamma' });
  const m = (lv) => {
    let s = 0, n = 0;
    for (let i = 0; i < lv.data.length; i += 4) { s += lv.data[i] + lv.data[i + 1] + lv.data[i + 2]; n += 3; }
    return s / n;
  };
  const base = m(box.chain[0]);
  return {
    base: +base.toFixed(3),
    boxDrift: +(m(box.chain[box.levels - 1]) - base).toFixed(3),
    gammaDrift: +(m(gamma.chain[gamma.levels - 1]) - base).toFixed(3),
    kaiserDrift: +(() => {
      const k = buildChain(tex, { filter: 'kaiser' });
      return m(k.chain[k.levels - 1]) - base;
    })().toFixed(3),
  };
}

/** 把任意 {w,h,data} 画到 canvas（页面用）。 */
export function paint(ctx, img, x, y, scale = 1) {
  const off = ctx.canvas.ownerDocument.createElement('canvas');
  off.width = img.w; off.height = img.h;
  off.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, x, y, img.w * scale, img.h * scale);
  return off;
}

/**
 * 闪烁度量：同一机位、把纹理坐标整体挪 1/4 texel，看远景那几行**变了多少**。
 *
 * 为什么用"挪一下就变了多少"而不是静态能量：静态高频里有一部分是内容本身的（砖缝），
 * 挪一下就变的才是**不该有的**摩尔纹/闪烁。这个数才对应原文"试了自定义过滤"想解决的问题。
 * 返回每档的平均绝对变化（0..255 亮度），越小越稳。
 */
export function shimmerReport({ size = 256, W = 400, H = 220, filters = ['box', 'gamma', 'kaiser'], steps = 4 } = {}) {
  const tex = makeTestTexture(size, size);
  const hy = Math.round(H * 0.42);
  // 按"离地平线多少像素"分带，而不是按画面比例分。
  // 第一版整条 20px 带混在一起算，把 lod 5.4 和 lod 0 的行平均掉了 ——
  // 差值被低 lod 行冲淡，看起来"三种过滤器完全没区别"。
  const bands = [
    { name: '远景 dy2-8', y0: hy + 2, y1: hy + 8 },
    { name: '中景 dy8-20', y0: hy + 8, y1: hy + 20 },
    { name: '近景 dy20-48', y0: hy + 20, y1: hy + 48 },
  ];
  const rows = [];
  for (const filter of filters) {
    const built = buildChain(tex, { filter });
    for (const mode of ['none', 'trilinear', 'aniso']) {
      const frames = [];
      for (let i = 0; i < steps; i++) {
        frames.push(renderGround(built, W, H, { mode, offsetU: i / (steps * 4), offsetV: i / (steps * 3) }));
      }
      for (const band of bands) {
        let acc = 0, n = 0, peak = 0;
        for (let f = 1; f < frames.length; f++) {
          const a = frames[f - 1], b = frames[f];
          for (let y = band.y0; y < band.y1; y++) {
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              const la = a.data[i] * 0.299 + a.data[i + 1] * 0.587 + a.data[i + 2] * 0.114;
              const lb = b.data[i] * 0.299 + b.data[i + 1] * 0.587 + b.data[i + 2] * 0.114;
              const d = Math.abs(la - lb);
              acc += d; n++;
              if (d > peak) peak = d;
            }
          }
        }
        rows.push({
          filter, mode, band: band.name,
          meanAbsDelta: +(acc / Math.max(1, n)).toFixed(2),
          peakAbsDelta: +peak.toFixed(1),
          buildMs: +built.ms.toFixed(2),
        });
      }
    }
  }
  return { rows, bands, W, H, horizonY: hy };
}
