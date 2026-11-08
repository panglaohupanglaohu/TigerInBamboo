/**
 * walkreach.js — 「可通行」不等于「连通」：关卡生成的可走性启发式 + 台阶修补。
 *
 * 帖子 ID：917405214638006273
 * 原文：「A somewhat major breakthrough in my procedural generation: a heuristic for
 *        deliberately generating navigable levels」
 *
 * ---- 画面观察（tmp/cap/917405214638006273 的 6 帧，ViewImage 看过）----
 * 六帧全是同一张调试底图：一片灰色网格上撒着一层很淡的六棱柱标记，中央只有一座小岛、
 * 岛上一栋白房子、外加一根红黄绿三轴 gizmo。画面里**没有任何一条路径线**、也没有可走性
 * 判定的可视化，所以这条只能靠原文一句话下手，不能假装从画面读出了算法（见 GUIDE 第 1 条）。
 *
 * ---- 为什么这么做 ----
 * 上一轮（src/campaignmap.js）只做到了图论层：随机游走保证 start→finish 在图上连着（67 点、
 * 0 次断路）。但「图上连着」和「人真能走上去」是两件事：量化台地上任意一次跨层移动都是
 * 0.9 的垂直落差，而人要一步跨上去的上限是 0.62 —— 于是最短路会沿着崖壁直线穿过去，
 * 到了地形层就断成互不相通的几块。这就是本条剩下的那一半。
 *
 * 本模块的做法（三步，全都能量）：
 *   ① BFS 在忽略高度的格图上求最短路 → 得到「保证连通」的那条线（对应 campaignmap 的结论）；
 *   ② 用「单步落差 ≤ CLIMB」重新判定可走，分出真正能到达的连通分量 → 量出图连通但走不通的比例；
 *   ③ 修补：沿路线每遇到一条崖边，在低侧那一格放一级台阶（把 0.9 落差拆成两级 0.45 踏步），
 *      再重跑 ② —— 量出台阶数、修补后的可走率、以及「斜面不可走但台阶可走」这件事本身。
 *
 * 量化结论（node --input-type=module 实跑 measure()，24 张图；格宽 1.0、层高 0.9、可跨落差 0.62）：
 *   - 图连通 24/24（BFS 100%），但这条「保证连通」的最短路**没有一张**能一脚不落地走完（直达 0/24）：
 *     平均每张图穿 5.00 条崖边，每条都是 0.90 的垂直落差 > 0.62 的上限。
 *   - 允许绕行的可走路线在 24 张里只有 4 张存在（16.7%），存在的那几张也要绕 1.431×、最坏 2.283×
 *     （一条 52 格的直线要绕成 76 格）——「图上通」和「人能到」差着一整个地形层。
 *   - 沿路线每遇一条崖边在低侧补 1 级台阶（0.90 拆成两级 0.45 踏步）后：直达 24/24，单步最大落差 0.90 → 0.45，
 *     台阶 119 级 / 平均 4.96 级每图；120 条跨崖边只用了 119 级台阶 —— 有 1 次同一格同时服务两条边。
 *   - 全岛可达率 38.2% → 94.5%；剩下 5.5% 是路线没经过的孤立高台，不补台阶就到不了。
 *   - 斜坡 vs 台阶：量化台沿坡角 42.0°，超过可走 31.8°；若硬当斜坡走，一级落差要 1.26 格水平进深，
 *     一格斜坡不够 —— 台阶之所以成立不是"坡缓"，而是把一步拆成两级 0.45 的踏步。
 */

export const CFG = {
  W: 52,             // 格子列数
  H: 40,             // 格子行数
  cell: 1.0,         // 一格的水平边长
  step: 0.9,         // 量化台地的层高（一级落差）
  climb: 0.62,       // 人一步能跨上的最大落差 = 0.69 × 层高
  tread: 0.45,       // 台阶踏步高 = 层高 / 2
  water: 0.0,        // 水面高度（高度场归一化后海平面在 0）
  seeds: 24,
};

