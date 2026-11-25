/**
 * bake.js — 分层遮蔽 + 彩色反弹光（Placemaker.AoBaker），地形和建筑共用。
 *
 * 1168571866405097472："The occlusion lives in a layered mesh that's reprojected
 *   to a texture at each change. That texture is then blurred, and sampled in
 *   the vertex shader of whatever needs lighting."
 * 1237305125070426112：colored "bounce" "light" —— 白墙旁边染上邻居的颜色。
 *
 * 做法：每一层一张占用栅格（同时存这一格的颜色）→ 盒式模糊两遍（≈高斯）→
 * 每个顶点沿面法线外移一点采样，按占用度压暗、按邻居颜色加一点反弹。
 *
 * 结构对应原文两半：buildOcclusionField() 是「分层网格重投影成纹理 + 模糊」，
 * bakeLighting() 是「顶点采样」（voxel-field.js 另有同一套取样的顶点着色器版）。
 * bakeLighting({field}) 直接吃一张已经建好的场——配合 src/light/field-cache.js
 * 的逐次重投影，改动一格不必再全量重建（只读裁判 src/lightingcache.js 同机制）。
 */

import { pointInQuad } from '../core/spatial.js';
import { MAX_LEVEL } from '../core/world.js';
import { clamp } from '../core/noise.js';

/**
 * 「重投影成纹理 + 模糊」那半步：把 world 里有东西的格逐层栅格化成分层占用
 * （RGBA = 占用/颜色三份），再对每层做两遍可分离盒式模糊。
 *
 * @param {object} o
 * @param {number} o.L              层高（世界单位）
 * @param {(cell, lv:number)=>{r,g,b}} o.colorOf
 * @param {object} [o.shape]        地形形变（rock 层按切面 lv 取变形顶点）
 * @param {object} [o.region]       分块烘焙：只栅格化这一块附近的格子
 * @param {number} [o.res]          纹素边长；不给按范围自适应（同 bakeLighting 老口径）
 * @param {number} [o.radius]       盒式模糊半径（纹素）；不给按 ≈0.32 世界单位
 * @param {number} [o.pad]          场外扩边（世界单位），默认 0.8
 * @param {number} [o.filterPad]    region 选格/裁剪用的外扩，默认 0.8
 * @param {boolean} [o.keepBits]    保留模糊前 0/1 占用位图（太阳射线 / solidAt）
 * @param {boolean} [o.keepRaw]     保留模糊前底片 + 暴露 cellWriteRect/clearRect/
 *                                  restamp/refreshBits/reblur —— field-cache.js
 *                                  的逐次重投影用这套钩子
 * @returns {object|null} 没有任何实心格时返回 null
 */
