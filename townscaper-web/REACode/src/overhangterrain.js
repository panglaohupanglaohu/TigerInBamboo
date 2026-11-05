/**
 * overhangterrain.js — 地形能悬垂，才敢让镜头低于岩檐；缓坡与垂直崖壁要能同框。
 *
 * 帖子 ID + 原文：
 *   1671808851895627776 (2023-06-22)
 *     "If your terrain generator supports overhangs you gotta flaunt it.
 *      I don't make the rules, but I do follow them."
 *   1447488323845509121 (2021-10-11)
 *     "I'm able to do a couple of things here I've always wanted to, but never
 *      been able to before: - Properly combine seamless soft slopes with
 *      distinct sharp cliffs. - Erosion valid terrain with no local m[inima]"
 *
 * 为什么这么做：
 *   高度场（每格一个 h）天生画不出岩檐——每列只有一个顶面，悬垂的那块没有
 *   地方存。所以这里每格存的是**一叠实心体素**，不是单个高度：岩檐就是"顶上
 *   还有实心、下面几格被掏空"的列。网格化时只画"邻居没覆盖到的那一面"，
 *   隧道口和岩檐底面就自己长出来了，不需要额外的悬垂几何。
 *   缓坡与陡崖共用同一个高度场：sharp 是把高度按 step 取整（台阶），soft 是
 *   原值（连续），两者按低频噪声掩码插值，所以交界处是渐变的，不会出现
 *   "两种地形拼接"的直线缝。这一条对应原文的 "seamless soft slopes with
 *   distinct sharp cliffs"。
 */

export const NX = 56;
export const NY = 56;
export const NZ = 44;
export const WATER = 7.5;

/* ---------- 噪声 ---------- */
function hash(x, y, s) {
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
function fbm(x, y, s, oct) {
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

/* ---------- 高度场：soft/sharp 两种量化混一起 ---------- */
export function heightField(seed = 7, opts = {}) {
  const step = opts.step ?? 9;
  const h = new Float32Array(NX * NY);
  const sharp = new Float32Array(NX * NY);   // 0=纯缓坡 1=纯台阶
  const rawSharp = new Float32Array(NX * NY);
  const land = new Float32Array(NX * NY);
  const cx = (NX - 1) / 2, cy = (NY - 1) / 2;
  const rad = Math.min(NX, NY) * 0.47;

  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      // 岛屿轮廓：径向衰减 + 低频扰动，避免圆形
      const dx = (i - cx) / rad, dy = (j - cy) / rad;
      const warp = (fbm(i * 0.035, j * 0.035, seed + 91, 3) - 0.5) * 0.55;
      const r = Math.hypot(dx, dy) + warp;
      const mask = smoothstep(1.02, 0.42, r);
      land[k] = mask;
      const n = fbm(i * 0.055, j * 0.055, seed, 5);
      const ridge = Math.pow(clamp(fbm(i * 0.026 + 5.1, j * 0.026 + 2.7, seed + 13, 3), 0, 1), 2.1);
      h[k] = WATER + 1.2 + mask * (6 + 20 * n + 30 * ridge);
      // 陡崖省 vs 缓坡省：低频掩码，两者在边界上连续过渡
      rawSharp[k] = fbm(i * 0.023 + 21.3, j * 0.023 + 9.4, seed + 57, 3);
      sharp[k] = rawSharp[k];
    }
  }
  // 用这个场自己的分位数当阈值：保证约 1/3 缓坡、1/3 陡崖、1/3 过渡带，
  // 不依赖 fbm 的具体取值范围（不同 seed 不会退化成一整片台阶）。
  const sorted = Array.from(rawSharp).sort((a, b) => a - b);
  const p30 = sorted[Math.floor(sorted.length * 0.30)];
  const p72 = sorted[Math.floor(sorted.length * 0.58)];
  for (let k = 0; k < NX * NY; k++) sharp[k] = smoothstep(p30, p72, rawSharp[k]);
  // 混：sharp -> 按 step 取整；soft -> 原值
  const mix = new Float32Array(NX * NY);
  for (let k = 0; k < NX * NY; k++) {
    const q = Math.round(h[k] / step) * step;
    mix[k] = h[k] + (q - h[k]) * sharp[k];
  }
  return { h: mix, raw: h, sharp, land, step };
}

