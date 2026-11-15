/**
 * megatexture-gi.js — 第 56 批 C11：SDF(UV) → mega texture → 六向光体积 的往返反弹（第三项目 GI）。
 *
 * 原文：
 *   1580835075629133825 "my first decent attempt to actually have the light *bounce*"
 *   1580845127207387137 "1st texture here is an sdf volume. The distance lives in the alpha, but RG actually reference UVs in
 *     the mega texture! 2nd is a baked 6 directional light volume, raycast against the sdf, sampling the mega texture using the
 *     UVs where it hits the sdf. 3rd is the lit mega texture"
 *   1580846877855338497 "the slowed down bounce sequence. You can see how the mega texture and the light volume affect each
 *     other back and forth. After about the 3rd bounce, further bounces are not noticeable."
 *
 * 本地做法（CPU，按需烘焙；与 lightvolume.js 同一套共享 World 体素化，不另建格子）：
 *   1. 体素化：岛包围盒 res×(L/2)×res；实心 / 反照率；海面一层当实心（偏青）。
 *   2. mega texture：每个暴露的体素面 = 1 纹素。面按 (法线方向, 所在层) 分成 chart（同一平面上的一片），
 *      chart 按高度排序后货架装箱进一张 W×H 图集，chart 之间留 1 纹素 gutter。每纹素存 位置/法线/反照率/受光。
 *   3. SDF 体积：RGBA Float32，A = voxel-distance.js 的有符号中心距离；RG = 最近表面纹素在 mega texture 的 UV
 *      （从贴着暴露面的空格出发做多源 BFS 传播纹素号）。实心格 RG = -1。
 *   4. 六向光体积（粗格，res×2）：每个空格每个轴向一个 lobe，lobe 内 5 条射线（轴向 + 4 条 40° 斜射）。
 *      射线对 SDF 做球步进（lowerBound 大时跳，近表面切 DDA），命中时取「命中前最后一个空格」SDF 的 RG → UV → 纹素，
 *      读 mega texture 当前的出射光；没命中且朝上 → 天光。命中纹素在几何不变时缓存（只算一次），每轮只重做 gather。
 *   5. 照亮 mega texture：纹素出射 = 反照率 × (太阳 N·L·可见 + Σ n_a² · lobe(±a))；lobe 从纹素位置沿法线外移半格三线性取。
 *   6. 往返：重置(全黑) → 直射 → 体积 → 纹理 → 体积 …，每轮记录 mega texture 的平均 / 最大 / 相对变化。
 * 诚实边界：纹素 = 体素面（不是原作的三角网 UV 展开）；SDF 是体素中心 EDT（不是形变三角网的连续 SDF）；
 *   RG 是最近纹素而不一定是射线真正穿过的那张面 —— 命中时另外统计「SDF-UV 纹素 = 精确穿越面」的比例。
 */
import { voxelDistance } from '../core/voxel-distance.js';

const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** 共享 World → 体素（与 lightvolume.js 同口径）。 */
export function voxelizeWorld(world, index, { L = 0.5, res = 0.25, albedoOf = () => [.5, .5, .5], maxVoxels = 1500000, sea = true } = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 1;
  for (const c of world.cells) { const t = world.top(c); if (!t) continue; minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); maxH = Math.max(maxH, t); }
  if (!Number.isFinite(minX)) return null;
  minX -= 1; minZ -= 1; maxX += 1; maxZ += 1;
  const dy = L / 2, nx = Math.max(2, Math.ceil((maxX - minX) / res)), nz = Math.max(2, Math.ceil((maxZ - minZ) / res)), ny = (maxH + 2) * 2, N = nx * ny * nz;
  if (N > maxVoxels) throw new RangeError('megatexture-gi: voxel budget');
  const solid = new Uint8Array(N), alb = new Float32Array(N * 3), id = (x, y, z) => (z * ny + y) * nx + x;
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const wx = minX + (x + .5) * res, wz = minZ + (z + .5) * res, c = index.cellAt(wx, wz);
    for (let y = 0; y < ny; y++) {
      const k = id(x, y, z), wy = (y + .5) * dy;
      if (sea && y === 0 && (!c || world.top(c) === 0)) { solid[k] = 2; alb.set([.30, .55, .60], k * 3); continue; }
      if (!c) continue;
      const lv = Math.floor(wy / L) + 1;
      if (world.isSolid(c, lv)) { const rgb = albedoOf(c, lv, wy); if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) throw new RangeError('megatexture-gi: albedo'); solid[k] = 1; alb.set(rgb, k * 3); }
    }
  }
  return { nx, ny, nz, N, res, dy, L, minX, minZ, solid, alb, id };
}

