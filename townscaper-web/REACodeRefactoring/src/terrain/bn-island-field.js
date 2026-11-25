/**
 * bn-island-field.js — 1579474420749725696「I'm back on the island generation」的可对齐裁判残差。
 *
 * 片子（454 帧）：两组岛 —— 线框逐步搭出崖/坡/小屋 → 绿色台地/浅色崖/黄色屋顶着色 → 转镜；
 * 218 帧重置，第二组线框再生 → 着色 → 转到俯视。「两组」= 同一台种子化生成器重跑两次。
 *
 * 迁自 REACode/engine/islands.js（裁判库 Bad North 那一半引擎，原版只读不改）：
 *   buildIsland         域扭曲 fbm + 脊线噪声 → 径向衰减 → 台地量化 → 一次平滑 →
 *                       材质分类（SEA/SAND/GRASS/GRASS_TOP/ROCK/ROCK_DARK）→ 可走格。
 *   findPath            可走格上的 8 向 A*（代价含高差惩罚）。
 *   buildIslandGeometry 顶面 quad + 落差 ≥0.12 的竖直崖裙，逐面明暗（faceted look）。
 * 依赖的 value-noise/fbm/ridged/makeRng 在 src/core/noise.js 已与裁判逐位一致，
 * 所以同参数下 h/mat/slope/walkable、findPath 路径、几何 pos/col 全部逐位对拍
 * （tests/bn-island-referee.mjs）。「两组岛」就是两个 seed 各跑一次 —— 确定性、互不相同。
 *
 * placeIslandHouses 是「模块联合生成」那半边：小屋候选与台地同一场、同一种子一起出。
 * 规则取裁判 engine/mesa.js 第 6 步的「平顶候选 → 随机挑 → 最小间距 → spire 标记」
 * （mesa 在方格 Town 上跑、house placement 未迁进共享 World，本函数是它在这场上的同款实现，
 * 不是原作算法 —— 原片配文只说了「back on the island generation」，生成器算法未公开，
 * 不能把本实现认证为原算法）。mesa 的「4 邻完全同高」在连续高度场上逐位成立率为 0，
 * 故按 |Δh| ≤ eps + slope < slopeMax + 草顶材质（GRASS/GRASS_TOP，即台地顶面）判平顶内部。
 */

import { fbm, ridged, clamp01, smoothstep, makeRng } from '../core/noise.js';

export const MATERIAL = {
  SEA: 0, SAND: 1, GRASS: 2, GRASS_TOP: 3, ROCK: 4, ROCK_DARK: 5,
};

const COLORS = {
  [MATERIAL.SAND]: '#e2d3ac',
  [MATERIAL.GRASS]: '#7f9f52',
  [MATERIAL.GRASS_TOP]: '#93b062',
  [MATERIAL.ROCK]: '#9a9287',
  [MATERIAL.ROCK_DARK]: '#8a8274',
};

export function materialColor(id) {
  return COLORS[id] ?? '#7f9f52';
}

/**
 * Build an island field.（与裁判 engine/islands.js 同式同序）
 * @param {object} opts
 * @param {number} opts.size     grid resolution (cells per side)
 * @param {number} opts.seed
 * @param {number} opts.terraces how many height steps the land is quantised to
 * @param {number} opts.roughness 0..1, how much high-frequency detail
 * @param {number} opts.coast    radius of the island as a fraction of the field
 */
