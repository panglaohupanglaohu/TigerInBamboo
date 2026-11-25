/**
 * shorefield.js — 岸线距离场。独立原版 `buildShoreDistance` API 的逐式移植
 * （残差核销：clip 1664566546683899905 原记录「独立原版buildShoreDistance API未迁移」）。
 *
 * 裁判 = REACode/engine/shorefield.js，来源注记照抄：
 *
 *   1664566546683899905  "Here's a distance field-like mesh skirt solution
 *   very similar to Townscaper and Bad North. It works for calm waters I
 *   guess..."
 *
 * A skirt built by offsetting the coastline along its normals breaks down in
 * bays: two normal rays cross, the band folds over itself, and the foam gets
 * pinched. A distance field has no such failure — every ring sits at a true
 * distance from land, so it widens in bays and tightens on headlands.
 *
 * Implementation: rasterise the land mask, run a two-pass chamfer distance
 * transform over the water cells, then let a ray-march find where a given
 * distance is reached. No marching squares needed.
 *
 * 与原版同口径 / 本仓差异（如实标，不冒充逐字相同）：
 *   · 原版内部用 REACode/src/town.js 的 buildCellIndex（桶 4，`at` 回 3×3 邻域
 *     候选）。本仓 core/spatial.js 的 buildCellIndex 桶 2、`at` 只回所在桶——
 *     两者都返回「覆盖该点的全部格子」的超集（格子的包围盒必然覆盖所在桶），
 *     pointInQuad 过滤后陆地掩码逐位一致；tests/shorefield-referee.mjs 对拍
 *     sample/march 输出 maxDiff=0。
 *   · 原版 pointInQuad 只按前 4 个角巡边（它的网格全是四边形）；本仓
 *     core/spatial.js 的 pointInQuad 按 pts.length 巡边，四边形上逐式相同，
 *     三角/合并多边形也能算（裁判在那类输入上反而会崩）。
 *   · 原版不验参：本仓惯例补 RangeError（res/pad 非法、格子未 decorate 出
 *     minX/maxX、栅格超预算）。budget=4_000_000 与 water/shore.js 内部
 *     distanceField 的 4M 栅格预算同口径。
 *   · 返回面与原版同形 { sample, march, res, origin, size }；另挂诊断字段
 *     { w, h, land, field }（Uint8Array 陆地掩码 / Float32Array 距离场，
 *     供测试逐格对拍；原调用方只取 sample/march，不受影响）。
 *   · 与 water/shore.js 的关系：shore.js 内部 distanceField 是另一套（按陆地
 *     顶点定界、支持 shape 形变、march 走 core/shore-profile.js 的
 *     marchShore），保留不动。本模块是原版 API 形状的独立场，sample/march
 *     两成员签名与 shore.js 内部场一致，可做它的平替注入。
 */
import { buildCellIndex, pointInQuad } from '../core/spatial.js';

/**
 * Rasterise land coverage by testing every sample against the actual quads.
 * Marking cell bounding boxes instead (the obvious shortcut) fattens every
 * headland by half a cell, and the skirt then sits visibly offshore.
 * —— 逐式移植：格心采样 + index.at 候选 + town.top + pointInQuad。
 */
function rasterise(town, grid, { origin, size, res, index, budget }) {
  const w = Math.ceil(size / res);
  const h = w;
  if (!Number.isSafeInteger(w * h) || w * h > budget) throw new RangeError('shorefield raster budget');
  const land = new Uint8Array(w * h);

  for (let j = 0; j < h; j++) {
    const z = origin.z + (j + 0.5) * res;
    for (let i = 0; i < w; i++) {
      const x = origin.x + (i + 0.5) * res;
      for (const cell of index.at(x, z)) {
        if (town.top(cell) === 0) continue;
        if (pointInQuad(cell.pts, x, z)) { land[j * w + i] = 1; break; }
      }
    }
  }
  return { land, w, h };
}

/**
 * Two-pass chamfer distance transform (3-4 metric, then scaled).
 * Distance is measured from land, in world units, only meaningful over water.
 * —— 逐式移植：a=1、b=√2、正向两遍 + 反向两遍、末尾乘 res。
 */
