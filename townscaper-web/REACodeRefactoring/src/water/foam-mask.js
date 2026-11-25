/**
 * foam-mask.js — 第 56 批 C10：海面「全局水面遮罩」与「绕岛障碍染料流」，两件都是纯 CPU 数据，View 那边只负责贴图。
 *
 *   1849732997945110651 原文："There is also a global water mask texture that adds extra foam around rocks and stuff."
 *     → buildFoamMask：把 World 第 1 层（触水的柱子）按真实四边形栅格化成 land 掩码，chamfer 距离 d、
 *       盒式模糊得到局部陆地占比 L。泡沫 = 近岸衰减 exp(-d/falloff) × 暴露度 (1 - L 的归一化)：
 *       突出的岬角 / 海中独石 L 小 → 泡沫多；深湾里 L 大 → 泡沫少。这就是「around rocks」的那一份额外泡沫；
 *       岸浪本身（shore.js 的分段浪带）不变。原作具体公式原文没说，这里是程序化替代，写明是本地设计。
 *
 *   1664565063552847873 原文："I'm trying out using a shader based fluid simulation ... feed back to CPU if needed."
 *     片子：岛周围青/洋红/黄色染料场绕着地形流动。core/float-advect.js（r55）只有固定涡旋、没有障碍。
 *     → ObstacleFlow：同一 land 栅格当固壁；均匀来流 U 在 MAC 交错网格上置零陆地面通量、SOR 解压力泊松做一次投影，
 *       得到绕岛无散度流（迎流面驻点、两侧加速、背流汇合）；陆地速度 0、染料不进陆地。半拉格朗日推进，
 *       回溯出界取解析入流色带（入流边界），可选按 f16/f32 存储取整（复用 float-advect.roundHalf）比较精度。
 *       速度场是静态势流投影，不是逐帧 Navier–Stokes；CPU 跑，GPU 精度对表见 world/float-advect-gpu.js。
 */
import { pointInQuad } from '../core/spatial.js';
import { roundHalf } from '../core/float-advect.js';

/** 把 cells 中 isLand 的多边形栅格化。ptsOf(c) 返回 [{x,z}]。 */
export function rasterLand(cells, isLand, ptsOf = (c) => c.pts, { res = 0.08, pad = 2.5, budget = 2_000_000 } = {}) {
  if (!(res > 0) || !(pad >= 0)) throw new RangeError('rasterLand options');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const land = [];
  for (const c of cells) {
    if (!isLand(c)) continue;
    const pts = ptsOf(c); land.push(pts);
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  }
  if (!land.length) return null;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const W = Math.ceil((maxX - minX) / res) + 1, H = Math.ceil((maxZ - minZ) / res) + 1;
  if (W * H > budget) throw new RangeError('foam mask budget');
  const mask = new Uint8Array(W * H);
  for (const pts of land) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    for (let j = Math.max(0, Math.floor((z0 - minZ) / res)); j <= Math.min(H - 1, Math.ceil((z1 - minZ) / res)); j++)
      for (let i = Math.max(0, Math.floor((x0 - minX) / res)); i <= Math.min(W - 1, Math.ceil((x1 - minX) / res)); i++)
        if (pointInQuad(pts, minX + i * res, minZ + j * res)) mask[j * W + i] = 1;
  }
  return { W, H, minX, minZ, res, mask };
}

/** 两遍 chamfer（1, √2），返回世界单位距离；陆地 = 0。 */
export function chamferDistance({ W, H, res, mask }) {
  const d = new Float32Array(W * H);
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? 0 : 1e9;
  const S = Math.SQRT2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; let v = d[k]; if (!v) continue;
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) { v = Math.min(v, d[k - W] + 1); if (i > 0) v = Math.min(v, d[k - W - 1] + S); if (i < W - 1) v = Math.min(v, d[k - W + 1] + S); }
    d[k] = v;
  }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
    const k = j * W + i; let v = d[k]; if (!v) continue;
    if (i < W - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < H - 1) { v = Math.min(v, d[k + W] + 1); if (i < W - 1) v = Math.min(v, d[k + W + 1] + S); if (i > 0) v = Math.min(v, d[k + W - 1] + S); }
    d[k] = v;
  }
  for (let k = 0; k < d.length; k++) d[k] *= res;
  return d;
}

