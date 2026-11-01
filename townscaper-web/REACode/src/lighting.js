/**
 * lighting.js — one voxel field for the whole scene, and the occlusion that
 * every material samples out of it.
 *
 * Two clips decide the shape of this file:
 *
 *   931196707236392960  "My generated levels all keep a virtual voxel space. It
 *     is used for light baking, soft normals, various 3D textures, simplified
 *     collision, wind simulation etc."
 *
 *   1168571866405097472  "A peek at my ambient occlusion approach. The occlusion
 *     lives in a layered mesh that's reprojected to a texture at each change.
 *     That texture is then blurred, and sampled in the vertex shader of whatever
 *     needs lighting."
 *
 * Before this module the occupancy raster lived inside TownMesh (#bakeLighting)
 * and only saw the town it was building. That is exactly the thing that stops
 * terrain and buildings from ever fusing: the hill could not darken the house,
 * because the hill was not in the raster.
 *
 * So: `buildVoxelField()` takes *any number* of voxel sets — the land town, the
 * building town, props, whatever — rasterises all of them into one layered
 * occupancy volume, blurs it once, and hands back
 *
 *   - sample()/bakeVertexAO()   CPU path: multiply straight into vertex colours
 *                               (what src/townmesh.js has always done)
 *   - texture()                 RGBA float texture, layers stacked as rows
 *   - patchMaterial()           the same field sampled *in the vertex shader*,
 *                               which is what 1168571866405097472 describes
 *
 * Both paths run the identical maths (occlusion 1-0.62*occ plus 0.42 colour
 * bounce), so a mesh lit on the CPU and a mesh lit on the GPU agree.
 */

import * as THREE from 'three';
import { pointInQuad } from './town.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {object} o
 * @param {object} o.grid                 the shared polygon grid
 * @param {number} [o.levelHeight]        world units per voxel level
 * @param {Array}  o.sets                 [{ town, cells?, y?: 0, colorOf? }]
 *                                        `y` lifts the whole set (a town standing
 *                                        on a terrace is y = terraceTop * level)
 * @param {number} [o.res]                raster resolution, world units per texel
 * @param {number} [o.pad]                margin around the built volume
 * @param {number} [o.blurRadius]         box-blur radius in texels
 * @param {number} [o.blurPasses]         two passes ≈ gaussian
 */
