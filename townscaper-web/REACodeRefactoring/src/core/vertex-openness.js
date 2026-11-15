/**
 * vertex-openness.js — 第 56 批 C04：798580832906739712「Some dirt cheap (and highly inaccurate) ray marching.
 * Might use it for visibility when indoors」。
 *
 * 片子（64 帧）：整栋灰模楼**逐顶点**是灰度——室内、洞口深处、楼下暗，外墙和屋顶亮；黄色射线从一个点扇出。
 * space-visibility.js 已有单点射线开阔度和"每格地面一个灰点"；这里把同一套固定步长 ray march 烘到**网格顶点**上：
 *   顶点沿法线抬一点作起点 → 法线半球内 K 条斐波那契方向 → 固定步长查共享 World 实心位，命中即停 →
 *   value = 平均(命中距离 / maxDist)。便宜、不准（会漏薄墙，片子原话 highly inaccurate），只读 World。
 * 位置量化去重：非索引网格同一个角会被多个三角形重复，只算一次。
 */
import { fibonacciDirections } from './space-visibility.js';

export function bakeVertexOpenness(world, index, positions, normals, { count = 16, maxDist = 2.4, step = .15, levelHeight = .5, lift = .06, budget = 6e6 } = {}) {
  if (!world || typeof index?.cellAt !== 'function') throw new TypeError('World + cell index required');
  if (!(positions?.length % 3 === 0) || normals?.length !== positions.length) throw new RangeError('positions/normals mismatch');
  if (![maxDist, step, levelHeight, lift].every(Number.isFinite) || maxDist <= 0 || step <= 0 || levelHeight <= 0 || lift < 0) throw new RangeError('openness settings');
  const dirs = fibonacciDirections(count), steps = Math.ceil(maxDist / step), L = levelHeight;
  const solid = (x, y, z) => { if (y < 0) return true; const c = index.cellAt(x, z); return !!(c && world.isSolid(c, Math.floor(y / L) + 1)); };
  const n = positions.length / 3, out = new Float32Array(n), cache = new Map();
  let probes = 0, unique = 0;
  for (let v = 0; v < n; v++) {
    const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
    let nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    // 量化：位置 1/64、法线 1/4（同一角、同一朝向的面共享一个值；不同朝向的面不混）
    const key = Math.round(px * 64) + ',' + Math.round(py * 64) + ',' + Math.round(pz * 64) + '|' + Math.round(nx * 4) + ',' + Math.round(ny * 4) + ',' + Math.round(nz * 4);
    const hit = cache.get(key);
    if (hit !== undefined) { out[v] = hit; continue; }
    if (probes > budget) throw new RangeError('openness budget exceeded');
    unique++;
    const ox = px + nx * lift, oy = py + ny * lift, oz = pz + nz * lift;
    let sum = 0;
    for (const d of dirs) {
      // 只看法线半球：背面方向翻到正面（不然一半射线一出门就撞自己）
      const s = d.x * nx + d.y * ny + d.z * nz < 0 ? -1 : 1, dx = d.x * s, dy = d.y * s, dz = d.z * s;
      let dist = maxDist;
      for (let i = 1; i <= steps; i++) { const t = Math.min(i * step, maxDist); probes++; if (solid(ox + dx * t, oy + dy * t, oz + dz * t)) { dist = t; break; } }
      sum += dist / maxDist;
    }
    const val = sum / count; cache.set(key, val); out[v] = val;
  }
  let mn = Infinity, mx = -Infinity, mean = 0; for (const x of out) { mn = Math.min(mn, x); mx = Math.max(mx, x); mean += x; }
  return { values: out, stats: { vertices: n, unique, probes, min: n ? mn : NaN, max: n ? mx : NaN, mean: n ? mean / n : NaN } };
}