export function buildIsland({
  size = 96,
  seed = 1,
  terraces = 5,
  roughness = 0.55,
  coast = 0.78,
  waterLevel = 0,
} = {}) {
  const n = size;
  const h = new Float32Array(n * n);
  const mat = new Uint8Array(n * n);
  const rng = makeRng(seed);

  // ---- 1. height field -----------------------------------------------------
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const v = j / (n - 1);

      // domain warp: pushes the coastline around so it is never a blob
      const wx = fbm(u * 3 + 11.3, v * 3 + 7.1, { octaves: 3, freq: 2, seed: seed + 91 });
      const wy = fbm(u * 3 + 41.7, v * 3 + 3.9, { octaves: 3, freq: 2, seed: seed + 57 });
      const x = u + (wx - 0.5) * 0.28;
      const y = v + (wy - 0.5) * 0.28;

      let e = fbm(x * 2.2, y * 2.2, { octaves: 5, freq: 2.6, gain: 0.52, seed });
      e = e * 0.75 + ridged(x * 3.1, y * 3.1, { octaves: 3, freq: 3, seed: seed + 13 }) * 0.25;

      // radial falloff: island sits in the middle of the field
      const dx = (u - 0.5) * 2;
      const dy = (v - 0.5) * 2;
      const r = Math.sqrt(dx * dx + dy * dy) / coast;
      const falloff = 1 - smoothstep(0.62, 1.08, r);

      let land = clamp01(e * 1.35 - 0.34) * falloff;

      // a rim of beach, then a small shelf so the coast is not a knife edge
      land -= 0.06 * smoothstep(0.5, 1.0, r);

      // ---- 2. terrace it: this is what gives the stacked-plateau silhouette
      if (land > 0.02) {
        const t = Math.pow(land, 0.92);
        const stepped = Math.round(t * terraces) / terraces;
        land = stepped * (1 - roughness) + t * roughness;
      }

      h[j * n + i] = land * 3.2 - 0.55 + waterLevel;
    }
  }

  // ---- 3. smooth once so ledges are not jagged per-cell -------------------
  const tmp = h.slice();
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      tmp[k] = (h[k] * 4 + h[k - 1] + h[k + 1] + h[k - n] + h[k + n]) / 8;
    }
  }
  h.set(tmp);

  // ---- 4. material classification ----------------------------------------
  const nx = new Float32Array(n * n);
  const nz = new Float32Array(n * n);
  const slope = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const hl = h[j * n + Math.max(0, i - 1)];
      const hr = h[j * n + Math.min(n - 1, i + 1)];
      const hd = h[Math.max(0, j - 1) * n + i];
      const hu = h[Math.min(n - 1, j + 1) * n + i];
      nx[k] = (hl - hr) * 0.5;
      nz[k] = (hd - hu) * 0.5;
      slope[k] = Math.hypot(nx[k], nz[k]);
    }
  }

  for (let k = 0; k < n * n; k++) {
    const e = h[k];
    const s = slope[k];
    if (e <= 0.02) mat[k] = MATERIAL.SEA;
    else if (e < 0.16 && s < 0.5) mat[k] = MATERIAL.SAND;
    else if (s > 0.62) mat[k] = e > 1.6 ? MATERIAL.ROCK_DARK : MATERIAL.ROCK;
    else if (e > 2.1) mat[k] = MATERIAL.ROCK;
    else mat[k] = e > 1.2 ? MATERIAL.GRASS_TOP : MATERIAL.GRASS;
  }

  // ---- 5. navigation grid -------------------------------------------------
  const walkable = new Uint8Array(n * n);
  let walkableCount = 0;
  for (let k = 0; k < n * n; k++) {
    const ok = h[k] > 0.18 && slope[k] < 0.5;
    walkable[k] = ok ? 1 : 0;
    if (ok) walkableCount++;
  }

  return { n, h, mat, slope, walkable, waterLevel, seed, stats: { walkableCount } };
}

/* --------------------------------------------------------------- nav: A* */

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Path between two cells on the walkable grid; [] when unreachable.（与裁判同式同序） */
export function findPath(field, from, to) {
  const { n, walkable, h } = field;
  const idx = (i, j) => j * n + i;
  const start = idx(from[0], from[1]);
  const goal = idx(to[0], to[1]);
  if (!walkable[start] || !walkable[goal]) return [];

  const open = [start];
  const gScore = new Float32Array(n * n).fill(Infinity);
  const fScore = new Float32Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  gScore[start] = 0;
  fScore[start] = Math.hypot(from[0] - to[0], from[1] - to[1]);

  while (open.length > 0) {
    let best = 0;
    for (let k = 1; k < open.length; k++) if (fScore[open[k]] < fScore[open[best]]) best = k;
    const cur = open.splice(best, 1)[0];
    if (cur === goal) break;
    closed[cur] = 1;
    const ci = cur % n;
    const cj = (cur / n) | 0;

    for (const [di, dj] of DIRS) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = idx(ni, nj);
      if (!walkable[nk] || closed[nk]) continue;
      const step = (di && dj ? 1.4142 : 1) * (1 + Math.abs(h[nk] - h[cur]) * 1.5);
      const tentative = gScore[cur] + step;
      if (tentative >= gScore[nk]) continue;
      came[nk] = cur;
      gScore[nk] = tentative;
      fScore[nk] = tentative + Math.hypot(ni - to[0], nj - to[1]);
      if (!open.includes(nk)) open.push(nk);
    }
  }

  if (came[goal] === -1 && goal !== start) return [];
  const path = [];
  let cur = goal;
  while (cur !== -1) {
    path.push([cur % n, (cur / n) | 0]);
    if (cur === start) break;
    cur = came[cur];
  }
  return path.reverse();
}

