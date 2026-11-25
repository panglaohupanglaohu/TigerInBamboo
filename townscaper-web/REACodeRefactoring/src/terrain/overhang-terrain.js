/**
 * overhang-terrain.js — 悬垂地形（R42 嫁接自 REACode/src/overhangterrain.js，原版只读不改）。
 *
 * 来源帖子：
 *   1671808851895627776 (2023-06-22) "If your terrain generator supports overhangs you gotta flaunt it."
 *   1447488323845509121 (2021-10-11) "Properly combine seamless soft slopes with distinct sharp cliffs."
 *
 * 原版做的事（行为照搬，默认参数下输出与原版逐字节一致，由 TigerMessenger/tests/relief-parity.test.mjs 对照）：
 *   1. heightField：一座岛的连续高度 + 低频「陡崖省」掩码（用这张场自己的 30% / 58% 分位数当阈值，
 *      所以不同 seed 都约有 1/3 缓坡、1/3 陡崖、1/3 过渡带）；陡崖省把高度按 step 取整成台阶，缓坡省保留原值，
 *      两者按掩码插值，交界处是渐变的，没有直线缝。
 *   2. buildTerrain：每格存一叠实心体素（不是单个高度），沿山脊那一行找到东岸，贴水面掏一条海蚀洞（顶上留着 → 岩檐），
 *      岸外水里立一根帽檐比柱子宽的海上石柱。
 *   3. buildMesh：只画「邻居没盖住的面」，洞顶和帽檐的朝下面自己长出来；soffitAboveWater = 水面以上朝下的面数，是悬垂的证据。
 *   4. measure：悬出来的地板格数、海蚀洞从洞口往里能走多深（盒内 BFS）、缓坡 / 陡崖格数、最高点。
 *
 * 和原版不同的地方（都登记在 TigerMessenger/src/scene-authoring/catalog/parity/relief.overhang.json 的 diffs 里）：
 *   - 原版 heightField 的上分位变量名叫 p72，实际取的是 58% 分位：这里改名 pHi，数值不变。
 *   - 原版 buildTerrain(seed) 不把 opts 传给 heightField（step 改不了）：这里 buildTerrain(seed, opts) 会传；不传 opts 时与原版相同。
 *   - 原版的海上石柱固定放在「岸线 + 5 格」，那一格要是还在坡上，石柱就站在陆地上、帽檐读不出来，原版不报：
 *     measure 多一个字段 stackInWater（石柱脚下那格是不是不填地面的海）。
 *   - 新增（原版没有）：sharpMaskFor / softenField / mixSoftSharp / cliffLips / lipStats，
 *     把「软坡 + 硬崖 + 岩檐」从固定的 56×56 演示岛推广到任意高度场（地貌管线 TigerMessenger/src/system-workshop/relief/ 调用）。
 * 纯函数、无依赖、Node 与浏览器 / Worker 共用。
 */

export const NX = 56;
export const NY = 56;
export const NZ = 44;
export const WATER = 7.5;

/* ---------- 噪声（与原版同一套哈希，结果逐位一致） ---------- */
export function hash(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
  n = (n ^ (n >>> 13)) * 1274126177 | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
}
export function fbm(x, y, s, oct) {
  let v = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    v += vnoise(x * f, y * f, s + o * 37) * amp;
    norm += amp; amp *= 0.5; f *= 2.07;
  }
  return v / norm;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 原始陡崖值 → 0..1 掩码：用这张场自己的分位数当阈值（原版 30% / 58%）。raw 可以是任意长度的数组。 */
export function softSharpMask(raw, { lo = 0.30, hi = 0.58, skip = null } = {}) {
  const vals = [];
  for (let k = 0; k < raw.length; k++) if (!skip || !skip(k)) vals.push(raw[k]);
  const sorted = Float32Array.from(vals).sort();
  const out = new Float32Array(raw.length);
  if (!sorted.length) return out;
  const pLo = sorted[Math.floor(sorted.length * lo)], pHi = sorted[Math.floor(sorted.length * hi)];
  for (let k = 0; k < raw.length; k++) out[k] = smoothstep(pLo, pHi, raw[k]);
  return out;
}

