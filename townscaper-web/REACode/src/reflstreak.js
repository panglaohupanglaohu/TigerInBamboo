/**
 * reflstreak.js — 水面反射：低分辨率镜像 + **竖向拉丝**，不是一块平涂色。
 *
 * 原文（x.com/OskSta/status/1758250248483278925, 2024-02-15）：
 *
 *   "New water reflection I'm quite happy with"
 *
 * 画面实测（24 帧、640²；把岛下方的水面放大到 4 倍看）：
 *   · 水里**没有**镜像细节。崖壁、草地、房子一样都认不出来；
 *   · 但有明暗结构：岛正下方是一团**竖向拖长的暗块**，越往下越淡；
 *   · 块的左右边界很软，上下边界更软 —— 竖向被拉长了 3~5 倍；
 *   · 左右边界还有轻微起伏（跟着水面波形横摆），不是一根直边；
 *   · 水线紧贴岛脚处有一条**较亮的水线**，往下一两像素就开始变暗。
 *
 * 结论：他是"渲染一张低分辨率镜面 → 沿竖向糊 / 拉丝 → 按深度淡出"，而不是
 * 真镜面，也不是我们 engine/reflection.js 那种"平涂中色块"。差别就在**各向异性**：
 * 真镜面横竖一样清楚，模糊球横竖一样糊，只有竖向拉丝是横清楚、竖糊涂 ——
 * 这个差别可以直接量出来（横竖梯度比）。
 *
 * 本文件不 import three；输入输出都是 {w,h,data:Uint8ClampedArray} 的 RGBA，
 * 与 bouncegi.js 的 renderRay 输出同构，可以串起来跑。
 */

/**
 * 竖向拉丝。
 *
 * @param img   {w,h,data}
 * @param opts.radius  竖向半径（像素）
 * @param opts.taps    采样数（太少会出条带）
 * @param opts.wobble  横向摆幅（像素）—— 水面波让拉丝左右晃
 * @param opts.waveLen 摆动波长（像素）
 * @param opts.fade    从顶部到底部的衰减（0=不衰减）
 * @param opts.top     从哪一行开始（水面线）
 */
export function streak(img, {
  radius = 14, taps = 9, wobble = 2.0, waveLen = 26, fade = 0.55, top = 0,
} = {}) {
  const { w, h, data } = img;
  const out = new Uint8ClampedArray(data.length);
  out.set(data);
  for (let y = top; y < h; y++) {
    const depth = y - top;
    for (let x = 0; x < w; x++) {
      const wx = wobble * Math.sin((y / waveLen) * Math.PI * 2 + (x / w) * 0.6);
      let r = 0, g = 0, b = 0, n = 0;
      for (let t = 0; t < taps; t++) {
        const k = t / (taps - 1) * 2 - 1;         // -1..1
        // 采样要用**双线性**，不能四舍五入。第一版用 round，波浪把采样点抖到
        // 半像素上时会出现台阶（实测竖向梯度从 0.51 反而涨到 4.38 —— 拉丝把
        // 画面拉出一堆 1px 的锯齿）。
        const fy = y + k * radius;
        const fx = x + wx * Math.abs(k);
        const sy = Math.floor(fy), sx = Math.floor(fx);
        const ty = fy - sy, tx = fx - sx;
        if (sy < top || sy + 1 >= h || sx < 0 || sx + 1 >= w) continue;
        const o00 = (sy * w + sx) * 4, o10 = (sy * w + sx + 1) * 4;
        const o01 = ((sy + 1) * w + sx) * 4, o11 = ((sy + 1) * w + sx + 1) * 4;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        r += data[o00] * w00 + data[o10] * w10 + data[o01] * w01 + data[o11] * w11;
        g += data[o00 + 1] * w00 + data[o10 + 1] * w10 + data[o01 + 1] * w01 + data[o11 + 1] * w11;
        b += data[o00 + 2] * w00 + data[o10 + 2] * w10 + data[o01 + 2] * w01 + data[o11 + 2] * w11;
        n++;
      }
      if (!n) continue;
      // 深度淡出：越往下越接近水的底色
      const f = 1 - fade * Math.min(1, depth / (h - top));
      const o = (y * w + x) * 4;
      out[o] = r / n * f + data[o] * (1 - f);
      out[o + 1] = g / n * f + data[o + 1] * (1 - f);
      out[o + 2] = b / n * f + data[o + 2] * (1 - f);
      out[o + 3] = 255;
    }
  }
  return { w, h, data: out };
}