/** 暴露面 → 纹素；按 (方向, 层) 成 chart，货架装箱成图集。 */
export function buildMegaTexture(vox, { gutter = 1 } = {}) {
  const { nx, ny, nz, solid, alb, id } = vox, dims = [nx, ny, nz];
  const faceTex = new Int32Array(vox.N * 6).fill(-1), charts = new Map();
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const k = id(x, y, z); if (!solid[k]) continue; const p = [x, y, z];
    for (let d = 0; d < 6; d++) {
      const q = [x + AX[d][0], y + AX[d][1], z + AX[d][2]];
      if (q.some((v, i) => v < 0 || v >= dims[i])) continue;           // 体积外的面不可见
      if (solid[id(...q)]) continue;
      const a = d >> 1, [u, v] = a === 0 ? [2, 1] : a === 1 ? [0, 2] : [0, 1], layer = p[a], key = d * 4096 + layer;
      let ch = charts.get(key); if (!ch) charts.set(key, ch = { d, layer, faces: [], minU: Infinity, minV: Infinity, maxU: -Infinity, maxV: -Infinity });
      ch.faces.push([k, p[u], p[v]]); ch.minU = Math.min(ch.minU, p[u]); ch.maxU = Math.max(ch.maxU, p[u]); ch.minV = Math.min(ch.minV, p[v]); ch.maxV = Math.max(ch.maxV, p[v]);
    }
  }
  // 同一 (方向, 层) 平面内再按 4 连通拆成独立 chart（否则稀疏墙面的包围盒很空，图集填充率极低）
  const comps = [];
  for (const ch of charts.values()) {
    const key = (u, v) => u * 65536 + v, at = new Map(ch.faces.map((f, i) => [key(f[1], f[2]), i])), seen = new Uint8Array(ch.faces.length);
    for (let i = 0; i < ch.faces.length; i++) {
      if (seen[i]) continue; const stack = [i], faces = []; seen[i] = 1; let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
      while (stack.length) {
        const j = stack.pop(), f = ch.faces[j]; faces.push(f); minU = Math.min(minU, f[1]); maxU = Math.max(maxU, f[1]); minV = Math.min(minV, f[2]); maxV = Math.max(maxV, f[2]);
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = at.get(key(f[1] + du, f[2] + dv)); if (q !== undefined && !seen[q]) { seen[q] = 1; stack.push(q); } }
      }
      comps.push({ d: ch.d, layer: ch.layer, faces, minU, minV, maxU, maxV });
    }
  }
  const list = comps.map((c) => ({ ...c, w: c.maxU - c.minU + 1, h: c.maxV - c.minV + 1 })).sort((a, b) => b.h - a.h || b.w - a.w);
  let area = 0; for (const c of list) area += (c.w + gutter) * (c.h + gutter);
  const W = Math.max(16, Math.ceil(Math.sqrt(area) * 1.15));
  let x = 0, y = 0, rowH = 0;
  for (const c of list) { if (x + c.w > W) { x = 0; y += rowH + gutter; rowH = 0; } c.ox = x; c.oy = y; x += c.w + gutter; rowH = Math.max(rowH, c.h); }
  const H = y + rowH, T = list.reduce((s, c) => s + c.faces.length, 0);
  const tex = { W, H, count: T, charts: list.length, atlas: new Int32Array(W * H).fill(-1), px: new Int32Array(T * 2), pos: new Float32Array(T * 3), nrm: new Int8Array(T * 3), dir: new Uint8Array(T), voxel: new Int32Array(T), albedo: new Float32Array(T * 3), faceTex };
  let t = 0;
  for (const c of list) for (const [k, pu, pv] of c.faces) {
    const tx = c.ox + pu - c.minU, ty = c.oy + pv - c.minV, kx = k % nx, ky = Math.floor(k / nx) % ny, kz = Math.floor(k / (nx * ny)), n = AX[c.d];
    tex.atlas[ty * W + tx] = t; tex.px[t * 2] = tx; tex.px[t * 2 + 1] = ty; tex.dir[t] = c.d; tex.voxel[t] = k; faceTex[k * 6 + c.d] = t;
    tex.nrm.set(n, t * 3); tex.albedo.set([alb[k * 3], alb[k * 3 + 1], alb[k * 3 + 2]], t * 3);
    // 面中心（世界坐标）
    tex.pos[t * 3] = vox.minX + (kx + .5 + n[0] * .5) * vox.res; tex.pos[t * 3 + 1] = (ky + .5 + n[1] * .5) * vox.dy; tex.pos[t * 3 + 2] = vox.minZ + (kz + .5 + n[2] * .5) * vox.res;
    t++;
  }
  return tex;
}

