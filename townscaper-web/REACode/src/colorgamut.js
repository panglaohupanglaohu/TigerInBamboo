/**
 * colorgamut.js — 给每个"特征"划一个**色容体**，而不是给整张图配一套调色板。
 *
 * 1710031224838771027  "Ok here's a probably horrible way to author color volumes. The idea is to
 *   properly define the whole color possibility space for each feature"
 *
 * ---- 画面观察（770×266，24 帧；他自己那个编辑器） ----
 *   · 上半是**每个特征一行**（草/沙/岩/屋顶…），每行是一条色相渐变，颜色块落在不同高度上；
 *   · 下半是一把 24 格的色相带（彩虹），像是"取色器"；
 *   · 后面几帧（9–23）选中某个特征时，行上方会**竖起一列**方块：同一色相、不同明度 ——
 *     也就是"体"的第三个轴被拉出来看了。
 *   · 所以这不是"调色板"，是**每特征一个盒子**（hue × value，再乘饱和度），
 *     取色时从盒子里随便取，"整个可能性空间"都被授权。
 *
 * 这个文件做三件可量的事：
 *   1. `sample()`    —— 从一个特征的盒子里取色（可重现，不随机）
 *   2. `stats()`     —— 每个特征的体量（Lab 里对角线的 ΔE）、能分辨出多少种颜色
 *   3. `separation()`—— 特征之间**最接近**的那一对差多少 ΔE（可读性下限）
 *
 * 为什么用 ΔE 而不是 HSV 距离：HSV 的距离跟人眼不成比例（蓝区的 10° 和绿区的 10° 差很多），
 * 拿它判"两个特征分不分得开"会得出反的结论。注意这里用的是 CIE76，够粗用，别当精密色差。
 */

/** sRGB → Lab（D65）。只为了算 ΔE，不走色彩管理。 */
export function rgbToLab(r, g, b) {
  const f = (u) => (u > 0.04045 ? Math.pow((u + 0.055) / 1.055, 2.4) : u / 12.92);
  const R = f(r / 255);
  const G = f(g / 255);
  const B = f(b / 255);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = (u) => (u > 0.008856 ? Math.cbrt(u) : 7.787 * u + 16 / 116);
  x = g2(x);
  y = g2(y);
  z = g2(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** HSV(度, 0..1, 0..1) → RGB(0..255)。 */
export function hsvToRgb(h, s, v) {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * 每个特征一个盒子：hue 范围（度）、sat 范围、value 范围。
 * 数值是**按片子里的画面调的**（那个编辑器本身就是调色工具，这里只复刻"盒子"这件事，
 * 不复刻他的具体配色），所以当示例看，不要当"原作色板"引用。
 */
export const FEATURES = [
  { key: 'grass', name: '草', h: [78, 108], s: [0.22, 0.42], v: [0.55, 0.78] },
  { key: 'foliage', name: '树冠', h: [96, 132], s: [0.34, 0.56], v: [0.36, 0.60] },
  { key: 'sand', name: '沙', h: [26, 44], s: [0.18, 0.36], v: [0.86, 0.97] },
  { key: 'rock', name: '岩', h: [188, 214], s: [0.05, 0.16], v: [0.62, 0.82] },
  { key: 'plaster', name: '墙面', h: [34, 54], s: [0.04, 0.14], v: [0.90, 1.0] },
  { key: 'roof', name: '屋顶', h: [6, 22], s: [0.52, 0.76], v: [0.62, 0.86] },
  { key: 'water', name: '水', h: [184, 202], s: [0.50, 0.74], v: [0.42, 0.62] },
];

/**
 * 从盒子里取一个颜色。u 走色相，v 走明度，s 走饱和度 —— 三个参数都在 0..1，
 * 这样同一个特征的任何一点都可以用坐标寻址（编辑器里就是拖动那三条）。
 */
export function sample(feature, u = 0.5, v = 0.5, s = 0.5) {
  const h = feature.h[0] + (feature.h[1] - feature.h[0]) * u;
  const sat = feature.s[0] + (feature.s[1] - feature.s[0]) * s;
  const val = feature.v[0] + (feature.v[1] - feature.v[0]) * v;
  const rgb = hsvToRgb(h, sat, val);
  return { rgb, lab: rgbToLab(...rgb), h, s: sat, v: val };
}

/** 网格取色：nu × nv 个子样本（饱和度取中值，足够看清体的两个主轴）。 */
export function grid(feature, nu = 8, nv = 4) {
  const out = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) out.push(sample(feature, i / (nu - 1), j / (nv - 1), 0.5));
  }
  return out;
}

/** 每个特征的体量：Lab 里对角线两端的 ΔE（"这个盒子有多大"）。 */
export function stats(features = FEATURES, nu = 6, nv = 3) {
  return features.map((f) => {
    const cols = grid(f, nu, nv);
    let volume = 0;
    for (const a of cols) for (const b of cols) volume = Math.max(volume, deltaE(a.lab, b.lab));
    // 能分辨出多少种颜色：量化到 1/16 后去重
    const set = new Set(cols.map((c) => c.rgb.map((x) => Math.round(x / 16)).join(',')));
    let minIn = Infinity;
    for (let i = 0; i < cols.length; i++) {
      for (let j = i + 1; j < cols.length; j++) minIn = Math.min(minIn, deltaE(cols[i].lab, cols[j].lab));
    }
    return {
      key: f.key,
      name: f.name,
      hueSpan: f.h[1] - f.h[0],
      satSpan: +(f.s[1] - f.s[0]).toFixed(2),
      valSpan: +(f.v[1] - f.v[0]).toFixed(2),
      extentDE: volume,
      distinct: set.size,
      samples: cols.length,
      minNeighbourDE: minIn,
    };
  });
}

/**
 * 特征之间的最小色差：任何两个特征、任何两个取色，最近的那一对差多少 ΔE。
 * 这个数是"可读性下限" —— 低于 10 左右，两个特征在画面上就开始糊成一片。
 */
export function separation(features = FEATURES, n = 5) {
  const cols = features.map((f) => grid(f, n, n));
  let min = Infinity;
  let pair = null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      for (const a of cols[i]) {
        for (const b of cols[j]) {
          const d = deltaE(a.lab, b.lab);
          sum += d;
          count++;
          if (d < min) { min = d; pair = [features[i].key, features[j].key]; }
        }
      }
    }
  }
  return { minDE: min, pair, meanDE: sum / count };
}

/**
 * 对照：如果只给每个特征**一种**颜色（平面调色板），最小色差还剩多少。
 * 这是"色容体 vs 调色板"的差别所在 —— 体本身不提高分离度，
 * 它提高的是"同一特征内部的变化量"，而分离度反而要靠**收窄盒子**来保证。
 */
export function flatPalette(features = FEATURES) {
  const cols = features.map((f) => sample(f, 0.5, 0.5, 0.5));
  let min = Infinity;
  let pair = null;
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const d = deltaE(cols[i].lab, cols[j].lab);
      if (d < min) { min = d; pair = [features[i].key, features[j].key]; }
    }
  }
  return { minDE: min, pair, colors: cols.map((c) => c.rgb) };
}

/** 一键体检。 */
export function audit() {
  const t0 = performance.now();
  const rows = stats();
  const sep = separation();
  const flat = flatPalette();
  const internal = rows.reduce((s, r) => s + r.extentDE, 0) / rows.length;
  return {
    rows,
    separation: sep,
    flat: { minDE: flat.minDE, pair: flat.pair },
    meanExtent: internal,
    ms: performance.now() - t0,
  };
}