/* ── 确定性值噪声（不引三方库，同 seed 必出同图） ───────────── */
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 100000) / 100000;
}
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = fade(x - xi), fy = fade(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * 高度场：径向岛形 × 低频噪声，再量化到层高 step。
 * 量化是这条帖子的前提（台地地形），也是「跨层必是 0.9」的来源。
 */
export function terrain(seed) {
  const { W, H, step } = CFG;
  const h = new Float64Array(W * H);
  const lvl = new Int8Array(W * H);
  const cx = (W - 1) / 2, cy = (H - 1) / 2;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const nx = (i - cx) / (W * 0.42), ny = (j - cy) / (H * 0.46);
      const r = Math.hypot(nx, ny);
      const n =
        vnoise(i * 0.13, j * 0.13, seed) * 1.00 +
        vnoise(i * 0.31, j * 0.31, seed + 17) * 0.42;
      let v = (1.30 - r * 1.05) * 2.40 + (n - 0.72) * 1.70;
      if (v < 0) v = 0;                                  // 水下压平，免得海底也分层
      h[j * W + i] = v;
      lvl[j * W + i] = Math.floor(v / step);
    }
  }
  return { W, H, h, lvl };
}

const idx = (T, i, j) => j * T.W + i;
const inside = (T, i, j) => i >= 0 && j >= 0 && i < T.W && j < T.H;
const isLand = (T, k) => T.h[k] > CFG.water + 1e-6;

const NB4E = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 最大的一块连片陆地（噪声会把岛打成两瓣，起终点不能落在不同瓣上）。 */
function largestLand(T) {
  const lab = new Int32Array(T.W * T.H).fill(-1);
  let best = -1, bestN = 0, cur = 0;
  for (let k = 0; k < lab.length; k++) {
    if (lab[k] !== -1 || !isLand(T, k)) continue;
    const q = [k]; lab[k] = cur;
    for (let hd = 0; hd < q.length; hd++) {
      const p = q[hd], i = p % T.W, j = (p - i) / T.W;
      for (const [di, dj] of NB4E) {
        if (!inside(T, i + di, j + dj)) continue;
        const n = idx(T, i + di, j + dj);
        if (lab[n] !== -1 || !isLand(T, n)) continue;
        lab[n] = cur; q.push(n);
      }
    }
    if (q.length > bestN) { bestN = q.length; best = cur; }
    cur++;
  }
  return { lab, main: best, mainSize: bestN };
}

/** 起终点：主陆块里左右两端最靠边的格。 */
export function endpoints(T) {
  const { lab, main } = largestLand(T);
  let a = -1, b = -1;
  for (let j = 0; j < T.H; j++) for (let i = 0; i < T.W; i++) {
    const k = idx(T, i, j);
    if (lab[k] !== main) continue;
    if (a < 0 || i < a % T.W) a = k;
    if (b < 0 || i > b % T.W) b = k;
  }
  return { a, b };
}

/** 台地的有效高度 = 层号 × 层高。跨层就是 0.9 —— 这是本条全部数字的来源。 */
export const quantH = (T, k) => T.lvl[k] * CFG.step;

const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** ① 忽略高度的 BFS：这就是 campaignmap 那条「保证连通」的走法。 */
export function graphRoute(T, a, b) {
  const prev = new Int32Array(T.W * T.H).fill(-2);
  const q = [a]; prev[a] = -1;
  for (let hd = 0; hd < q.length; hd++) {
    const k = q[hd];
    if (k === b) break;
    const i = k % T.W, j = (k - i) / T.W;
    for (const [di, dj] of NB4) {
      if (!inside(T, i + di, j + dj)) continue;
      const n = idx(T, i + di, j + dj);
      if (prev[n] !== -2 || !isLand(T, n)) continue;
      prev[n] = k; q.push(n);
    }
  }
  if (prev[b] === -2) return null;
  const path = [];
  for (let k = b; k !== -1; k = prev[k]) path.push(k);
  return path.reverse();
}

/**
 * ② 可走判定：单步落差 ≤ climb，高度用**量化后**的层高（不是原始浮点高度场）。
 * eff 是「有效高度」——台阶格把它改成 低侧层高 + tread，于是 0.9 的落差被拆成两级 0.45。
 */