/** 方形窗口内陆地占比（积分图，O(WH)）。r 以格计。 */
export function landFraction({ W, H, mask }, r) {
  const I = new Float64Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) { let row = 0; for (let i = 0; i < W; i++) { row += mask[j * W + i]; I[(j + 1) * (W + 1) + i + 1] = I[j * (W + 1) + i + 1] + row; } }
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = Math.max(0, i - r), b = Math.min(W, i + r + 1), c = Math.max(0, j - r), e = Math.min(H, j + r + 1);
    out[j * W + i] = (I[e * (W + 1) + b] - I[c * (W + 1) + b] - I[e * (W + 1) + a] + I[c * (W + 1) + a]) / ((b - a) * (e - c));
  }
  return out;
}

/**
 * 全局水面泡沫遮罩。返回 { W,H,minX,minZ,res, foam: Float32Array(0..1), dist, frac, stats }。
 * falloff：近岸泡沫的指数衰减长度；radius：判断「暴露 / 隐蔽」的窗口半径（世界单位）。
 */
export function buildFoamMask(raster, { falloff = 0.22, radius = 1.2, gain = 1.6 } = {}) {
  if (!raster) return null;
  if (!(falloff > 0) || !(radius > 0)) throw new RangeError('foam mask options');
  const { W, H, mask, res } = raster;
  const dist = chamferDistance(raster), frac = landFraction(raster, Math.max(1, Math.round(radius / res)));
  const foam = new Float32Array(W * H);
  let n = 0, sum = 0;
  for (let k = 0; k < foam.length; k++) {
    if (mask[k]) continue;
    const near = Math.exp(-dist[k] / falloff);
    if (near < 0.02) continue;
    // 直岸处 L≈0.5 → exposure≈0.5；独石 / 岬角 L→0 → 1；深湾 L→1 → 0
    const exposure = Math.min(1, Math.max(0, 1 - frac[k]));
    const f = Math.min(1, near * (0.25 + gain * exposure * exposure));
    foam[k] = f; n++; sum += f;
  }
  return { ...raster, foam, dist, frac, stats: { W, H, foamTexels: n, meanFoam: n ? sum / n : 0 } };
}

/**
 * 沿岸泡沫「白花簇」（第 183 轮，片 946660607008403456 · 946660607008403456 frame-0250 的 3× 裁切）：
 * 遮罩 `buildFoamMask` 给的是一条**连续**的近岸衰减带（距离场 × 暴露度），
 * 而原片沿岸带里是一簇簇**离散的白点**（看起来像白花），簇内 3–6 点、簇间距几倍点径。
 * 这里在「泡沫带内」按定种子撒簇：锚点取 band 内 foam 达标的格，簇内点按 spread 散开。
 * 只读遮罩、不写回 → 连续带与离散簇可以同时存在（A/B 由页面开关决定）。
 */
export function foamClusters(mask, { seed = 17, count = 60, inner = 0.06, outer = 0.6, specks = 4, spread = 0.12, minFoam = 0.25 } = {}) {
  if (!mask || !mask.foam) throw new RangeError('foamClusters needs foam mask');
  if (![seed, count, inner, outer, specks, spread, minFoam].every(Number.isFinite)) throw new RangeError('foamClusters options');
  if (count < 1 || specks < 0 || inner < 0 || !(outer > inner) || spread < 0 || minFoam < 0) throw new RangeError('foamClusters ranges');
  const { W, H, res, minX, minZ, mask: land, foam, dist } = mask;
  const cand = [];
  for (let k = 0; k < foam.length; k++) {
    if (land[k]) continue;
    const d = dist[k];                             // chamferDistance 末尾已乘过 res，本身就是世界单位
    if (d < inner || d > outer) continue;
    if (foam[k] < minFoam) continue;
    cand.push(k);
  }
  if (cand.length === 0) return { clusters: [], stats: { candidates: 0, clusters: 0, specks: 0, band: [inner, outer], meanDist: 0 } };
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clusters = [];
  let sumDist = 0;
  for (let i = 0; i < count; i++) {
    const k = cand[(r() * cand.length) | 0];
    const gx = k % W, gz = (k / W) | 0;
    const x = minX + (gx + 0.5) * res, z = minZ + (gz + 0.5) * res;
    const d = dist[k];
    sumDist += d;
    const pts = [];
    for (let j = 0; j <= specks; j++) {
      const ang = r() * Math.PI * 2, rad = j === 0 ? 0 : spread * Math.sqrt(r());
      pts.push({ x: x + Math.cos(ang) * rad, z: z + Math.sin(ang) * rad, r: res * (0.5 + 0.9 * r()), a: Math.min(1, foam[k] * (0.8 + 0.4 * r())) });
    }
    clusters.push({ x, z, dist: d, foam: foam[k], specks: pts });
  }
  return { clusters, stats: { candidates: cand.length, clusters: clusters.length, specks: clusters.length * (specks + 1), band: [inner, outer], meanDist: sumDist / clusters.length } };
}