/** SDF 体积：RGBA，A = 有符号中心距离；RG = 最近表面纹素 UV（多源 BFS）。 */
export function buildSdfUV(vox, mega) {
  const { nx, ny, nz, N, solid, id } = vox, dims = [nx, ny, nz];
  const sdf = voxelDistance(solid, { nx, ny, nz, spacing: [vox.res, vox.dy, vox.res], maxVoxels: vox.N + 1, maxDistance: 4 });
  const near = new Int32Array(N).fill(-1), queue = new Int32Array(N); let head = 0, tail = 0;
  for (let t = 0; t < mega.count; t++) {      // 种子：贴着暴露面的空格
    const k = mega.voxel[t], d = mega.dir[t], x = k % nx + AX[d][0], y = Math.floor(k / nx) % ny + AX[d][1], z = Math.floor(k / (nx * ny)) + AX[d][2], q = id(x, y, z);
    if (near[q] < 0) { near[q] = t; queue[tail++] = q; }
  }
  while (head < tail) {
    const k = queue[head++], x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny));
    for (let d = 0; d < 6; d++) {
      const p = [x + AX[d][0], y + AX[d][1], z + AX[d][2]]; if (p.some((v, i) => v < 0 || v >= dims[i])) continue;
      const q = id(...p); if (solid[q] || near[q] >= 0) continue; near[q] = near[k]; queue[tail++] = q;
    }
  }
  const rgba = new Float32Array(N * 4);
  for (let k = 0; k < N; k++) {
    const t = near[k];
    rgba[k * 4] = t >= 0 ? (mega.px[t * 2] + .5) / mega.W : -1; rgba[k * 4 + 1] = t >= 0 ? (mega.px[t * 2 + 1] + .5) / mega.H : -1;
    rgba[k * 4 + 3] = sdf.signed[k];
  }
  /** RG → 纹素号（真正按 UV 回查图集，而不是直接用 near[]）。 */
  const texelAtUV = (u, v) => { if (u < 0) return -1; const x = Math.floor(u * mega.W), y = Math.floor(v * mega.H); return x >= 0 && y >= 0 && x < mega.W && y < mega.H ? mega.atlas[y * mega.W + x] : -1; };
  return { sdf, rgba, near, texelAtUV, seeds: tail ? near.filter((x) => x >= 0).length : 0 };
}

