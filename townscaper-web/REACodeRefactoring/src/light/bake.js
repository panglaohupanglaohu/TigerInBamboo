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
 */

import { pointInQuad } from '../core/spatial.js';
import { MAX_LEVEL } from '../core/world.js';
import { clamp } from '../core/noise.js';

/**
 * @param {import('../core/meshwriter.js').MeshWriter} w
 * @param {import('../core/world.js').World} world
 * @param {{ L:number, colorOf:(cell, lv:number)=>{r,g,b} }} o
 */
export function bakeLighting(w, world, { L, colorOf, shape = null, region = null, res: resIn, radius: radiusIn, offset = 0.17, strength = 0.62, bounce = 0.42, aoMode = 'vertex', sunShadow = null, keepField = false }) {
  // 793557992931266561: flat -> up normal -> vertex voxel AO -> directional AO（SSAO 原作自己去掉了，不做）
  if (!AO_MODES.includes(aoMode)) throw new RangeError('invalid aoMode');
  // 1190191289922465793: per-vertex voxel sun shadow，与 AO 共用同一张分层占用（模糊前的 0/1）
  const sun = sunShadow ? normalizeSunShadow(sunShadow, L) : null;
  const sunReach = sun ? sun.steps * sun.stepLen + sun.normalBias : 0;
  // region（分块烘焙）：只看这一块顶点范围附近的格子；否则看整个世界
  const pad0 = Math.max(0.8, sunReach + 0.2);
  const cells = region
    ? world.cells.filter((c) => c.maxX >= region.minX - pad0 && c.minX <= region.maxX + pad0 && c.maxZ >= region.minZ - pad0 && c.minZ <= region.maxZ + pad0)
    : world.cells;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
  for (const c of cells) {
    const h = world.top(c);
    if (!h) continue;
    if (c.minX < minX) minX = c.minX; if (c.maxX > maxX) maxX = c.maxX;
    if (c.minZ < minZ) minZ = c.minZ; if (c.maxZ > maxZ) maxZ = c.maxZ;
    if (h > maxH) maxH = h;
  }
  if (!Number.isFinite(minX)) return { ms: 0, sunShadowed: 0 };
  if (region) {
    minX = Math.max(minX, region.minX - pad0); maxX = Math.min(maxX, region.maxX + pad0);
    minZ = Math.max(minZ, region.minZ - pad0); maxZ = Math.min(maxZ, region.maxZ + pad0);
    if (minX > maxX || minZ > maxZ) return { ms: 0, sunShadowed: 0 };
  }
  const t0 = performance.now();
  // 分辨率随范围自适应：小镇 0.08，整座岛放宽到约 0.13，模糊半径按世界单位保持 ≈0.3
  const area = (maxX - minX + 1.6) * (maxZ - minZ + 1.6);
  const res = resIn ?? Math.max(0.08, Math.min(0.14, Math.sqrt(area / 40000)));
  const radius = radiusIn ?? Math.max(2, Math.round(0.32 / res));
  const pad = Math.max(region ? 0.2 : 0.8, sunReach);
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
  for (const c of cells) {
    const h = world.top(c);
    if (!h) continue;
    const plain = [];   // 用原始四边形的层
    for (let lv = 1; lv <= h && lv < layers; lv++) {
      if (!world.isSolid(c, lv)) continue;
      const cc = colorOf(c, lv);
      let pts = null;
      if (shape && world.isRock(c, lv)) {
        const q = c.pts.map((p) => { const [x, z] = shape.at(p, lv); return { x, z }; });
        if (q.some((p, k) => Math.abs(p.x - c.pts[k].x) + Math.abs(p.z - c.pts[k].z) > 1e-4)) pts = q;
      }
      if (!pts) { plain.push([lv, cc]); continue; }
      extend(lv, c);
      rasterize(pts, c.minX, c.maxX, c.minZ, c.maxZ, (o) => {
        const k = lv * size + o;
        occ[k] = 1; cr[k] = cc.r; cg[k] = cc.g; cb[k] = cc.b;
      });
    }
    for (const [lv] of plain) extend(lv, c);
    if (plain.length) rasterize(c.pts, c.minX, c.maxX, c.minZ, c.maxZ, (o) => {
      for (const [lv, cc] of plain) { const k = lv * size + o; occ[k] = 1; cr[k] = cc.r; cg[k] = cc.g; cb[k] = cc.b; }
    });
  }

  // 模糊前的 0/1 占用：逐顶点太阳射线与调试字段都用这一份（同一张栅格，不另建）
  const bits = (sun || keepField) ? Uint8Array.from(occ, (v) => (v > 0 ? 1 : 0)) : null;

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

  // 3) 逐顶点采样
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

  const solidAt = (x, y, z) => {
    const lv = Math.floor(y / L) + 1;
    if (lv < 1 || lv >= layers) return 0;
    const i = Math.round((x - minX) / res), j = Math.round((z - minZ) / res);
    if (i < 0 || j < 0 || i >= W || j >= H) return 0;
    return bits[lv * size + j * W + i];
  };
  const sunShadeAt = (x, y, z, nx, ny, nz) => {
    const ox = x + nx * sun.normalBias, oy = y + ny * sun.normalBias, oz = z + nz * sun.normalBias;
    for (let k = 1; k <= sun.steps; k++) {
      const d = sun.stepLen * k;
      if (solidAt(ox + sun.dir[0] * d, oy + sun.dir[1] * d, oz + sun.dir[2] * d)) { const f = k / sun.steps; return 1 - 0.55 * f * f; }
    }
    return 0;
  };
  const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const dirH = Math.max(res * 2, 0.18);
  const pos = w.pos, col = w.col;
  const nVert = pos.length / 3;
  const sunShade = sun ? new Float32Array(nVert) : null;
  const dirAo = aoMode === 'directional' ? new Float32Array(nVert * 6) : null;
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
        col[o] *= k; col[o + 1] *= k; col[o + 2] *= k;
      }
      if (aoMode === 'flat') continue;
      if (aoMode === 'up') {
        // "up normal"：只看法线朝上多少，极软的上下渐变，不看邻居
        const k = 0.775 + 0.225 * ny;
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
        col[o] *= ao * (1 + (tr - 1) * mix); col[o + 1] *= ao * (1 + (tg - 1) * mix); col[o + 2] *= ao * (1 + (tb - 1) * mix);
        continue;
      }
      if (oc < 0.002) continue;
      const ao = 1 - strength * Math.min(1, oc * 1.15);
      const k = bounce * oc;
      col[o] = col[o] * ao + col[o] * (sample(cr, sx, sy, sz) / oc) * k;
      col[o + 1] = col[o + 1] * ao + col[o + 1] * (sample(cg, sx, sy, sz) / oc) * k;
      col[o + 2] = col[o + 2] * ao + col[o + 2] * (sample(cb, sx, sy, sz) / oc) * k;
    }
  }
  const out = { ms: +(performance.now() - t0).toFixed(1), sunShadowed };
  if (keepField) out.field = { minX, minZ, W, H, res, layers, L, bits, occ, cr, cg, cb, sampleOcc: (x, y, z) => sample(occ, x, y, z), solidAt, sunShade, dirAo };
  return out;
}

