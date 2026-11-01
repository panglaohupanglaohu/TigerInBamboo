/**
 * texelsnap.js — "每两个像素画一条线"：点采样 + UV 按 2 texel 台阶走。
 *
 * 原文（x.com/OskSta/status/1241046107125399552, 2020-03-20）：
 *
 *   "I moved my plants to a 32² corner on the 128² texture I'm using for
 *    everything else. Plus they now also use the every-other-pixel-is-a-line
 *    tech, so everything is crisp and nice up close"
 *
 * 配套原文（x.com/OskSta/status/1241096929490149376, 2020-03-20）：
 *
 *   "It has been brought to my attention that not all of you are familiar with my
 *    every-other-pixel-is-a-line tech. I make the UVs speed past every 2nd pixel
 *    before sampling. It's core to my art style"
 *
 * 画面实测（512² 帧，取 52 条植物轮廓）：轮廓的 10–90% 过渡宽度**中位 1.0px**、
 * 均值 1.0px —— 完全没有双线性那种 2–3px 软边。也就是说：贴图只有 32² 也够，
 * 关键**不是分辨率，是采样方式**。这一条推翻了我原先"贴图太小所以糊"的猜测。
 *
 * 做法（原文那句 "make the UVs speed past every 2nd pixel"）：
 *   屏幕上一个像素跨多少 uv，就先算出来（导数），然后把 uv **量化到 2 texel 的
 *   整数倍**再采样，并且用**最近邻**。于是：
 *     · 每个 texel 在屏幕上占 2×2 像素的方块（"每两个像素一条线"）；
 *     · 放大时方块跟着变大但边缘永远是 1px 硬边 → 近看很"脆"；
 *     · 缩小时 uv 步进跨过整块 texel，等于自带 mip 0 的块状降采样（会闪，
 *       所以真机要配 mip；这里为了量"锐不锐"只跑 mip0）。
 *
 * 本文件不 import three，纯 CPU；`audit()` 把同一张贴图用三种采样方式渲染到
 * 同一个屏幕尺寸，量边缘宽度 / 缩放稳定性 / 高频能量。
 */

/** 便宜的 2D 值噪声，用来画图集里的植物形状。 */
function vnoise(seed = 7, res = 64) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = new Float32Array(res * res);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[(((y % res) + res) % res) * res + (((x % res) + res) % res)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    return (at(xi, yi) * (1 - xf) + at(xi + 1, yi) * xf) * (1 - yf) +
      (at(xi, yi + 1) * (1 - xf) + at(xi + 1, yi + 1) * xf) * yf;
  };
}

/**
 * 烘一张 128² 图集，把植物放在右下 **32² 角落**（原文的做法），其余放地面色。
 * 植物是"多瓣小丛"的剪影 + 1px 深色描边 —— 和参考片里那圈毛边一致。
 *
 * @returns {{size:number, data:Uint8ClampedArray, corner:number, plantCount:number}}
 */