function chamfer({ land, w, h }, res) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = land[i] ? 0 : INF;

  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (d[k] === 0) continue;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + a);
      if (j > 0) v = Math.min(v, d[k - w] + a);
      if (i > 0 && j > 0) v = Math.min(v, d[k - w - 1] + b);
      if (i < w - 1 && j > 0) v = Math.min(v, d[k - w + 1] + b);
      d[k] = v;
    }
  }
  for (let j = h - 1; j >= 0; j--) {
    for (let i = w - 1; i >= 0; i--) {
      const k = j * w + i;
      if (d[k] === 0) continue;
      let v = d[k];
      if (i < w - 1) v = Math.min(v, d[k + 1] + a);
      if (j < h - 1) v = Math.min(v, d[k + w] + a);
      if (i < w - 1 && j < h - 1) v = Math.min(v, d[k + w + 1] + b);
      if (i > 0 && j < h - 1) v = Math.min(v, d[k + w - 1] + b);
      d[k] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] *= res;
  return d;
}

/**
 * @param town 任何暴露 top(cell)→level 的体素图（REACode Town、core/town-graph
 *   Town 或等价的查询对象都行；原版只调 town.top）。
 * @param grid cells 已 decorate（minX/maxX/minZ/maxZ、pts）。
 * @returns {{sample:(x:number,z:number)=>number, march:(x,z,nx,nz,target,maxTravel?)=>number,
 *   res:number, origin:{x,z}, size:number, w:number, h:number,
 *   land:Uint8Array, field:Float32Array}} 前五个成员与原版 API 同形。
 */
export function buildShoreDistance(town, grid, { res = 0.12, pad = 3, budget = 4_000_000 } = {}) {
  if (!(res > 0) || !Number.isFinite(res) || !(pad >= 0) || !Number.isFinite(pad) || !(budget > 0)) throw new RangeError('shorefield options');
  if (!town || typeof town.top !== 'function') throw new RangeError('shorefield town');
  if (!grid || !Array.isArray(grid.cells) || grid.cells.length === 0) throw new RangeError('shorefield grid');

  const index = buildCellIndex(grid);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) throw new RangeError('shorefield grid undecorated');
  const origin = { x: minX - pad, z: minZ - pad };
  const size = Math.max(maxX - minX, maxZ - minZ) + pad * 2;

  const raster = rasterise(town, grid, { origin, size, res, index, budget });
  const field = chamfer(raster, res);

  const sample = (x, z) => {
    const fi = (x - origin.x) / res;
    const fj = (z - origin.z) / res;
    if (fi < 0 || fj < 0 || fi >= raster.w - 1 || fj >= raster.h - 1) return 1e9;
    const i = fi | 0;
    const j = fj | 0;
    // bilinear: the field is used for placement, so smoothness matters more
    // than exactness
    const tx = fi - i;
    const tz = fj - j;
    const d00 = field[j * raster.w + i];
    const d10 = field[j * raster.w + i + 1];
    const d01 = field[(j + 1) * raster.w + i];
    const d11 = field[(j + 1) * raster.w + i + 1];
    return (d00 * (1 - tx) + d10 * tx) * (1 - tz) + (d01 * (1 - tx) + d11 * tx) * tz;
  };

  /**
   * Walk from a shore point along (nx,nz) until the field reaches `target`.
   * Returns the travelled distance. Bisection over a bracketed march: cheap,
   * and the field is monotone enough at these scales.
   * —— 逐式移植：步进 res·0.75、封顶 maxTravel=4、12 次二分。
   */
  const march = (x, z, nx, nz, target, maxTravel = 4) => {
    let lo = 0;
    let hi = 0;
    let step = res * 0.75;
    while (hi < maxTravel && sample(x + nx * hi, z + nz * hi) < target) hi += step;
    if (hi >= maxTravel) return maxTravel;
    lo = Math.max(0, hi - step);
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2;
      if (sample(x + nx * mid, z + nz * mid) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return { sample, march, res, origin, size, w: raster.w, h: raster.h, land: raster.land, field };
}