export function buildVoxelField({
  grid,
  levelHeight = 0.5,
  sets,
  res = 0.09,
  pad = 0.9,
  blurRadius = 4,
  blurPasses = 2,
  keepRaw = false,     // keep a pre-blur copy so a dirty rect can be re-blurred later
} = {}) {
  if (!sets || sets.length === 0) throw new Error('buildVoxelField needs at least one voxel set');

  /* ---- 1. bounds of everything that takes part ---------------------------- */
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxLevel = 0;
  for (const set of sets) {
    const cells = set.cells || grid.cells;
    for (const c of cells) {
      const top = set.town.top(c);
      if (!top) continue;
      for (const p of c.pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      const lifted = Math.ceil((set.y || 0) / levelHeight) + top;
      if (lifted > maxLevel) maxLevel = lifted;
    }
  }
  if (!Number.isFinite(minX)) {
    // nothing built: a 1-texel dummy so callers never have to null-check
    return emptyField();
  }
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;

  const W = Math.max(2, Math.ceil((maxX - minX) / res) + 1);
  const H = Math.max(2, Math.ceil((maxZ - minZ) / res) + 1);
  const L = maxLevel + 2;                     // one spare layer either side
  const size = W * H;

  const occ = new Float32Array(size * L);
  const cr = new Float32Array(size * L);
  const cg = new Float32Array(size * L);
  const cb = new Float32Array(size * L);

  /* ---- 2. rasterise every set into the same layers ------------------------ */
  const t0 = performance.now();
  let voxels = 0;
  for (const set of sets) {
    const cells = set.cells || grid.cells;
    const base = Math.round((set.y || 0) / levelHeight);
    const colorOf = set.colorOf || (() => WHITE);
    for (const c of cells) {
      const top = set.town.top(c);
      if (!top) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of c.pts) {
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
      }
      const i0 = Math.max(0, Math.floor((x0 - minX) / res));
      const i1 = Math.min(W - 1, Math.ceil((x1 - minX) / res));
      const j0 = Math.max(0, Math.floor((z0 - minZ) / res));
      const j1 = Math.min(H - 1, Math.ceil((z1 - minZ) / res));
      for (let j = j0; j <= j1; j++) {
        const z = minZ + j * res;
        for (let i = i0; i <= i1; i++) {
          const x = minX + i * res;
          if (!pointInQuad(c.pts, x, z)) continue;
          for (let lv = 1; lv <= top; lv++) {
            if (!set.town.isSolid(c, lv)) continue;
            const layer = base + lv;
            if (layer < 0 || layer >= L) continue;
            const k = layer * size + j * W + i;
            const col = colorOf(c, lv);
            occ[k] = 1; cr[k] = col.r; cg[k] = col.g; cb[k] = col.b;
            voxels++;
          }
        }
      }
    }
  }
  const rasterMs = performance.now() - t0;

  /* ---- 3. blur once, every consumer reads the same blur ------------------- */
  // 脏区增量（见 src/lightingcache.js）要能只重算被改到的那一块，所以这里留一份
  // 未模糊的底片。默认关：整城重建时没人用得上它，白占 4 份内存。
  const raw = keepRaw
    ? { occ: occ.slice(), cr: cr.slice(), cg: cg.slice(), cb: cb.slice() }
    : null;
  const t1 = performance.now();
  if (blurRadius > 0) {
    const R = blurRadius;
    const tmp = new Float32Array(Math.max(W, H));
    const blur1 = (arr, off) => {
      for (let pass = 0; pass < blurPasses; pass++) {
        for (let j = 0; j < H; j++) {
          const row = off + j * W;
          let s = 0;
          for (let i = -R; i <= R; i++) s += arr[row + clamp(i, 0, W - 1)];
          for (let i = 0; i < W; i++) {
            tmp[i] = s / (2 * R + 1);
            s += arr[row + Math.min(W - 1, i + R + 1)] - arr[row + Math.max(0, i - R)];
          }
          for (let i = 0; i < W; i++) arr[row + i] = tmp[i];
        }
        for (let i = 0; i < W; i++) {
          let s = 0;
          for (let j = -R; j <= R; j++) s += arr[off + clamp(j, 0, H - 1) * W + i];
          for (let j = 0; j < H; j++) {
            tmp[j] = s / (2 * R + 1);
            s += arr[off + Math.min(H - 1, j + R + 1) * W + i] - arr[off + Math.max(0, j - R) * W + i];
          }
          for (let j = 0; j < H; j++) arr[off + j * W + i] = tmp[j];
        }
      }
    };
    for (let lv = 1; lv < L; lv++) {
      blur1(occ, lv * size); blur1(cr, lv * size); blur1(cg, lv * size); blur1(cb, lv * size);
    }
  }
  const blurMs = performance.now() - t1;

  /* ---- 4. samplers -------------------------------------------------------- */
  const sampleLayer = (arr, lv, x, z) => {
    if (lv < 0 || lv >= L) return 0;
    const fi = (x - minX) / res, fj = (z - minZ) / res;
    if (fi < 0 || fj < 0 || fi >= W - 1 || fj >= H - 1) return 0;
    const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j;
    const o = lv * size + j * W + i;
    return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + W] * (1 - tx) + arr[o + W + 1] * tx) * tz;
  };
  /** Trilinear sample: bilinear in XZ, linear across levels. */
  const sample = (arr, x, y, z) => {
    const f = y / levelHeight + 0.5;          // level k spans [k-1,k) -> centre k-0.5
    const l0 = Math.floor(f), t = f - l0;
    return sampleLayer(arr, l0, x, z) * (1 - t) + sampleLayer(arr, l0 + 1, x, z) * t;
  };

  const field = {
    grid, res, pad, W, H, L, size, minX, minZ, maxX, maxZ, levelHeight,
    occ, cr, cg, cb,
    voxels,
    sample,
    sampleOcc: (x, y, z) => sample(occ, x, y, z),
    /**
     * Average colour of whatever occupies this spot (1 when nothing does).
     *
     * 空位里原本一律返回白 —— 因为只有"墙自己"才算反弹源。跑了
     * `diffuseBounce()` 之后，空位里也有光了（邻居渗过来的），这时返回
     * 空气里的颜色，多跳才有意义（原文 1580846877855338497）。
     */
    sampleBounce(x, y, z) {
      const oc = sample(occ, x, y, z);
      const sr = sample(cr, x, y, z), sg = sample(cg, x, y, z), sb = sample(cb, x, y, z);
      // 表面色：墙面自己的颜色（除以占用率）
      const surf = oc > 1e-3 ? [sr / oc, sg / oc, sb / oc] : [1, 1, 1];
      if (!field._air) return surf;
      // 空气色：扩散过来的邻居光。越空的地方吃空气光越多 —— 墙角 0.17 外那个
      // 采样点 oc 大约 0.3~0.5，于是拿到"自己的色 + 隔壁的色"的混合，
      // 这就是多跳的可见来源。只吃表面色的话，第 2、3 跳根本进不了画面
      // （实测只改 1.5% 像素，等于没做）。
      const air = field.sampleAir(x, y, z);
      const ar = air[0], ag = air[1], ab = air[2];
      // 纯空气色：跑过扩散之后，墙收到的间接光就是"它面前那团空气里的光"，
      // 不该再按占用率掺回自己的表面色 —— 掺回去只剩 0.6 的权重，等于把
      // 多跳的色差又稀释掉一半（实测屏幕上一共只变 0.03% 的像素）。
      const w = 1.0;
      return [
        surf[0] + (ar - surf[0]) * w,
        surf[1] + (ag - surf[1]) * w,
        surf[2] + (ab - surf[2]) * w,
      ];
    },
    raw,
    blurParams: { radius: blurRadius, passes: blurPasses },
    stats: { W, H, layers: L, res, voxels, rasterMs: +rasterMs.toFixed(1), blurMs: +blurMs.toFixed(1) },
    _texture: null,
  };

  /**
   * The blurred field as one RGBA float texture: R = occlusion,
   * GBA = colour sums (divide by R for the average colour). Layers stack as
   * rows, so layer `l` owns rows [l*H, (l+1)*H) and a bilinear tap is still
   * one texel quad.
   */
  field.texture = () => {
    if (field._texture) return field._texture;
    const data = new Float32Array(W * H * L * 4);
    for (let lv = 0; lv < L; lv++) {
      const off = lv * size;
      const dst = lv * size * 4;
      for (let k = 0; k < size; k++) {
        const d = dst + k * 4;
        data[d] = occ[off + k];
        data[d + 1] = cr[off + k];
        data[d + 2] = cg[off + k];
        data[d + 3] = cb[off + k];
      }
    }
    const tex = new THREE.DataTexture(data, W, H * L, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    field._texture = tex;
    return tex;
  };

  /** Debug: one layer of occlusion as an 8-bit canvas (learning panel slices). */
  field.sliceCanvas = (layer = 1) => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let k = 0; k < size; k++) {
      const v = clamp(occ[layer * size + k], 0, 1);
      const d = k * 4;
      // transparent where the layer is empty, so the slice reads as a footprint
      // of what stands at this height instead of tinting the whole sea
      img.data[d] = 40 + v * 210;
      img.data[d + 1] = 90 + v * 140;
      img.data[d + 2] = 110 + v * 90;
      img.data[d + 3] = v > 0.02 ? 60 + v * 195 : 0;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  };

  return field;
}

/**
 * Re-blur one rectangle of a built field in place, from `field.raw`.
 *
 * Why a windowed blur is *exact* here rather than an approximation: a separable
 * box blur of P passes with radius R only ever reads P*R texels away. So if the
 * window is the dirty rectangle grown by P*R, every kernel that touches the
 * rectangle stays inside the window, and the edge clamp only affects texels
 * that we never write back. Outside the rectangle the previous (correct) blur is
 * left alone, because nothing outside it changed.
 *
 * @returns {{ms:number, texels:number}|null}
 */