/**
 * 射线：world 起点 o、单位方向 dir、最大长度 maxT。lowerBound 大时球步进，否则逐格 DDA。
 * 返回 { hit: 实心格号 | -1, prev: 命中前最后一个空格号, axisDir: 穿越面的方向号（从实心格看）}。
 */
export function makeTracer(vox, sdf, stats = { rays: 0, sphere: 0, dda: 0 }) {
  const { nx, ny, nz, solid, res, dy, minX, minZ } = vox, sp = [res, dy, res], dims = [nx, ny, nz];
  const trace = (o, dir, maxT) => {
    stats.rays++;
    const v0 = [(o[0] - minX) / res, o[1] / dy, (o[2] - minZ) / res], dv = [dir[0] / res, dir[1] / dy, dir[2] / res];
    let t = 0, prev = -1, prevP = null;
    for (let it = 0; it < 512; it++) {
      const v = [v0[0] + dv[0] * t, v0[1] + dv[1] * t, v0[2] + dv[2] * t], p = v.map(Math.floor);
      if (p.some((x, i) => x < 0 || x >= dims[i])) return { hit: -1, prev, axisDir: -1 };
      const k = (p[2] * ny + p[1]) * nx + p[0];
      if (solid[k]) {
        let axisDir = -1;
        if (prevP) for (let a = 0; a < 3; a++) if (prevP[a] !== p[a]) { axisDir = a * 2 + (prevP[a] > p[a] ? 0 : 1); break; }
        return { hit: k, prev, axisDir };
      }
      prev = k; prevP = p;
      const b = sdf.lowerBound(v);
      if (b > res) { t += b * .9; stats.sphere++; }
      else {
        let tx = Infinity;
        for (let a = 0; a < 3; a++) { if (Math.abs(dv[a]) < 1e-12) continue; const edge = dv[a] > 0 ? p[a] + 1 : p[a]; tx = Math.min(tx, (edge - v[a]) / dv[a]); }
        t += Math.max(tx, 0) + 1e-5 * Math.min(...sp); stats.dda++;
      }
      if (t > maxT) return { hit: -1, prev, axisDir: -1 };
    }
    return { hit: -1, prev, axisDir: -1 };
  };
  return trace;
}

const tiltRays = (d, deg = 40) => {
  const n = AX[d], a = d >> 1, [u, v] = [[1, 2], [0, 2], [0, 1]][a], s = Math.sin(deg * Math.PI / 180), c = Math.cos(deg * Math.PI / 180), out = [n.slice()];
  for (const [i, sg] of [[u, 1], [u, -1], [v, 1], [v, -1]]) { const r = n.map((x) => x * c); r[i] += sg * s; out.push(r); }
  return out;
};

/**
 * 主入口。返回 { vox, mega, sdfuv, lv, stats, steps[] } 和逐轮快照（可逐步播放：reset / direct / volume k / texture k）。
 */
