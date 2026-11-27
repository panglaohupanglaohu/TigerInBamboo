/**
 * paletteauthor.js — "给每个特征定义一整个颜色可能空间"：四角色标 + 三角面带抖动的色带
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1712088611934371876（2023-10-11）：
 *     "Another take on a palette authoring tool"
 *   同一天前后两条（1710031224838771027 / 1714613599035863191）把意图说全了：
 *     "The idea is to properly define the whole color possibility space for each feature"
 *     "a mix where some areas are more man made and others more natural"
 *   所以这不是取色器，是**给一个特征（草/石/屋顶）定义一个体积**：角点是允许的极值色，
 *   里面每一点都是这个特征可以取到的颜色。工具的作用是让你看见这个体积长什么样。
 *
 * ── 帧实测（640×640，f014 / f020）────────────────────────────────────────
 *   色带 bbox：**88 × 328**（f014）/ 88 × 348（f020）→ 宽度定死 88，长度由滑杆改。
 *   底色 rgb(56,56,56)。四角小方块（角标 = 体积的四个极值色）实测：
 *      左上 (93,142,100)   右上 (228,165,83)
 *      左下 (58,131,162)   右下 (171,94,113)
 *   竖切（中列，t = 0.1 … 0.9）：
 *      (166,153,95) (155,144,104) (146,133,102) (146,133,103) (159,134,113)
 *      (135,121,115) (134,121,115) (134,118,125) (130,116,133)
 *
 *   ★ 关键：把四角当双线性模型的四个角，对带内 6400 个采样点做残差 ──
 *      均值 (−7.3, −12.0, −9.2)   标准差 **(34.4, 27.9, 22.5)**
 *     均值小、标准差大 = **底面确实是双线性，但每个顶点各带一份噪声**。
 *     如果它只是一张平滑渐变，标准差应该在个位数；34 的抖动量级说明带子内部是
 *     "三角面 + 每顶点抖动色"，面内仿射、面与面之间有折 —— 片子上一块块三角形就是这么来的。
 *
 *   ★ 抖动幅度可以反推：Gouraud 面内一个像素的颜色是三个顶点按重心坐标的加权和，
 *     独立同分布抖动时 Var(像素) = Var(顶点)/3，所以
 *       σ_顶点 ≈ σ_像素 × √3 = (59.6, 48.3, 39.0)
 *     本模块的 jitter 用的就是这三个数（不是拍的）。
 *
 * ── 左栏读数（另一个可反推的细节）────────────────────────────────────────
 *   四个滑杆的读数：0.61176 / 0.59607 / 0.52549 / 0，以及 0.49019 / 0.48235。
 *   乘 255：156.0 / 152.0 / 134.0 / 0 / 125.0 / 123.0 —— **全是整数**。
 *   也就是说这些值本来就是 8bit 通道除以 255 的浮点（Unity 的 Color）。
 *   再往下还能判出它是**截断**而不是四舍五入：
 *     152/255 = 0.59607843… → 截断 0.59607 ✅（片子里就是这个），四舍五入会得 0.59608 ✗
 *   注意别拿 156/255 去判：0.61176470… 第 6 位是 4，两种取法同值，判不出东西
 *   （第一版就是这么写的，结论"恰好"没暴露错误）。
 *   本模块的 truncReadout() 就是按截断写的，lab 里专门测这一条。
 */

/** 片中实测 */
export const MEASURED = {
  strip: { w: 88, h: 328, h2: 348 },      // f014 / f020
  bg: [56, 56, 56],
  corners: {                              // 角标色（TL/TR/BL/BR），5×5 均值
    TL: [93, 142, 100],
    TR: [228, 165, 83],
    BL: [58, 131, 162],
    BR: [171, 94, 113],
  },
  centerProfile: [                        // 中列竖切 t=0.1..0.9
    [166, 153, 95], [155, 144, 104], [146, 133, 102], [146, 133, 103],
    [159, 134, 113], [135, 121, 115], [134, 121, 115], [134, 118, 125], [130, 116, 133],
  ],
  residSD: [34.4, 27.9, 22.5],            // 片中：像素相对双线性的标准差
  /**
   * 顶点抖动的半宽 a。推导（这一步第一次写错过，记下来）：
   *   均匀分布 ±a 的标准差是 a/√3；
   *   Gouraud 面内像素 = 三顶点按重心坐标加权，独立抖动时 Var(像素) ≈ Var(顶点)/3；
   *   所以 σ_像素 = (a/√3)/√3 = **a/3** → a = 3 × σ_像素。
   * 一开始写成 σ×√3，渲出来的 sd 只有片子的一半（18 vs 34），就是这么来的。
   */
  jitter: [103.2, 83.7, 67.5],            // = residSD × 3
  // 片中底面整体比纯双线性暗约 10 级。成因不明（可能是 sRGB↔线性空间转了一次），
  // 这里当成常数偏置记下来，不假装知道为什么。
  bias: [-7.3, -12.0, -9.2],
  readouts: [0.61176, 0.59607, 0.52549, 0, 0.49019, 0.48235],
  readoutBytes: [156, 152, 134, 0, 125, 123],   // 读数 × 255，全为整数 → 8bit 通道
};

/** 双线性取体积里的颜色，u 横、v 纵（v=0 是顶） */
export function bilinear(c, u, v) {
  const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
  return [
    w00 * c.TL[0] + w10 * c.TR[0] + w01 * c.BL[0] + w11 * c.BR[0],
    w00 * c.TL[1] + w10 * c.TR[1] + w01 * c.BL[1] + w11 * c.BR[1],
    w00 * c.TL[2] + w10 * c.TR[2] + w01 * c.BL[2] + w11 * c.BR[2],
  ];
}