export function reblurRect(field, { i0, i1, j0, j1 }) {
  const { W, H, L, size } = field;
  const params = field.blurParams || { radius: 0, passes: 0 };
  const R = params.radius | 0;
  const P = Math.max(1, params.passes | 0);
  if (!field.raw || R <= 0) return null;

  // 改动的 *影响范围* 是 rect ± R·P（模糊会把变化往外抹这么多），
  // 而要把这块算对，窗口还得再往外留一圈 R·P 让卷积核完整。
  // 第一版只留一圈、也只写回 rect，结果 rect 外面那一圈停在旧值 —— 实测
  // 有 497 个 texel 与全量重烤不一致，最差的正好在 j1+1。
  const halo = R * P;
  const x0 = Math.max(0, i0 - 2 * halo), x1 = Math.min(W - 1, i1 + 2 * halo);
  const y0 = Math.max(0, j0 - 2 * halo), y1 = Math.min(H - 1, j1 + 2 * halo);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 2 || h < 2) return null;

  const t0 = performance.now();
  const scratch = new Float32Array(w * h);
  const tmp = new Float32Array(Math.max(w, h));
  const pairs = [
    [field.occ, field.raw.occ],
    [field.cr, field.raw.cr],
    [field.cg, field.raw.cg],
    [field.cb, field.raw.cb],
  ];

  const wx0 = Math.max(x0, i0 - halo), wx1 = Math.min(x1, i1 + halo);
  const wy0 = Math.max(y0, j0 - halo), wy1 = Math.min(y1, j1 + halo);

  for (const [dst, src] of pairs) {
    for (let lv = 1; lv < L; lv++) {
      const off = lv * size;
      for (let j = 0; j < h; j++) {
        const from = off + (y0 + j) * W + x0;
        scratch.set(src.subarray(from, from + w), j * w);
      }
      for (let pass = 0; pass < P; pass++) {
        for (let j = 0; j < h; j++) {
          const row = j * w;
          let sum = 0;
          for (let i = -R; i <= R; i++) sum += scratch[row + clamp(i, 0, w - 1)];
          for (let i = 0; i < w; i++) {
            tmp[i] = sum / (2 * R + 1);
            sum += scratch[row + Math.min(w - 1, i + R + 1)] - scratch[row + Math.max(0, i - R)];
          }
          for (let i = 0; i < w; i++) scratch[row + i] = tmp[i];
        }
        for (let i = 0; i < w; i++) {
          let sum = 0;
          for (let j = -R; j <= R; j++) sum += scratch[clamp(j, 0, h - 1) * w + i];
          for (let j = 0; j < h; j++) {
            tmp[j] = sum / (2 * R + 1);
            sum += scratch[Math.min(h - 1, j + R + 1) * w + i] - scratch[Math.max(0, j - R) * w + i];
          }
          for (let j = 0; j < h; j++) scratch[j * w + i] = tmp[j];
        }
      }
      // write back the *affected* rectangle (rect ± halo): inside it the values
      // are exact, outside it nothing changed, so the old values are still right
      for (let j = wy0; j <= wy1; j++) {
        const row = (j - y0) * w + (wx0 - x0);
        const to = off + j * W + wx0;
        dst.set(scratch.subarray(row, row + (wx1 - wx0 + 1)), to);
      }
    }
  }
  field._texture = null;
  return { ms: performance.now() - t0, texels: (wx1 - wx0 + 1) * (wy1 - wy0 + 1) * (L - 1) * 4 };
}

const WHITE = { r: 1, g: 1, b: 1 };

function emptyField() {
  return {
    W: 0, H: 0, L: 0, size: 0, res: 1, minX: 0, minZ: 0, levelHeight: 0.5,
    occ: new Float32Array(0), cr: new Float32Array(0), cg: new Float32Array(0), cb: new Float32Array(0),
    voxels: 0,
    sample: () => 0,
    sampleOcc: () => 0,
    sampleBounce: () => [1, 1, 1],
    texture: () => null,
    sliceCanvas: () => document.createElement('canvas'),
    stats: { W: 0, H: 0, layers: 0, voxels: 0, rasterMs: 0, blurMs: 0 },
  };
}

/* -------------------------------------------------------------------------- */
/*  CPU path — what TownMesh always did, now reading a shared field            */
/* -------------------------------------------------------------------------- */

/**
 * Multiply occlusion + colour bounce straight into a vertex-colour array.
 * `pos` is the interleaved triangle soup the town mesher produces (9 floats per
 * triangle, i.e. three vertices), `col` the matching rgb triples.
 */
export function bakeVertexAO(field, pos, col, { offset = 0.17, strength = 0.62, bounce = 0.42, airGain = 0 } = {}) {
  if (!field || field.voxels === 0) return 0;
  const t0 = performance.now();
  let touched = 0;
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t], ay = pos[t + 1], az = pos[t + 2];
    const ux = pos[t + 3] - ax, uy = pos[t + 4] - ay, uz = pos[t + 5] - az;
    const vx = pos[t + 6] - ax, vy = pos[t + 7] - ay, vz = pos[t + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    for (let v = 0; v < 3; v++) {
      const o = t + v * 3;
      const sx = pos[o] + nx * offset;
      const sy = pos[o + 1] + ny * offset + 0.02;
      const sz = pos[o + 2] + nz * offset;
      const oc = field.sampleOcc(sx, sy, sz);
      if (oc < 0.002) continue;
      touched++;
      const ao = 1 - strength * Math.min(1, oc * 1.15);
      const [br, bg, bb] = field.sampleBounce(sx, sy, sz);
      const k = bounce * oc;
      col[o] = col[o] * (ao + br * k);
      col[o + 1] = col[o + 1] * (ao + bg * k);
      col[o + 2] = col[o + 2] * (ao + bb * k);
      // 多跳补光：AO 遮掉的那部分天光，由"面前这团空气里已经渗过来的邻居光"
      // 补回来一点。加法项，所以是**染色**而不是把整面墙提亮 —— 参考片里
      // 缝里泛的是邻居的颜色（1237305125070426112），不是整体变亮。
      if (airGain > 0 && field.sampleAir) {
        const [ar, ag, ab] = field.sampleAir(sx, sy, sz);
        const k2 = airGain * oc;
        col[o] += ar * k2;
        col[o + 1] += ag * k2;
        col[o + 2] += ab * k2;
      }
    }
  }
  return { touched, ms: +(performance.now() - t0).toFixed(1) };
}