export function effHeight(T, stair) {
  const eff = new Float64Array(T.h.length);
  for (let k = 0; k < eff.length; k++) eff[k] = quantH(T, k);
  if (stair) for (const k of stair) {
    const i = k % T.W, j = (k - i) / T.W;
    let lo = Infinity;
    for (const [di, dj] of NB4) {
      if (!inside(T, i + di, j + dj)) continue;
      const n = idx(T, i + di, j + dj);
      if (isLand(T, n)) lo = Math.min(lo, quantH(T, n));
    }
    if (lo < Infinity) eff[k] = lo + CFG.tread;           // 一级台阶 = 两级踏步
  }
  return eff;
}

export function walkableComp(T, eff, src) {
  const seen = new Uint8Array(T.W * T.H);
  const q = [src]; seen[src] = 1;
  for (let hd = 0; hd < q.length; hd++) {
    const k = q[hd];
    const i = k % T.W, j = (k - i) / T.W;
    for (const [di, dj] of NB4) {
      if (!inside(T, i + di, j + dj)) continue;
      const n = idx(T, i + di, j + dj);
      if (seen[n] || !isLand(T, n)) continue;
      if (Math.abs(eff[n] - eff[k]) > CFG.climb + 1e-9) continue;
      seen[n] = 1; q.push(n);
    }
  }
  return seen;
}

/** 可走图上求最短路（单位代价 BFS）：人真正走的那条，允许绕行。 */
export function walkRoute(T, eff, a, b) {
  const prev = new Int32Array(T.W * T.H).fill(-2);
  const q = [a]; prev[a] = -1;
  for (let hd = 0; hd < q.length; hd++) {
    const k = q[hd];
    if (k === b) break;
    const i = k % T.W, j = (k - i) / T.W;
    for (const [di, dj] of NB4) {
      if (!inside(T, i + di, j + dj)) continue;
      const n = idx(T, i + di, j + dj);
      if (prev[n] !== -2 || !isLand(T, n)) continue;
      if (Math.abs(eff[n] - eff[k]) > CFG.climb + 1e-9) continue;
      prev[n] = k; q.push(n);
    }
  }
  if (prev[b] === -2) return null;
  const path = [];
  for (let k = b; k !== -1; k = prev[k]) path.push(k);
  return path.reverse();
}

/** 沿路线找出所有「跨层」的相邻格对（图能过、脚过不去的地方）。 */
export function cliffCrossings(T, path) {
  const out = [];
  for (let s = 0; s + 1 < path.length; s++) {
    const p = path[s], q = path[s + 1];
    if (T.lvl[p] !== T.lvl[q]) out.push([p, q]);
  }
  return out;
}

/** ③ 修补：每条崖边在低侧那一格放一级台阶。 */
export function repairStairs(T, path) {
  const stair = new Set();
  for (const [p, q] of cliffCrossings(T, path)) {
    const low = quantH(T, p) <= quantH(T, q) ? p : q;
    stair.add(low);
  }
  return stair;
}

function countMaxRise(T, path, eff) {
  let m = 0;
  for (let s = 0; s + 1 < path.length; s++) {
    m = Math.max(m, Math.abs(eff[path[s + 1]] - eff[path[s]]));
  }
  return m;
}