/* ---------- 高度场：soft/sharp 两种量化混一起（默认参数与原版一致） ---------- */
export function heightField(seed = 7, opts = {}) {
  const step = opts.step ?? 9;
  const nx = opts.nx ?? NX, ny = opts.ny ?? NY;
  const h = new Float32Array(nx * ny);
  const sharp = new Float32Array(nx * ny);   // 0=纯缓坡 1=纯台阶
  const rawSharp = new Float32Array(nx * ny);
  const land = new Float32Array(nx * ny);
  const cx = (nx - 1) / 2, cy = (ny - 1) / 2;
  const rad = Math.min(nx, ny) * 0.47;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const dx = (i - cx) / rad, dy = (j - cy) / rad;
      const warp = (fbm(i * 0.035, j * 0.035, seed + 91, 3) - 0.5) * 0.55;
      const r = Math.hypot(dx, dy) + warp;
      const mask = smoothstep(1.02, 0.42, r);
      land[k] = mask;
      const n = fbm(i * 0.055, j * 0.055, seed, 5);
      const ridge = Math.pow(clamp(fbm(i * 0.026 + 5.1, j * 0.026 + 2.7, seed + 13, 3), 0, 1), 2.1);
      h[k] = WATER + 1.2 + mask * (6 + 20 * n + 30 * ridge);
      rawSharp[k] = fbm(i * 0.023 + 21.3, j * 0.023 + 9.4, seed + 57, 3);
      sharp[k] = rawSharp[k];
    }
  }
  // 原版：分位数取自 Array.from(rawSharp).sort()（Float32 值的数值排序）；pHi 原版变量名 p72、实取 58%
  const sorted = Array.from(rawSharp).sort((a, b) => a - b);
  const p30 = sorted[Math.floor(sorted.length * 0.30)];
  const pHi = sorted[Math.floor(sorted.length * 0.58)];
  for (let k = 0; k < nx * ny; k++) sharp[k] = smoothstep(p30, pHi, rawSharp[k]);
  const mix = new Float32Array(nx * ny);
  for (let k = 0; k < nx * ny; k++) {
    const q = Math.round(h[k] / step) * step;
    mix[k] = h[k] + (q - h[k]) * sharp[k];
  }
  return { h: mix, raw: h, sharp, land, step };
}

/* ---------- 体素：地面 + 掏海蚀洞 + 海上石柱（默认参数与原版一致） ---------- */
export function buildTerrain(seed = 7, opts = {}) {
  const nx = opts.nx ?? NX, ny = opts.ny ?? NY, nz = opts.nz ?? NZ;
  const F = heightField(seed, opts);
  const vox = new Uint8Array(nx * ny * nz);
  const idx = (i, j, k) => (k * ny + j) * nx + i;
  const top = new Int16Array(nx * ny);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k0 = j * nx + i;
      if (F.land[k0] < 0.10) { top[k0] = 0; continue; }
      const tz = clamp(Math.floor(F.h[k0]), 1, nz - 2);
      const bot = Math.round(6 * (1 - F.land[k0]));
      top[k0] = tz;
      for (let k = bot; k < tz; k++) vox[idx(i, j, k)] = 1;
    }
  }

  // 海岸线：沿山脊那一行往 +x 扫，找到岸，再贴水面往里掏海蚀洞
  let bi = 0, bj = 0, bh = -1;
  for (let j = 6; j < ny - 6; j++) {
    for (let i = 6; i < nx * 0.55; i++) {
      const t = top[j * nx + i];
      if (t > bh) { bh = t; bi = i; bj = j; }
    }
  }
  let iCoast = nx - 2;
  for (let i = nx - 2; i > 4; i--) {
    if (F.land[bj * nx + i] > 0.15) { iCoast = i; break; }
  }

  const caveK = Math.round(WATER) + 2;
  const tunnel = {
    i0: Math.max(3, iCoast - 12), i1: Math.min(nx - 2, iCoast + 2),
    j: bj, k: caveK, width: 5, height: 4, cells: 0,
  };
  for (let i = tunnel.i0; i <= tunnel.i1; i++) {
    for (let dj = -2; dj <= 2; dj++) {
      const j = bj + dj;
      if (j < 1 || j >= ny - 1) continue;
      for (let k = caveK; k < caveK + 4; k++) {
        if (!vox[idx(i, j, k)]) continue;
        vox[idx(i, j, k)] = 0; tunnel.cells++;
      }
    }
  }

  // 海上石柱：柱子在水中，帽檐比柱子宽
  const sj = Math.min(ny - 5, bj + 8);
  let iCoast2 = iCoast;
  for (let i = nx - 2; i > 4; i--) {
    if (F.land[sj * nx + i] > 0.15) { iCoast2 = i; break; }
  }
  const si = Math.min(nx - 4, iCoast2 + 5);
  const stack = { i: si, j: sj, stemR: 1.5, capR: 3.9, capZ: caveK + 6, capCells: 0 };
  for (let dj = -2; dj <= 2; dj++) {
    for (let di = -2; di <= 2; di++) {
      if (di * di + dj * dj > 3.2) continue;
      for (let k = 0; k < stack.capZ; k++) vox[idx(si + di, sj + dj, k)] = 1;
    }
  }
  for (let dj = -4; dj <= 4; dj++) {
    for (let di = -4; di <= 4; di++) {
      if (Math.hypot(di, dj) > stack.capR) continue;
      const i = si + di, j = sj + dj;
      if (i < 1 || j < 1 || i >= nx - 1 || j >= ny - 1) continue;
      for (let k = stack.capZ; k <= stack.capZ + 2; k++) {
        vox[idx(i, j, k)] = 1; stack.capCells++;
      }
    }
  }

  return { vox, top, field: F, tunnel, stack, idx, nx, ny, nz };
}

