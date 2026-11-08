/**
 * src/depfill.js — 「冲蚀过的地形不能留下局部极小」：Priority-Flood 填洼
 *
 * 帖子 ID：1447488323845509121（Bad North 地形，2018）
 * 原文：「I'm able to do a couple of things here I've always wanted to, but never
 *        been able to before: - Properly combine seamless soft slopes with
 *        distinct sharp cliffs. - **Erosion valid terrain with no local minimums.**
 *        - Get the best of both square tiles and triangular tiles」
 * 本条上一轮只落了第一条（缓坡/陡崖分位掩码 = src/terracecliff.js），
 * 第二条「无局部极小」一直挂着。本文件补的就是第二条。
 *
 * 为什么这么做：
 *   噪声地形量化成台地之后，坑底成了"四面都比自己高"的格子——水落进去出不来，
 *   单位寻路会把它当死胡同，白沫/河流也画不出来。修法不能是"逐格抬到最低邻居"：
 *   那只把坑底那一格抬平，坑的其他格还在，湖面根本不存在（实测湖格 0）。
 *   正确做法是 Priority-Flood：从海（边界/水面）出发用最小堆向内蔓延，
 *   水位只在水能困住的地方抬到**溢出口**高程——于是每个洼地被填成一个平面湖，
 *   湖边的格子一定有一条通向海的下降路径（实测排水率 100%）。
 *   本文件只做"填"，不做"侵蚀本身"：填洼是侵蚀流水线的最后一道保险。
 */

export const CFG = {
  N: 64,          // 64×64 高度场
  WATER: 0,       // 水面高程
  STEP: 0.6,      // 台地层高（与 terracecliff 同一套量化）
  EPS: 1e-4,      // priority-flood 的微坡：保证填出来的湖面仍有唯一排水方向
};

/* ---------- 确定性噪声（不引任何依赖，seed 固定可复现） ---------- */

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

/* ---------- 高度场：台地量化 + 几处封闭洼地 ---------- */

/**
 * 返回 { H, basin }：
 *   H[y][x]  高程（已量化到 STEP 的整数倍；<= WATER 为海）
 *   basin[]  人为挖出来的洼地中心（为了有"能困住水"的坑可填）
 * 量化让台面成片（承接第一条机制），洼地让"局部极小"真实存在。
 */
export function heights(seed = 7) {
  const { N, STEP, WATER } = CFG;
  const H = [];
  const raw = [];
  for (let y = 0; y < N; y++) {
    const rowR = [];
    for (let x = 0; x < N; x++) {
      const u = x / N - 0.5, v = y / N - 0.5;
      const r = Math.hypot(u, v) * 2;                       // 0 中心 → 1 边缘 → 1.41 角
      const island = Math.max(0, Math.min(1, (1.06 - r) / 0.62));  // 边缘收到水面以下
      const n = fbm(x * 0.085, y * 0.085, seed) * 1.28 + fbm(x * 0.21, y * 0.21, seed + 11) * 0.42;
      rowR.push(island * (2.0 + n * 4.4) - 0.42);
    }
    raw.push(rowR);
  }

  // 挖 6 处坑（半径 2.4~3.6）——量化后会变成一片平面坑底，水困在里面
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
  // 再点 10 个单格针孔，制造"严格四面更高"的洼底（量化后仍是独立一格）
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

/* ---------- 度量 ---------- */

const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function isLand(H, x, y) {
  const N = H.length;
  return x >= 0 && y >= 0 && x < N && y < N && H[y][x] > CFG.WATER;
}

/** 局部极小：陆地格，且 8 邻居全部**严格**高于自己（等于自己算平台、不算坑） */
export function localMinima(H) {
  const N = H.length, out = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!isLand(H, x, y)) continue;
      let low = true, nb = 0;
      for (const [dx, dy] of NB8) {
        if (!isLand(H, x + dx, y + dy)) { low = false; break; } // 边缘/靠海 = 有出口
        nb++;
        if (H[y + dy][x + dx] <= H[y][x]) { low = false; break; }
      }
      if (low && nb === 8) out.push({ x, y, z: H[y][x] });
    }
  return out;
}

/**
 * 排水判定：从"出口"（水面格 / 地图边界）反向 BFS，只走**不降**的边
 * （正向就是"只降不升"，允许穿过等高台面——台地本身就有一大片等高格，
 *  拿"逐格找严格更低的邻居"会把这些格全判成困住，上一版就是这么错的）。
 * 剩下走不到出口的陆地格 = 真正被困住的水。
 */