/**
 * 把水线以上的部分镜像下来，乘一个衰减，再压到低分辨率（模拟 RT）。
 * 原片里镜像的"信息量"很低，所以先降到 1/scale 再插回来 —— 这一步本身就是
 * 一次模糊，而且是**各向同性**的；竖向拉丝是第二步，各向异性。
 */
export function mirrorDownsample(img, {
  waterY = null, scale = 4, strength = 0.55, tint = [0.42, 0.55, 0.60],
} = {}) {
  const { w, h, data } = img;
  const wy = waterY ?? Math.round(h * 0.55);
  const out = new Uint8ClampedArray(data.length);
  out.set(data);
  const lw = Math.max(1, Math.floor(w / scale));
  const lh = Math.max(1, Math.floor((h - wy) / scale));
  const lo = new Uint8ClampedArray(lw * lh * 3);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const sx = x * scale + dx;
          const sy = wy - (y * scale + dy);          // 镜像
          if (sy < 0 || sy >= h || sx < 0 || sx >= w) continue;
          const o = (sy * w + sx) * 4;
          r += data[o]; g += data[o + 1]; b += data[o + 2]; n++;
        }
      }
      const i = (y * lw + x) * 3;
      lo[i] = n ? r / n : 0;
      lo[i + 1] = n ? g / n : 0;
      lo[i + 2] = n ? b / n : 0;
    }
  }
  // 放大回全尺寸，混到水下
  for (let y = wy; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lx = Math.min(lw - 1, Math.floor(x / scale));
      const ly = Math.min(lh - 1, Math.floor((y - wy) / scale));
      const i = (ly * lw + lx) * 3;
      const depth = (y - wy) / Math.max(1, h - wy);
      const a = strength * (1 - depth * 0.8);
      const o = (y * w + x) * 4;
      // 反射色往水里偏一点（原片的反射不是原色的，是"水色 + 一点岛色"）
      const rr = lo[i] * 0.55 + tint[0] * 255 * 0.45;
      const gg = lo[i + 1] * 0.55 + tint[1] * 255 * 0.45;
      const bb = lo[i + 2] * 0.55 + tint[2] * 255 * 0.45;
      out[o] = data[o] * (1 - a) + rr * a;
      out[o + 1] = data[o + 1] * (1 - a) + gg * a;
      out[o + 2] = data[o + 2] * (1 - a) + bb * a;
      out[o + 3] = 255;
    }
  }
  // 水线上一道细亮线
  for (let x = 0; x < w; x++) {
    const o = ((wy) * w + x) * 4;
    out[o] = Math.min(255, out[o] * 1.18 + 12);
    out[o + 1] = Math.min(255, out[o + 1] * 1.18 + 12);
    out[o + 2] = Math.min(255, out[o + 2] * 1.18 + 12);
  }
  return { w, h, data: out, waterY: wy };
}

/** 平均梯度（横 / 竖分开算），用来量"各向异性"。 */
export function gradients(img, { from = 0, to = null } = {}) {
  const { w, h, data } = img;
  const y1 = to ?? h;
  let gx = 0, gy = 0, n = 0;
  for (let y = from + 1; y < y1 - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = (y * w + x) * 4;
      const l = data[o] * 0.3 + data[o + 1] * 0.59 + data[o + 2] * 0.11;
      const lx = data[o + 4] * 0.3 + data[o + 5] * 0.59 + data[o + 6] * 0.11;
      const ly = data[o + w * 4] * 0.3 + data[o + w * 4 + 1] * 0.59 + data[o + w * 4 + 2] * 0.11;
      gx += Math.abs(lx - l);
      gy += Math.abs(ly - l);
      n++;
    }
  }
  return { gx: gx / n, gy: gy / n, anisotropy: gy / Math.max(1e-6, gx) };
}

/** 竖向自相关长度：反射被"拉"了多长（像素）。 */
export function verticalCorrLength(img, { from = 0, to = null, maxLag = 24 } = {}) {
  const { w, h, data } = img;
  const y1 = to ?? h;
  const lum = (x, y) => {
    const o = (y * w + x) * 4;
    return data[o] * 0.3 + data[o + 1] * 0.59 + data[o + 2] * 0.11;
  };
  const out = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let s = 0, n = 0;
    for (let y = from; y < y1 - lag; y++) {
      for (let x = 0; x < w; x += 2) {
        s += Math.abs(lum(x, y) - lum(x, y + lag));
        n++;
      }
    }
    out.push(s / n);
  }
  const base = out[0];
  for (let i = 0; i < out.length; i++) if (out[i] < base * 0.5) return i + 1;
  return out.length;
}