/* ---------- 只画「邻居没盖住」的面 ---------- */
const FACES = [
  { d: [1, 0, 0],  n: [1, 0, 0],  q: [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], shade: 0.94 },
  { d: [-1, 0, 0], n: [-1, 0, 0], q: [[0,0,1],[0,0,0],[0,1,0],[0,1,1]], shade: 0.72 },
  { d: [0, 0, 1],  n: [0, 0, 1],  q: [[1,0,1],[0,0,1],[0,1,1],[1,1,1]], shade: 0.84 },
  { d: [0, 0, -1], n: [0, 0, -1], q: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], shade: 0.66 },
  { d: [0, 1, 0],  n: [0, 1, 0],  q: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], shade: 1.00 },
  { d: [0, -1, 0], n: [0, -1, 0], q: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], shade: 0.42 },
];

function faceColor(dir, wx, wy, wz, shade, out, o) {
  let r, g, b;
  if (dir === 4) {
    const t = clamp((wy - WATER) / 22, 0, 1);
    r = 0.88 - 0.14 * t; g = 0.84 - 0.08 * t; b = 0.50 + 0.10 * t;
  } else if (dir === 5) {
    r = 0.30; g = 0.28; b = 0.24;
  } else {
    const band = ((Math.floor((wy + 0.5) / 2.2) & 1) ? 0.05 : -0.04);
    r = 0.70 + band; g = 0.63 + band; b = 0.47 + band;
    if (wy < WATER + 0.6) { r = 0.34; g = 0.38; b = 0.38; }
  }
  out[o] = r * shade; out[o + 1] = g * shade; out[o + 2] = b * shade;
}

export function buildMesh(T) {
  const { vox } = T;
  const idx = T.idx;
  const nx = T.nx ?? NX, ny = T.ny ?? NY, nz = T.nz ?? NZ;
  const solid = (i, j, k) =>
    i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz ? vox[idx(i, j, k)] : 0;

  const pos = [], nor = [], col = [];
  let faces = 0, soffitAboveWater = 0;
  const byDir = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!vox[idx(i, j, k)]) continue;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          if (solid(i + F.d[0], j + F.d[2], k + F.d[1])) continue;
          byDir[f]++;
          if (f === 5 && k > WATER) soffitAboveWater++;
          const q = F.q;
          const order = [0, 1, 2, 0, 2, 3];
          for (const c of order) {
            const vv = q[c];
            const wx = (i + vv[0] - nx / 2);
            const wy = k + vv[1];
            const wz = (j + vv[2] - ny / 2);
            pos.push(wx, wy, wz);
            nor.push(F.n[0], F.n[1], F.n[2]);
            const o = col.length;
            col.push(0, 0, 0);
            faceColor(f, wx, wy, wz, F.shade, col, o);
          }
          faces++;
        }
      }
    }
  }
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    colors: new Float32Array(col),
    faces,
    byDir,
    soffitFaces: byDir[5],
    soffitAboveWater,
  };
}