export function bakeAtlas({ size = 128, corner = 32, seed = 11 } = {}) {
  const data = new Uint8ClampedArray(size * size * 4);
  const n = vnoise(seed, 64);
  // 地面：暖灰 + 一点噪声
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 0.72 + 0.06 * (n(x * 0.09, y * 0.09) - 0.5);
      const o = (y * size + x) * 4;
      data[o] = v * 255; data[o + 1] = v * 0.95 * 255; data[o + 2] = v * 0.86 * 255; data[o + 3] = 255;
    }
  }
  // 角落里的植物：4 株，每株 3~5 个瓣
  const x0 = size - corner, y0 = size - corner;
  const plants = [];
  const rnd = (() => { let s = seed * 7919 >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  for (let p = 0; p < 4; p++) {
    const cx = x0 + 6 + rnd() * (corner - 12);
    const cy = y0 + 6 + rnd() * (corner - 12);
    const lobes = 3 + Math.floor(rnd() * 3);
    const lobesArr = [];
    for (let k = 0; k < lobes; k++) {
      const a = rnd() * Math.PI * 2;
      lobesArr.push({
        ox: Math.cos(a) * (1.5 + rnd() * 2.2),
        oy: Math.sin(a) * (1.5 + rnd() * 2.2),
        r: 2.2 + rnd() * 2.4,
      });
    }
    plants.push({ cx, cy, lobes: lobesArr });
  }
  const inside = (x, y) => {
    for (const p of plants) {
      for (const l of p.lobes) {
        const dx = x - (p.cx + l.ox), dy = y - (p.cy + l.oy);
        if (dx * dx + dy * dy <= l.r * l.r) return true;
      }
    }
    return false;
  };
  // 先填内色，再沿边界描一圈深色（1px）
  for (let y = y0; y < size; y++) {
    for (let x = x0; x < size; x++) {
      if (!inside(x, y)) continue;
      const o = (y * size + x) * 4;
      data[o] = 96; data[o + 1] = 132; data[o + 2] = 78; data[o + 3] = 255;
    }
  }
  for (let y = y0; y < size; y++) {
    for (let x = x0; x < size; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
      if (!edge) continue;
      const o = (y * size + x) * 4;
      data[o] = 42; data[o + 1] = 58; data[o + 2] = 36; data[o + 3] = 255;
    }
  }
  return { size, data, corner, plantCount: plants.length };
}

/** 最近邻采样（图集是 RGBA，返回亮度就够量边缘）。 */
function samplePoint(atlas, u, v) {
  const s = atlas.size;
  const x = Math.floor(((u % 1) + 1) % 1 * s);
  const y = Math.floor(((v % 1) + 1) % 1 * s);
  const o = (y * s + x) * 4;
  return [atlas.data[o], atlas.data[o + 1], atlas.data[o + 2]];
}

/** 双线性采样。 */
function sampleBilinear(atlas, u, v) {
  const s = atlas.size;
  const fx = ((u % 1) + 1) % 1 * s - 0.5;
  const fy = ((v % 1) + 1) % 1 * s - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const at = (x, y) => {
    const xx = ((x % s) + s) % s, yy = ((y % s) + s) % s;
    const o = (yy * s + xx) * 4;
    return [atlas.data[o], atlas.data[o + 1], atlas.data[o + 2]];
  };
  const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  return [0, 1, 2].map((k) => (a[k] * (1 - tx) + b[k] * tx) * (1 - ty) + (c[k] * (1 - tx) + d[k] * tx) * ty);
}

/**
 * 把图集的一块（uv 范围）铺到一个 w×h 的屏幕缓冲区。
 *
 * @param mode 'bilinear' | 'point' | 'snap'
 *   snap = 原文的做法：uv 按当前像素跨度量化到 2 texel 的整数倍，再用最近邻
 * @param scale 屏幕上 1 个世界单位 = 多少像素（同时决定 uv 跨度 → texel/pixel）
 */
export function drawQuad(atlas, {
  w = 256, h = 256, mode = 'snap', pxPerTexel = 2.0, texelsPerStep = 2, center = null,
} = {}) {
  const buf = new Uint8ClampedArray(w * h * 4);
  const s = atlas.size;
  // 屏幕一个像素跨多少 uv：一个 texel 占 pxPerTexel 个像素 → uv/pixel = 1/(pxPerTexel·s)
  const duv = 1 / (pxPerTexel * s);
  const cu = center ? center.u : (s - atlas.corner / 2) / s;
  const cv = center ? center.v : (s - atlas.corner / 2) / s;
  const u0 = cu - (w * duv) / 2;
  const v0 = cv - (h * duv) / 2;
  const stepUv = texelsPerStep / s;          // 2 texel 一格（原文的 every-other-pixel）
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let u = u0 + px * duv;
      let v = v0 + py * duv;
      let c;
      if (mode === 'bilinear') c = sampleBilinear(atlas, u, v);
      else if (mode === 'point') c = samplePoint(atlas, u, v);
      else {
        u = Math.round(u / stepUv) * stepUv;
        v = Math.round(v / stepUv) * stepUv;
        c = samplePoint(atlas, u, v);
      }
      const o = (py * w + px) * 4;
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
    }
  }
  return { w, h, data: buf, pxPerTexel, mode };
}