/**
 * 直接量"拉丝核"的形状：拿一张只有一个亮点（脉冲）的图过一遍 streak，
 * 看结果在竖 / 横方向上铺开了几个像素。
 *
 * 为什么不用"梯度比"当主指标：在真实画面上它被内容本身压住了 —— 我们的
 * 水面区域本来就很平，竖向梯度只有 0.6，拉丝之后变 0.55，看着像"没生效"，
 * 其实核是 29×1。梯度比是"内容 + 核"的混合量，核才是我们真正实现的东西。
 * 所以这里补一个与内容无关的量：核的纵横比。
 */
export function kernelExtent(imgOpts = {}) {
  const w = 121, h = 121;
  const make = (rows, cols) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inRow = Math.abs(y - (h >> 1)) < rows / 2;
        const inCol = Math.abs(x - (w >> 1)) < cols / 2;
        const v = (rows > 0 ? inRow : true) && (cols > 0 ? inCol : true) ? 255 : 0;
        const o = (y * w + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
      }
    }
    return { w, h, data };
  };
  const fwhm = (img, along) => {
    const at = (x, y) => img.data[(y * w + x) * 4];
    const cx = w >> 1, cy = h >> 1;
    const peak = Math.max(1e-6, at(cx, cy));
    let n = 1;
    for (const dir of [1, -1]) {
      for (let d = 1; d < 60; d++) {
        const a = along === 'y' ? at(cx, cy + d * dir) : at(cx + d * dir, cy);
        if (a < peak * 0.5) break;
        n++;
      }
    }
    return n;
  };
  // 用一条 5px 粗的**横线**量竖向拉丝长度（脉冲太窄，9 个采样点会漏掉它）
  const row = streak(make(5, 0), { top: 0, wobble: 0, fade: 0, ...imgOpts });
  // 用一条 5px 粗的**竖线**量横向铺开（应该几乎不变）
  const col = streak(make(0, 5), { top: 0, wobble: 0, fade: 0, ...imgOpts });
  const ky = fwhm(row, 'y');
  const kx = fwhm(col, 'x');
  return { kernelY: ky, kernelX: kx, aspect: +(ky / Math.max(1, kx)).toFixed(1) };
}

/**
 * 全流程：渲染 → 镜像降采样 → 竖向拉丝。返回三种对照图与数字。
 * 需要调用方传入渲染函数，避免这里 import 渲染相关的东西。
 */
export function buildComparison(render, field, light, opts = {}) {
  const {
    w = 360, h = 300, waterY = null, scale = 4, strength = 0.55,
    radius = 14, taps = 9, wobble = 2.0,
  } = opts;
  const W = Math.round(w), H = Math.round(h);
  const base = render(field, light, { w: W, h: H, yaw: -Math.PI / 2, elev: 0.42, zoom: 1.0 });
  const wy = waterY ?? Math.round(H * 0.58);
  const mirrored = mirrorDownsample(base, { waterY: wy, scale, strength });
  const streaked = streak(mirrored, { top: wy + 1, radius, taps, wobble, fade: 0.55 });

  const region = { from: wy + 2, to: H - 2 };
  const gBase = gradients(mirrored, region);
  const gStreak = gradients(streaked, region);
  const corrBase = verticalCorrLength(mirrored, region);
  const corrStreak = verticalCorrLength(streaked, region);

  return {
    base, mirrored, streaked, waterY: wy,
    numbers: {
      anisotropyBefore: +gBase.anisotropy.toFixed(2),
      anisotropyAfter: +gStreak.anisotropy.toFixed(2),
      gradXBefore: +gBase.gx.toFixed(2),
      gradXAfter: +gStreak.gx.toFixed(2),
      gradYBefore: +gBase.gy.toFixed(2),
      gradYAfter: +gStreak.gy.toFixed(2),
      vertCorrBefore: corrBase,
      vertCorrAfter: corrStreak,
      kernel: kernelExtent({ radius, taps, wobble }),
      radius, taps, scale,
    },
  };
}