export function measure() {
  let graphs = 0, directBefore = 0, directAfter = 0, detourSum = 0, detourN = 0, detourMax = 1;
  let crossTotal = 0, stairTotal = 0, routeLen = 0;
  let reachBefore = 0, reachAfter = 0, landTotal = 0;
  let riseBeforeMax = 0, riseAfterMax = 0;
  let cliffEdges = 0;
  const per = [];

  for (let s = 0; s < CFG.seeds; s++) {
    const T = terrain(1000 + s * 37);
    let land = 0;
    for (let k = 0; k < T.h.length; k++) if (isLand(T, k)) land++;
    landTotal += land;
    // 崖边总数（相邻陆地格跨层的边，无向）
    let ce = 0;
    for (let j = 0; j < T.H; j++) for (let i = 0; i < T.W; i++) {
      const k = idx(T, i, j); if (!isLand(T, k)) continue;
      if (i + 1 < T.W) { const n = idx(T, i + 1, j); if (isLand(T, n) && T.lvl[n] !== T.lvl[k]) ce++; }
      if (j + 1 < T.H) { const n = idx(T, i, j + 1); if (isLand(T, n) && T.lvl[n] !== T.lvl[k]) ce++; }
    }
    cliffEdges += ce;

    const { a, b } = endpoints(T);
    const path = graphRoute(T, a, b);
    if (!path) { per.push({ seed: s, graph: false }); continue; }
    graphs++;
    routeLen += path.length;

    const eff0 = effHeight(T, null);
    const comp0 = walkableComp(T, eff0, a);
    const directOk0 = countMaxRise(T, path, eff0) <= CFG.climb + 1e-9;
    if (directOk0) directBefore++;
    for (let k = 0; k < comp0.length; k++) if (comp0[k]) reachBefore++;
    const rise0 = countMaxRise(T, path, eff0);
    riseBeforeMax = Math.max(riseBeforeMax, rise0);

    const w0 = walkRoute(T, eff0, a, b);
    if (w0) { const r = w0.length / path.length; detourSum += r; detourN++; detourMax = Math.max(detourMax, r); }

    const cross = cliffCrossings(T, path);
    crossTotal += cross.length;
    const stair = repairStairs(T, path);
    stairTotal += stair.size;
    const eff1 = effHeight(T, stair);
    const comp1 = walkableComp(T, eff1, a);
    const directOk1 = countMaxRise(T, path, eff1) <= CFG.climb + 1e-9;
    if (directOk1) directAfter++;
    for (let k = 0; k < comp1.length; k++) if (comp1[k]) reachAfter++;
    const rise1 = countMaxRise(T, path, eff1);
    riseAfterMax = Math.max(riseAfterMax, rise1);

    per.push({ seed: s, graph: true, directOk0, directOk1, cross: cross.length, stairs: stair.size, len: path.length, walkLen: w0 ? w0.length : -1, rise0, rise1, ce });
  }

  const n = CFG.seeds;
  return {
    seeds: n,
    graphRate: graphs / n,
    directRateBefore: directBefore / n,     // 这条最短路本身能不能走完
    directRateAfter: directAfter / n,
    detourAvg: detourSum / Math.max(1, detourN),
    detourMax,
    cliffCrossAvg: crossTotal / Math.max(1, graphs),
    stairsAvg: stairTotal / Math.max(1, graphs),
    stairTotal, crossTotal,
    routeLenAvg: routeLen / Math.max(1, graphs),
    reachBefore: reachBefore / landTotal,
    reachAfter: reachAfter / landTotal,
    riseBeforeMax, riseAfterMax,
    cliffEdgeAvg: cliffEdges / n,
    slopeLimitDeg: Math.atan(CFG.climb / CFG.cell) * 180 / Math.PI,
    quantSlopeDeg: Math.atan(CFG.step / CFG.cell) * 180 / Math.PI,
    runNeededCells: CFG.step / Math.tan(CFG.climb),   // 一级落差当斜坡走需要的进深（格）
    per,
    demo: demo(),
  };
}

/** 给 lab 用的固定一张图（seed 固定，画面与数字对得上）。 */
export function demo(seed = 1518) {
  const T = terrain(seed);
  const { a, b } = endpoints(T);
  const path = graphRoute(T, a, b);
  const cross = path ? cliffCrossings(T, path) : [];
  const eff0 = effHeight(T, null);
  const comp0 = walkableComp(T, eff0, a);
  const stair = path ? repairStairs(T, path) : new Set();
  const eff1 = effHeight(T, stair);
  const comp1 = walkableComp(T, eff1, a);
  return { T, a, b, path, cross, eff0, eff1, comp0, comp1, stair, seed };
}

export default { CFG, terrain, endpoints, graphRoute, cliffCrossings, repairStairs, walkableComp, effHeight, measure, demo };