/** 10–90% 边缘过渡宽度（沿水平扫描线取最陡处），中位数。 */
export function edgeWidths(img) {
  const { w, h, data } = img;
  const lum = (x, y) => {
    const o = (y * w + x) * 4;
    return data[o] * 0.3 + data[o + 1] * 0.59 + data[o + 2] * 0.11;
  };
  const out = [];
  for (let y = 2; y < h - 2; y += 3) {
    let best = 0, bi = -1;
    for (let x = 1; x < w - 1; x++) {
      const g = Math.abs(lum(x + 1, y) - lum(x - 1, y));
      if (g > best) { best = g; bi = x; }
    }
    if (bi < 0 || best < 18) continue;
    const lo = lum(bi - 6, y), hi = lum(bi + 6, y);
    const span = Math.abs(hi - lo);
    if (span < 18) continue;
    // 沿扫描线找 10% 与 90% 位置
    const dir = hi > lo ? 1 : -1;
    const t10 = lo + span * 0.1 * dir, t90 = lo + span * 0.9 * dir;
    let x10 = null, x90 = null;
    for (let x = bi - 6; x <= bi + 6; x++) {
      const l = lum(x, y);
      if (x10 === null && (dir > 0 ? l >= t10 : l <= t10)) x10 = x;
      if (x10 !== null && x90 === null && (dir > 0 ? l >= t90 : l <= t90)) x90 = x;
    }
    if (x10 !== null && x90 !== null) out.push(Math.max(1, x90 - x10 + 1));
  }
  out.sort((a, b) => a - b);
  const med = out.length ? out[Math.floor(out.length / 2)] : 0;
  return { median: med, count: out.length, samples: out };
}

/** 高频能量（相邻像素差的均值）—— 越大越"脆"。 */
export function highFreq(img) {
  const { w, h, data } = img;
  let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = (y * w + x) * 4;
      const l = data[o] + data[o + 1] + data[o + 2];
      const r = data[o + 4] + data[o + 5] + data[o + 6];
      s += Math.abs(r - l);
      n++;
    }
  }
  return s / n / 3;
}

/**
 * 缩放稳定性：同一块区域放大 1.7% 再采样，逐像素比 —— 越稳越不"爬行"。
 * 点采样没 snap 时这个数会很大（每个 texel 的边界在抖），snap 之后应该小。
 */
export function zoomJitter(atlas, mode, { w = 200, h = 200, pxPerTexel = 3 } = {}) {
  const a = drawQuad(atlas, { w, h, mode, pxPerTexel });
  const b = drawQuad(atlas, { w, h, mode, pxPerTexel: pxPerTexel * 1.013 });
  let s = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    s += Math.abs(a.data[i] - b.data[i]);
  }
  return s / (a.data.length / 4);
}

/**
 * 验收：三种采样方式在同一块 32² 植物区上。
 *  - edgeMedian：10–90% 过渡宽度（参考片实测中位 1.0px）
 *  - highFreq：脆度
 *  - zoomJitter：放大 1.7% 后的平均像素漂移
 */
export function audit({ size = 128, corner = 32, pxPerTexel = 6 } = {}) {
  const atlas = bakeAtlas({ size, corner });
  const rows = [];
  for (const mode of ['bilinear', 'point', 'snap']) {
    const img = drawQuad(atlas, { w: 240, h: 240, mode, pxPerTexel });
    const ew = edgeWidths(img);
    rows.push({
      mode,
      pxPerTexel: +pxPerTexel.toFixed(2),
      edgeMedianPx: ew.median,
      edgeSamples: ew.count,
      highFreq: +highFreq(img).toFixed(2),
      zoomJitter: +zoomJitter(atlas, mode, { pxPerTexel: pxPerTexel * 0.6 }).toFixed(2),
    });
  }
  return { rows, atlasSize: size, corner, plantTexels: corner * corner };
}
