/**
 * planetatmo.js — 球形世界的**边光/大气晕**与**会飘的云壳**。
 *
 * 原文（768886648625061889）：无文字说明，只有 5.4 秒的循环片段。
 * 同一条 id 在索引里只被当成 "planet.html 外链" 提过一次，没看过。
 *
 * 画面观察（400×400, 5.4s, 24 帧全看）：
 *   · 深海军蓝背景 (13,22,35)，球体是一颗有海陆的星球：海 (64,120,178) 到
 *     浅海 (120,200,235)、陆 (140,198,148)、云 (228,247,250)。
 *   · 轮廓**不是硬切**：从球面往外的亮度是一段衰减，不是一步掉到背景色。
 *     这是这颗球"看起来是球"的主要原因，不是明暗关系 —— 明暗在球心附近
 *     几乎是平的（亮部一路到边缘都饱和）。
 *   · 云比地面慢，且**两层**（大块和小块互相穿过），所以云不会整块平移。
 *
 * 边光的衰减是这条里唯一能量出来的东西。沿 x=208 竖扫（球心 y≈224，R≈157），
 * 轮廓在 y=62 处从 L=105 跳到 L=211，往上一共 32px 才回到背景 L≈19。
 * 把 (L−bg)/(edge−bg) 归一化后得到下面这张表 —— 代码直接**用表插值**，
 * 不拿 exp 拟合，因为前 5px 明显比指数掉得慢（那是云的散射，不是大气）。
 */

export const ATMO = {
  bg: [13, 22, 35],
  edge: [81, 110, 142],   // 轮廓外侧第一像素
  haloMid: [60, 83, 108],
  haloOuter: [41, 60, 83],
  ocean: [64, 120, 178],
  shallow: [120, 200, 235],
  land: [140, 198, 148],
  cloud: [228, 247, 250],
  // 归一化边光强度，键是"离轮廓的像素 / 半径"。11 个点直接来自竖扫：
  //   d(px) 0  2   4   6   8   10  12  16  20  26  30
  //   L    105 95  87  79  70  67  54  45  39  26  19(bg)
  // (L−bg)/(edge−bg) 归一化后就是右边这一列。
  HALO: [
    [0.000, 1.000], [0.013, 0.884], [0.025, 0.791], [0.038, 0.698],
    [0.051, 0.593], [0.064, 0.558], [0.076, 0.407], [0.102, 0.302],
    [0.127, 0.233], [0.166, 0.081], [0.191, 0.000],
  ],
};

/** 边光强度：0 在轮廓上，1 是完全回到背景。表内线性插值。 */
export function haloAlpha(dOverR) {
  const t = Math.abs(dOverR);
  const T = ATMO.HALO;
  if (t >= T[T.length - 1][0]) return 0;
  for (let i = 1; i < T.length; i++) {
    if (t <= T[i][0]) {
      const [x0, y0] = T[i - 1], [x1, y1] = T[i];
      const k = (t - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * k;
    }
  }
  return 0;
}

const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * 边光颜色：**一个常数**，衰减全靠 alpha。
 *
 * 第一版这里又调了一次颜色（edge → haloMid → bg），结果半宽只有 3.2% R，
 * 是片子的一半 —— 因为 alpha 和颜色在同时衰减，两次相乘等于把曲线平方了。
 * 而 "edge 混到 bg" 本身就等于 haloOuter：0.5×(81,110,142)+0.5×(13,22,35)
 * = (47,66,88)，正好是量到的 (41,60,83)。所以颜色不需要动。
 */
export function haloColor(a) {
  return a <= 0 ? ATMO.bg.slice() : ATMO.edge.slice();
}

/* ---- 云壳 ---------------------------------------------------------- */

function h2(x, y) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * 云：球面经纬坐标 + 两层不同速度、不同尺度的噪声。
 * 两层是**互相穿过**的（速度不同方向也不同），所以云看起来在"长"而不是在平移
 * —— 这是片子里云的变化方式。
 */
export function cloudField(lon, lat, t, seed = 0) {
  const a = vnoise(lon * 5.0 + t * 0.021 + seed, lat * 5.0 - t * 0.008);
  const b = vnoise(lon * 11.0 - t * 0.037 - seed * 3, lat * 11.0 + t * 0.014);
  const c = vnoise(lon * 2.3 + t * 0.005, lat * 2.3 + seed);
  // 阈值化而不是线性混：片子里的云边界清楚，不是一层薄雾
  const v = a * 0.52 + b * 0.26 + c * 0.22;
  return smoothstep(0.52, 0.66, v);
}

export function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * 海陆：只用两个阈值，不要连续渐变 —— 片子里海岸线是硬的，浅海带很窄。
 */
export function terrainColor(n) {
  if (n > 0.615) return ATMO.land;
  if (n > 0.53) return ATMO.shallow;
  return ATMO.ocean;
}

/** 一颗球的软阴影：光源在左上，边缘压暗但**不压到黑**（片子里暗侧仍有 ~45 亮度）。 */
export function sphereShade(nx, ny, nz, light = [-0.45, 0.55, 0.7]) {
  const d = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
  return 0.42 + 0.58 * d;
}