export function buildOcclusionField(world, { L, colorOf, shape = null, region = null, res: resIn, radius: radiusIn, pad: padIn, filterPad = 0.8, keepBits = false, keepRaw = false } = {}) {
  if (!world?.cells || typeof colorOf !== 'function') throw new RangeError('buildOcclusionField needs {world, colorOf}');
  // region（分块烘焙）：只看这一块顶点范围附近的格子；否则看整个世界
  const cells = region
    ? world.cells.filter((c) => c.maxX >= region.minX - filterPad && c.minX <= region.maxX + filterPad && c.maxZ >= region.minZ - filterPad && c.minZ <= region.maxZ + filterPad)
    : world.cells;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
  for (const c of cells) {
    const h = world.top(c);
    if (!h) continue;
    if (c.minX < minX) minX = c.minX; if (c.maxX > maxX) maxX = c.maxX;
    if (c.minZ < minZ) minZ = c.minZ; if (c.maxZ > maxZ) maxZ = c.maxZ;
    if (h > maxH) maxH = h;
  }
  if (!Number.isFinite(minX)) return null;
  if (region) {
    minX = Math.max(minX, region.minX - filterPad); maxX = Math.min(maxX, region.maxX + filterPad);
    minZ = Math.max(minZ, region.minZ - filterPad); maxZ = Math.min(maxZ, region.maxZ + filterPad);
    if (minX > maxX || minZ > maxZ) return null;
  }
  const t0 = performance.now();
  // 分辨率随范围自适应：小镇 0.08，整座岛放宽到约 0.13，模糊半径按世界单位保持 ≈0.3
  const area = (maxX - minX + 1.6) * (maxZ - minZ + 1.6);
  const res = resIn ?? Math.max(0.08, Math.min(0.14, Math.sqrt(area / 40000)));
  const radius = radiusIn ?? Math.max(2, Math.round(0.32 / res));
  const pad = padIn ?? 0.8;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  // 分块时对齐到全局像素网格，相邻块的采样点一致、接缝处不跳
  if (region) { minX = Math.floor(minX / res) * res; minZ = Math.floor(minZ / res) * res; }
  const W = Math.ceil((maxX - minX) / res) + 1;
  const H = Math.ceil((maxZ - minZ) / res) + 1;
  const layers = Math.min(MAX_LEVEL, maxH) + 2;
  const size = W * H;
  const occ = new Float32Array(size * layers);
  const cr = new Float32Array(size * layers);
  const cg = new Float32Array(size * layers);
  const cb = new Float32Array(size * layers);

  // 1) 栅格化：每个实心体素写进它那一层。
  //    地形变形后（terrain/shape.js），第 lv 层的轮廓取切面 lv 的顶点位置；没变形的层共用原始四边形。
  const grow = shape ? 0.26 : 0;
  // 扫描线：每一行求各条边与该行的交点，取 [min, max]（格子都是凸多边形）
  const rasterize = (pts, x0, x1, z0, z1, fn) => {
    const j0 = Math.max(0, Math.floor((z0 - grow - minZ) / res)), j1 = Math.min(H - 1, Math.ceil((z1 + grow - minZ) / res));
    for (let j = j0; j <= j1; j++) {
      const z = minZ + j * res;
      let lo = Infinity, hi = -Infinity;
      for (let k = 0, n = pts.length; k < n; k++) {
        const a = pts[k], b = pts[(k + 1) % n];
        if ((a.z <= z && b.z > z) || (b.z <= z && a.z > z)) {
          const x = a.x + (z - a.z) / (b.z - a.z) * (b.x - a.x);
          if (x < lo) lo = x; if (x > hi) hi = x;
        }
      }
      if (lo > hi) continue;
      const i0 = Math.max(0, Math.ceil((lo - minX) / res)), i1 = Math.min(W - 1, Math.floor((hi - minX) / res));
      for (let i = i0; i <= i1; i++) fn(j * W + i);
    }
  };
  // 每层有内容的格子范围（像素），模糊只做这一块（加半径）
  const lb = Array.from({ length: layers }, () => [W, H, -1, -1]);
  const extend = (lv, c) => {
    const b = lb[lv];
    b[0] = Math.min(b[0], Math.floor((c.minX - grow - minX) / res)); b[1] = Math.min(b[1], Math.floor((c.minZ - grow - minZ) / res));
    b[2] = Math.max(b[2], Math.ceil((c.maxX + grow - minX) / res)); b[3] = Math.max(b[3], Math.ceil((c.maxZ + grow - minZ) / res));
  };
  // 形变后岩石层用切面顶点；没变形的层共用原始四边形（返回 null = 用 c.pts）。
  // shp 默认取建场时的 shape；field-cache 增量重投影时用当前 shape 显式传入，
  // 否则形变变了会拿旧切面顶点重印（ao-field-cache 形变签名测试踩过这个坑）。
  const levelPts = (c, lv, shp = shape) => {
    if (!shp || !world.isRock(c, lv)) return null;
    const q = c.pts.map((p) => { const [x, z] = shp.at(p, lv); return { x, z }; });
    return q.some((p, k) => Math.abs(p.x - c.pts[k].x) + Math.abs(p.z - c.pts[k].z) > 1e-4) ? q : null;
  };
  // 把一格写进给定数组——build 时写待模糊场，field-cache 逐次重投影时写底片 raw
  const stampCell = (c, tgt, shp = shape) => {
    const h = world.top(c);
    if (!h) return;
    const plain = [];   // 用原始四边形的层
    for (let lv = 1; lv <= h && lv < layers; lv++) {
      if (!world.isSolid(c, lv)) continue;
      const cc = colorOf(c, lv);
      const pts = levelPts(c, lv, shp);
      if (!pts) { plain.push([lv, cc]); continue; }
      rasterize(pts, c.minX, c.maxX, c.minZ, c.maxZ, (o) => {
        const k = lv * size + o;
        tgt.occ[k] = 1; tgt.cr[k] = cc.r; tgt.cg[k] = cc.g; tgt.cb[k] = cc.b;
      });
    }
    if (plain.length) rasterize(c.pts, c.minX, c.maxX, c.minZ, c.maxZ, (o) => {
      for (const [lv, cc] of plain) { const k = lv * size + o; tgt.occ[k] = 1; tgt.cr[k] = cc.r; tgt.cg[k] = cc.g; tgt.cb[k] = cc.b; }
    });
  };
  for (const c of cells) {
    const h = world.top(c);
    if (!h) continue;
    for (let lv = 1; lv <= h && lv < layers; lv++) if (world.isSolid(c, lv)) extend(lv, c);
    stampCell(c, { occ, cr, cg, cb });
  }

  // 模糊前的 0/1 占用与底片：逐顶点太阳射线 / solidAt 用位图，增量重投影用底片
  const bits = keepBits ? Uint8Array.from(occ, (v) => (v > 0 ? 1 : 0)) : null;
  const raw = keepRaw ? { occ: occ.slice(), cr: cr.slice(), cg: cg.slice(), cb: cb.slice() } : null;

  // 2) 可分离盒式模糊，两遍
  const tmp = new Float32Array(Math.max(W, H));
  const R = radius;
  // 只在该层的范围 [x0..x1]×[z0..z1]（已加半径）里做；范围外本来就是 0
  const blur = (arr, off, x0, z0, x1, z1) => {
    for (let pass = 0; pass < 2; pass++) {
      for (let j = z0; j <= z1; j++) {
        const row = off + j * W;
        let s = 0;
        for (let i = x0 - R; i <= x0 + R; i++) s += arr[row + clamp(i, 0, W - 1)];
        for (let i = x0; i <= x1; i++) {
          tmp[i] = s / (2 * R + 1);
          s += arr[row + Math.min(W - 1, i + R + 1)] - arr[row + Math.max(0, i - R)];
        }
        for (let i = x0; i <= x1; i++) arr[row + i] = tmp[i];
      }
      for (let i = x0; i <= x1; i++) {
        let s = 0;
        for (let j = z0 - R; j <= z0 + R; j++) s += arr[off + clamp(j, 0, H - 1) * W + i];
        for (let j = z0; j <= z1; j++) {
          tmp[j] = s / (2 * R + 1);
          s += arr[off + Math.min(H - 1, j + R + 1) * W + i] - arr[off + Math.max(0, j - R) * W + i];
        }
        for (let j = z0; j <= z1; j++) arr[off + j * W + i] = tmp[j];
      }
    }
  };
  for (let lv = 1; lv < layers; lv++) {
    const b = lb[lv];
    if (b[2] < 0) continue;
    const m = 2 * R + 2;
    const x0 = Math.max(0, b[0] - m), z0 = Math.max(0, b[1] - m), x1 = Math.min(W - 1, b[2] + m), z1 = Math.min(H - 1, b[3] + m);
    for (const arr of [occ, cr, cg, cb]) blur(arr, lv * size, x0, z0, x1, z1);
  }

  // 3) 场取样器：与逐顶点烘焙/顶点着色器同一套双线性 + 层间线性
  const layer = (arr, lv, x, z) => {
    if (lv < 1 || lv >= layers) return 0;
    const fi = (x - minX) / res, fj = (z - minZ) / res;
    if (fi < 0 || fj < 0 || fi >= W - 1 || fj >= H - 1) return 0;
    const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = lv * size + j * W + i;
    return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + W] * (1 - tx) + arr[o + W + 1] * tx) * tz;
  };
  const sample = (arr, x, y, z) => {
    const f = y / L + 0.5;            // 连续层号：第 k 层中心在 k-0.5
    const l0 = Math.floor(f), t = f - l0;
    return layer(arr, l0, x, z) * (1 - t) + layer(arr, l0 + 1, x, z) * t;
  };
  const solidAt = bits ? (x, y, z) => {
    const lv = Math.floor(y / L) + 1;
    if (lv < 1 || lv >= layers) return 0;
    const i = Math.round((x - minX) / res), j = Math.round((z - minZ) / res);
    if (i < 0 || j < 0 || i >= W || j >= H) return 0;
    return bits[lv * size + j * W + i];
  } : null;

  const field = {
    minX, minZ, maxX, maxZ, W, H, layers, size, res, radius, L,
    occ, cr, cg, cb, bits, raw, lb, grow,
    layer, sample,
    sampleOcc: (x, y, z) => sample(occ, x, y, z),
    solidAt,
    ms: +(performance.now() - t0).toFixed(1),
  };

  // —— 动态纹理钩子（field-cache.js 逐次重投影用；只在 keepRaw 时挂）——
  if (keepRaw) {
    const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    // 该格「可能写到的纹素」的保守包围盒：x 取各实心层切面/原始顶点 x 的并集，
    // z 是扫描线行程 = 格包围盒 ±grow（rasterize 的 j0/j1 同款口径），四边再让 1 纹素。
    field.cellWriteRect = (c, shp = shape) => {
      const h = world.top(c);
      if (!h) return null;
      let x0 = c.minX, x1 = c.maxX;
      for (let lv = 1; lv <= h && lv < layers; lv++) {
        if (!world.isSolid(c, lv)) continue;
        const pts = levelPts(c, lv, shp);
        if (pts) for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; }
      }
      return {
        i0: clampI(Math.floor((x0 - minX) / res) - 1, 0, W - 1),
        i1: clampI(Math.ceil((x1 - minX) / res) + 1, 0, W - 1),
        j0: clampI(Math.floor((c.minZ - grow - minZ) / res) - 1, 0, H - 1),
        j1: clampI(Math.ceil((c.maxZ + grow - minZ) / res) + 1, 0, H - 1),
      };
    };
    field.clearRect = ({ i0, i1, j0, j1 }) => {
      i0 = clampI(i0, 0, W - 1); i1 = clampI(i1, 0, W - 1);
      j0 = clampI(j0, 0, H - 1); j1 = clampI(j1, 0, H - 1);
      for (let lv = 1; lv < layers; lv++) {
        const off = lv * size;
        for (let j = j0; j <= j1; j++) {
          const row = off + j * W;
          raw.occ.fill(0, row + i0, row + i1 + 1);
          raw.cr.fill(0, row + i0, row + i1 + 1);
          raw.cg.fill(0, row + i0, row + i1 + 1);
          raw.cb.fill(0, row + i0, row + i1 + 1);
        }
      }
    };
    // 把一格按当前状态重投影进底片（调用方按 world.cells 原序喂，重叠边界纹素与全量同序覆写；
    // shp 传当前形变——场建好后形变还能变，默认只是建场时的那份）
    field.restamp = (c, shp = shape) => stampCell(c, raw, shp);
    field.refreshBits = ({ i0, i1, j0, j1 }) => {
      if (!bits) return;
      i0 = clampI(i0, 0, W - 1); i1 = clampI(i1, 0, W - 1);
      j0 = clampI(j0, 0, H - 1); j1 = clampI(j1, 0, H - 1);
      for (let lv = 1; lv < layers; lv++) {
        const off = lv * size;
        for (let j = j0; j <= j1; j++) {
          const row = off + j * W;
          for (let i = i0; i <= i1; i++) bits[row + i] = raw.occ[row + i] > 0 ? 1 : 0;
        }
      }
    };
    /**
     * 只重模糊一个矩形（裁判 reblurRect 同款）：raw 拷出 rect±2·P·R 的窗口，
     * 两遍盒式后写回 rect±P·R。窗口内滑动和的边缘钳制只在写回区之外出错，
     * 写回区里与全量同式（前缀和锚点不同可能差 ~1e-15 浮点尾数，见 field-cache 验证）。
     */
    field.reblur = ({ i0, i1, j0, j1 }) => {
      const P = 2, halo = R * P;
      const x0 = clampI(i0 - 2 * halo, 0, W - 1), x1 = clampI(i1 + 2 * halo, 0, W - 1);
      const z0 = clampI(j0 - 2 * halo, 0, H - 1), z1 = clampI(j1 + 2 * halo, 0, H - 1);
      const w = x1 - x0 + 1, h = z1 - z0 + 1;
      if (w < 2 || h < 2) return null;
      const t1 = performance.now();
      const scratch = new Float32Array(w * h);
      const wx0 = clampI(i0 - halo, x0, x1), wx1 = clampI(i1 + halo, x0, x1);
      const wz0 = clampI(j0 - halo, z0, z1), wz1 = clampI(j1 + halo, z0, z1);
      for (const [dst, src] of [[occ, raw.occ], [cr, raw.cr], [cg, raw.cg], [cb, raw.cb]]) {
        for (let lv = 1; lv < layers; lv++) {
          const off = lv * size;
          for (let j = 0; j < h; j++) scratch.set(src.subarray(off + (z0 + j) * W + x0, off + (z0 + j) * W + x1 + 1), j * w);
          for (let pass = 0; pass < 2; pass++) {
            for (let j = 0; j < h; j++) {
              const row = j * w;
              let s = 0;
              for (let i = -R; i <= R; i++) s += scratch[row + clamp(i, 0, w - 1)];
              for (let i = 0; i < w; i++) {
                tmp[i] = s / (2 * R + 1);
                s += scratch[row + Math.min(w - 1, i + R + 1)] - scratch[row + Math.max(0, i - R)];
              }
              for (let i = 0; i < w; i++) scratch[row + i] = tmp[i];
            }
            for (let i = 0; i < w; i++) {
              let s = 0;
              for (let j = -R; j <= R; j++) s += scratch[clamp(j, 0, h - 1) * w + i];
              for (let j = 0; j < h; j++) {
                tmp[j] = s / (2 * R + 1);
                s += scratch[Math.min(h - 1, j + R + 1) * w + i] - scratch[Math.max(0, j - R) * w + i];
              }
              for (let j = 0; j < h; j++) scratch[j * w + i] = tmp[j];
            }
          }
          for (let j = wz0; j <= wz1; j++) {
            const row = (j - z0) * w + (wx0 - x0);
            dst.set(scratch.subarray(row, row + (wx1 - wx0 + 1)), off + j * W + wx0);
          }
        }
      }
      return { ms: +(performance.now() - t1).toFixed(2), texels: (wx1 - wx0 + 1) * (wz1 - wz0 + 1) * (layers - 1) * 4, write: { i0: wx0, i1: wx1, j0: wz0, j1: wz1 }, window: { i0: x0, i1: x1, j0: z0, j1: z1 } };
    };
  }
  return field;
}

