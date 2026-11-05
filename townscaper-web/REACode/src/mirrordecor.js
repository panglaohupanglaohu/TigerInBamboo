/**
 * mirrordecor.js — 一张图，8 个朝向，靠"绕中心镜像"铺满任意尺寸的矩形。
 *
 * 帖子 ID + 原文：
 *   1061221291137605633 (2018-11-10)
 *     "I'm writing a simple graphic for UI decoration. A single texture can be
 *      oriented 8 different ways and mirrors around the center to work in any
 *      size."
 *
 * 为什么这么做：
 *   UI 装饰不能靠"画大一点"来适配不同长宽——拉伸会破坏线宽。这里存一张
 *   motif，铺的时候把目标像素折回 motif 的 [0,1]² 空间：三角波折叠（mirror）
 *   让图案在每个 2 倍周期处自动翻面，所以无论矩形多宽多高，边界永远是
 *   自己跟自己对接，接缝误差恒为 0，而线宽不变。
 *   8 个朝向 = 4 次旋转 × 是否镜像（D4 群），全部由同一张 motif 变换得到，
 *   不需要画 8 张图。
 */

/* 确定性 PRNG */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** 画一张 motif（白色线稿 / 深底），尺寸 S×S */
export function makeMotif(S = 64, seed = 11) {
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#101014';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#e8e6df';
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const r = rng(seed);
  // 底纹：斜向细线（密度决定"雕版"感）
  g.lineWidth = 0.7;
  for (let k = -S; k < S * 2; k += 5) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + S, S); g.stroke();
  }
  // 主体：几圈嵌套菱形 + 放射短线，靠近边界留空，折叠后才不会糊在一起
  const cx = S / 2, cy = S / 2;
  g.lineWidth = 1.6;
  for (let ring = 0; ring < 4; ring++) {
    const rad = S * (0.14 + ring * 0.09);
    g.beginPath();
    for (let a = 0; a < 4; a++) {
      const ang = (Math.PI / 2) * a + Math.PI / 4;
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.stroke();
    // 每条边上挂 2~3 个小三角
    for (let a = 0; a < 4; a++) {
      const ang = (Math.PI / 2) * a + Math.PI / 4;
      const x0 = cx + Math.cos(ang) * rad, y0 = cy + Math.sin(ang) * rad;
      const n = 2 + (ring % 2);
      for (let t = 0; t < n; t++) {
        const f = 0.25 + 0.5 * (t / Math.max(1, n - 1));
        const ang2 = ang + (Math.PI / 2) * a * 0;
        const px = x0 + (cx - x0) * f * 0.55 * (r() * 0.4 + 0.8);
        const py = y0 + (cy - y0) * f * 0.55 * (r() * 0.4 + 0.8);
        const s = S * 0.035;
        g.beginPath();
        g.moveTo(px, py - s); g.lineTo(px + s, py + s * 0.7); g.lineTo(px - s, py + s * 0.7);
        g.closePath(); g.stroke();
      }
    }
  }
  // 中心小方块 + 四向短杆（折叠后正好连成十字）
  g.lineWidth = 1.5;
  g.strokeRect(cx - S * 0.055, cy - S * 0.055, S * 0.11, S * 0.11);
  g.beginPath();
  g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, cy - S * 0.12);
  g.moveTo(S * 0.5, cy + S * 0.12); g.lineTo(S * 0.5, S);
  g.moveTo(0, cy); g.lineTo(cx - S * 0.12, cy);
  g.moveTo(cx + S * 0.12, cy); g.lineTo(S, cy);
  g.stroke();

  // 一个不对称记号：没有它，motif 自身 90° 对称，8 个朝向看起来一模一样，
  // 页面就演示不出"同一张图有 8 种朝向"这件事。
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(S * 0.16, S * 0.16); g.lineTo(S * 0.34, S * 0.16); g.lineTo(S * 0.16, S * 0.34);
  g.closePath(); g.stroke();
  g.beginPath(); g.arc(S * 0.80, S * 0.78, S * 0.065, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8e6df';
  g.fillRect(S * 0.60, S * 0.12, S * 0.16, S * 0.035);

  const data = g.getImageData(0, 0, S, S);
  return { S, canvas: cv, data };
}

/** 三角波折叠：把任意 t 折回 [0,1]，相邻 1 宽区间自动镜像 */
export function fold(t) {
  const m = ((t % 2) + 2) % 2;
  return m > 1 ? 2 - m : m;
}

/** D4：orient 0..7 = (旋转 0..3) × (是否镜像) */
export function orientUV(u, v, orient) {
  const rot = orient % 4, mir = (orient >> 2) & 1;
  let a = mir ? 1 - u : u, b = v;
  for (let r = 0; r < rot; r++) {
    const na = 1 - b, nb = a;
    a = na; b = nb;
  }
  return [a, b];
}

/**
 * 把 motif 铺到 (x,y,w,h)，边折叠边按 orient 取图。
 * mirror=false 时退回"硬平铺"，用来对比接缝。
 */
export function paintRect(ctx, motif, opts) {
  const { x, y, w, h, scale = 96, orient = 0, mirror = true } = opts;
  const img = ctx.createImageData(w, h);
  const dst = img.data;
  const S = motif.S, md = motif.data.data;
  for (let py = 0; py < h; py++) {
    const v0 = py / scale;
    const fv = mirror ? fold(v0) : ((v0 % 1) + 1) % 1;
    for (let px = 0; px < w; px++) {
      const u0 = px / scale;
      const fu = mirror ? fold(u0) : ((u0 % 1) + 1) % 1;
      const [mu, mv] = orientUV(fu, fv, orient);
      const sx = Math.min(S - 1, Math.max(0, Math.floor(mu * S)));
      const sy = Math.min(S - 1, Math.max(0, Math.floor(mv * S)));
      const si = (sy * S + sx) * 4;
      const di = (py * w + px) * 4;
      dst[di] = md[si]; dst[di + 1] = md[si + 1]; dst[di + 2] = md[si + 2]; dst[di + 3] = 255;
    }
  }
  ctx.putImageData(img, x, y);
}

/**
 * 接缝实测：沿折叠线（x = x0 + k*scale）比较左右两列像素。
 * 镜像铺法应当恒等于 0；硬平铺会在 motif 边界处跳变。
 */
export function seamError(ctx, x0, y0, w, h, scale) {
  const img = ctx.getImageData(x0, y0, w, h).data;
  let sum = 0, n = 0, worst = 0;
  for (let kx = scale; kx < w - 1; kx += scale) {
    const xa = Math.round(kx) - 1, xb = Math.round(kx);
    for (let py = 0; py < h; py++) {
      const ia = (py * w + xa) * 4, ib = (py * w + xb) * 4;
      const d = (Math.abs(img[ia] - img[ib]) + Math.abs(img[ia + 1] - img[ib + 1]) + Math.abs(img[ia + 2] - img[ib + 2])) / 765;
      sum += d; n++;
      if (d > worst) worst = d;
    }
  }
  return { mean: n ? sum / n : 0, worst, samples: n };
}