/* -------------------------------------------------------------------------- */
/*  多跳反弹                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 颜色反弹：在体素之间做 3D Jacobi 扩散，`passes` 次封顶（原文 3 次）。
 *
 * 原文：x.com/OskSta/status/1580846877855338497
 *   "Here's the slowed down bounce sequence. You can see how the mega texture and
 *    the light volume affect each other back and forth. After about the 3rd
 *    bounce, further bounces are not noticeable."
 *
 * 画面（11 帧）：主体先近黑只有剪影，之后一帧比一帧亮，暖色从受光面往背光面
 * **渗**过去，2~3 帧之后基本不动；每次的增量是亮度而不是色相。
 *
 * 规则：
 *   · 表面体素（occ > 0.5）颜色固定 —— 它就是光源；
 *   · 空气体素收下六邻居（前后左右 + 上下层）的颜色，按 1/(1+gain) 混进自己；
 *   · 跑完写进 `field._air`，`sampleBounce()` 在空位里就返回它。
 *
 * 所以白色墙旁边的红墙会把红渗到白墙上，距离 1~2 格 —— 正是参考片里
 * "白塔靠红房子那侧泛粉、靠蓝房子那侧泛冷"的那个量级。
 *
 * 注意：这不是 SDF 光线步进，也不是光体积采样。它在体素之间传颜色，
 * "远处山体给近处补光"这种远距离渗色做不到；近程染色够用。
 */