export const AO_MODES = ['flat', 'up', 'vertex', 'directional'];
// ±X, ±Y, ±Z 遮挡方向的色偏（原片第④档：拱下朝左的面偏粉、朝右偏绿）
const DIR_TINT = [[1.06, 0.97, 1.0], [0.96, 1.05, 0.98], [0.97, 0.99, 1.05], [1.02, 1.0, 0.97], [1.04, 1.01, 0.95], [0.97, 1.0, 1.04]];

/** 原 engine/voxelshadow.js 的量：10 步，最远约 2.5 格；最深压暗 0.24；越远命中越淡。 */
export function normalizeSunShadow({ dir, steps = 10, strength = 0.24, normalBias = 0.05, stepLen = null } = {}, L = 0.5) {
  if (!Array.isArray(dir) || dir.length !== 3 || !dir.every(Number.isFinite)) throw new RangeError('sunShadow.dir');
  const l = Math.hypot(...dir);
  if (!(l > 0) || dir[1] <= 0) throw new RangeError('sunShadow.dir must point upward');
  const len = stepLen ?? Math.max(0.05, L * 0.5);
  if (!Number.isInteger(steps) || steps < 1 || steps > 64 || !Number.isFinite(strength) || strength < 0 || strength > 1 || !Number.isFinite(normalBias) || normalBias < 0 || !Number.isFinite(len) || len <= 0) throw new RangeError('sunShadow options');
  return { dir: dir.map((v) => v / l), steps, strength, normalBias, stepLen: len };
}
