/**
 * voxel-light.js — 一张体素场照亮整个场景：分层遮蔽（AO）+ 彩色反弹 + 多跳扩散。
 * R63（TigerMessenger CAPABILITY_PIPELINE_GUIDE §10 R61–R70）嫁接自原版 townscaper-web/REACode/src/lighting.js 的 CPU 路径：
 *   buildVoxelField / bakeVertexAO / diffuseBounce。
 * 帖子：931196707236392960「My generated levels all keep a virtual voxel space. It is used for light baking …」
 *       1168571866405097472「The occlusion lives in a layered mesh … blurred, and sampled in the vertex shader」
 *       1237305125070426112（彩色「反弹」光：白墙旁边染上邻居的颜色）
 *       1580846877855338497「After about the 3rd bounce, further bounces are not noticeable.」
 *
 * 和重构库已有的 light/bake.js 的关系：bake.js 是 TownMesh 那份「建一次、烘一次」的分层 AO（单跳反弹、按层窗口模糊、扫描线栅格化）；
 * 原版 lighting.js 把占用场抽成一个可共享、可反复采样的对象：多个体素集合（地形 + 建筑 + 道具）进同一张场，
 * 场上还能做多跳扩散（diffuseBounce）。重构库缺的正是这一半，这里补上，数学与原版逐行一致——
 * 对照在 TigerMessenger/src/system-workshop/lightlife/parity.js：「同判据」下烘出来的顶点色应当逐值相同。
 *
 * 与原版不同的地方（修掉的瑕疵，其余照搬）：
 *   · 体素集合 sets 里既可以给原版的 Town（set.town），也可以给共享 World（set.world，core/world.js）；只用 top(c) / isSolid(c, lv)。
 *   · pointInQuad 用 core/spatial.js 的 n 边形版本（四边形时与原版 town.js 是同一个算法、同一个阈值）。
 *   · 空场 emptyField 不再调 document（原版 sliceCanvas 在 Node / Worker 里会直接抛错）；GPU 部分（texture / patchMaterial /
 *     FIELD_GLSL / makeLightingUniforms）不在这里嫁接——重构库的分层场 GPU 采样在 light/voxel-field.js。
 *   · diffuseBounce 里原版每个空气体素都新建一个 6 元数组（nb6），这里复用一个 Int32Array；顺序与数值不变。
 *   · 原版 diffuseBounce 的上邻居在最高层夹到自己（lv + 1 ≥ L 时取 lv）——保留，改了会让顶层多跳的结果变。
 *   · performance.now 不在时退回 Date.now（只影响 stats 里的毫秒数）。
 */
import { pointInQuad } from '../core/spatial.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
const WHITE = { r: 1, g: 1, b: 1 };
const voxelsOf = (set) => set.town || set.world;

/**
 * @param {object} o
 * @param {object} o.grid          共享多边形网格（cells[].pts、cells[].id）
 * @param {number} [o.levelHeight] 每层体素的世界高度
 * @param {Array}  o.sets          [{ town | world, cells?, y?: 0, colorOf? }]
 * @param {number} [o.res]         栅格分辨率（世界单位 / 像素）
 * @param {number} [o.pad]         包围盒外扩
 * @param {number} [o.blurRadius]  盒式模糊半径（像素）
 * @param {number} [o.blurPasses]  两遍 ≈ 高斯
 * @param {boolean} [o.keepRaw]    留一份模糊前的底片（脏区重模糊用）
 */
