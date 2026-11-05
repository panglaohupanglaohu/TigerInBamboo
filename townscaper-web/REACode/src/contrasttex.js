/**
 * contrasttex.js — 线不是画上去的：整个贴图是一张三角网，靠约束松弛把颜色"解"出来。
 *
 * 帖子 ID：1482346496460828674（2022-01-15，texture）
 *
 *   "I created a dedicated contrast texture system for the lines: an iterative
 *    simulation on the triangles that starts random and then tries to make
 *    contrasted edges different, and non-contrasted edges similar. A byproduct
 *    is a beautiful color gradient that help express connectivity"
 *
 * ---- 画面观察（6 帧，512²；灰绿底上一块不规则贴花，红色线框压在三角边上） ----
 *   · 主体是一张**三角网**，不是像素图；红线全部落在三角边上，沿特征交界走一圈；
 *   · 不描红的地方，三角形之间几乎看不出接缝 —— 同一块区域被"抹"成一片；
 *   · 左上角面板 5 张缩略图是迭代过程：第 2 张三角块还是互不相关的饱和色（随机起手），
 *     第 3 张已经收成一团一团，第 1 张是最终那张"苔绿"的成品。
 *
 * ---- 为什么这么做（而不是手画对比色） ----
 * 手画的问题是一致性：一张贴花几百个三角形，交界线两侧到底该差多少，人眼判断不了，
 * 而且改一处形状整片贴图都要重画。把"差多少"写成**边上的约束**，形状怎么变都成立：
 *   · 对比边（contrast）—— 两侧三角形的颜色距离必须 ≥ target；
 *   · 非对比边（same）—— 两侧颜色距离尽量压到 0（同一块材质不能有接缝）。
 * 于是贴图颜色是这个约束图的解，不是一张画。
 *
 * 副产品是渐变：交界线两侧被硬推开，这股张力向内扩散、被内部收缩压成一条缓坡，
 * 所以"哪块和哪块连着"能直接从颜色上读出来 —— 原文说的 express connectivity。
 *
 * 颜色空间用 OKLab（欧氏距离≈感知差），全程在线性里迭代，最后钳进 sRGB 色域再回读。
 */

