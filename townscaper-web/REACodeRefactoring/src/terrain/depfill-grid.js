/**
 * depfill-grid.js — 方格版填洼诊断（R44 嫁接补缺：REACode/src/depfill.js 的方格接口，原版只读不改）。
 *
 * 原版 priorityFlood 的算法已在 core/depression-fill.js（多边形邻接 + 显式出口树，Barnes 微坡可选），这里不再写一份 Priority-Flood：
 * priorityFlood(H) 把方格包成 8 邻 cells 调 depressionFill，再按原版的口径交回二维数组。
 * 原版其余导出（演示岛 heights、isLand、localMinima、drained、naiveLift、liftStats、stepEdges、lakeClusters、measure）
 * 是方格上的诊断，搬过来以后两边能对同一个种子逐项对照（TigerMessenger/tests/relief-parity.test.mjs）。
 *
 * 和原版不同（登记在 catalog/parity/relief.valley.json）：
 *   - 原版被困格抬到「当前水位 + EPS」，链式累加 k·EPS；这里抬到溢出面本身（depressionFill.filled，无微坡）。
 *     对照比较 lift / lake 时容差 1e-3（EPS = 1e-4，最长链也远小于这个数）。
 *   - 原版 lakeClusters 把相连的被抬格不分水位并成一个湖；core lakeClusters 按同一溢出面分湖。湖格总数一致，湖的个数可能不同。
 *   - 原版海格高程 WATER − 0.4（负数）；depressionFill 要求高程 ≥ 0，包装时海格记 0（原版也把海种子的水位取 max(H, WATER) = 0）。
 */
import { depressionFill, drainedCells, lakeClusters as coreLakes } from '../core/depression-fill.js';
import { gridCells } from './river-valley.js';

export const CFG = Object.freeze({ N: 64, WATER: 0, STEP: 0.6, EPS: 1e-4 });
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695040888963407) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
}
function fbm(x, y, s) {
  let v = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < 5; o++) {
    v += amp * vnoise(x * f, y * f, s + o * 37);
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return v / norm;
}

/** 原版演示岛：台地量化 + 6 处坑 + 10 个针孔（与原版逐值一致） */
export function heights(seed = 7) {
  const { N, STEP, WATER } = CFG;
  const H = [], raw = [];
  for (let y = 0; y < N; y++) {
    const rowR = [];
    for (let x = 0; x < N; x++) {
      const u = x / N - 0.5, v = y / N - 0.5;
      const r = Math.hypot(u, v) * 2;
      const island = Math.max(0, Math.min(1, (1.06 - r) / 0.62));
      const n = fbm(x * 0.085, y * 0.085, seed) * 1.28 + fbm(x * 0.21, y * 0.21, seed + 11) * 0.42;
      rowR.push(island * (2.0 + n * 4.4) - 0.42);
    }
    raw.push(rowR);
  }
  const basin = [];
  for (let b = 0; b < 6; b++) {
    const cx = 14 + Math.floor(hash2(b, 3, seed) * (N - 28));
    const cy = 14 + Math.floor(hash2(b, 9, seed) * (N - 28));
    const rad = 2.4 + hash2(b, 17, seed) * 1.2;
    const depth = 1.2 + hash2(b, 23, seed) * 1.0;
    basin.push({ x: cx, y: cy, r: rad, d: depth });
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < rad) raw[y][x] -= depth * (1 - (d / rad) ** 2);
      }
  }
  for (let p = 0; p < 10; p++) {
    const px = 12 + Math.floor(hash2(p, 41, seed) * (N - 24));
    const py = 12 + Math.floor(hash2(p, 47, seed) * (N - 24));
    if (raw[py][px] < 1.6) continue;
    const d = 1.1 + hash2(p, 53, seed) * 0.9;
    raw[py][px] -= d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) raw[py + dy][px + dx] -= d * 0.35;
  }
  for (let y = 0; y < N; y++) {
    const row = [];
    for (let x = 0; x < N; x++) {
      const h = raw[y][x];
      row.push(h <= WATER ? WATER - 0.4 : Math.round(h / STEP) * STEP + STEP * 0.5);
    }
    H.push(row);
  }
  return { H, basin };
}