export function bakeMegaTextureGI(world, index, { L = .5, res = .25, lvScale = 2, sun = [.4, .8, .45], sunColor = [1, .95, .85], sunIntensity = 1, sky = [.55, .62, .75], skyIntensity = 1, bounces = 4, maxDist = 4, albedoOf, keepSnapshots = false, maxVoxels } = {}) {
  if (!Number.isInteger(bounces) || bounces < 0 || bounces > 12 || !Number.isInteger(lvScale) || lvScale < 1 || lvScale > 4) throw new RangeError('megatexture-gi: options');
  const t0 = performance.now(), vox = voxelizeWorld(world, index, { L, res, albedoOf, maxVoxels }); if (!vox) return null;
  const mega = buildMegaTexture(vox), sdfuv = buildSdfUV(vox, mega), stats = { rays: 0, sphere: 0, dda: 0 }, trace = makeTracer(vox, sdfuv.sdf, stats);
  const T = mega.count, S = (() => { const l = Math.hypot(...sun); return sun.map((x) => x / l); })();
  // --- 直射（每纹素：N·L × 太阳可见）
  const direct = new Float32Array(T * 3), reach = Math.hypot(vox.nx * res, vox.ny * vox.dy, vox.nz * res);
  for (let t = 0; t < T; t++) {
    const n = mega.nrm.subarray(t * 3, t * 3 + 3), ndl = n[0] * S[0] + n[1] * S[1] + n[2] * S[2]; if (ndl <= 0) continue;
    const o = [mega.pos[t * 3] + n[0] * res * .05, mega.pos[t * 3 + 1] + n[1] * vox.dy * .05, mega.pos[t * 3 + 2] + n[2] * res * .05];
    if (trace(o, S, reach).hit >= 0) continue;
    for (let c = 0; c < 3; c++) direct[t * 3 + c] = sunIntensity * sunColor[c] * ndl;
  }
  // --- 六向光体积（粗格）与命中缓存
  const lres = res * lvScale, ldy = vox.dy * lvScale, lnx = Math.ceil(vox.nx / lvScale), lny = Math.ceil(vox.ny / lvScale), lnz = Math.ceil(vox.nz / lvScale), LN = lnx * lny * lnz, lid = (x, y, z) => (z * lny + y) * lnx + x;
  const lsolid = new Uint8Array(LN), RAYS = AX.map((_, d) => tiltRays(d)), R = RAYS[0].length;
  const hitTex = new Int32Array(LN * 6 * R).fill(-2);   // -2 = 实心格（不算）；-1 = 没命中
  const sky6 = new Float32Array(LN * 6 * 3);              // 每 lobe 逃逸射线的天光（几何不变 → 常量）
  let uvMatch = 0, uvHits = 0;
  for (let z = 0; z < lnz; z++) for (let y = 0; y < lny; y++) for (let x = 0; x < lnx; x++) {
    const L0 = lid(x, y, z), cx = Math.min(vox.nx - 1, x * lvScale + (lvScale >> 1)), cy = Math.min(vox.ny - 1, y * lvScale + (lvScale >> 1)), cz = Math.min(vox.nz - 1, z * lvScale + (lvScale >> 1));
    if (vox.solid[vox.id(cx, cy, cz)]) { lsolid[L0] = 1; continue; }
    const o = [vox.minX + (x + .5) * lres, (y + .5) * ldy, vox.minZ + (z + .5) * lres];
    for (let d = 0; d < 6; d++) for (let r = 0; r < R; r++) {
      const dir = RAYS[d][r], l = Math.hypot(...dir), u = dir.map((q) => q / l), h = trace(o, u, maxDist), slot = (L0 * 6 + d) * R + r;
      if (h.hit < 0) { hitTex[slot] = -1; if (u[1] > 0) for (let c = 0; c < 3; c++) sky6[(L0 * 6 + d) * 3 + c] += sky[c] * skyIntensity / R; continue; }
      // 「sampling the mega texture using the UVs where it hits the sdf」：命中前的空格读 SDF 的 RG → 图集 → 纹素
      const rg = h.prev >= 0 ? sdfuv.rgba.subarray(h.prev * 4, h.prev * 4 + 2) : null, tex = rg ? sdfuv.texelAtUV(rg[0], rg[1]) : -1;
      hitTex[slot] = tex;
      if (h.axisDir >= 0) { uvHits++; if (mega.faceTex[h.hit * 6 + h.axisDir] === tex) uvMatch++; }
    }
  }
  const lv = new Float32Array(LN * 6 * 3), exitance = new Float32Array(T * 3), indirect = new Float32Array(T * 3);
  const gatherVolume = () => {
    for (let L0 = 0; L0 < LN; L0++) { if (lsolid[L0]) continue; for (let d = 0; d < 6; d++) { const o = (L0 * 6 + d) * 3; let r0 = sky6[o], g0 = sky6[o + 1], b0 = sky6[o + 2]; for (let r = 0; r < R; r++) { const tx = hitTex[(L0 * 6 + d) * R + r]; if (tx < 0) continue; r0 += exitance[tx * 3] / R; g0 += exitance[tx * 3 + 1] / R; b0 += exitance[tx * 3 + 2] / R; } lv[o] = r0; lv[o + 1] = g0; lv[o + 2] = b0; } }
  };
  /** 光体积按法线取间接辐照：Σ n_a² · lobe(朝法线那侧)，空格加权三线性。 */
  const sampleLV = (px, py, pz, n, out = [0, 0, 0]) => {
    out[0] = out[1] = out[2] = 0;
    const fx = (px - vox.minX) / lres - .5, fy = py / ldy - .5, fz = (pz - vox.minZ) / lres - .5;
    const x0 = Math.max(0, Math.min(lnx - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(lny - 2, Math.floor(fy))), z0 = Math.max(0, Math.min(lnz - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0)), tz = Math.min(1, Math.max(0, fz - z0));
    const len = Math.hypot(n[0], n[1], n[2]) || 1; let ws = 0;
    for (let c = 0; c < 8; c++) {
      const k = lid(x0 + (c & 1), y0 + ((c >> 1) & 1), z0 + ((c >> 2) & 1)); if (lsolid[k]) continue;
      const w = (c & 1 ? tx : 1 - tx) * ((c >> 1) & 1 ? ty : 1 - ty) * ((c >> 2) & 1 ? tz : 1 - tz); if (w <= 0) continue; ws += w;
      for (let a = 0; a < 3; a++) { const na = n[a] / len, wa = na * na; if (!wa) continue; const d = a * 2 + (na < 0 ? 1 : 0), o = (k * 6 + d) * 3; out[0] += w * wa * lv[o]; out[1] += w * wa * lv[o + 1]; out[2] += w * wa * lv[o + 2]; }
    }
    if (ws > 1e-4) { out[0] /= ws; out[1] /= ws; out[2] /= ws; }
    return out;
  };
  const relightTexture = () => {
    const tmp = [0, 0, 0];
    for (let t = 0; t < T; t++) {
      const n = mega.nrm.subarray(t * 3, t * 3 + 3);
      sampleLV(mega.pos[t * 3] + n[0] * lres * .5, mega.pos[t * 3 + 1] + n[1] * ldy * .5, mega.pos[t * 3 + 2] + n[2] * lres * .5, n, tmp);
      for (let c = 0; c < 3; c++) { indirect[t * 3 + c] = tmp[c]; exitance[t * 3 + c] = mega.albedo[t * 3 + c] * (direct[t * 3 + c] + tmp[c]); }
    }
  };
  const snapshots = [], snap = (stage, k) => { if (keepSnapshots) snapshots.push({ stage, bounce: k, exitance: exitance.slice(), lv: lv.slice() }); };
  snap('reset', 0);
  // 直射进 mega texture（光体积仍为 0）
  for (let t = 0; t < T; t++) for (let c = 0; c < 3; c++) exitance[t * 3 + c] = mega.albedo[t * 3 + c] * direct[t * 3 + c];
  snap('direct', 0);
  const bounceStats = [];
  for (let b = 1; b <= bounces; b++) {
    const before = exitance.slice();
    gatherVolume(); snap('volume', b);
    relightTexture(); snap('texture', b);
    let sum = 0, max = 0, prevSum = 0, energy = 0;
    for (let i = 0; i < T * 3; i++) { const d = Math.abs(exitance[i] - before[i]); sum += d; max = Math.max(max, d); prevSum += before[i]; energy += exitance[i]; }
    bounceStats.push({ bounce: b, meanChange: sum / (T * 3), maxChange: max, relativeChange: prevSum > 0 ? sum / prevSum : null, meanExitance: energy / (T * 3) });
  }
  const out = {
    vox, mega, sdfuv, direct, indirect, exitance, lv, lsolid, lnx, lny, lnz, lres, ldy, snapshots, bounceStats, sampleLV,
    stats: { voxels: vox.N, texels: T, atlas: [mega.W, mega.H], charts: mega.charts, lvCells: LN, lvEmpty: LN - lsolid.reduce((s, x) => s + x, 0), raysPerLobe: R, rays: stats.rays, sphereSteps: stats.sphere, ddaSteps: stats.dda, uvHits, uvMatch, uvMatchRate: uvHits ? uvMatch / uvHits : null, ms: Math.round(performance.now() - t0) },
  };
  /** 网格顶点 → 间接辐照（光体积按法线取）。 */
  out.sampleIndirect = (px, py, pz, n) => sampleLV(px + n[0] * lres * .5, py + n[1] * ldy * .5, pz + n[2] * lres * .5, n, [0, 0, 0]);
  return out;
}

/** 参考：同一纹素场景，每纹素 N 条余弦加权射线直接取「精确穿越面」纹素（不经 SDF-UV、不经光体积），迭代 bounces 次。 */
export function referenceTexelBounce(res0, { rays = 96, bounces = 4, maxDist = 4, sky = [.55, .62, .75], seed = 1 } = {}) {
  const { vox, mega, sdfuv, direct } = res0, T = mega.count, trace = makeTracer(vox, sdfuv.sdf);
  let s = seed >>> 0 || 1; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296);
  const hits = new Int32Array(T * rays).fill(-1), skyAcc = new Float32Array(T * 3);
  for (let t = 0; t < T; t++) {
    const n = Array.from(mega.nrm.subarray(t * 3, t * 3 + 3)), a = Math.abs(n[0]) > .5 ? [0, 1, 0] : [1, 0, 0];
    const b1 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], b2 = [n[1] * b1[2] - n[2] * b1[1], n[2] * b1[0] - n[0] * b1[2], n[0] * b1[1] - n[1] * b1[0]];
    const o = [mega.pos[t * 3] + n[0] * vox.res * .05, mega.pos[t * 3 + 1] + n[1] * vox.dy * .05, mega.pos[t * 3 + 2] + n[2] * vox.res * .05];
    for (let r = 0; r < rays; r++) {
      const u1 = rnd(), u2 = rnd(), rr = Math.sqrt(u1), ph = 2 * Math.PI * u2, x = rr * Math.cos(ph), y = rr * Math.sin(ph), z = Math.sqrt(1 - u1);
      const d = [0, 1, 2].map((i) => b1[i] * x + b2[i] * y + n[i] * z), h = trace(o, d, maxDist);
      if (h.hit >= 0 && h.axisDir >= 0) hits[t * rays + r] = mega.faceTex[h.hit * 6 + h.axisDir];
      else if (h.hit < 0 && d[1] > 0) for (let c = 0; c < 3; c++) skyAcc[t * 3 + c] += sky[c] / rays;   // 逃逸且朝上 = 天光（与 lobe 同口径）
    }
  }
  const ex = new Float32Array(T * 3), ind = new Float32Array(T * 3);
  for (let t = 0; t < T; t++) for (let c = 0; c < 3; c++) ex[t * 3 + c] = mega.albedo[t * 3 + c] * direct[t * 3 + c];
  for (let b = 0; b < bounces; b++) {
    const prev = ex.slice();
    for (let t = 0; t < T; t++) { for (let c = 0; c < 3; c++) { let acc = skyAcc[t * 3 + c]; for (let r = 0; r < rays; r++) { const h = hits[t * rays + r]; if (h >= 0) acc += prev[h * 3 + c] / rays; } ind[t * 3 + c] = acc; ex[t * 3 + c] = mega.albedo[t * 3 + c] * (direct[t * 3 + c] + acc); } }
  }
  return { indirect: ind, exitance: ex };
}

export const pearson = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let sab = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; sa += x * x; sb += y * y; } return sab / Math.sqrt(sa * sb || 1); };
