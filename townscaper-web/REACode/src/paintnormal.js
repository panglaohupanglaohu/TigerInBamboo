/**
 * paintnormal.js — "画"出来的法线：大块笔触，每块一个朝向，跟几何无关。
 *
 * 原文（x.com/OskSta/status/1481661852887265288, 2022-01-13）：
 *
 *   "The textures are: 1. Normals (procedurally painted in big chunky strokes)
 *    2. 3D Signed Distance Field 3. 3D Ambient Occlusion in positive and negative
 *    X,Y and Z"
 *
 * 画面实测（这张图左上角的调试贴图，640² 原帧放大看）：
 *   · 法线图是**彩色大块**：绿、粉、蓝、橙、灰，块内颜色几乎不变，块边界是硬的
 *     （不是渐变过渡），块宽约占贴图的 1/8~1/6；
 *   · 同一块里没有任何内部结构 —— 也就是说它不是"从高度场算出来的法线"，
 *     而是**先分块、再给每块一个随机倾斜**；
 *   · 岛本体是低模（能看见大平面），但明暗在平面上有起伏 —— 那就是这些块在起作用。
 *
 * 为什么这么做：低模 + 程序化绘制的时候，几何法线太平（整块面一个朝向），
 * 高模又太贵。把"细节"放进法线贴图里，几何一点不用改，轮廓（silhouette）
 * 完全不变 —— 这正是原片岛的样子：边缘是硬折线，面上却是碎的。
 *
 * 本文件不 import three；产出 Uint8Array（RGB，切线空间，z 朝外）。
 * `audit()` 给出块数、块宽、平均倾斜角、以及"平面上明暗方差"——
 * 最后这个数是关键：几何完全平，明暗却有方差，说明细节是从贴图来的。
 */

import { rng } from './bouncegi.js';

/** 便宜的 2D 哈希（用来给每个 Voronoi 胞一个稳定的随机朝向）。 */
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2654435761) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/**
 * 画一张大块法线图。
 *
 * 步骤（对应原文的 "big chunky strokes"）：
 *   1. 撒 N 个种子（抖动网格，避免纯随机的聚簇）；
 *   2. 每个像素找最近种子（Voronoi），得到胞 id；
 *   3. 每个胞一个随机倾斜向量，长度 = tan(maxTilt)·随机；
 *   4. 在胞边界处按 (d2−d1) 做一点柔化 —— 但不能柔太多，否则就不"chunky"了。
 *      原片块边界只有 1~2px 的过渡，所以这里的柔化半径是 0.02 个格。
 *
 * @returns {{size:number, rgb:Uint8Array, chunks:number, chunkPx:number}}
 */
export function paintNormal({
  size = 128, chunks = 24, maxTiltDeg = 26, softness = 0.03, seed = 7, flat = 0.0,
} = {}) {
  const rnd = rng(seed);
  const g = Math.max(2, Math.round(Math.sqrt(chunks)));
  const seeds = [];
  for (let j = 0; j < g; j++) {
    for (let i = 0; i < g; i++) {
      const jx = (rnd() - 0.5) * 0.7;
      const jy = (rnd() - 0.5) * 0.7;
      seeds.push({
        x: ((i + 0.5 + jx) / g) * size,
        y: ((j + 0.5 + jy) / g) * size,
        // 倾斜：随机方位 + 随机大小
        a: rnd() * Math.PI * 2,
        m: (0.35 + 0.65 * rnd()) * Math.tan((maxTiltDeg * Math.PI) / 180),
        id: i + j * g,
      });
    }
  }
  const rgb = new Uint8Array(size * size * 3);
  const chunkPx = size / g;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 最近 + 次近（周期边界：贴图要能平铺）
      let d1 = 1e9, d2 = 1e9, best = null;
      for (const s of seeds) {
        let dx = Math.abs(x - s.x), dy = Math.abs(y - s.y);
        dx = Math.min(dx, size - dx);
        dy = Math.min(dy, size - dy);
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; best = s; }
        else if (d < d2) d2 = d;
      }
      // 边界柔化：只在 |d2−d1| 很小的薄带里混
      const edge = Math.max(0, 1 - (d2 - d1) / (chunkPx * softness));
      const m = best.m * (1 - edge * 0.85);
      let nx = Math.cos(best.a) * m;
      let ny = Math.sin(best.a) * m;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx = nx / len * (1 - flat);
      ny = ny / len * (1 - flat);
      const nzz = nz / len + flat * 0.999;
      const i = (y * size + x) * 3;
      rgb[i] = Math.round((nx * 0.5 + 0.5) * 255);
      rgb[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      rgb[i + 2] = Math.round((nzz * 0.5 + 0.5) * 255);
    }
  }
  return { size, rgb, chunks: seeds.length, chunkPx, maxTiltDeg };
}