/** 取遮罩在世界坐标 (x,z) 的双线性值（node 测试与 CPU 调试用）。 */
export function sampleGrid(g, arr, x, z) {
  const fi = (x - g.minX) / g.res, fj = (z - g.minZ) / g.res;
  if (fi < 0 || fj < 0 || fi >= g.W - 1 || fj >= g.H - 1) return 0;
  const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = j * g.W + i;
  return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + g.W] * (1 - tx) + arr[o + g.W + 1] * tx) * tz;
}

/** 绕陆地的染料流（片子 1664565063552847873 的绕岛色场）。 */
export class ObstacleFlow {
  constructor(raster, { speed = 0.6, angle = 0.6, storage = 'f32', iters = 700 } = {}) {
    if (!raster) throw new RangeError('ObstacleFlow needs land raster');
    if (!['f64', 'f32', 'f16'].includes(storage)) throw new RangeError('storage');
    Object.assign(this, { raster, speed, angle, storage });
    const { W, H } = raster;
    this.dist = chamferDistance(raster);
    this.vx = new Float32Array(W * H); this.vz = new Float32Array(W * H);
    this.dye = new Float32Array(W * H * 3); this.tmp = new Float32Array(W * H * 3);
    this.time = 0;
    this.setCurrent(angle, { iters });
    this.seed();
  }
  /**
   * 均匀来流 U → 绕陆地的无散度流：MAC 交错网格上把与陆地相邻的面通量置 0（固壁不可穿透），再解压力泊松方程
   * （SOR 迭代，域外 p=0）做一次投影，减去压力梯度。得到的是势流式「绕过去」的速度场：迎流面减速分流、
   * 两侧加速、背流面汇合。陆地格速度 0。是一次性静态投影，不是逐帧 Navier–Stokes。
   */
  setCurrent(angle, { iters = 700, omega = 1.85 } = {}) {
    const { W, H, res, mask } = this.raster;
    this.angle = angle;
    const ux = Math.cos(angle) * this.speed, uz = Math.sin(angle) * this.speed;
    const solid = (i, j) => i >= 0 && j >= 0 && i < W && j < H && mask[j * W + i] === 1;
    const U = new Float32Array((W + 1) * H), V = new Float32Array(W * (H + 1));   // U[j*(W+1)+i]：格 i-1 | i 之间；V[j*W+i]：格 j-1 | j 之间
    for (let j = 0; j < H; j++) for (let i = 0; i <= W; i++) U[j * (W + 1) + i] = solid(i - 1, j) || solid(i, j) ? 0 : ux;
    for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) V[j * W + i] = solid(i, j - 1) || solid(i, j) ? 0 : uz;
    const div = (i, j) => (U[j * (W + 1) + i + 1] - U[j * (W + 1) + i] + V[(j + 1) * W + i] - V[j * W + i]) / res;
    const maxDiv = () => { let m = 0; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!mask[j * W + i]) m = Math.max(m, Math.abs(div(i, j))); return m; };
    const divBefore = maxDiv();
    const P = new Float64Array(W * H), D = new Float64Array(W * H), N = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (mask[k]) continue;
      D[k] = res * res * div(i, j);
      N[k] = (!solid(i - 1, j)) + (!solid(i + 1, j)) + (!solid(i, j - 1)) + (!solid(i, j + 1));
    }
    const p = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 0 : P[j * W + i];   // 域外开边界 p=0
    for (let it = 0; it < iters; it++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (mask[k] || !N[k]) continue;
      let s = 0;
      if (!solid(i - 1, j)) s += p(i - 1, j); if (!solid(i + 1, j)) s += p(i + 1, j);
      if (!solid(i, j - 1)) s += p(i, j - 1); if (!solid(i, j + 1)) s += p(i, j + 1);
      P[k] += omega * ((s - D[k]) / N[k] - P[k]);
    }
    for (let j = 0; j < H; j++) for (let i = 0; i <= W; i++) if (!solid(i - 1, j) && !solid(i, j)) U[j * (W + 1) + i] -= (p(i, j) - p(i - 1, j)) / res;
    for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) if (!solid(i, j - 1) && !solid(i, j)) V[j * W + i] -= (p(i, j) - p(i, j - 1)) / res;
    let wallFlux = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (mask[k]) { this.vx[k] = this.vz[k] = 0; continue; }
      const l = U[j * (W + 1) + i], r = U[j * (W + 1) + i + 1], b = V[j * W + i], t = V[(j + 1) * W + i];
      if (solid(i - 1, j)) wallFlux = Math.max(wallFlux, Math.abs(l)); if (solid(i + 1, j)) wallFlux = Math.max(wallFlux, Math.abs(r));
      if (solid(i, j - 1)) wallFlux = Math.max(wallFlux, Math.abs(b)); if (solid(i, j + 1)) wallFlux = Math.max(wallFlux, Math.abs(t));
      this.vx[k] = (l + r) / 2; this.vz[k] = (b + t) / 2;
    }
    this.stats = { ...(this.stats || {}), divBefore, divAfter: maxDiv(), wallFlux, maxIntoAtShore: wallFlux };
  }
  /** 初值 / 入流边界：沿来流方向的平行色带（青 / 洋红 / 黄…），流过岛后色带被岸线拨弯、在背流面拖出尾迹——片子里那种绕地形的色场。 */
  seedAt(x, z, out, o) {
    const { W, H, minX, minZ, res } = this.raster, span = Math.hypot(W, H) * res;
    const q = ((x - minX - W * res / 2) * -Math.sin(this.angle) + (z - minZ - H * res / 2) * Math.cos(this.angle)) / span * this.bands;
    const h = ((q % 1) + 1) % 1 * 6;
    out[o] = Math.min(1, Math.max(0, Math.abs(h - 3) - 1)); out[o + 1] = Math.min(1, Math.max(0, 2 - Math.abs(h - 2))); out[o + 2] = Math.min(1, Math.max(0, 2 - Math.abs(h - 4)));
  }
  seed(bands = 2.5) {
    const { W, H, minX, minZ, res } = this.raster; this.bands = bands;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) this.seedAt(minX + i * res, minZ + j * res, this.dye, (j * W + i) * 3);
  }
  #store(v) { return this.storage === 'f16' ? roundHalf(v) : this.storage === 'f32' ? Math.fround(v) : v; }
  step(dt) {
    const { W, H, res, mask } = this.raster, src = this.dye, dst = this.tmp;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, o = k * 3;
      if (mask[k]) { dst[o] = src[o]; dst[o + 1] = src[o + 1]; dst[o + 2] = src[o + 2]; continue; }
      const x = i - this.vx[k] * dt / res, z = j - this.vz[k] * dt / res;
      // 回溯出界 = 从域外流入：取解析入流色带（入流边界条件），不钳边复制（钳边会把错位色带灌进来）
      if (x < 0 || z < 0 || x > W - 1.001 || z > H - 1.001) { this.seedAt(this.raster.minX + x * res, this.raster.minZ + z * res, dst, o); continue; }
      const i0 = x | 0, j0 = z | 0, tx = x - i0, tz = z - j0;
      const taps = [[i0, j0, (1 - tx) * (1 - tz)], [i0 + 1, j0, tx * (1 - tz)], [i0, j0 + 1, (1 - tx) * tz], [i0 + 1, j0 + 1, tx * tz]];
      let r = 0, g = 0, b = 0, wsum = 0;
      for (const [ii, jj, w] of taps) { const kk = jj * W + ii; if (mask[kk] || w <= 0) continue; r += src[kk * 3] * w; g += src[kk * 3 + 1] * w; b += src[kk * 3 + 2] * w; wsum += w; }
      if (wsum < 1e-6) { dst[o] = src[o]; dst[o + 1] = src[o + 1]; dst[o + 2] = src[o + 2]; continue; }   // 回溯点全落陆地：固壁，不从陆地吸色
      dst[o] = this.#store(r / wsum); dst[o + 1] = this.#store(g / wsum); dst[o + 2] = this.#store(b / wsum);
    }
    this.dye = dst; this.tmp = src; this.time += dt;
    return this;
  }
}

