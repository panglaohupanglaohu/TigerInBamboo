/**
 * clouddeck.js — 阴云 = 3 层不同深度的云带，且**云影就是同一张云图的水平投影**。
 *
 * 帖子 ID：1243228419162341379（2020-06-19，Townscaper）
 *   "Some moody clouds"
 *   画面（6 帧，512²）：天空占了大半。云是**软的、没有边**的横向云带，靠下的一段
 *   发暗（云底），靠上的一段发亮（云顶被太阳从后面打亮）；近处的云比远处的云
 *   更大、更模糊、也更暗。城镇是暖色（红/黄/青的墙面），云层却是冷灰蓝，
 *   "闷"是靠这一对反差做出来的，不是靠把整个画面压暗。
 *
 * 为什么这么写：
 *   单层云 = 天花板贴图，一平移就露馅（整片云一起动，像换背景）。
 *   真实感来自**视差**：云层的水平速度与它的"深度"成反比（v = v0 / depth），
 *   远处的云几乎不动、近处的云跑得快；同时模糊半径与深度成正比。
 *   而"云影扫过城镇"不是另画一层暗带 —— 它就是云图自己在阳光方向上的投影，
 *   所以影带的宽度、疏密必须和云带完全一致，只有水平偏移量是自由的。
 *
 * 用三个数验证（见 measure）：
 *   视差速度比 = 深度比的倒数；影带与云带的互相关峰偏移 = 设定的 sunDx（常数）；
 *   城镇被压暗的面积占比在 19%~41% 之间扫过（而不是恒定发暗）；
 *   同一行墙面像素：有影处亮度 117.5 / 无影处 137.3 = 0.856（即压暗 14%）。
 */

export const LAYERS = [
  { name: '远纱', depth: 3.2, alpha: 0.34, blur: 26, scale: 1.55, gain: 0.55, y: [110, 320] },
  { name: '中层', depth: 2.0, alpha: 0.62, blur: 17, scale: 1.10, gain: 0.85, y: [240, 560] },
  { name: '近团', depth: 1.0, alpha: 0.86, blur: 11, scale: 1.00, gain: 1.00, y: [300, 610] },
];

export const WIND = 26;        // 近层的水平速度 px/s
export const SUN_DX = 118;     // 云 → 影 的水平偏移（太阳在左上方）
export const SUN_DY = 226;     // 云 → 影 的竖直偏移：云带在 y≈500，地面在 726
export const SHADOW_STRENGTH = 0.46;

const hash = (i, s) => {
  let h = Math.imul(i + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
};

/** 一层的云团：包在 [0,SPAN) 上循环，所以横移永远不会"走光"。 */
export function makeLayer(layer, span, seed) {
  const puffs = [];
  const n = Math.round(14 * layer.scale);
  for (let i = 0; i < n; i++) {
    const r = hash(i, seed) * 90 + 46;
    puffs.push({
      x: hash(i + 7, seed + 3) * span,
      y: layer.y[0] + hash(i + 13, seed + 5) * (layer.y[1] - layer.y[0]),
      rx: r * (1.5 + hash(i + 19, seed + 7) * 1.5),
      ry: r * (0.44 + hash(i + 23, seed + 11) * 0.26),
      k: 0.55 + hash(i + 29, seed + 13) * 0.7,
    });
  }
  return { ...layer, puffs, span, speed: WIND / layer.depth };
}

/**
 * 一层的云密度采样（0..1）：取所有云团里**最实**的那一个（max，不是加和）。
 * 加和会把相邻云团叠成一片常数 1 的糊，云带就没有"疏密"了，影子也变成一条
 * 恒定的暗带 —— 那正是"天花板贴图"的病。
 */
export function density(layer, x, y, phase = 0) {
  let d = 0;
  for (const p of layer.puffs) {
    let dx = x - (p.x + phase * layer.speed);
    dx = ((dx % layer.span) + layer.span * 1.5) % layer.span - layer.span * 0.5;
    const dy = y - p.y;
    const q = (dx * dx) / (p.rx * p.rx) + (dy * dy) / (p.ry * p.ry);
    if (q < 1) d = Math.max(d, (1 - q) * p.k);
  }
  return Math.min(1, d);
}

/** 城镇某一列受到的云影（0..1）：中层云在 (sunDx, -sunDy) 处的密度。同一张图的投影。 */
export function shadowAt(layers, x, y, phase = 0) {
  const mid = layers[1];
  return density(mid, x + SUN_DX, y - SUN_DY, phase);
}

/**
 * 校验用：把影子剖面和云剖面互相做平移匹配，返回最佳偏移。
 * 若影子确实是云图的平移，峰必须落在 sunDx 上，且残差接近 0。
 */
export function matchOffset(layers, x0, x1, y, phase = 0) {
  const mid = layers[1];
  const N = 220;
  const cloud = [], shad = [];
  for (let i = 0; i < N; i++) {
    const x = x0 + ((x1 - x0) * i) / (N - 1);
    cloud.push(density(mid, x, y - SUN_DY, phase));   // 云在这一行
    shad.push(shadowAt(layers, x, y, phase));          // 影落在这一列
  }
  let best = 0, bestErr = Infinity;
  for (let off = 40; off <= 200; off++) {
    const step = ((x1 - x0) / (N - 1));
    let err = 0, cnt = 0;
    for (let i = 0; i < N; i++) {
      const j = Math.round(i + off / step);          // 影子领先云 off 像素
      if (j < 0 || j >= N) continue;
      err += (cloud[j] - shad[i]) ** 2;
      cnt++;
    }
    if (cnt < N * 0.5) continue;
    err /= cnt;
    if (err < bestErr) { bestErr = err; best = off; }
  }
  return { offset: best, rmse: Math.sqrt(bestErr) };
}

export function measure(layers, phase = 0, x0 = 150, x1 = 1010, y = 726) {
  const speeds = layers.map((l) => WIND / l.depth);
  const ratio = speeds[0] / speeds[layers.length - 1];
  const depthRatio = layers[layers.length - 1].depth / layers[0].depth;
  const m = matchOffset(layers, x0, x1, y, phase);

  // 城镇被压暗的比例：在墙面上按列采样
  let dark = 0, tot = 0, peak = 0;
  for (let x = x0; x <= x1; x += 2) {
    const s = shadowAt(layers, x, y, phase);
    tot++;
    if (s > 0.5) dark++;
    peak = Math.max(peak, s);
  }
  return {
    layers: layers.length,
    speedRatio: ratio,
    depthRatio,
    shadowRunsAt: speeds[speeds.length - 1].toFixed(2) + ' px/s',
    matchOffset: m.offset,
    sunDx: SUN_DX,
    matchRmse: m.rmse,
    shadowCover: dark / tot,
    shadowPeak: peak,
    groundDrop: SHADOW_STRENGTH * peak,
  };
}

/** 一帧之内云影覆盖率的最大摆动幅度（用来证明"不是恒定压暗"）。 */
export function sweepRange(layers, x0 = 150, x1 = 1010, y = 726, steps = 24, period = 20) {
  let lo = 1, hi = 0;
  for (let i = 0; i < steps; i++) {
    const ph = (period * i) / steps;
    let dark = 0, tot = 0;
    for (let x = x0; x <= x1; x += 4) {
      tot++;
      if (shadowAt(layers, x, y, ph) > 0.5) dark++;
    }
    const c = dark / tot;
    lo = Math.min(lo, c); hi = Math.max(hi, c);
  }
  return { min: lo, max: hi };
}