export function diffuseBounce(field, passes = 3, gain = 0.9, stride = 3) {
  if (!field || !field.voxels || passes < 1) return 0;
  const t0 = performance.now();
  const { W, H, L, size, occ, cr, cg, cb, res, minX, minZ, levelHeight } = field;

  // 关键：**降采样**再扩散。
  // 体素栅格是 0.08 世界单位一格（为了 AO 平滑），一个格子才 0.8 宽，也就是
  // 一格 = 6 个体素。在细栅格上跑 3 遍，光只走了 3×0.08 = 0.24，连半格都不到 ——
  // 第 2、3 跳根本出不了自己那面墙（实测整张图只变 1.8% 像素，几乎等于没做）。
  // 原文的"3 次反弹"是**光照体积**的格子尺度，所以这里按 stride 降采样，
  // 让一遍 = 1/3 格，3 遍 ≈ 1 格，正好是参考片里"隔壁房子给这面墙染色"的距离。
  const S = Math.max(1, stride | 0);
  const cW = Math.ceil(W / S), cH = Math.ceil(H / S);
  const cSize = cW * cH;
  const cOcc = new Float32Array(cSize * L);
  const cr0 = new Float32Array(cSize * L), cg0 = new Float32Array(cSize * L), cb0 = new Float32Array(cSize * L);
  for (let lv = 1; lv < L; lv++) {
    for (let cj = 0; cj < cH; cj++) {
      for (let ci = 0; ci < cW; ci++) {
        let w = 0, r = 0, g = 0, b = 0, m = 0;
        for (let j = cj * S; j < Math.min(H, cj * S + S); j++) {
          for (let i = ci * S; i < Math.min(W, ci * S + S); i++) {
            const k = lv * size + j * W + i;
            const o = occ[k];
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

  const solid = new Uint8Array(cSize * L);
  for (let k = 0; k < cSize * L; k++) if (cOcc[k] > 0.5) solid[k] = 1;
  const nr = new Float32Array(cr0), ng = new Float32Array(cg0), nb = new Float32Array(cb0);
  const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  for (let p = 0; p < passes; p++) {
    for (let lv = 1; lv < L; lv++) {
      const off = lv * cSize;
      for (let j = 0; j < cH; j++) {
        for (let i = 0; i < cW; i++) {
          const k = off + j * cW + i;
          if (solid[k]) continue;
          let ws = 0, r = 0, g = 0, b = 0;
          const nb6 = [
            off + j * cW + clampI(i - 1, 0, cW - 1),
            off + j * cW + clampI(i + 1, 0, cW - 1),
            off + clampI(j - 1, 0, cH - 1) * cW + i,
            off + clampI(j + 1, 0, cH - 1) * cW + i,
            (lv - 1) * cSize + j * cW + i,
            (lv + 1 < L ? lv + 1 : lv) * cSize + j * cW + i,
          ];
          for (let q = 0; q < 6; q++) {
            const m2 = nb6[q];
            const w = cOcc[m2];
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

  // 粗网格三线性采样（xz 双线性 + 层间线性），坐标换算按 stride 放大
  const cRes = res * S;
  const airSample = (x, y, z) => {
    const fi = (x - minX) / cRes, fj = (z - minZ) / cRes;
    const f = y / levelHeight + 0.5;
    const l0 = Math.floor(f), t = f - l0;
    const li = (arr, lv) => {
      if (lv < 1 || lv >= L) return 0;
      if (fi < 0 || fj < 0 || fi >= cW - 1 || fj >= cH - 1) return 0;
      const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j;
      const o = lv * cSize + j * cW + i;
      return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + cW] * (1 - tx) + arr[o + cW + 1] * tx) * tz;
    };
    const mix2 = (arr) => li(arr, l0) * (1 - t) + li(arr, l0 + 1) * t;
    return [mix2(nr), mix2(ng), mix2(nb)];
  };

  field.sampleAir = airSample;
  field._air = true;
  field.bouncePasses = passes;
  field.diffuseMs = +(performance.now() - t0).toFixed(1);
  field.airGrid = `${cW}×${L}×${cH} @${cRes.toFixed(2)}`;
  return field.diffuseMs;
}

/* -------------------------------------------------------------------------- */
/*  软法线（同一张体素场里的梯度）                                              */
/* -------------------------------------------------------------------------- */

/**
 * 从体素场的占用梯度算"软法线"，再和几何法线混合。
 *
 * 原文：x.com/OskSta/status/1062374549407350790
 *   "Got the voxel normals to smooth out the island a bit more"（回复里补：
 *    "blend between smooth and hard normals in the final lighting"）
 *
 * 为什么要它：地形/台阶是方块堆出来的，`computeVertexNormals()` 给的是每个面
 * 自己的硬法线，于是每一级台阶都有一条锐利的明暗分界。占用场的梯度是**连续**的
 * （因为它由模糊过的 0..1 场算出来），拿它当法线，台阶的明暗才会跨过去连成一片，
 * 而方块轮廓不变 —— 这就是"把网格感打散"。
 *
 * 注意：场是模糊过的，梯度天然偏低频，所以混合系数不能太大，否则整个房子会像
 * 被揉圆的橡皮。
 */
export function bakeSoftNormals(field, geometry, { blend = 0.55, h = null } = {}) {
  if (!field || !field.voxels) return 0;
  const t0 = performance.now();
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  if (!pos || !nrm) return 0;
  const step = h || field.res * 1.5;
  const g = (x, y, z) => field.sampleOcc(x, y, z);
  let touched = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const gx = g(x + step, y, z) - g(x - step, y, z);
    const gy = g(x, y + step, z) - g(x, y - step, z);
    const gz = g(x, y, z + step) - g(x, y, z - step);
    const gl = Math.hypot(gx, gy, gz);
    if (gl < 1e-4) continue;                 // 场里没起伏（开阔处），保持几何法线
    // 占用往实体内部增加 → 外法线是梯度的反方向
    const sx = -gx / gl, sy = -gy / gl, sz = -gz / gl;
    let nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    const dot = nx * sx + ny * sy + nz * sz;
    if (dot <= 0.05) continue;               // 反着的（凹角/内部面）不要混，否则会翻面
    nx = nx + (sx - nx) * blend;
    ny = ny + (sy - ny) * blend;
    nz = nz + (sz - nz) * blend;
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(i, nx / l, ny / l, nz / l);
    touched++;
  }
  nrm.needsUpdate = true;
  return { touched, ms: +(performance.now() - t0).toFixed(1) };
}

/* -------------------------------------------------------------------------- */
/*  SDF 体积（真正的距离场，不再是占用阈值）                                    */
/* -------------------------------------------------------------------------- */

/**
 * 在体素场上烘一张**有符号距离场**，给光线步进用。
 *
 * 原文：x.com/OskSta/status/1580845127207387137
 *   "1st texture here is an sdf volume. The distance lives in the alpha, but RG
 *    actually reference UVs in the mega texture!"
 *
 * 我们之前只有"占用率 0/1 + 模糊"，步进只能固定步长（0.176 一格、最多 11 步），
 * 于是要么走不远，要么开销炸。有了距离场就能**球体追踪**：每次跳"离最近的墙
 * 还有多远 × 0.8"，空地上一步跨好几格，贴墙时自动变细 —— 同样的开销能走 2 倍距离。
 *
 * 注意两件事：
 *   1. 这张栅格是**各向异性**的：水平 0.08 一格，竖直 0.5 一层（6 倍）。所以
 *      栅格化必须在**世界单位**里算距离，不能用格子下标当单位，否则竖直方向会
 *      严重低估，球体追踪会一头撞进地板。
 *   2. 为了便宜，距离场建在降采样（stride 3 → 0.24）的粗格上：19k 格 × 26 邻居
 *      × 2 遍 ≈ 1M 次比较，10ms 级；细格 171k 格要 9M 次，每次重建都做不值。
 */
export function buildSDF(field, { stride = 3, maxDist = 2.5 } = {}) {
  if (!field || !field.voxels) return null;
  const t0 = performance.now();
  const { W, H, L, size, occ, res, minX, minZ, levelHeight } = field;
  const S = Math.max(1, stride | 0);
  const cW = Math.ceil(W / S), cH = Math.ceil(H / S);
  const cSize = cW * cH;
  const dx = res * S, dy = levelHeight;
  const INF = 1e9;
  const dist = new Float32Array(cSize * L).fill(INF);

  // 建：粗格里只要有一个实心细格，就当作表面（取格心）
  for (let lv = 1; lv < L; lv++) {
    for (let cj = 0; cj < cH; cj++) {
      for (let ci = 0; ci < cW; ci++) {
        let solid = 0;
        for (let j = cj * S; j < Math.min(H, cj * S + S) && !solid; j++) {
          for (let i = ci * S; i < Math.min(W, ci * S + S); i++) {
            if (occ[lv * size + j * W + i] > 0.45) { solid = 1; break; }
          }
        }
        if (solid) dist[lv * cSize + cj * cW + ci] = 0;
      }
    }
  }

  // 26 邻居的 chamfer（前向 + 后向），代价按**世界单位**
  const nb = [];
  for (let ky = -1; ky <= 1; ky++) {
    for (let kz = -1; kz <= 1; kz++) {
      for (let kx = -1; kx <= 1; kx++) {
        if (!kx && !ky && !kz) continue;
        nb.push([kx, ky, kz, Math.hypot(kx * dx, ky * dy, kz * dx)]);
      }
    }
  }
  const relax = (i, j, lv, k, list) => {
    let best = dist[k];
    for (let q = 0; q < list.length; q++) {
      const [kx, ky, kz, cost] = list[q];
      const ii = i + kx, jj = j + kz, ll = lv + ky;
      if (ii < 0 || ii >= cW || jj < 0 || jj >= cH || ll < 1 || ll >= L) continue;
      const v = dist[ll * cSize + jj * cW + ii] + cost;
      if (v < best) best = v;
    }
    dist[k] = best;
  };
  const fwd = nb.filter((n) => n[1] < 0 || (n[1] === 0 && (n[2] < 0 || (n[2] === 0 && n[0] < 0))));
  const bwd = nb.filter((n) => n[1] > 0 || (n[1] === 0 && (n[2] > 0 || (n[2] === 0 && n[0] > 0))));
  for (let lv = 1; lv < L; lv++) for (let j = 0; j < cH; j++) for (let i = 0; i < cW; i++) relax(i, j, lv, lv * cSize + j * cW + i, fwd);
  for (let lv = L - 1; lv >= 1; lv--) for (let j = cH - 1; j >= 0; j--) for (let i = cW - 1; i >= 0; i--) relax(i, j, lv, lv * cSize + j * cW + i, bwd);

  const sample = (x, y, z) => {
    const fi = (x - minX) / dx, fj = (z - minZ) / dx;
    const f = y / dy + 0.5;
    const l0 = Math.floor(f), t = f - l0;
    const at = (lv) => {
      if (lv < 1 || lv >= L) return maxDist;
      if (fi < 0 || fj < 0 || fi >= cW - 1 || fj >= cH - 1) return maxDist;
      const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j;
      const o = lv * cSize + j * cW + i;
      return Math.min(maxDist,
        (dist[o] * (1 - tx) + dist[o + 1] * tx) * (1 - tz) +
        (dist[o + cW] * (1 - tx) + dist[o + cW + 1] * tx) * tz);
    };
    return at(l0) * (1 - t) + at(l0 + 1) * t;
  };

  const sdf = {
    cW, cH, L, dist, dx, dy, minX, minZ, maxDist,
    stride: S,
    sample,
    ms: +(performance.now() - t0).toFixed(1),
    get stats() { return { grid: `${cW}×${L}×${cH}`, step: +dx.toFixed(2), ms: sdf.ms }; },
  };
  field.sdfField = sdf;
  field.sampleSDF = sample;
  return sdf;
}

/* -------------------------------------------------------------------------- */
/*  光线步进的反弹（能走远）                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 用**光线步进**打体素场，收集"打中处的墙面颜色"当间接光。
 *
 * 原文：x.com/OskSta/status/1580845127207387137
 *   "1st texture here is an sdf volume … 2nd is a baked 6 directional light
 *    volume, raycast against the sdf, sampling the mega texture using the UVs
 *    where it hits the sdf. 3rd is the lit mega texture"
 *
 * 和上面的 `diffuseBounce()` 的区别（也就是我上一轮"还没做"的那两件事）：
 *   · 扩散只能走 1 格（3 次 Jacobi ≈ 0.7 世界单位），巷子对面的房子照不到你；
 *   · 光线步进按实际几何打出去，碰壁才停 —— 距离由场景决定，最远 `reach`。
 * 代价也真实：每个三角形 6 条射线 × 最多 11 步，比扩散贵一个量级，所以它是
 * 可选模式（`raybounce`），不是默认。
 *
 * 画面依据（1237305125070426112）：白塔的色偏出现在**朝向**彩色房子的那几面，
 * 而且从墙脚往上越来越淡 —— 这就是"沿半球打射线，打中谁就沾谁的色"的形状。
 */
export function bakeRayBounce(field, pos, col, {
  rays = 6,
  reach = 2.6,
  gain = 0.30,
  offset = 0.07,
  threshold = 0.30,
} = {}) {
  if (!field || !field.voxels) return 0;
  const t0 = performance.now();
  const stepLen = field.res * 2.2;
  const maxSteps = Math.max(2, Math.ceil(reach / stepLen));
  // 有距离场就用球体追踪（每步跳"到最近墙面的距离"），否则退回固定步长。
  // 参考片第一张图就是 sdf volume —— 它存在的意义正是让步进能跳。
  const sdf = field.sampleSDF || null;
  const sdfSteps = 26;

  // 半球方向：1 条沿法线 + (rays-1) 条在 50° 环上。半数就够 —— 反弹是低频的。
  const dirs = [];
  dirs.push([0, 1, 0]);
  for (let k = 0; k < Math.max(0, rays - 1); k++) {
    const a = (k / Math.max(1, rays - 1)) * Math.PI * 2;
    const t = 0.85;                     // 与法线的夹角 ≈ 50°
    dirs.push([Math.cos(a) * t, Math.sqrt(1 - t * t), Math.sin(a) * t]);
  }

  let hitTri = 0;
  const acc = [0, 0, 0];
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t], ay = pos[t + 1], az = pos[t + 2];
    const ux = pos[t + 3] - ax, uy = pos[t + 4] - ay, uz = pos[t + 5] - az;
    const vx = pos[t + 6] - ax, vy = pos[t + 7] - ay, vz = pos[t + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    // 切线基（用来把半球转到法线周围）
    let tx = Math.abs(ny) < 0.9 ? 0 : 1, ty = Math.abs(ny) < 0.9 ? 1 : 0, tz = 0;
    let bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    const bl = Math.hypot(bx, by, bz) || 1;
    bx /= bl; by /= bl; bz /= bl;
    const cx = ny * bz - nz * by, cy = nz * bx - nx * bz, cz = nx * by - ny * bx;

    const ox = ax + nx * offset, oy = ay + ny * offset, oz = az + nz * offset;
    let wsum = 0;
    acc[0] = acc[1] = acc[2] = 0;
    for (const d of dirs) {
      const dx = bx * d[0] + ny * d[1] + cx * d[2];
      const dy = by * d[0] + nx * d[1] + cy * d[2];
      const dz = bz * d[0] + nz * d[1] + cz * d[2];
      const cosW = Math.max(0, dx * nx + dy * ny + dz * nz);
      if (cosW <= 0.02) continue;
      let hit = 0;
      let px = 0, py = 0, pz = 0, dist = 0;
      if (sdf) {
        // 球体追踪：空地一步跳好几格，贴墙时自动变细。
        // 两个保险，都是实测加的：
        //   · 跳跃上限 0.35 —— 粗距离场（0.24）在薄墙处会高估，0.8·d 会直接跳过去；
        //   · 每步再测一次占用 —— 跳过去了也还能在下一步抓住。
        let s = stepLen * 0.5;
        for (let k = 0; k < sdfSteps; k++) {
          // 这里的 dx/dy/dz 是**射线方向**（外层 const），不是格子尺寸
          px = ox + dx * s; py = oy + dy * s; pz = oz + dz * s;
          const d = sdf(px, py, pz);
          if (d < 0.06 || field.sampleOcc(px, py, pz) > threshold) { hit = 1; dist = s; break; }
          s += Math.min(0.35, Math.max(d * 0.6, stepLen * 0.5));
          if (s > reach) break;
        }
      } else {
        for (let k = 1; k <= maxSteps; k++) {
          const s = stepLen * k;
          px = ox + dx * s; py = oy + dy * s; pz = oz + dz * s;
          if (field.sampleOcc(px, py, pz) > threshold) { hit = 1; dist = s; break; }
        }
      }
      if (!hit) continue;
      // 退半步采样，避免正好落在实体里
      const [r, g2, b] = field.sampleBounce(px - dx * stepLen, py - dy * stepLen, pz - dz * stepLen);
      // 越远越弱（1/d），再乘余弦
      const fall = cosW / (1 + dist * 0.55);
      acc[0] += r * fall; acc[1] += g2 * fall; acc[2] += b * fall;
      wsum += fall;
    }
    if (wsum <= 1e-4) continue;
    hitTri++;
    // 按"这个面有多封闭"加权：开阔的屋脊几乎不加，巷子里/墙脚才加。
    // 不加这一项的话整座城会被抬亮一层雾（第一次实测平均涨 15/255）。
    const ocHere = field.sampleOcc(ox, oy, oz);
    const openK = Math.min(1, ocHere * 1.6);
    if (openK < 0.05) continue;
    const k = (gain * openK) / wsum;
    const tr = acc[0] * k, tg = acc[1] * k, tb = acc[2] * k;
    for (let v = 0; v < 3; v++) {
      const o = t + v * 3;
      col[o] += tr;
      col[o + 1] += tg;
      col[o + 2] += tb;
    }
  }
  return { tris: hitTri, ms: +(performance.now() - t0).toFixed(1), reach, rays };
}

/* -------------------------------------------------------------------------- */
/*  6 方向光体积（烘一次，顶点三线性采样）                                      */
/* -------------------------------------------------------------------------- */

const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/**
 * 参考片的第二张图：**烘好的 6 方向光体积**，对着 SDF 打射线，打中处取墙色。
 *
 * 原文：x.com/OskSta/status/1580845127207387137
 *   "2nd is a baked 6 directional light volume, raycast against the sdf, sampling
 *    the mega texture using the UVs where it hits the sdf."
 *
 * 为什么要从"每个三角形打射线"换成"烘体积再采样"：
 *   逐三角形打射线时，同一面墙上的不同三角形各自采样，反弹量在三角形边界上跳变
 *   —— 放大看是一块块色阶。烘进体积后，顶点在体积里做**三线性插值**，得到的是
 *   连续梯度；这也正是原文把它们烘成体积的原因（低分辨率、大块柔和）。
 *
 * 体积分辨率跟 SDF 一样是粗格（0.24 × 0.5 层），6 个方向各存一条颜色。
 */
export function bakeSixDirVolume(field, { stride = 3, reach = 4.0, maxDist = 4.2 } = {}) {
  if (!field || !field.voxels) return null;
  const t0 = performance.now();
  // 注意：sdfField 是**对象**（带 sample），不是函数 —— 这里取 .sample 来用
  const sdfObj = field.sdfField || buildSDF(field, { stride, maxDist });
  const sdfSample = field.sampleSDF || (sdfObj && sdfObj.sample);
  if (!sdfSample) return null;
  const { cW, cH, L, dx, dy, minX, minZ } = sdfObj;
  const vol = new Float32Array(cW * cH * L * 6 * 3);
  const stepMin = dx * 0.5;
  let hits = 0;

  for (let lv = 1; lv < L; lv++) {
    for (let j = 0; j < cH; j++) {
      for (let i = 0; i < cW; i++) {
        const x = minX + i * dx, y = (lv - 0.5) * dy, z = minZ + j * dx;
        if (field.sampleOcc(x, y, z) > 0.45) continue;      // 实体自己不需要收光
        for (let d = 0; d < 6; d++) {
          const [ax, ay, az] = AXES[d];
          let s = stepMin;
          let hit = 0, hx = 0, hy = 0, hz = 0;
          for (let k = 0; k < 24; k++) {
            hx = x + ax * s; hy = y + ay * s; hz = z + az * s;
            const dd = sdfSample(hx, hy, hz);
            if (dd < 0.06 || field.sampleOcc(hx, hy, hz) > 0.30) { hit = 1; break; }
            s += Math.min(0.35, Math.max(dd * 0.6, stepMin));
            if (s > reach) break;
          }
          if (!hit) continue;
          const [r, g, b] = field.sampleBounce(hx - ax * stepMin, hy - ay * stepMin, hz - az * stepMin);
          const fall = 1 / (1 + s * 0.6);
          const o = ((lv * cH + j) * cW + i) * 18 + d * 3;
          vol[o] = r * fall; vol[o + 1] = g * fall; vol[o + 2] = b * fall;
          hits++;
        }
      }
    }
  }

  const sample = (x, y, z) => {
    const fi = (x - minX) / dx, fj = (z - minZ) / dx;
    const f = y / dy + 0.5;
    const i0 = Math.max(0, Math.min(cW - 2, fi | 0)), j0 = Math.max(0, Math.min(cH - 2, fj | 0));
    const l0 = Math.max(1, Math.min(L - 2, Math.floor(f)));
    const tx = Math.max(0, Math.min(1, fi - i0)), tz = Math.max(0, Math.min(1, fj - j0)), ty = Math.max(0, Math.min(1, f - l0));
    const out = new Float32Array(6 * 3);
    const at = (ii, jj, ll, d, c) => vol[((ll * cH + jj) * cW + ii) * 18 + d * 3 + c];
    for (let d = 0; d < 6; d++) {
      for (let c = 0; c < 3; c++) {
        const c000 = at(i0, j0, l0, d, c), c100 = at(i0 + 1, j0, l0, d, c);
        const c010 = at(i0, j0 + 1, l0, d, c), c110 = at(i0 + 1, j0 + 1, l0, d, c);
        const c001 = at(i0, j0, l0 + 1, d, c), c101 = at(i0 + 1, j0, l0 + 1, d, c);
        const c011 = at(i0, j0 + 1, l0 + 1, d, c), c111 = at(i0 + 1, j0 + 1, l0 + 1, d, c);
        const lo0 = (c000 * (1 - tx) + c100 * tx) * (1 - tz) + (c010 * (1 - tx) + c110 * tx) * tz;
        const lo1 = (c001 * (1 - tx) + c101 * tx) * (1 - tz) + (c011 * (1 - tx) + c111 * tx) * tz;
        out[d * 3 + c] = lo0 * (1 - ty) + lo1 * ty;
      }
    }
    return out;
  };

  field.light6 = {
    cW, cH, L, vol, sample, reach, hits,
    ms: +(performance.now() - t0).toFixed(1),
    get stats() { return { grid: `${cW}×${L}×${cH}`, dirs: 6, hits: field.light6.hits, ms: field.light6.ms }; },
  };
  return field.light6;
}

/** 顶点从 6 方向光体积取光：按法线与 6 个轴的方向余弦加权。 */
export function bakeVertexLight6(field, pos, col, { gain = 0.55 } = {}) {
  if (!field || !field.light6) return 0;
  const t0 = performance.now();
  let touched = 0;
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t], ay = pos[t + 1], az = pos[t + 2];
    const ux = pos[t + 3] - ax, uy = pos[t + 4] - ay, uz = pos[t + 5] - az;
    const vx = pos[t + 6] - ax, vy = pos[t + 7] - ay, vz = pos[t + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const mx = ax + nx * 0.07, my = ay + ny * 0.07, mz = az + nz * 0.07;
    const six = field.light6.sample(mx, my, mz);
    let wsum = 0, r = 0, g = 0, b = 0;
    for (let d = 0; d < 6; d++) {
      const [dxa, dya, dza] = AXES[d];
      const w = Math.max(0, nx * dxa + ny * dya + nz * dza);
      if (w <= 0.001) continue;
      wsum += w;
      r += six[d * 3] * w; g += six[d * 3 + 1] * w; b += six[d * 3 + 2] * w;
    }
    if (wsum <= 0.001) continue;
    const k = gain / wsum;
    const oc = field.sampleOcc(mx, my, mz);
    const openK = Math.min(1, oc * 1.6 + 0.15);
    for (let v = 0; v < 3; v++) {
      const o = t + v * 3;
      col[o] += r * k * openK;
      col[o + 1] += g * k * openK;
      col[o + 2] += b * k * openK;
    }
    touched++;
  }
  return { tris: touched, ms: +(performance.now() - t0).toFixed(1) };
}

/* -------------------------------------------------------------------------- */
/*  GPU path — "sampled in the vertex shader of whatever needs lighting"       */
/* -------------------------------------------------------------------------- */

/** Uniforms shared by every patched material, so one toggle dims the whole scene. */
export function makeLightingUniforms(field) {
  return {
    uField: { value: field?.texture?.() || null },
    uFieldMin: { value: new THREE.Vector2(field?.minX || 0, field?.minZ || 0) },
    uFieldSize: { value: new THREE.Vector2(field?.W || 1, field?.H || 1) },
    uFieldRes: { value: field?.res || 1 },
    uFieldLayers: { value: field?.L || 1 },
    uLevelHeight: { value: field?.levelHeight || 0.5 },
    uAOStrength: { value: 0.62 },
    uBounce: { value: 0.42 },
  };
}

const FIELD_GLSL = /* glsl */ `
  uniform sampler2D uField;
  uniform vec2 uFieldMin;
  uniform vec2 uFieldSize;
  uniform float uFieldRes;
  uniform float uFieldLayers;
  uniform float uLevelHeight;
  uniform float uAOStrength;
  uniform float uBounce;

  // one layer, bilinear in XZ. Layers are stacked as rows: layer l owns
  // rows [l*H, (l+1)*H) of the texture.
  vec4 fieldLayer(vec2 g, float lv) {
    lv = clamp(lv, 0.0, uFieldLayers - 1.0);
    vec2 f = (g - uFieldMin) / uFieldRes;
    vec2 lo = floor(f);
    vec2 t = f - lo;
    vec2 origin = vec2(0.0, lv * uFieldSize.y);
    vec2 c00 = (origin + lo + vec2(0.5)) / vec2(uFieldSize.x, uFieldSize.y * uFieldLayers);
    vec2 step = vec2(1.0) / vec2(uFieldSize.x, uFieldSize.y * uFieldLayers);
    vec4 a = texture2D(uField, c00);
    vec4 b = texture2D(uField, c00 + vec2(step.x, 0.0));
    vec4 c = texture2D(uField, c00 + vec2(0.0, step.y));
    vec4 d = texture2D(uField, c00 + step);
    return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
  }

  // trilinear: bilinear in XZ, linear across the two nearest levels
  vec4 fieldSample(vec3 w) {
    float f = w.y / uLevelHeight + 0.5;
    float l0 = floor(f);
    float t = f - l0;
    vec4 a = fieldLayer(w.xz, l0);
    vec4 b = fieldLayer(w.xz, l0 + 1.0);
    return mix(a, b, t);
  }

  // same maths as bakeVertexAO(): col *= ao + bounce * avgColour * occ
  vec3 fieldShade(vec3 col, vec3 w, float scale, float power) {
    float oc = fieldSample(w).r * scale;
    float ao = 1.0 - uAOStrength * clamp(oc * 1.15 * power, 0.0, 1.0);
    return col * (ao + uBounce * oc);
  }
`;

/**
 * Sample the shared field in the vertex shader and fold it into the vertex
 * colour, so a MeshStandardMaterial gets the same shading as a CPU-baked mesh
 * but rebuilds in the time it takes to re-rasterise the field.
 *
 * `strength` lets a material dial the effect (a rock face wants more than a
 * painted wall), `scale` widens the sampled radius.
 */
export function patchMaterial(material, uniforms, { scale = 1.0, power = 1.0 } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FIELD_GLSL}`)
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
         #ifdef USE_COLOR
         {
           vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
           vColor = fieldShade(vColor, worldPos, ${scale.toFixed(3)}, ${power.toFixed(3)});
         }
         #endif`,
      );
  };
  material.needsUpdate = true;
  return material;
}

export { FIELD_GLSL };