/**
 * @param {import('../core/meshwriter.js').MeshWriter} w
 * @param {import('../core/world.js').World} world
 * @param {{ L:number, colorOf:(cell, lv:number)=>{r,g,b} }} o
 * o.field：可选——已建好的分层场（buildOcclusionField / field-cache.js），
 *          给了就跳过「重投影成纹理」那半步直接顶点采样，region/res/radius/shape/
 *          colorOf 不再生效；bounces>1 的扩散仍在该场模糊结果上整跑（Jacobi 是全局的）。
 */
export function bakeLighting(w, world, { L, colorOf, shape = null, region = null, res: resIn, radius: radiusIn, offset = 0.17, strength = 0.62, bounce: bounceIn, bounces = 1, airGain: airGainIn, diffuseGain = 0.9, stride = 3, aoMode = 'vertex', sunShadow = null, keepField = false, channels = false, field: fieldIn = null }) {
  // 793557992931266561: flat -> up normal -> vertex voxel AO -> directional AO（SSAO 原作自己去掉了，不做）
  // 1580846877855338497「after about the 3rd bounce」× townmesh.js 多跳档：bounces>1 时
  // 先在模糊场上做粗网格 Jacobi 扩散（diffuseAir），顶点再按 bounce 0.62 / airGain 0.55
  // 收色——裁判记录 0.42 下多跳只改 1.8% 像素、等于没做。bounces=1（默认）= 老行为。
  if (!Number.isInteger(bounces) || bounces < 1 || bounces > 8) throw new RangeError('bounces must be integer 1..8');
  const bounce = bounceIn ?? (bounces > 1 ? 0.62 : 0.42);
  const airGain = airGainIn ?? (bounces > 1 ? 0.55 : 0);
  if (!AO_MODES.includes(aoMode)) throw new RangeError('invalid aoMode');
  // 1190191289922465793: per-vertex voxel sun shadow，与 AO 共用同一张分层占用（模糊前的 0/1）
  const sun = sunShadow ? normalizeSunShadow(sunShadow, L) : null;
  const sunReach = sun ? sun.steps * sun.stepLen + sun.normalBias : 0;
  const t0 = performance.now();
  const field = fieldIn ?? buildOcclusionField(world, {
    L, colorOf, shape, region, res: resIn, radius: radiusIn,
    pad: Math.max(region ? 0.2 : 0.8, sunReach),
    filterPad: Math.max(0.8, sunReach + 0.2),
    keepBits: !!(sun || keepField),
  });
  if (!field) return { ms: 0, sunShadowed: 0 };
  const { minX, minZ, W, H, layers, size, res, occ, cr, cg, cb } = field;
  const bits = field.bits;
  if (sun && !bits) throw new RangeError('sunShadow needs a field with bits (buildOcclusionField keepBits)');

  // 多跳：在模糊好的占用/颜色场上做粗网格 Jacobi 扩散（裁判 diffuseBounce 同式）。
  let airSample = null, diffuseMs = 0;
  if (bounces > 1) ({ sampleAir: airSample, ms: diffuseMs } = diffuseAir(
    { W, H, layers, size, occ, cr, cg, cb, res, minX, minZ, L },
    { passes: bounces, gain: diffuseGain, stride }));

  const sample = field.sample;
  const solidAt = field.solidAt ?? (() => 0);
  const sunShadeAt = sun ? (x, y, z, nx, ny, nz) => {
    const ox = x + nx * sun.normalBias, oy = y + ny * sun.normalBias, oz = z + nz * sun.normalBias;
    for (let k = 1; k <= sun.steps; k++) {
      const d = sun.stepLen * k;
      if (solidAt(ox + sun.dir[0] * d, oy + sun.dir[1] * d, oz + sun.dir[2] * d)) { const f = k / sun.steps; return 1 - 0.55 * f * f; }
    }
    return 0;
  } : null;
  const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const dirH = Math.max(res * 2, 0.18);
  const pos = w.pos, col = w.col;
  const nVert = pos.length / 3;
  const sunShade = sun ? new Float32Array(nVert) : null;
  const dirAo = aoMode === 'directional' ? new Float32Array(nVert * 6) : null;
  // 1168571866405097472 遮蔽/反弹分离对照：opt-in 逐顶点通道读数。
  // 约定（对 aoMode 'vertex'/'up'/'flat' 精确成立）：
  //   col_out[c] = col_in[c] · sun[v] · ( ao[v] + bounce[3v+c] ) + air[3v+c]
  // ao = 纯遮蔽乘子（含 up 的朝向明暗），bounce = 邻居彩色反弹乘子项，
  // air = 多跳空气补光的加法项；未受遮蔽的顶点保持 ao=1 / bounce=0 / air=0。
  // aoMode 'directional' 把方向色偏乘子余量记进 bounce（它不是邻居反弹色）。
  const chAO = channels ? new Float32Array(nVert).fill(1) : null;
  const chBounce = channels ? new Float32Array(nVert * 3) : null;
  const chAir = channels ? new Float32Array(nVert * 3) : null;
  const chSun = channels ? new Float32Array(nVert).fill(1) : null;
  let sunShadowed = 0;
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t], ay = pos[t + 1], az = pos[t + 2];
    const ux = pos[t + 3] - ax, uy = pos[t + 4] - ay, uz = pos[t + 5] - az;
    const vx = pos[t + 6] - ax, vy = pos[t + 7] - ay, vz = pos[t + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    for (let v = 0; v < 3; v++) {
      const o = t + v * 3;
      if (sun) {
        const s = sunShadeAt(pos[o], pos[o + 1], pos[o + 2], nx, ny, nz);
        sunShade[o / 3] = s;
        if (s > 0.05) sunShadowed++;
        const k = 1 - sun.strength * s;
        if (channels) chSun[o / 3] = k;
        col[o] *= k; col[o + 1] *= k; col[o + 2] *= k;
      }
      if (aoMode === 'flat') continue;
      if (aoMode === 'up') {
        // "up normal"：只看法线朝上多少，极软的上下渐变，不看邻居
        const k = 0.775 + 0.225 * ny;
        if (channels) chAO[o / 3] = k;
        col[o] *= k; col[o + 1] *= k; col[o + 2] *= k;
        continue;
      }
      const sx = pos[o] + nx * offset, sy = pos[o + 1] + ny * offset + 0.02, sz = pos[o + 2] + nz * offset;
      const oc = sample(occ, sx, sy, sz);
      if (aoMode === 'directional') {
        // 六个标量：沿 ±X/±Y/±Z 各偏一步取模糊占用 —— "被哪一边挡住"，不只是"挡了多少"
        let dsum = 0;
        for (let a = 0; a < 6; a++) {
          const d = sample(occ, sx + AX[a][0] * dirH, sy + AX[a][1] * dirH, sz + AX[a][2] * dirH);
          dirAo[o / 3 * 6 + a] = d;
          dsum += d;
        }
        if (dsum < 0.002 && oc < 0.002) continue;
        // 方向色：挡光来自哪个轴，暗部就沾该轴的冷暖（±X 粉/绿，±Z 暖/冷，上方遮挡偏蓝灰）
        let tr = 0, tg = 0, tb = 0;
        for (let a = 0; a < 6; a++) { const d = dirAo[o / 3 * 6 + a] / dsum || 0; tr += DIR_TINT[a][0] * d; tg += DIR_TINT[a][1] * d; tb += DIR_TINT[a][2] * d; }
        const occl = Math.min(1, (oc + dsum / 6) * 0.5 * 1.15);
        const ao = 1 - strength * occl;
        const mix = Math.min(1, occl * 1.5);
        const mr = ao * (1 + (tr - 1) * mix), mg = ao * (1 + (tg - 1) * mix), mb = ao * (1 + (tb - 1) * mix);
        if (channels) { const v3 = o; chAO[o / 3] = ao; chBounce[v3] = mr - ao; chBounce[v3 + 1] = mg - ao; chBounce[v3 + 2] = mb - ao; }
        col[o] *= mr; col[o + 1] *= mg; col[o + 2] *= mb;
        continue;
      }
      if (oc < 0.002) continue;
      const ao = 1 - strength * Math.min(1, oc * 1.15);
      const k = bounce * oc;
      const br = (sample(cr, sx, sy, sz) / oc) * k, bg = (sample(cg, sx, sy, sz) / oc) * k, bb = (sample(cb, sx, sy, sz) / oc) * k;
      if (channels) { chAO[o / 3] = ao; chBounce[o] = br; chBounce[o + 1] = bg; chBounce[o + 2] = bb; }
      col[o] = col[o] * ao + col[o] * br;
      col[o + 1] = col[o + 1] * ao + col[o + 1] * bg;
      col[o + 2] = col[o + 2] * ao + col[o + 2] * bb;
      // 多跳补光（裁判 townmesh.js airGain）：AO 遮掉的那部分天光，由「面前这团空气里
      // 已经渗过来的邻居光」补回一点。加法项——染邻居的色相，不是把整面墙提亮。
      if (airGain > 0 && airSample) {
        const k2 = airGain * oc, [ar, ag, ab] = airSample(sx, sy, sz);
        if (channels) { chAir[o] = ar * k2; chAir[o + 1] = ag * k2; chAir[o + 2] = ab * k2; }
        col[o] += ar * k2; col[o + 1] += ag * k2; col[o + 2] += ab * k2;
      }
    }
  }
  const out = { ms: +(performance.now() - t0).toFixed(1), sunShadowed };
  if (channels) out.channels = { ao: chAO, bounce: chBounce, air: chAir, sun: chSun };
  if (bounces > 1) { out.diffuseMs = diffuseMs; out.airGain = airGain; }
  if (keepField) out.field = { minX, minZ, W, H, res, layers, L, bits, occ, cr, cg, cb, sampleOcc: (x, y, z) => sample(occ, x, y, z), sampleAir: airSample, solidAt, sunShade, dirAo };
  return out;
}