export function drained(H) {
  const N = H.length;
  const seen = Array.from({ length: N }, () => new Uint8Array(N));
  const q = [];
  let land = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!isLand(H, x, y)) continue;
      land++;
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      let shore = false;
      for (const [dx, dy] of NB8) if (!isLand(H, x + dx, y + dy)) shore = true;
      if (edge || shore) { seen[y][x] = 1; q.push([x, y]); }
    }
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of NB8) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N || seen[yy][xx]) continue;
      if (!isLand(H, xx, yy)) continue;
      if (H[yy][xx] < H[y][x] - CFG.EPS * 8) continue;     // 不能往低处倒推
      seen[yy][xx] = 1;
      q.push([xx, yy]);
    }
  }
  let ok = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isLand(H, x, y) && seen[y][x]) ok++;
  return { ok, land, pct: land ? (ok / land) * 100 : 0, seen };
}

/* ---------- 三种填法 ---------- */

/** 朴素法：只把"极小格"抬到最低邻居。快、看起来"极小格数=0"，但不产生湖面 */
export function naiveLift(H) {
  const { N } = CFG;
  const F = H.map((r) => r.slice());
  const mins = localMinima(F);
  for (const m of mins) {
    let low = Infinity;
    for (const [dx, dy] of NB8) if (isLand(F, m.x + dx, m.y + dy)) low = Math.min(low, F[m.y + dy][m.x + dx]);
    if (isFinite(low)) F[m.y][m.x] = low;
  }
  return F;
}

/** 最小堆（priority-flood 用） */
function heap() {
  const a = [];
  const less = (i, j) => a[i].z < a[j].z;
  const swap = (i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
  return {
    size: () => a.length,
    push(v) {
      a.push(v);
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
    },
    pop() {
      const top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < a.length && less(l, m)) m = l;
          if (r < a.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m); i = m;
        }
      }
      return top;
    },
  };
}

/**
 * Priority-Flood（Barnes 2014 版）：从水面格 + 地图边界出发，按高程从小到大蔓延。
 * 邻居比当前水位低 → 抬到水位 + EPS（这样湖面有唯一出口，不会出现无边平湖）。
 * 只抬不削，所以岛形、台地层数都不变。
 */
export function priorityFlood(H) {
  const { N, WATER, EPS } = CFG;
  const F = H.map((r) => r.slice());
  const done = Array.from({ length: N }, () => new Uint8Array(N));
  const q = heap();

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      if (H[y][x] <= WATER || edge) {
        q.push({ x, y, z: Math.max(H[y][x], WATER) });
        done[y][x] = 1;
      }
    }
  while (q.size()) {
    const c = q.pop();
    for (const [dx, dy] of NB8) {
      const xx = c.x + dx, yy = c.y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N || done[yy][xx]) continue;
      done[yy][xx] = 1;
      if (F[yy][xx] < c.z) F[yy][xx] = c.z + EPS;            // 抬到水位
      q.push({ x: xx, y: yy, z: Math.max(F[yy][xx], c.z) });
    }
  }
  return F;
}

/** 统计：抬升格数 / 平均抬升 / 最大抬升 / 湖格（抬升 > EPS 的格）/ 最大湖深 */
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

/** 台阶边（相邻高差 >= 半层）的条数：填洼只抬不削，台地结构应当保留 */
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

/** 被抬起来的格子按连通（8 邻）合成一个个湖，返回按面积降序 */
export function lakeClusters(H, F) {
  const N = H.length;
  const seen = Array.from({ length: N }, () => new Uint8Array(N));
  const out = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (seen[y][x] || F[y][x] - H[y][x] <= CFG.EPS * 4) continue;
      const cells = [];
      const st = [[x, y]];
      seen[y][x] = 1;
      while (st.length) {
        const [cx, cy] = st.pop();
        cells.push({ x: cx, y: cy, h: H[cy][cx], f: F[cy][cx] });
        for (const [dx, dy] of NB8) {
          const xx = cx + dx, yy = cy + dy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N || seen[yy][xx]) continue;
          if (F[yy][xx] - H[yy][xx] <= CFG.EPS * 4) continue;
          seen[yy][xx] = 1; st.push([xx, yy]);
        }
      }
      const surf = Math.max(...cells.map((c) => c.f));
      const deep = Math.max(...cells.map((c) => c.f - c.h));
      out.push({
        cells, area: cells.length, surf, deep,
        cx: cells.reduce((s, c) => s + c.x, 0) / cells.length,
        cy: cells.reduce((s, c) => s + c.y, 0) / cells.length,
      });
    }
  out.sort((a, b) => b.deep - a.deep);
  return out;
}

/** 一次跑完三种版本，给 lab 与 node 共用 */
export function measure(seed = 7) {
  const { H } = heights(seed);
  const NA = naiveLift(H);
  const PF = priorityFlood(H);
  const pack = (name, F) => ({
    name,
    minima: localMinima(F).length,
    drain: drained(F),
    lift: liftStats(H, F),
    steps: stepEdges(F),
    land: drained(F).land,
  });
  return {
    raw: pack('原始（量化台地 + 洼地）', H),
    naive: pack('逐格抬到最低邻居', NA),
    flood: pack('Priority-Flood 填洼', PF),
    lakes: lakeClusters(H, PF),
    H, NA, PF,
  };
}