/* ---------- 统计：悬垂有没有？海蚀洞通不通？ ---------- */
export function measure(T) {
  const { vox, idx, tunnel, stack } = T;
  const nx = T.nx ?? NX, ny = T.ny ?? NY, nz = T.nz ?? NZ;
  const caveK = tunnel.k;
  const solid = (i, j, k) =>
    i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz ? vox[idx(i, j, k)] : 0;

  let total = 0, overhang = 0;
  for (let k = 1; k < nz; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        if (!vox[idx(i, j, k)]) continue;
        total++;
        if (k > WATER && !solid(i, j, k - 1) && solid(i, j, k + 1)) overhang++;
      }
    }
  }

  const start = { i: tunnel.i1, j: tunnel.j, k: caveK + 1 };
  const seen = new Uint8Array(nx * ny * nz);
  const q = [start];
  seen[idx(start.i, start.j, start.k)] = 1;
  let airReach = 0, minI = start.i;
  const inBox = (i, j, k) =>
    i >= tunnel.i0 && i <= tunnel.i1 && j >= tunnel.j - 2 && j <= tunnel.j + 2 &&
    k >= caveK && k < caveK + 4;
  while (q.length) {
    const c = q.pop(); airReach++;
    if (c.i < minI) minI = c.i;
    const nb = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [di, dj, dk] of nb) {
      const i = c.i + di, j = c.j + dj, k = c.k + dk;
      if (!inBox(i, j, k)) continue;
      const id = idx(i, j, k);
      if (seen[id] || vox[id]) continue;
      seen[id] = 1; q.push({ i, j, k });
    }
  }

  let soft = 0, sharpCells = 0, maxH = 0;
  const F = T.field;
  for (let n = 0; n < nx * ny; n++) {
    if (F.land[n] < 0.35) continue;
    if (F.sharp[n] > 0.62) sharpCells++; else if (F.sharp[n] < 0.38) soft++;
    if (F.h[n] > maxH) maxH = F.h[n];
  }

  return {
    solidVoxels: total, overhangAboveWater: overhang, airReach,
    tunnelCells: tunnel.cells, caveDepth: tunnel.i1 - minI, tunnelLen: tunnel.i1 - tunnel.i0 + 1,
    capCells: stack.capCells, capZ: stack.capZ,
    softCells: soft, sharpCells, maxHeight: +maxH.toFixed(1),
    water: WATER,
    // 新增（原版没有）：石柱脚下那格是不是海（land < 0.10 的格不填地面）
    stackInWater: F.land[stack.j * nx + stack.i] < 0.10,
  };
}

/* ======================================================================
 * 推广到任意高度场（原版没有；地貌管线用）。网格约定：n×n 行优先，k = j*n + i；
 * h 单位米（海 / 场外 = NaN），protect[k] = 1 的格及其 ring 圈内不改。
 * ====================================================================== */

/** 与原版同一个低频噪声算陡崖省原始值，再按这张场自己的分位数映射成 0..1（只用陆地格算分位）。 */
export function sharpMaskFor(n, seed = 7, { h = null, lo = 0.30, hi = 0.58, freq = 0.023 } = {}) {
  const raw = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) raw[j * n + i] = fbm(i * freq + 21.3, j * freq + 9.4, seed + 57, 3);
  return softSharpMask(raw, { lo, hi, skip: h ? (k) => !(h[k] > 0) : null });
}

const isLand = (v) => Number.isFinite(v) && v > 0;
/** 保护圈：protect 为 1 的格向外扩 ring 格（切比雪夫距离）。返回 Uint8Array。 */
export function protectRing(n, protect, ring = 1) {
  const out = new Uint8Array(n * n);
  if (!protect) return out;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!protect[j * n + i]) continue;
    for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
      const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < n && b < n) out[b * n + a] = 1;
    }
  }
  return out;
}