export const AO_MODES = ['flat', 'up', 'vertex', 'directional'];
// ±X, ±Y, ±Z 遮挡方向的色偏（原片第④档：拱下朝左的面偏粉、朝右偏绿）
const DIR_TINT = [[1.06, 0.97, 1.0], [0.96, 1.05, 0.98], [0.97, 0.99, 1.05], [1.02, 1.0, 0.97], [1.04, 1.01, 0.95], [0.97, 1.0, 1.04]];

/**
 * 多跳反弹扩散 —— 与只读裁判 REACode/src/lighting.js `diffuseBounce` 同一套数学
 * （1580846877855338497：3 跳之后增量看不出）。bake 的模糊场形状
 * { W, H, layers, size, occ, cr, cg, cb, res, minX, minZ, L(层高) } 与裁判场同构，
 * 只是字段名不同（layers↔L、L↔levelHeight）：
 *   · 先按 stride 降采样成粗网格——0.08 一格的细场上跑 3 遍，光只走 0.24 世界单位，
 *     出不了自己那面墙；stride=3 让一遍 ≈1/3 格，三遍 ≈1 格，正好是"隔壁房子给
 *     这面墙染色"的距离（裁判实测记录）。
 *   · 表面体素（占用 >0.5）颜色固定——它就是光源；空气体素收六邻居颜色，
 *     按 1/(1+gain) 混进自己。
 * 返回 sampleAir（粗网格三线性采样：xz 双线性 + 层间线性）。近程染色（1~2 格）够用，
 * 远距离渗色做不到——裁判同样如此。
 */