// ---------- OKLab <-> sRGB ----------

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function rgbToOklab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToRgb(L, A, B) {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.2914855480 * B;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

/** 钳进 sRGB 色域：转成 0..1 的 rgb，再把钳过的值转回 OKLab。 */
export function clampToGamut(c) {
  const [r, g, b] = oklabToRgb(c[0], c[1], c[2]);
  const r2 = Math.min(1, Math.max(0, r));
  const g2 = Math.min(1, Math.max(0, g));
  const b2 = Math.min(1, Math.max(0, b));
  const back = rgbToOklab(r2, g2, b2);
  c[0] = back[0]; c[1] = back[1]; c[2] = back[2];
  return [r2, g2, b2];
}

export function css(c) {
  const [r, g, b] = oklabToRgb(c[0], c[1], c[2]);
  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${q(r)},${q(g)},${q(b)})`;
}

// ---------- 确定性随机 ----------

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 贴花网格 ----------

/** 贴花轮廓：几个圆的并集（对应原片那块不规则圆角形状）。world 0..1。 */
export function insideDecal(x, y) {
  const blobs = [
    [0.46, 0.55, 0.34],
    [0.31, 0.40, 0.20],
    [0.66, 0.66, 0.22],
    [0.55, 0.33, 0.15],
    [0.72, 0.42, 0.13],
  ];
  for (const [cx, cy, r] of blobs) {
    const dx = (x - cx) / r, dy = (y - cy) / r;
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
}

/** 特征区：给每个三角形分配一个 feature id（对应围栏/石墙/草/路…）。 */
const SEEDS = [
  [0.31, 0.44], [0.46, 0.60], [0.63, 0.37], [0.70, 0.64], [0.52, 0.26],
];

/**
 * 建三角网：抖动的规则网格，每格按 (i+j) 奇偶切开成两个三角形，
 * 再丢掉质心落在贴花外的三角形 —— 边界会自然毛糙，正好是原片那种裁切感。
 */
export function buildDecal({ nx = 26, ny = 21, jitter = 0.34, seed = 7 } = {}) {
  const rnd = mulberry32(seed);
  const verts = [];
  const vid = new Map();
  const key = (i, j) => i * 1000 + j;
  const pushVert = (i, j) => {
    const k = key(i, j);
    if (vid.has(k)) return vid.get(k);
    const jx = i === 0 || i === nx ? 0 : (rnd() - 0.5) * jitter;
    const jy = j === 0 || j === ny ? 0 : (rnd() - 0.5) * jitter;
    const id = verts.length;
    verts.push({ x: (i + jx) / nx, y: (j + jy) / ny });
    vid.set(k, id);
    return id;
  };

  const tris = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = pushVert(i, j), b = pushVert(i + 1, j);
      const c = pushVert(i + 1, j + 1), d = pushVert(i, j + 1);
      const pairs = (i + j) % 2 === 0 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const t of pairs) {
        const [p, q, r] = t.map((k) => verts[k]);
        const cx = (p.x + q.x + r.x) / 3, cy = (p.y + q.y + r.y) / 3;
        if (!insideDecal(cx, cy)) continue;
        let best = 0, bd = 1e9;
        SEEDS.forEach(([sx, sy], si) => {
          const dd = (cx - sx) ** 2 + (cy - sy) ** 2;
          if (dd < bd) { bd = dd; best = si; }
        });
        tris.push({ v: t, cx, cy, feature: best });
      }
    }
  }

  // 边表：同一条边被两个三角形共享 → 一条内部边；否则是边界。
  const em = new Map();
  const ekey = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
  tris.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const a = t.v[k], b = t.v[(k + 1) % 3];
      const kk = ekey(a, b);
      if (!em.has(kk)) em.set(kk, { a: Math.min(a, b), b: Math.max(a, b), t: [] });
      em.get(kk).t.push(ti);
    }
  });
  const edges = [];
  for (const e of em.values()) {
    if (e.t.length !== 2) continue;                 // 外轮廓不参与约束
    const [i, j] = e.t;
    edges.push({
      i, j, a: e.a, b: e.b,
      contrast: tris[i].feature !== tris[j].feature,
    });
  }
  return { verts, tris, edges, nx, ny };
}

// ---------- 颜色求解 ----------

/** 每个特征一份"底色"（对应原片的苔绿/灰石），初始颜色在底色上撒随机。 */
const BASE = [
  [0.62, -0.10, 0.045],   // 草绿
  [0.58, 0.030, 0.030],   // 暖灰
  [0.72, -0.06, 0.035],   // 浅苔
  [0.46, -0.02, -0.05],   // 冷石
  [0.68, 0.075, 0.055],   // 土黄
];

export function initColors(mesh, { seed = 3, spread = 0.16, random = false } = {}) {
  const rnd = mulberry32(seed);
  return mesh.tris.map((t) => {
    const b = BASE[t.feature % BASE.length];
    const j = random ? 0.34 : spread;
    return [
      b[0] + (rnd() - 0.5) * j,
      b[1] + (rnd() - 0.5) * j * 1.6,
      b[2] + (rnd() - 0.5) * j * 1.6,
    ];
  });
}

/**
 * 一轮迭代 = 扫一遍所有边，两边各让一半。
 *   contrast：距离不足 target 就沿连线推开；
 *   same    ：按 k 收缩（同时轻微拉向本特征均值，避免整块被边界张力带跑）。
 * 温度退火：前 40% 的迭代额外加一点随机抖动，帮解跳出"颜色挤成一坨"的局部最小。
 */
export function relaxStep(mesh, colors, {
  target = 0.17, pull = 0.24, push = 0.42, anchor = 0.02, noise = 0, rnd = Math.random,
} = {}) {
  const featMean = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < colors.length; i++) {
    const f = featMean[mesh.tris[i].feature % featMean.length];
    f[0] += colors[i][0]; f[1] += colors[i][1]; f[2] += colors[i][2]; f[3]++;
  }
  for (const f of featMean) {
    if (f[3]) { f[0] /= f[3]; f[1] /= f[3]; f[2] /= f[3]; }
  }

  const dv = [0, 0, 0];
  for (const e of mesh.edges) {
    const A = colors[e.i], B = colors[e.j];
    dv[0] = B[0] - A[0]; dv[1] = B[1] - A[1]; dv[2] = B[2] - A[2];
    const d = Math.hypot(dv[0], dv[1], dv[2]) || 1e-6;
    let s = 0;
    if (e.contrast) {
      if (d < target) s = -push * (target - d) / d * 0.5;   // 负 = 继续推开
    } else {
      s = pull * 0.5;
    }
    A[0] += dv[0] * s; A[1] += dv[1] * s; A[2] += dv[2] * s;
    B[0] -= dv[0] * s; B[1] -= dv[1] * s; B[2] -= dv[2] * s;
  }

  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const f = featMean[mesh.tris[i].feature % featMean.length];
    c[0] += (f[0] - c[0]) * anchor;
    c[1] += (f[1] - c[1]) * anchor;
    c[2] += (f[2] - c[2]) * anchor;
    if (noise) {
      c[0] += (rnd() - 0.5) * noise;
      c[1] += (rnd() - 0.5) * noise;
      c[2] += (rnd() - 0.5) * noise;
    }
  }
  for (const c of colors) clampToGamut(c);
  return colors;
}

export function solve(mesh, opts = {}) {
  const { iters = 220 } = opts;
  const colors = initColors(mesh, opts);
  const rnd = mulberry32(opts.seed || 3);
  for (let it = 0; it < iters; it++) {
    const t = it / iters;
    relaxStep(mesh, colors, { ...opts, noise: t < 0.35 ? 0.012 * (1 - t / 0.35) : 0, rnd });
  }
  return colors;
}

// ---------- 量 ----------

/** 对比边/非对比边的平均感知色差（OKLab 欧氏 ×100，近似 ΔE）。 */
export function measure(mesh, colors) {
  let sumC = 0, nC = 0, sumS = 0, nS = 0;
  for (const e of mesh.edges) {
    const A = colors[e.i], B = colors[e.j];
    const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) * 100;
    if (e.contrast) { sumC += d; nC++; } else { sumS += d; nS++; }
  }
  // 每个特征内部的离散度：>0 说明不是一块死色，而是有方向的渐变
  const groups = new Map();
  colors.forEach((c, i) => {
    const k = mesh.tris[i].feature;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  });
  let spread = 0;
  for (const arr of groups.values()) {
    const m = [0, 0, 0];
    for (const c of arr) { m[0] += c[0]; m[1] += c[1]; m[2] += c[2]; }
    m[0] /= arr.length; m[1] /= arr.length; m[2] /= arr.length;
    let s = 0;
    for (const c of arr) s += Math.hypot(c[0] - m[0], c[1] - m[1], c[2] - m[2]);
    spread += (s / arr.length) * 100;
  }
  return {
    contrastEdges: nC, sameEdges: nS,
    contrastDE: nC ? sumC / nC : 0,
    sameDE: nS ? sumS / nS : 0,
    withinFeatureSpread: spread / groups.size,
    minContrastDE: (() => {
      let m = 1e9;
      for (const e of mesh.edges) {
        if (!e.contrast) continue;
        const A = colors[e.i], B = colors[e.j];
        m = Math.min(m, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) * 100);
      }
      return m === 1e9 ? 0 : m;
    })(),
  };
}

/** 画一张：填三角形 + 只在对比边上压一条线（原片红线的画法）。 */
export function paint(ctx, mesh, colors, {
  w, h, sx = 1, sy = 1, ox = 0, oy = 0, lineColor = 'rgba(196,48,38,0.92)', lineWidth = 1.6, both = false,
} = {}) {
  ctx.save();
  ctx.translate(ox, oy);
  for (let i = 0; i < mesh.tris.length; i++) {
    const t = mesh.tris[i];
    ctx.beginPath();
    t.v.forEach((vi, k) => {
      const p = mesh.verts[vi];
      const X = p.x * w * sx, Y = p.y * h * sy;
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.fillStyle = css(colors[i]);
    ctx.fill();
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  for (const e of mesh.edges) {
    if (!both && !e.contrast) continue;
    const A = mesh.verts[e.a], B = mesh.verts[e.b];
    ctx.beginPath();
    ctx.moveTo(A.x * w * sx, A.y * h * sy);
    ctx.lineTo(B.x * w * sx, B.y * h * sy);
    ctx.stroke();
  }
  ctx.restore();
}