/** 确定性哈希（不用 Math.random：截图要可复现，两次跑必须一模一样） */
function hash2(i, j, seed = 1337) {
  let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;   // 0..1
}

/**
 * 建色带网格：2 列 × rows 行，每格拆两个三角形（对角线交替）。
 * 为什么交替：全用同一方向的对角线会形成一条贯穿的斜向纹理，
 *   片子里三角形的斜边是**左右交替**的（放大 f014 可见）。
 */
export function buildVolume({ corners = MEASURED.corners, rows = 14, cols = 3, jitter = MEASURED.jitter, bias = MEASURED.bias, seed = 7 } = {}) {
  const verts = [];
  const idx = (j, i) => j * (cols + 1) + i;
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const raw = bilinear(corners, u, v);
      const base = [0, 1, 2].map((ch) => raw[ch] + (bias ? bias[ch] : 0));
      // 边界顶点不抖：角点就是"极值色"（角标），抖了就不是极值；
      // 左右两条边不抖，带子边缘才不会啃出毛边（片子里边缘是干净的直边）。
      const border = j === 0 || j === rows || i === 0 || i === cols;
      /**
       * ★ 抖动必须是**一个标量乘三个通道**，不能让每个通道各抖各的。
       *   各抖各的 = 色相乱飞（第一版渲出来是霓虹彩虹，片子里是"同一色相明暗变化 + 少量串色"）。
       *   共用一个 s 时，三通道的像素标准差仍分别是 residSD，因为幅度按通道配比：
       *     A_ch = 3 × residSD_ch（推导见 MEASURED.jitter）
       */
      const sPar = border ? 0 : (hash2(i, j, seed) * 2 - 1);
      verts.push({ u, v, c: [0, 1, 2].map((ch) => clamp255(base[ch] + sPar * jitter[ch])) });
    }
  }
  const tris = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = idx(j, i), b = idx(j, i + 1), c = idx(j + 1, i), d = idx(j + 1, i + 1);
      // 对角线左右交替：全用同一方向会出现一条贯穿整条带子的斜纹，
      // 片子里三角形斜边是交错的（放大 f014 可见）
      if ((i + j) % 2 === 0) { tris.push([a, b, d], [a, d, c]); }
      else { tris.push([a, b, c], [b, d, c]); }
    }
  }
  return { verts, tris, rows, cols };
}

const clamp255 = (x) => Math.max(0, Math.min(255, x));

/**
 * 逐像素重心坐标填充（Gouraud）。
 * 为什么不用 ctx.fillStyle 逐三角填平均色：那样面内是常数，看不出片中
 * "面内有渐变、面间有折"的样子；而 canvas 也没有原生的顶点色渐变。
 */
export function rasterize(ctx, vol, { x = 0, y = 0, w = 88, h = 328 } = {}) {
  const img = ctx.createImageData(Math.round(w), Math.round(h));
  const d = img.data;
  const P = (k) => [x + vol.verts[k].u * w, y + vol.verts[k].v * h];
  for (let t = 0; t < vol.tris.length; t++) {
    const [i0, i1, i2] = vol.tris[t];
    const p0 = P(i0), p1 = P(i1), p2 = P(i2);
    const c0 = vol.verts[i0].c, c1 = vol.verts[i1].c, c2 = vol.verts[i2].c;
    // 裁到**图像局部坐标**，不是画布坐标：图是 w×h 的小块，画在 (x,y)，
    // 用画布坐标去夹会让 minX > img.width，整个循环一次都不跑（第一版就这么白屏了）
    const minX = Math.max(x, Math.floor(Math.min(p0[0], p1[0], p2[0])));
    const maxX = Math.min(x + img.width - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const minY = Math.max(y, Math.floor(Math.min(p0[1], p1[1], p2[1])));
    const maxY = Math.min(y + img.height - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    const den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
    if (Math.abs(den) < 1e-6) continue;         // 退化三角形（rows 很大时会出现）
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const l0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / den;
        const l1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / den;
        const l2 = 1 - l0 - l1;
        if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
        const o = ((py - y) * img.width + (px - x)) * 4;
        d[o] = clamp255(l0 * c0[0] + l1 * c1[0] + l2 * c2[0]);
        d[o + 1] = clamp255(l0 * c0[1] + l1 * c1[1] + l2 * c2[1]);
        d[o + 2] = clamp255(l0 * c0[2] + l1 * c1[2] + l2 * c2[2]);
        d[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, x, y);
}

/**
 * 读数格式化：**截断**到 n 位（片子里 0.6117647 → 0.61176）。
 * 注意 JS 的 toFixed 是四舍五入，会得 0.61177 —— 差一位就是判错片子。
 */
export function truncReadout(v, n = 5) {
  const k = 10 ** n;
  return (Math.floor(v * k + 1e-9) / k).toFixed(n);
}

/** 8bit/255 → 片中那几个读数的来源 */
export const byteFloat = (b) => b / 255;

/* ── 颜色空间互转（左栏 RGB ⇄ HSL 那个开关）───────────────────────────── */
export function rgbToHsl([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (mx === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb([h, s, l]) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

/** 四个通道的读数（前三个随空间变，第四个在原片里恒为 0，用途未知 —— 如实记） */
export function readChannels(rgb, space = 'rgb') {
  if (space === 'hsl') {
    const [h, s, l] = rgbToHsl(rgb);
    return [truncReadout(h), truncReadout(s), truncReadout(l), truncReadout(0)];
  }
  return [truncReadout(byteFloat(rgb[0])), truncReadout(byteFloat(rgb[1])), truncReadout(byteFloat(rgb[2])), truncReadout(0)];
}