/**
 * 浪带路径穿岸审计（1849732997945110651「waves travel from the blue line to the yellow」）：每个浪带顶点从蓝线点 sea
 * 直线走到黄线点 shore；检查这段直线（跳过贴自家岸的起始陆地段）上有没有采样点落进栅格陆地。shore/sea 为 [x,z,x,z,…]。
 * 返回 { segments, crossing, ratio, worst }，worst ≈ 碰陆后路径上落在陆地的最大比例。只审计，不改几何。
 */
/** 沿 黄线→蓝线 采样：跳过贴着自家岸的起始陆地段（黄线就在岸脚，栅格取整会落进陆地），返回之后第一个陆地采样的 t，没有则 -1。 */
function firstLandHit(land, sx, sz, dx, dz, samples, skip) {
  let sawWater = false;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples, l = land(sx + dx * t, sz + dz * t);
    if (!l) sawWater = true; else if (sawWater || t > skip) return t;
  }
  return -1;
}
export function auditWavePaths(raster, shore, sea, { skip = 0.12, samples = 24 } = {}) {
  const { W, H, minX, minZ, res, mask } = raster, n = Math.min(shore.length, sea.length) / 2;
  let crossing = 0, worst = 0;
  const land = (x, z) => { const i = Math.round((x - minX) / res), j = Math.round((z - minZ) / res); return i >= 0 && j >= 0 && i < W && j < H && mask[j * W + i] === 1; };
  for (let v = 0; v < n; v++) {
    const sx = shore[v * 2], sz = shore[v * 2 + 1], ex = sea[v * 2], ez = sea[v * 2 + 1];
    const t0 = firstLandHit(land, sx, sz, ex - sx, ez - sz, samples, skip);
    if (t0 < 0) continue;
    let hits = 0;
    for (let s = 0; s <= samples; s++) { const t = t0 + (1 - t0) * s / samples; if (land(sx + (ex - sx) * t, sz + (ez - sz) * t)) hits++; }
    crossing++; worst = Math.max(worst, (1 - t0) * hits / (samples + 1));
  }
  return { segments: n, crossing, ratio: n ? crossing / n : 0, worst };
}

