/**
 * scene-voxels.js — 光影与生命管线的「虚拟体素空间」：场景采样 → 共享 World（纯数据，Node / Worker 共用）。
 * 931196707236392960「My generated levels all keep a virtual voxel space. It is used for light baking, soft normals, various 3D textures,
 *   simplified collision, wind simulation etc.」——这一层所有能力（遮蔽、反弹、大纹理、区域图、植物图集、风、烟、动物）读同一份 World。
 *
 * site（lightlife.probe 的实景采样，或 syntheticSite(seed) 的合成岛）：
 *   { scene:{ id, label }, source:'probe'|'synthetic', n, step（米 / 格）, L（米 / 层）, x0, z0（第 0 格角点，贴球舞台坐标，米）,
 *     h:[n·n]（离海面高度，米；≤ SEA = 海）, kind:[n·n]（0 海 · 1 地形 · 2 建筑）, col:[n·n]（顶面色 '#rrggbb'）,
 *     flora:{ 网格名里认出的植物种类: 株数 }, seed }
 * 层数 = round(h / L)，夹在 1..MAX_LEVEL（core/world.js 是 12 层）；建筑柱子写非岩石层（World.isBuilt），地形写岩石层。
 */
import { World, MAX_LEVEL } from '../../../../townscaper-web/REACodeRefactoring/src/core/world.js';
import { fbm } from '../../../../townscaper-web/REACodeRefactoring/src/core/noise.js';
import { PALETTES, TERRAIN } from '../../../../townscaper-web/REACodeRefactoring/src/core/palette.js';

export const SEA = 0.05;
export const hexToRgb = (h) => { const v = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = v ? parseInt(v[1], 16) : 0xb0b0b0; return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };
export const rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
export const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export function hueOf({ r, g, b }) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return 0; const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return h * 60; }
const rng = (seed) => { let a = (seed * 2654435761) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** n×n 方格网格：cells[] 带 pts（四角，按边序）、包围盒、edgeNeighbors（第 k 条边 = pts[k]→pts[k+1] 那一侧的邻居，没有为 −1）。原版 Town 与 World 都能用。 */
export function squareGrid(n, step, x0 = 0, z0 = 0) {
  const cells = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const id = j * n + i, ax = x0 + i * step, az = z0 + j * step;
    const pts = [{ x: ax, z: az }, { x: ax + step, z: az }, { x: ax + step, z: az + step }, { x: ax, z: az + step }];
    cells.push({ id, i, j, n: 4, pts, cx: ax + step / 2, cz: az + step / 2, minX: ax, maxX: ax + step, minZ: az, maxZ: az + step, size: step / 2,
      edgeNeighbors: [j > 0 ? id - n : -1, i + 1 < n ? id + 1 : -1, j + 1 < n ? id + n : -1, i > 0 ? id - 1 : -1] });
  }
  return { cells, cellCount: cells.length, n, step, x0, z0 };
}
export const levelOf = (h, L) => (!(h > SEA) ? 0 : Math.max(1, Math.min(MAX_LEVEL, Math.round(h / L))));

/** site → { grid, world, L, step, n, levels, colorOf, topRgb }。colorOf(cell, lv) = 这一列的顶面色（反弹光的来源色）。 */
export function worldFromSite(site) {
  const { n, step, L } = site, grid = squareGrid(n, step, site.x0 || 0, site.z0 || 0), world = new World(grid), levels = new Int8Array(n * n), topRgb = new Array(n * n);
  for (const c of grid.cells) {
    const lv = levelOf(site.h[c.id], L); levels[c.id] = lv; topRgb[c.id] = hexToRgb(site.col?.[c.id]);
    if (lv) world.fill(c, lv, { rock: (site.kind?.[c.id] ?? 1) !== 2 });
  }
  return { grid, world, L, step, n, levels, topRgb, colorOf: (c) => topRgb[c.id] };
}

/**
 * 体素柱子的三角形汤（顶面每格两个三角，露出来的侧墙每条边两个三角），朝外绕序，供烘焙与量指标。
 * tri[k] = { cell, part:'top'|'wall', edge, y0, y1, nb }（每个三角形一条，nb = 墙对面邻居的顶层）。
 */
export function columnMesh(V) {
  const { grid, world, L } = V, pos = [], col = [], tri = [], top = (c) => world.top(c);
  const push = (pts, c, info) => { for (const [x, y, z] of pts) { pos.push(x, y, z); const k = V.colorOf(c); col.push(k.r, k.g, k.b); } tri.push(info); };
  for (const c of grid.cells) {
    const t = top(c); if (!t) continue;
    const y = t * L, [a, b, cc, d] = c.pts;
    push([[a.x, y, a.z], [cc.x, y, cc.z], [b.x, y, b.z]], c, { cell: c.id, part: 'top', y0: y, y1: y });
    push([[a.x, y, a.z], [d.x, y, d.z], [cc.x, y, cc.z]], c, { cell: c.id, part: 'top', y0: y, y1: y });
    for (let e = 0; e < 4; e++) {
      const nid = c.edgeNeighbors[e], nt = nid < 0 ? 0 : top(grid.cells[nid]);
      if (nt >= t) continue;
      const p = c.pts[e], q = c.pts[(e + 1) % 4], y0 = nt * L, y1 = y;
      push([[p.x, y0, p.z], [q.x, y1, q.z], [q.x, y0, q.z]], c, { cell: c.id, part: 'wall', edge: e, y0, y1, nb: nt });
      push([[p.x, y0, p.z], [p.x, y1, p.z], [q.x, y1, q.z]], c, { cell: c.id, part: 'wall', edge: e, y0, y1, nb: nt });
    }
  }
  return { pos, col, tri };
}