/* ---------- 体素：地面 + 掏隧道 + 蘑菇岩 ---------- */
export function buildTerrain(seed = 7) {
  const F = heightField(seed);
  const vox = new Uint8Array(NX * NY * NZ);
  const idx = (i, j, k) => (k * NY + j) * NX + i;
  const top = new Int16Array(NX * NY);

  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const k0 = j * NX + i;
      // 只在岛体范围内填：整张网格都填满的话，水下会多出一块方形底座，
      // 从任何角度看都是一块板，看不出这是座岛。
      if (F.land[k0] < 0.10) { top[k0] = 0; continue; }
      const tz = clamp(Math.floor(F.h[k0]), 1, NZ - 2);
      // 底部按轮廓收成碗状，海岸处自然收薄，不会拖出一堵直上直下的裙边
      const bot = Math.round(6 * (1 - F.land[k0]));
      top[k0] = tz;
      for (let k = bot; k < tz; k++) vox[idx(i, j, k)] = 1;
    }
  }

  // —— 海岸线：沿山脊那一行往 +x 扫，找到岸，再贴水面往里掏海蚀洞 ——
  let bi = 0, bj = 0, bh = -1;
  for (let j = 6; j < NY - 6; j++) {
    for (let i = 6; i < NX * 0.55; i++) {
      const t = top[j * NX + i];
      if (t > bh) { bh = t; bi = i; bj = j; }
    }
  }
  let iCoast = NX - 2;
  for (let i = NX - 2; i > 4; i--) {
    if (F.land[bj * NX + i] > 0.15) { iCoast = i; break; }
  }

  const caveK = Math.round(WATER) + 2;   // 洞口贴水面：低机位平视就能看穿
  const tunnel = {
    i0: Math.max(3, iCoast - 12), i1: Math.min(NX - 2, iCoast + 2),
    j: bj, k: caveK, width: 5, height: 4, cells: 0,
  };
  for (let i = tunnel.i0; i <= tunnel.i1; i++) {
    for (let dj = -2; dj <= 2; dj++) {
      const j = bj + dj;
      if (j < 1 || j >= NY - 1) continue;
      // 掏掉 4 层、顶上原样留着 → 洞口有一圈悬空的岩檐/洞顶
      for (let k = caveK; k < caveK + 4; k++) {
        if (!vox[idx(i, j, k)]) continue;
        vox[idx(i, j, k)] = 0; tunnel.cells++;
      }
    }
  }

  // —— 海上石柱：柱子在水中，帽檐比柱子宽 —— 悬垂在剪影上就看得见 ——
  const sj = Math.min(NY - 5, bj + 8);
  let iCoast2 = iCoast;
  for (let i = NX - 2; i > 4; i--) {
    if (F.land[sj * NX + i] > 0.15) { iCoast2 = i; break; }
  }
  // 石柱必须站到岸外的水里，站在坡上就不叫"海上石柱"，帽檐也读不出来
  const si = Math.min(NX - 4, iCoast2 + 5);
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
      if (i < 1 || j < 1 || i >= NX - 1 || j >= NY - 1) continue;
      for (let k = stack.capZ; k <= stack.capZ + 2; k++) {
        vox[idx(i, j, k)] = 1; stack.capCells++;
      }
    }
  }

  return { vox, top, field: F, tunnel, stack, idx };
}

/* ---------- 只画"邻居没盖住"的面 ---------- */
const FACES = [
  // dir, normal, 4 个角的体素局部坐标（x,y,z 轴 → i,k,j）
  { d: [1, 0, 0],  n: [1, 0, 0],  q: [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], shade: 0.94 },
  { d: [-1, 0, 0], n: [-1, 0, 0], q: [[0,0,1],[0,0,0],[0,1,0],[0,1,1]], shade: 0.72 },
  { d: [0, 0, 1],  n: [0, 0, 1],  q: [[1,0,1],[0,0,1],[0,1,1],[1,1,1]], shade: 0.84 },
  { d: [0, 0, -1], n: [0, 0, -1], q: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]], shade: 0.66 },
  { d: [0, 1, 0],  n: [0, 1, 0],  q: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], shade: 1.00 },
  { d: [0, -1, 0], n: [0, -1, 0], q: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], shade: 0.42 },
];