/**
 * 用一张法线图给平面着色 —— 只为了量"平面上有没有细节"。
 * 光方向固定，返回每像素亮度（0..1）。
 */
export function shadeWithNormals(map, { sun = { x: -0.55, y: 0.62, z: 0.56 }, albedo = 0.8 } = {}) {
  const { size, rgb } = map;
  const L = Math.hypot(sun.x, sun.y, sun.z);
  const sx = sun.x / L, sy = sun.y / L, sz = sun.z / L;
  const out = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    let nx = rgb[i * 3] / 255 * 2 - 1;
    let ny = rgb[i * 3 + 1] / 255 * 2 - 1;
    let nz = rgb[i * 3 + 2] / 255 * 2 - 1;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    // 切线空间的 z 朝外 → 世界法线基本是 +Y 方向，把 (x,y,z) 映射到 (x, z, y)
    const wx = nx, wy = nz, wz = ny;
    const ndl = Math.max(0, wx * sx + wy * sy + wz * sz);
    out[i] = albedo * ndl;
  }
  return out;
}

/** 平几何（法线全朝上）的对照着色，用来算方差基线。 */
export function shadeFlat(size, { sun = { x: -0.55, y: 0.62, z: 0.56 }, albedo = 0.8 } = {}) {
  const L = Math.hypot(sun.x, sun.y, sun.z);
  const v = albedo * Math.max(0, sun.y / L);
  return new Float32Array(size * size).fill(v);
}

export function stats(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  const m = s / a.length;
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m);
  return { mean: m, std: Math.sqrt(v / a.length) };
}

/**
 * 验收：
 *  · 平面上明暗标准差 —— 几何是平的，标准差越大说明"画上去的细节"越强；
 *  · 轮廓不变 —— 法线图不碰几何，所以 silhouette 变化恒为 0（这一点在
 *    LEARNING.md 里写清楚：它换的是"面上碎不碎"，不是"边在哪里"）；
 *  · 块宽 / 块数 / 平均倾斜角 —— 拿去和参考片比对。
 */
export function audit({ size = 128, chunksList = [9, 16, 24, 36], maxTiltDeg = 26 } = {}) {
  const rows = [];
  for (const chunks of chunksList) {
    const map = paintNormal({ size, chunks, maxTiltDeg });
    const lit = shadeWithNormals(map);
    const flat = shadeFlat(size);
    const sl = stats(lit), sf = stats(flat);
    // 平均倾斜角：从法线图直接反算
    let sum = 0, n = 0;
    for (let i = 0; i < size * size; i++) {
      const nz = map.rgb[i * 3 + 2] / 255 * 2 - 1;
      sum += Math.acos(Math.min(1, Math.abs(nz))) * 180 / Math.PI;
      n++;
    }
    // 有多少像素的亮度跟"平几何"差 5% 以上 —— 比 std 好读：它直接回答
    // "面上有多少地方看得出是画上去的"，而 std 会被块数稀释。
    let changed = 0;
    for (let i = 0; i < lit.length; i++) if (Math.abs(lit[i] - flat[i]) > 0.05) changed++;
    rows.push({
      chunks: map.chunks,
      chunkPx: +map.chunkPx.toFixed(1),
      meanTiltDeg: +(sum / n).toFixed(1),
      litStd: +sl.std.toFixed(4),
      litMean: +sl.mean.toFixed(3),
      flatStd: +sf.std.toFixed(4),
      pctPixelsChanged: +((changed / lit.length) * 100).toFixed(1),
      silhouetteChange: 0,
    });
  }
  return { rows, size, maxTiltDeg };
}