/* ---------------------------------------------------------- 小屋联合生成 */

/**
 * 台地上的小屋（片中绿台面上的黄顶白墙模块），与高度场同一种子一起出 ——
 * 即「模块联合生成」：不是生成完岛再后贴，而是同一场上按平顶候选挑出。
 *
 * 规则取裁判 engine/mesa.js 第 6 步：候选 = 平顶内部格（mesa 是 4 邻完全同高；
 * 本函数在连续高度场上用 |Δh|≤eps 的同款判据），随机挑、彼此拉开 minDist，
 * spire = rng()<0.35 与裁判同概率。候选另限 mat 为 GRASS/GRASS_TOP（台地草顶，
 * 即片中小屋站的那一层）且 slope<slopeMax —— 小屋不站崖肩/沙滩/岩壁。
 * 返回 [{i, j, x, z, h, spire}]，x/z 为格坐标，h 为场高度；确定性：同种子同结果。
 */
export function placeIslandHouses(field, {
  seed = 1, count = 4, minH = 0.6, eps = 0.02, slopeMax = 0.4, minDist = 3, spireChance = 0.35,
} = {}) {
  const { n, h, mat, slope } = field;
  if (!(n > 2) || !(count >= 0)) throw new RangeError('placeIslandHouses: bad field/count');
  const cand = [];
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      if (h[k] < minH || slope[k] >= slopeMax) continue;
      if (mat[k] !== MATERIAL.GRASS && mat[k] !== MATERIAL.GRASS_TOP) continue;
      if (Math.abs(h[k] - h[k - 1]) > eps || Math.abs(h[k] - h[k + 1]) > eps) continue;
      if (Math.abs(h[k] - h[k - n]) > eps || Math.abs(h[k] - h[k + n]) > eps) continue;
      cand.push(k);
    }
  }
  const rng = makeRng(seed);
  const picks = [];
  for (let t = 0; t < count * 6 && picks.length < count && cand.length; t++) {
    const k = cand[(rng() * cand.length) | 0];
    const i = k % n, j = (k / n) | 0;
    if (picks.some((p) => Math.hypot(p.i - i, p.j - j) < minDist)) continue;
    picks.push({ i, j, x: i, z: j, h: h[k], spire: rng() < spireChance });
  }
  return { houses: picks, candidates: cand.length };
}

/* ------------------------------------------------------------- mesh build */

/**
 * Turn the field into one flat-shaded mesh: a surface quad per cell plus a
 * vertical skirt wherever the ground drops away (the cliff silhouette).
 * （与裁判同式同序；pos/col 与裁判逐位一致）
 */
export function buildIslandGeometry(field, { cell = 0.42, heightScale = 0.55 } = {}) {
  const { n, h, mat } = field;
  const pos = [];
  const col = [];
  const toLinear = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
  const c = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [
      toLinear(((v >> 16) & 255) / 255),
      toLinear(((v >> 8) & 255) / 255),
      toLinear((v & 255) / 255),
    ];
  };
  const cache = new Map();
  const colorOf = (id) => {
    if (!cache.has(id)) cache.set(id, c(materialColor(id)));
    return cache.get(id);
  };

  const off = (n - 1) * cell * 0.5;
  const P = (i, j) => [i * cell - off, h[j * n + i] * heightScale, j * cell - off];

  const tri = (a, b, cc, rgb, shade = 1) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2]);
    for (let k = 0; k < 3; k++) col.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
  };

  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const k = j * n + i;
      const m = mat[k];
      if (m === MATERIAL.SEA) continue;
      const rgb = colorOf(m);
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);

      // surface, two triangles, flat shades to fake the faceted look
      tri(p00, p01, p11, rgb, 0.97);
      tri(p00, p11, p10, rgb, 1.03);

      // cliffs: a skirt down to the lowest neighbour, on all four sides
      const nbs = [
        [1, 0, p10, p11], [0, 1, p01, p11],
        [-1, 0, p00, p01], [0, -1, p00, p10],
      ];
      for (const [di, dj, a, b] of nbs) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const drop = h[j * n + i] - h[nj * n + ni];
        if (drop < 0.12) continue;
        const y = (P(ni, nj)[1]);
        const rock = colorOf(MATERIAL.ROCK_DARK);
        tri(a, [a[0], y, a[2]], [b[0], y, b[2]], rock, 0.86);
        tri(a, [b[0], y, b[2]], b, rock, 0.82);
      }
    }
  }

  return { pos, col };
}