function faceColor(dir, wx, wy, wz, shade, out, o) {
  let r, g, b;
  if (dir === 4) {            // 顶面：草/苔，高处偏冷
    const t = clamp((wy - WATER) / 22, 0, 1);
    r = 0.88 - 0.14 * t; g = 0.84 - 0.08 * t; b = 0.50 + 0.10 * t;
  } else if (dir === 5) {     // 悬垂底面：暗岩，必须压到很暗才看得出"下面是空的"
    r = 0.30; g = 0.28; b = 0.24;
  } else {                    // 侧面：岩壁，按高度分带
    const band = ((Math.floor((wy + 0.5) / 2.2) & 1) ? 0.05 : -0.04);
    r = 0.70 + band; g = 0.63 + band; b = 0.47 + band;
    if (wy < WATER + 0.6) { r = 0.34; g = 0.38; b = 0.38; }
  }
  out[o] = r * shade; out[o + 1] = g * shade; out[o + 2] = b * shade;
}

export function buildMesh(T) {
  const { vox } = T;
  const idx = T.idx;
  const solid = (i, j, k) =>
    i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ ? vox[idx(i, j, k)] : 0;

  const pos = [], nor = [], col = [];
  let faces = 0, soffitAboveWater = 0;
  const byDir = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < NZ; k++) {
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        if (!vox[idx(i, j, k)]) continue;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          if (solid(i + F.d[0], j + F.d[2], k + F.d[1])) continue;
          byDir[f]++;
          // 水面以上的朝下面 = 真正的悬垂（水面以下那片是岛底，不算岩檐）
          if (f === 5 && k > WATER) soffitAboveWater++;
          const q = F.q;
          // 四角 → 两个三角形（底面反向给顺序无所谓，材质双面）
          const order = [0, 1, 2, 0, 2, 3];
          for (const c of order) {
            const vv = q[c];
            const wx = (i + vv[0] - NX / 2);
            const wy = k + vv[1];
            const wz = (j + vv[2] - NY / 2);
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
    // 朝下的面 = 真正的岩檐/洞顶下沿。高度场做不到这件事，所以这个数就是证据。
    soffitFaces: byDir[5],
    soffitAboveWater,
  };
}

/* ---------- 统计：悬垂到底有没有？隧道到底通不通？ ---------- */
export function measure(T) {
  const { vox, idx, tunnel, stack } = T;
  const caveK = tunnel.k;
  const solid = (i, j, k) =>
    i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ ? vox[idx(i, j, k)] : 0;

  let total = 0, overhang = 0, topFaces = 0;
  for (let k = 1; k < NZ; k++) {
    for (let j = 1; j < NY - 1; j++) {
      for (let i = 1; i < NX - 1; i++) {
        if (!vox[idx(i, j, k)]) continue;
        total++;
        // 脚下空、头顶实、且在水面以上 → 这一格是"悬出来的地板"。
        // 水面以下那层是岛底收窄造成的，不算岩檐，必须排除，否则数会虚高十倍。
        if (k > WATER && !solid(i, j, k - 1) && solid(i, j, k + 1)) overhang++;
      }
    }
  }

  // 海蚀洞：从洞口那格空气往里 BFS，看最深能走到哪一格（不穿实心）
  const start = { i: tunnel.i1, j: tunnel.j, k: caveK + 1 };
  const seen = new Uint8Array(NX * NY * NZ);
  const q = [start];
  seen[idx(start.i, start.j, start.k)] = 1;
  let airReach = 0, minI = start.i;
  // 只在洞体这个盒子里走：不设边界的话 BFS 会从洞口漏到外面的空气里，
  // 走得通整片天空，"洞有多深"就变成一个没有意义的数。
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
  for (let n = 0; n < NX * NY; n++) {
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
  };
}