/** 顶面「开阔」= 八邻居都不比它高（天空没被挡）；「凹角」= 墙脚贴着更高的邻居（第一圈）。量遮蔽是否只压该压的地方用。 */
export function surfaceClasses(V) {
  const { grid, world, n } = V, open = new Uint8Array(n * n), corner = new Uint8Array(n * n);
  for (const c of grid.cells) {
    const t = world.top(c); if (!t) continue;
    let higher = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const i = c.i + di, j = c.j + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue; if (world.top(grid.cells[j * n + i]) > t) higher = true; }
    if (!higher) open[c.id] = 1;
    for (const nid of c.edgeNeighbors) if (nid >= 0 && world.top(grid.cells[nid]) > t) corner[c.id] = 1;
  }
  return { open, corner };
}

/**
 * 合成岛（种子 s）：低多边形小岛 + 一圈沙岸 + 几栋 Townscaper 色的房子 + 植物清单。分布报告与单元测试用。
 * 地形用重构库 core/noise.js 的 fbm（与山形管线同一个噪声），房子颜色用 core/palette.js 的 PALETTES.town，地形色用 TERRAIN。
 */
export function syntheticSite(seed = 1, { n = 28, step = 2, L = 1.2 } = {}) {
  const R = rng(seed), N = n * n, h = new Array(N).fill(0), kind = new Array(N).fill(0), col = new Array(N).fill('#5d9fae');
  const raw = new Float64Array(N); let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = fbm(i / n, j / n, { octaves: 4, freq: 3, seed }); raw[j * n + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const cx = n / 2 + (R() - 0.5) * 4, cz = n / 2 + (R() - 0.5) * 4, rad = n * (0.34 + R() * 0.08);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i, r = Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / rad, noise = hi > lo ? (raw[q] - lo) / (hi - lo) : 0.5;
    const e = (1 - r) * 1.2 + (noise - 0.5) * 0.8;
    if (e <= 0.08) continue;
    const m = Math.min(9.5, e * 10 * L);
    h[q] = Math.round(m * 100) / 100; kind[q] = 1;
    col[q] = m < 1.6 * L ? TERRAIN.sand : m > 6 * L ? TERRAIN.rock : TERRAIN.grass;
  }
  const land = [...h.keys()].filter((q) => h[q] > L * 1.5), houses = 5 + Math.floor(R() * 6), town = PALETTES.town.colors;
  for (let k = 0; k < houses && land.length; k++) {
    const q = land[Math.floor(R() * land.length)], w = 1 + Math.floor(R() * 2), d = 1 + Math.floor(R() * 2), up = (2 + Math.floor(R() * 4)) * L, paint = town[Math.floor(R() * town.length)];
    const i0 = q % n, j0 = (q / n) | 0;
    for (let dj = 0; dj < d; dj++) for (let di = 0; di < w; di++) { const i = i0 + di, j = j0 + dj; if (i >= n || j >= n) continue; const p = j * n + i; if (!(h[p] > SEA)) continue; h[p] = Math.round(Math.min(14.2, h[q] + up) * 100) / 100; kind[p] = 2; col[p] = paint; }
  }
  const flora = { pine: 4 + Math.floor(R() * 20), shrub: 6 + Math.floor(R() * 30), meadow: 10 + Math.floor(R() * 60) };
  if (R() < 0.5) flora.fern = 3 + Math.floor(R() * 12);
  return { scene: { id: 'synthetic-' + seed, label: '合成岛 #' + seed }, source: 'synthetic', n, step, L, x0: -n * step / 2, z0: -n * step / 2, h, kind, col, flora, seed };
}

/** 采样健全性（扫描时用）：形状、数值、范围。返回问题清单（空 = 可用）。 */
export function siteProblems(site) {
  const out = [];
  if (!site || typeof site !== 'object') return ['没有采样'];
  const { n, step, L } = site;
  if (!(Number.isInteger(n) && n >= 4 && n <= 128)) out.push('格数 n 无效');
  if (!(step > 0) || !(L > 0)) out.push('格距 / 层高无效');
  if (!Array.isArray(site.h) || site.h.length !== n * n || site.h.some((v) => !Number.isFinite(v))) out.push('高度网格无效');
  if (site.kind && (site.kind.length !== n * n)) out.push('分类网格长度不对');
  if (site.col && (site.col.length !== n * n)) out.push('颜色网格长度不对');
  return out;
}