export function buildVoxelField({ grid, levelHeight = 0.5, sets, res = 0.09, pad = 0.9, blurRadius = 4, blurPasses = 2, keepRaw = false } = {}) {
  if (!sets || sets.length === 0) throw new Error('buildVoxelField 至少要一个体素集合');
  for (const s of sets) if (!voxelsOf(s) || typeof voxelsOf(s).top !== 'function') throw new TypeError('体素集合要给 town 或 world（带 top / isSolid）');

  /* ---- 1. 所有参与者的包围盒 ---------------------------------------------- */
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxLevel = 0;
  for (const set of sets) {
    const vox = voxelsOf(set), cells = set.cells || grid.cells;
    for (const c of cells) {
      const top = vox.top(c);
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
  if (!Number.isFinite(minX)) return emptyField(levelHeight);
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;

  const W = Math.max(2, Math.ceil((maxX - minX) / res) + 1);
  const H = Math.max(2, Math.ceil((maxZ - minZ) / res) + 1);
  const L = maxLevel + 2;
  const size = W * H;
  const occ = new Float32Array(size * L), cr = new Float32Array(size * L), cg = new Float32Array(size * L), cb = new Float32Array(size * L);

  /* ---- 2. 每个集合栅格化进同一组层 ------------------------------------------ */
  const t0 = now();
  let voxels = 0;
  for (const set of sets) {
    const vox = voxelsOf(set), cells = set.cells || grid.cells;
    const base = Math.round((set.y || 0) / levelHeight);
    const colorOf = set.colorOf || (() => WHITE);
    for (const c of cells) {
      const top = vox.top(c);
      if (!top) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of c.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      const i0 = Math.max(0, Math.floor((x0 - minX) / res)), i1 = Math.min(W - 1, Math.ceil((x1 - minX) / res));
      const j0 = Math.max(0, Math.floor((z0 - minZ) / res)), j1 = Math.min(H - 1, Math.ceil((z1 - minZ) / res));
      for (let j = j0; j <= j1; j++) {
        const z = minZ + j * res;
        for (let i = i0; i <= i1; i++) {
          const x = minX + i * res;
          if (!pointInQuad(c.pts, x, z)) continue;
          for (let lv = 1; lv <= top; lv++) {
            if (!vox.isSolid(c, lv)) continue;
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
  const rasterMs = now() - t0;

  /* ---- 3. 模糊一次，所有消费者读同一份模糊 ---------------------------------- */
  const raw = keepRaw ? { occ: occ.slice(), cr: cr.slice(), cg: cg.slice(), cb: cb.slice() } : null;
  const t1 = now();
  if (blurRadius > 0) {
    const R = blurRadius, tmp = new Float32Array(Math.max(W, H));
    const blur1 = (arr, off) => {
      for (let pass = 0; pass < blurPasses; pass++) {
        for (let j = 0; j < H; j++) {
          const row = off + j * W;
          let s = 0;
          for (let i = -R; i <= R; i++) s += arr[row + clamp(i, 0, W - 1)];
          for (let i = 0; i < W; i++) { tmp[i] = s / (2 * R + 1); s += arr[row + Math.min(W - 1, i + R + 1)] - arr[row + Math.max(0, i - R)]; }
          for (let i = 0; i < W; i++) arr[row + i] = tmp[i];
        }
        for (let i = 0; i < W; i++) {
          let s = 0;
          for (let j = -R; j <= R; j++) s += arr[off + clamp(j, 0, H - 1) * W + i];
          for (let j = 0; j < H; j++) { tmp[j] = s / (2 * R + 1); s += arr[off + Math.min(H - 1, j + R + 1) * W + i] - arr[off + Math.max(0, j - R) * W + i]; }
          for (let j = 0; j < H; j++) arr[off + j * W + i] = tmp[j];
        }
      }
    };
    for (let lv = 1; lv < L; lv++) { blur1(occ, lv * size); blur1(cr, lv * size); blur1(cg, lv * size); blur1(cb, lv * size); }
  }
  const blurMs = now() - t1;

  /* ---- 4. 采样 ------------------------------------------------------------- */
  const sampleLayer = (arr, lv, x, z) => {
    if (lv < 0 || lv >= L) return 0;
    const fi = (x - minX) / res, fj = (z - minZ) / res;
    if (fi < 0 || fj < 0 || fi >= W - 1 || fj >= H - 1) return 0;
    const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = lv * size + j * W + i;
    return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + W] * (1 - tx) + arr[o + W + 1] * tx) * tz;
  };
  /** 三线性：XZ 双线性 + 层间线性（第 k 层占 [k−1, k)，中心在 k − 0.5） */
  const sample = (arr, x, y, z) => {
    const f = y / levelHeight + 0.5, l0 = Math.floor(f), t = f - l0;
    return sampleLayer(arr, l0, x, z) * (1 - t) + sampleLayer(arr, l0 + 1, x, z) * t;
  };
  const field = {
    grid, res, pad, W, H, L, size, minX, minZ, maxX, maxZ, levelHeight, occ, cr, cg, cb, voxels,
    sample,
    sampleOcc: (x, y, z) => sample(occ, x, y, z),
    /** 这一处被什么占着、平均是什么颜色（没东西时是白）；diffuseBounce 跑过之后空位里返回空气里扩散过来的颜色（多跳） */
    sampleBounce(x, y, z) {
      const oc = sample(occ, x, y, z), sr = sample(cr, x, y, z), sg = sample(cg, x, y, z), sb = sample(cb, x, y, z);
      const surf = oc > 1e-3 ? [sr / oc, sg / oc, sb / oc] : [1, 1, 1];
      if (!field._air) return surf;
      const air = field.sampleAir(x, y, z);
      return [surf[0] + (air[0] - surf[0]), surf[1] + (air[1] - surf[1]), surf[2] + (air[2] - surf[2])];
    },
    raw,
    blurParams: { radius: blurRadius, passes: blurPasses },
    stats: { W, H, layers: L, res, voxels, rasterMs: +rasterMs.toFixed(1), blurMs: +blurMs.toFixed(1) },
  };
  return field;
}

function emptyField(levelHeight = 0.5) {
  return {
    W: 0, H: 0, L: 0, size: 0, res: 1, minX: 0, minZ: 0, levelHeight,
    occ: new Float32Array(0), cr: new Float32Array(0), cg: new Float32Array(0), cb: new Float32Array(0), voxels: 0,
    sample: () => 0, sampleOcc: () => 0, sampleBounce: () => [1, 1, 1],
    stats: { W: 0, H: 0, layers: 0, voxels: 0, rasterMs: 0, blurMs: 0 },
  };
}

/**
 * 遮蔽 + 彩色反弹直接乘进顶点色。pos = 三角形汤（每三角 9 个数），col = 对应的 rgb。
 * 与原版同一组默认值：外移 0.17、遮蔽强度 0.62、反弹 0.42、多跳补光 airGain 0（加法项，染色而不是提亮）。
 */
export function bakeVertexAO(field, pos, col, { offset = 0.17, strength = 0.62, bounce = 0.42, airGain = 0 } = {}) {
  if (!field || field.voxels === 0) return 0;
  const t0 = now();
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
      const sx = pos[o] + nx * offset, sy = pos[o + 1] + ny * offset + 0.02, sz = pos[o + 2] + nz * offset;
      const oc = field.sampleOcc(sx, sy, sz);
      if (oc < 0.002) continue;
      touched++;
      const ao = 1 - strength * Math.min(1, oc * 1.15);
      const [br, bg, bb] = field.sampleBounce(sx, sy, sz);
      const k = bounce * oc;
      col[o] = col[o] * (ao + br * k);
      col[o + 1] = col[o + 1] * (ao + bg * k);
      col[o + 2] = col[o + 2] * (ao + bb * k);
      if (airGain > 0 && field.sampleAir) {
        const [ar, ag, ab] = field.sampleAir(sx, sy, sz), k2 = airGain * oc;
        col[o] += ar * k2; col[o + 1] += ag * k2; col[o + 2] += ab * k2;
      }
    }
  }
  return { touched, ms: +(now() - t0).toFixed(1) };
}

/**
 * 多跳反弹：粗网格（stride 降采样）上做 3D Jacobi 扩散，passes 次封顶（原文约 3 跳后看不出）。
 *   表面体素（占用 > 0.5）颜色固定——它就是光源；空气体素收下六邻居的颜色，按 1/(1+gain) 混进自己。
 * 跑完写进 field.sampleAir / field._air，sampleBounce 在空位里就返回它。只做近程染色（1~2 格），远距离渗色做不到（原版同样如此）。
 */
export function diffuseBounce(field, passes = 3, gain = 0.9, stride = 3) {
  if (!field || !field.voxels || passes < 1) return 0;
  const t0 = now();
  const { W, H, L, size, occ, cr, cg, cb, res, minX, minZ, levelHeight } = field;
  const S = Math.max(1, stride | 0), cW = Math.ceil(W / S), cH = Math.ceil(H / S), cSize = cW * cH;
  const cOcc = new Float32Array(cSize * L), cr0 = new Float32Array(cSize * L), cg0 = new Float32Array(cSize * L), cb0 = new Float32Array(cSize * L);
  for (let lv = 1; lv < L; lv++) for (let cj = 0; cj < cH; cj++) for (let ci = 0; ci < cW; ci++) {
    let w = 0, r = 0, g = 0, b = 0, m = 0;
    for (let j = cj * S; j < Math.min(H, cj * S + S); j++) for (let i = ci * S; i < Math.min(W, ci * S + S); i++) {
      const k = lv * size + j * W + i, o = occ[k];
      if (o > m) m = o;
      if (o <= 0.02) continue;
      w += o; r += cr[k]; g += cg[k]; b += cb[k];
    }
    const kc = lv * cSize + cj * cW + ci;
    cOcc[kc] = m;
    if (w > 1e-4) { cr0[kc] = r / w; cg0[kc] = g / w; cb0[kc] = b / w; }
  }
  const solid = new Uint8Array(cSize * L);
  for (let k = 0; k < cSize * L; k++) if (cOcc[k] > 0.5) solid[k] = 1;
  const nr = new Float32Array(cr0), ng = new Float32Array(cg0), nb = new Float32Array(cb0);
  const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v), nb6 = new Int32Array(6);
  for (let p = 0; p < passes; p++) for (let lv = 1; lv < L; lv++) {
    const off = lv * cSize;
    for (let j = 0; j < cH; j++) for (let i = 0; i < cW; i++) {
      const k = off + j * cW + i;
      if (solid[k]) continue;
      nb6[0] = off + j * cW + clampI(i - 1, 0, cW - 1);
      nb6[1] = off + j * cW + clampI(i + 1, 0, cW - 1);
      nb6[2] = off + clampI(j - 1, 0, cH - 1) * cW + i;
      nb6[3] = off + clampI(j + 1, 0, cH - 1) * cW + i;
      nb6[4] = (lv - 1) * cSize + j * cW + i;
      nb6[5] = (lv + 1 < L ? lv + 1 : lv) * cSize + j * cW + i;
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
  const cRes = res * S;
  field.sampleAir = (x, y, z) => {
    const fi = (x - minX) / cRes, fj = (z - minZ) / cRes, f = y / levelHeight + 0.5, l0 = Math.floor(f), t = f - l0;
    const li = (arr, lv) => {
      if (lv < 1 || lv >= L) return 0;
      if (fi < 0 || fj < 0 || fi >= cW - 1 || fj >= cH - 1) return 0;
      const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = lv * cSize + j * cW + i;
      return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + cW] * (1 - tx) + arr[o + cW + 1] * tx) * tz;
    };
    const mix2 = (arr) => li(arr, l0) * (1 - t) + li(arr, l0 + 1) * t;
    return [mix2(nr), mix2(ng), mix2(nb)];
  };
  field._air = true;
  field.bouncePasses = passes;
  field.diffuseMs = +(now() - t0).toFixed(1);
  field.airGrid = `${cW}×${L}×${cH} @${cRes.toFixed(2)}`;
  return field.diffuseMs;
}
