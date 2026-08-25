// 像素统计纯函数库：sRGB→Lab、CIEDE2000、主色聚类、明度分布。
// 供 Node 单测（tools/test_pixel_stats.mjs）与 e2e 页面内注入（buildPageStatsScript）共用。
// 所有函数自包含、无副作用，toString 后可直接拼接注入页面。

export function srgbChannelToLinear(c) {
  // c: 0..1
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToLab(r, g, b) {
  // 输入 sRGB 0..255，输出 {L, a, b}（D65）
  const rl = srgbChannelToLinear(r / 255);
  const gl = srgbChannelToLinear(g / 255);
  const bl = srgbChannelToLinear(b / 255);
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hexToRgb(hex) {
  // 支持 "#RRGGBB" / "RRGGBB" / 0xRRGGBB 数字
  if (typeof hex === "number") return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
  const s = String(hex).replace(/^#/, "");
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}

export function deltaE00(lab1, lab2) {
  // CIEDE2000，输入 {L, a, b}
  const rad = Math.PI / 180;
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const ang = (bb, aa) => {
    const h = Math.atan2(bb, aa);
    return h >= 0 ? h : h + 2 * Math.PI;
  };
  const h1p = C1p === 0 ? 0 : ang(b1, a1p);
  const h2p = C2p === 0 ? 0 : ang(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > Math.PI) dhp -= 2 * Math.PI;
    else if (dhp < -Math.PI) dhp += 2 * Math.PI;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2);
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else {
    const hsum = h1p + h2p;
    if (Math.abs(h1p - h2p) <= Math.PI) hbarp = hsum / 2;
    else hbarp = hsum < 2 * Math.PI ? (hsum + 2 * Math.PI) / 2 : (hsum - 2 * Math.PI) / 2;
  }
  const hdeg = hbarp / rad;
  const T =
    1 -
    0.17 * Math.cos(hbarp - 30 * rad) +
    0.24 * Math.cos(2 * hbarp) +
    0.32 * Math.cos(3 * hbarp + 6 * rad) -
    0.2 * Math.cos(4 * hbarp - 63 * rad);
  const dTheta = 30 * rad * Math.exp(-Math.pow((hdeg - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
  );
}

export function deltaLStar(colorA, colorB) {
  // 两色（hex/数字）的 L* 差（绝对值）
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return Math.abs(rgbToLab(a.r, a.g, a.b).L - rgbToLab(b.r, b.g, b.b).L);
}

export function deltaE00Colors(colorA, colorB) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return deltaE00(rgbToLab(a.r, a.g, a.b), rgbToLab(b.r, b.g, b.b));
}

export function luminance255(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function analyzePixels(pixels, opts) {
  // pixels: RGBA 的 Uint8Array/普通数组。opts: { bgTolerance=20, topColors=8 }
  const o = opts || {};
  const bgTolerance = o.bgTolerance == null ? 20 : o.bgTolerance;
  const topColors = o.topColors == null ? 8 : o.topColors;
  const totalPixels = pixels.length / 4;
  if (!totalPixels) return null;
  // 背景色取左上角像素，距离小于 bgTolerance 且 alpha>0 的视为背景剔除
  const bg = [pixels[0], pixels[1], pixels[2]];
  const luminances = [];
  let clipped = 0;
  let dark = 0;
  let saturationSum = 0;
  const bins = new Map(); // 4bit/通道量化 → {count, r, g, b}（存质心累加）
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a === 0) continue;
    const bgDistance = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    if (bgDistance < bgTolerance) continue;
    const y = luminance255(r, g, b);
    luminances.push(y);
    if (Math.max(r, g, b) >= 250) clipped++;
    if (y <= 18) dark++;
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    saturationSum += hi > 0 ? (hi - lo) / hi : 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let bin = bins.get(key);
    if (!bin) {
      bin = { count: 0, r: 0, g: 0, b: 0 };
      bins.set(key, bin);
    }
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
  }
  if (!luminances.length) return null;
  luminances.sort((x, y) => x - y);
  const q = (p) => luminances[Math.min(luminances.length - 1, Math.floor(luminances.length * p))];
  const subjectPixels = luminances.length;
  const dominantColors = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topColors)
    .map((bin) => ({
      r: Math.round(bin.r / bin.count),
      g: Math.round(bin.g / bin.count),
      b: Math.round(bin.b / bin.count),
      share: +(bin.count / subjectPixels).toFixed(4),
    }));
  return {
    totalPixels,
    subjectPixels,
    bg: { r: bg[0], g: bg[1], b: bg[2] },
    p10: +q(0.1).toFixed(2),
    p50: +q(0.5).toFixed(2),
    p90: +q(0.9).toFixed(2),
    contrastP90P10: +(q(0.9) / Math.max(1, q(0.1))).toFixed(2),
    clippedPercent: +((clipped / subjectPixels) * 100).toFixed(2),
    darkPercent: +((dark / subjectPixels) * 100).toFixed(2),
    meanSaturation: +(saturationSum / subjectPixels).toFixed(3),
    dominantColors,
    top3Share: +dominantColors.slice(0, 3).reduce((s, c) => s + c.share, 0).toFixed(4),
  };
}

// 生成注入页面的自包含脚本：把上述纯函数 toString 拼接后，对页面第一个 canvas
// 缩放采样到 maxSize 内并跑 analyzePixels。在 e2e 里用 page.evaluate(script) 调用。
export function buildPageStatsScript(opts) {
  const lib = [srgbChannelToLinear, rgbToLab, hexToRgb, deltaE00, luminance255, analyzePixels]
    .map((f) => f.toString())
    .join("\n");
  const o = opts || {};
  const maxSize = o.maxSize || 512;
  const analyzeOpts = JSON.stringify({ bgTolerance: o.bgTolerance, topColors: o.topColors });
  return (
    "(function(){ 'use strict';\n" +
    lib +
    "\nvar src = document.querySelector('canvas');" +
    "\nif (!src) return null;" +
    "\nvar scale = Math.min(1, " +
    maxSize +
    " / Math.max(src.width, src.height));" +
    "\nvar w = Math.max(1, Math.round(src.width * scale));" +
    "\nvar h = Math.max(1, Math.round(src.height * scale));" +
    "\nvar c2 = document.createElement('canvas'); c2.width = w; c2.height = h;" +
    "\nvar ctx = c2.getContext('2d', { willReadFrequently: true });" +
    "\nctx.drawImage(src, 0, 0, w, h);" +
    "\nvar data = ctx.getImageData(0, 0, w, h).data;" +
    "\nreturn analyzePixels(data, " +
    analyzeOpts +
    "); })()"
  );
}

// 对已合成的 PNG 截图（data URL，不含 base64 前缀亦可）跑 analyzePixels。
// 用法：const buf = await page.screenshot(); await page.evaluate(buildDataUrlStatsScript(buf, opts))
// 与 buildPageStatsScript 的区别：分析的是合成后的最终像素（含 UI/雾），
// 不依赖 WebGL drawing buffer 是否保留，任何时刻调用都安全。
export function buildDataUrlStatsScript(pngBuffer, opts) {
  const lib = [srgbChannelToLinear, rgbToLab, hexToRgb, deltaE00, luminance255, analyzePixels]
    .map((f) => f.toString())
    .join("\n");
  const o = opts || {};
  const maxSize = o.maxSize || 512;
  const analyzeOpts = JSON.stringify({ bgTolerance: o.bgTolerance, topColors: o.topColors });
  const b64 = Buffer.isBuffer(pngBuffer) ? pngBuffer.toString("base64") : String(pngBuffer);
  return (
    "(async function(){ 'use strict';\n" +
    lib +
    "\nvar img = new Image();" +
    "\nimg.src = 'data:image/png;base64," +
    b64 +
    "';" +
    "\nawait img.decode();" +
    "\nvar scale = Math.min(1, " +
    maxSize +
    " / Math.max(img.width, img.height));" +
    "\nvar w = Math.max(1, Math.round(img.width * scale));" +
    "\nvar h = Math.max(1, Math.round(img.height * scale));" +
    "\nvar c2 = document.createElement('canvas'); c2.width = w; c2.height = h;" +
    "\nvar ctx = c2.getContext('2d', { willReadFrequently: true });" +
    "\nctx.drawImage(img, 0, 0, w, h);" +
    "\nvar data = ctx.getImageData(0, 0, w, h).data;" +
    "\nreturn analyzePixels(data, " +
    analyzeOpts +
    "); })()"
  );
}