/**
 * 浪带路径防穿岸（auditWavePaths 的修复半）：沿 黄线→蓝线 找第一个陆地采样，把该顶点的蓝线点收回到碰陆之前，
 * 入射位移 aIn 与反射位移 aOut 同比缩放（bakeWaveMotion 对位移是线性的，所以方向不变、只变长度）。
 * 原地改 shore/sea/inc/out 四个 [x,z,…] 数组；返回被收回的顶点数。整条路径都在陆上时收到 minScale（浪几乎不可见）。
 */
export function clampWavePaths(raster, shore, sea, inc, out, { skip = 0.12, samples = 32, minScale = 0.04 } = {}) {
  const { W, H, minX, minZ, res, mask } = raster, n = shore.length / 2;
  const land = (x, z) => { const i = Math.round((x - minX) / res), j = Math.round((z - minZ) / res); return i >= 0 && j >= 0 && i < W && j < H && mask[j * W + i] === 1; };
  let clamped = 0;
  for (let v = 0; v < n; v++) {
    const sx = shore[v * 2], sz = shore[v * 2 + 1], dx = sea[v * 2] - sx, dz = sea[v * 2 + 1] - sz;
    const hit = firstLandHit(land, sx, sz, dx, dz, samples, skip);
    if (hit < 0) continue;
    const k = Math.max(minScale, hit - 1 / samples);
    sea[v * 2] = sx + dx * k; sea[v * 2 + 1] = sz + dz * k;
    inc[v * 2] *= k; inc[v * 2 + 1] *= k; out[v * 2] *= k; out[v * 2 + 1] *= k;
    clamped++;
  }
  return clamped;
}