export function diffuseAir(field, { passes = 3, gain = 0.9, stride = 3 } = {}) {
  if (!field || !field.occ || !field.occ.length || passes < 1) return { sampleAir: null, ms: 0, airGrid: '0×0×0' };
  if (!Number.isInteger(passes) || passes > 8 || !Number.isInteger(stride) || stride < 1) throw new RangeError('diffuseAir options');
  if (!Number.isFinite(gain) || gain <= 0) throw new RangeError('diffuseAir gain');
  const t0 = performance.now();
  const { W, H, layers, size, occ, cr, cg, cb, res, minX, minZ, L: levelHeight } = field;
  const S = Math.max(1, stride | 0);
  const cW = Math.ceil(W / S), cH = Math.ceil(H / S), cSize = cW * cH;
  const cOcc = new Float32Array(cSize * layers);
  const cr0 = new Float32Array(cSize * layers), cg0 = new Float32Array(cSize * layers), cb0 = new Float32Array(cSize * layers);
  for (let lv = 1; lv < layers; lv++) {
    for (let cj = 0; cj < cH; cj++) {
      for (let ci = 0; ci < cW; ci++) {
        let w = 0, r = 0, g = 0, b = 0, m = 0;
        for (let j = cj * S; j < Math.min(H, cj * S + S); j++) {
          for (let i = ci * S; i < Math.min(W, ci * S + S); i++) {
            const k = lv * size + j * W + i, o = occ[k];
            if (o > m) m = o;
            if (o <= 0.02) continue;
            w += o; r += cr[k]; g += cg[k]; b += cb[k];
          }
        }
        const kc = lv * cSize + cj * cW + ci;
        cOcc[kc] = m;
        if (w > 1e-4) { cr0[kc] = r / w; cg0[kc] = g / w; cb0[kc] = b / w; }
      }
    }
  }

  const solid = new Uint8Array(cSize * layers);
  for (let k = 0; k < cSize * layers; k++) if (cOcc[k] > 0.5) solid[k] = 1;
  const nr = new Float32Array(cr0), ng = new Float32Array(cg0), nb = new Float32Array(cb0);
  const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const nb6 = new Int32Array(6);
  for (let p = 0; p < passes; p++) {
    for (let lv = 1; lv < layers; lv++) {
      const off = lv * cSize;
      for (let j = 0; j < cH; j++) {
        for (let i = 0; i < cW; i++) {
          const k = off + j * cW + i;
          if (solid[k]) continue;
          nb6[0] = off + j * cW + clampI(i - 1, 0, cW - 1);
          nb6[1] = off + j * cW + clampI(i + 1, 0, cW - 1);
          nb6[2] = off + clampI(j - 1, 0, cH - 1) * cW + i;
          nb6[3] = off + clampI(j + 1, 0, cH - 1) * cW + i;
          nb6[4] = (lv - 1) * cSize + j * cW + i;
          nb6[5] = (lv + 1 < layers ? lv + 1 : lv) * cSize + j * cW + i;
          let ws = 0, r = 0, g = 0, b = 0;
          for (let q = 0; q < 6; q++) {
            const m2 = nb6[q], w = cOcc[m2];
            if (w <= 0.02) continue;
            ws += w; r += nr[m2] * w; g += ng[m2] * w; b += nb[m2] * w;
          }
          if (ws > 1e-4) {
            nr[k] = (nr[k] + gain * (r / ws)) / (1 + gain);
            ng[k] = (ng[k] + gain * (g / ws)) / (1 + gain);
            nb[k] = (nb[k] + gain * (b / ws)) / (1 + gain);
          }
        }
      }
    }
  }

  const cRes = res * S;
  const sampleAir = (x, y, z) => {
    const fi = (x - minX) / cRes, fj = (z - minZ) / cRes;
    const f = y / levelHeight + 0.5, l0 = Math.floor(f), t = f - l0;
    const li = (arr, lv) => {
      if (lv < 1 || lv >= layers) return 0;
      if (fi < 0 || fj < 0 || fi >= cW - 1 || fj >= cH - 1) return 0;
      const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = lv * cSize + j * cW + i;
      return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + cW] * (1 - tx) + arr[o + cW + 1] * tx) * tz;
    };
    const mix2 = (arr) => li(arr, l0) * (1 - t) + li(arr, l0 + 1) * t;
    return [mix2(nr), mix2(ng), mix2(nb)];
  };
  return { sampleAir, ms: +(performance.now() - t0).toFixed(1), airGrid: `${cW}×${layers}×${cH} @${cRes.toFixed(2)}` };
}

/** 原 engine/voxelshadow.js 的量：10 步，最远约 2.5 格；最深压暗 0.24；越远命中越淡。 */
export function normalizeSunShadow({ dir, steps = 10, strength = 0.24, normalBias = 0.05, stepLen = null } = {}, L = 0.5) {
  if (!Array.isArray(dir) || dir.length !== 3 || !dir.every(Number.isFinite)) throw new RangeError('sunShadow.dir');
  const l = Math.hypot(...dir);
  if (!(l > 0) || dir[1] <= 0) throw new RangeError('sunShadow.dir must point upward');
  const len = stepLen ?? Math.max(0.05, L * 0.5);
  if (!Number.isInteger(steps) || steps < 1 || steps > 64 || !Number.isFinite(strength) || strength < 0 || strength > 1 || !Number.isFinite(normalBias) || normalBias < 0 || !Number.isFinite(len) || len <= 0) throw new RangeError('sunShadow options');
  return { dir: dir.map((v) => v / l), steps, strength, normalBias, stepLen: len };
}