export function isLand(H, x, y) {
  const N = H.length;
  return x >= 0 && y >= 0 && x < N && y < N && H[y][x] > CFG.WATER;
}

/** 局部极小：陆地格，8 邻全部是陆地且严格高于自己（同原版） */
export function localMinima(H) {
  const N = H.length, out = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!isLand(H, x, y)) continue;
      let low = true, nb = 0;
      for (const [dx, dy] of NB8) {
        if (!isLand(H, x + dx, y + dy)) { low = false; break; }
        nb++;
        if (H[y + dy][x + dx] <= H[y][x]) { low = false; break; }
      }
      if (low && nb === 8) out.push({ x, y, z: H[y][x] });
    }
  return out;
}

const flat = (H) => { const N = H.length, a = new Float64Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a[y * N + x] = H[y][x] > CFG.WATER ? H[y][x] : 0; return a; };

/** Priority-Flood：调 core/depression-fill.js（8 邻 cells），返回与原版同形的二维数组 F（海格保持原值）。 */
export function priorityFlood(H, { withFill = false } = {}) {
  const N = H.length, cells = gridCells(N, { diag: true }), hs = flat(H), fill = depressionFill(cells, hs);
  const F = H.map((r, y) => r.map((z, x) => (z > CFG.WATER ? fill.filled[y * N + x] : z)));
  return withFill ? { F, fill, cells, heights: hs } : F;
}

/** 排水率：调 core drainedCells（8 邻 cells）；pct 与原版同口径（百分数） */
export function drained(H) {
  const N = H.length, cells = gridCells(N, { diag: true }), r = drainedCells(cells, flat(H));
  return { ok: r.ok, land: r.land, pct: r.land ? (r.ok / r.land) * 100 : 0, seen: r.seen };
}

/** 反面对照（同原版）：只把极小格抬到最低邻居——极小格数变 0，但湖面不存在 */
export function naiveLift(H) {
  const F = H.map((r) => r.slice());
  for (const m of localMinima(F)) {
    let low = Infinity;
    for (const [dx, dy] of NB8) if (isLand(F, m.x + dx, m.y + dy)) low = Math.min(low, F[m.y + dy][m.x + dx]);
    if (isFinite(low)) F[m.y][m.x] = low;
  }
  return F;
}

export function liftStats(H, F) {
  const N = H.length;
  let raised = 0, sum = 0, max = 0, lake = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = F[y][x] - H[y][x];
      if (d > CFG.EPS * 4) { raised++; sum += d; if (d > max) max = d; }
      if (d > CFG.EPS * 4 && H[y][x] > CFG.WATER) lake++;
    }
  return { raised, mean: raised ? sum / raised : 0, max, lake };
}

export function stepEdges(H) {
  const N = H.length;
  let n = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!isLand(H, x, y)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!isLand(H, x + dx, y + dy)) continue;
        if (Math.abs(H[y + dy][x + dx] - H[y][x]) >= CFG.STEP * 0.9) n++;
      }
    }
  return n;
}

/** 湖：core lakeClusters（同一溢出面成一个湖），转成原版字段 { area, surf, deep, cx, cy }，按 deep 降序 */
export function lakeClusters(H) {
  const N = H.length, { fill, cells, heights } = priorityFlood(H, { withFill: true });
  return coreLakes(cells, heights, fill).lakes.map((l) => ({
    area: l.area, surf: l.level, deep: l.depth,
    cx: l.cells.reduce((s, id) => s + (id % N), 0) / l.area, cy: l.cells.reduce((s, id) => s + Math.floor(id / N), 0) / l.area,
  })).sort((a, b) => b.deep - a.deep);
}

export function measure(seed = 7) {
  const { H } = heights(seed);
  const NA = naiveLift(H), PF = priorityFlood(H);
  const pack = (name, F) => ({ name, minima: localMinima(F).length, drain: drained(F), lift: liftStats(H, F), steps: stepEdges(F), land: drained(F).land });
  return { raw: pack('原始（量化台地 + 洼地）', H), naive: pack('逐格抬到最低邻居', NA), flood: pack('Priority-Flood 填洼（core/depression-fill.js）', PF), lakes: lakeClusters(H), H, NA, PF };
}