/**
 * 软坡：缓坡省（sharp 小）做几轮邻域平均，陡崖省（sharp 大）不动；按 (1 − sharp) 插值，交界渐变。
 * 只改陆地格，不把陆地压成海（最低 minLand 米），不碰保护格。返回新数组。
 */
export function softenField(h, n, sharp, { passes = 3, protect = null, minLand = 0.3 } = {}) {
  let cur = Float64Array.from(h);
  const lock = protect || new Uint8Array(n * n);
  for (let p = 0; p < passes; p++) {
    const next = Float64Array.from(cur);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; if (!isLand(cur[k]) || lock[k]) continue;
      let s = cur[k], c = 1;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const v = cur[b * n + a]; if (isLand(v)) { s += v; c++; }
      }
      const w = 1 - (sharp ? sharp[k] : 0);
      next[k] = Math.max(minLand, cur[k] + (s / c - cur[k]) * w);
    }
    cur = next;
  }
  return Array.from(cur);
}

/** 硬崖：陡崖省按 step 米取整成台阶（原版 mix 公式），缓坡省保留原值；不碰保护格，不把陆地压成海。 */
export function mixSoftSharp(h, sharp, step, { protect = null, minLand = 0.3 } = {}) {
  const out = new Array(h.length);
  for (let k = 0; k < h.length; k++) {
    const v = h[k];
    if (!isLand(v) || (protect && protect[k])) { out[k] = v; continue; }
    const q = Math.round(v / step) * step;
    out[k] = Math.max(minLand, v + (q - v) * (sharp ? sharp[k] : 1));
  }
  return out;
}

/**
 * 岩檐（悬垂推广版）：陡崖省里，一格比相邻低格高出 ≥ minDrop 米时，在高格朝低格那一侧伸出一块檐板：
 * 顶面 = 高格顶，厚 thick 米，向外伸 reach 格（< 1），檐下到低格顶面是空的 —— 这就是「顶上还有实心、下面被掏空」。
 * 只在 sharp ≥ sharpMin、两格都不受保护、檐下净空 ≥ clear 米处放；按落差大 + 哈希挑，最多 maxLips 块。
 * 返回 [{ i, j, di, dj, top, bottom, under, reach, drop }]，under = 檐下低格顶面高度。
 */
export function cliffLips(h, n, sharp, { minDrop = 4, thick = 1.5, reach = 0.45, clear = 1.5, sharpMin = 0.62, maxLips = 64, protect = null, seed = 7 } = {}) {
  const cand = [];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
    const k = j * n + i, v = h[k];
    if (!isLand(v) || (protect && protect[k]) || (sharp && sharp[k] < sharpMin)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const kb = (j + dj) * n + (i + di), u = h[kb];
      if (protect && protect[kb]) continue;
      const under = isLand(u) ? u : 0, drop = v - under;
      if (drop < minDrop || drop - thick < clear) continue;
      cand.push({ i, j, di, dj, top: v, bottom: v - thick, under, reach, drop: +drop.toFixed(3), r: hash(i * 3 + di + 7, j * 5 + dj + 11, seed) });
    }
  }
  cand.sort((a, b) => b.drop - a.drop || a.r - b.r || a.j - b.j || a.i - b.i);
  // 同一格最多一块檐（避免一格四面都伸）
  const used = new Set(), out = [];
  for (const c of cand) {
    if (out.length >= maxLips) break;
    const key = c.j * n + c.i; if (used.has(key)) continue; used.add(key);
    const { r, ...lip } = c; out.push(lip);
  }
  return out;
}

/** 岩檐统计：块数、檐下总面积（格²）、平均净空（米）、薄檐（厚 ≤ 2 m，可站的薄台）块数 */
export function lipStats(lips = [], { cell = 1 } = {}) {
  let area = 0, clear = 0, thin = 0;
  for (const l of lips) { area += l.reach * cell * cell; clear += l.bottom - l.under; if (l.top - l.bottom <= 2) thin++; }
  return { lips: lips.length, soffitArea: +area.toFixed(3), meanClear: lips.length ? +(clear / lips.length).toFixed(3) : 0, thinLedges: thin };
}
