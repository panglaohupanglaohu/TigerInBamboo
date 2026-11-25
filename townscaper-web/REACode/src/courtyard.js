/**
 * courtyard.js — 「建出封闭区域 → 它变成后院」。
 *
 * 原文（1238474550511308800，2020-03-13）：
 *   "I needed some more greenery, so now if you build an enclosed area it
 *    becomes a backyard!"
 *   —— 触发条件是**封闭（enclosed）**，不是"内部有一块空地"。所以判定
 *   必须是可达性（洪水填充），不是数周围有几个建筑。
 *
 * 画面观察（512×512，6.66s，24 帧）：
 *   · 一圈红屋顶房子围出一个院子，俯视 45°。院子地面先是**石板灰**
 *     (100,110,120)，上面有一排排小短横（像是排水缝/踏步）。
 *   · 0.831s 还是石板 → 0.914s 整块变成**草地** (86,122,102)：
 *     是**一次性铺满**，不是从边缘长出来（中间帧里没有半草半石）。
 *   · 0.982s 出现**小路**（浅暖灰 190,162,148）：不是一条线，是一张
 *     **带闭环的网**——右上有一个三角形回路，另外有支路通向墙边的长椅。
 *     路宽约 5–7 px，占院子 ~20%。
 *   · 1.065s 出现**树/灌木**：几十团小圆球，全部避开小路并留一圈空隙
 *     （没有一棵压在路上），也不贴墙。
 *   · 1.581s 出现一栋**小木屋**（红顶、占 2×3 格），压在草地空处。
 *   · 全程相机不动，变化只有院子内部 —— 所以这是"区域内容生成"，
 *     不是镜头动画。
 *
 * 时间轴（同上，单位秒，从石板态起算）：
 *   草地 0.000 → 小路 +0.083 → 树 +0.234 → 小木屋 +0.750。
 *   实测在 24 帧采样下，草地在两帧之间就铺完了（<0.1s），
 *   所以这里不做"生长"动画，直接切。
 *
 * 路网为什么用 Voronoi 边（推断）：片子里的小路围出**多边形闭环**，
 * 端点是三叉路口 —— 这正是"散点图的 Voronoi 边"的形态；
 * 如果是随机游走或最短路径，几乎不会自带闭环。地块 = Voronoi 胞，
 * 树 = 胞内部散点 —— 于是"树永远不压路"是构造保证的，不用靠碰撞检测。
 */

export const STAGES = [
  { key: 'grass', at: 0.0 },
  { key: 'path', at: 0.083 },
  { key: 'tree', at: 0.234 },
  { key: 'shed', at: 0.75 },
];

/** 片子里量到的颜色。 */
export const YARD = {
  slate: [100, 110, 120],   // 未触发时的石板地
  grass: [86, 122, 102],    // 草地
  path: [190, 162, 148],    // 小路（暖浅灰）
  shedRoof: [196, 92, 74],
  trunk: [92, 66, 54],
  leaf: [78, 128, 84],
};

/**
 * 判定哪些空格属于「被建筑围住的内部」。
 * 从边界上的空格做 4 邻域洪水填充，填不到的才是内部 —— 有一个缺口就漏，
 * 这正好是片子里"必须先围起来"的语义。
 */
export function detectInterior(w, h, solid) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (solid[i] || seen[i]) return;
    seen[i] = 1; stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  const interior = new Uint8Array(w * h);
  let area = 0;
  for (let i = 0; i < w * h; i++) {
    if (!solid[i] && !seen[i]) { interior[i] = 1; area++; }
  }
  return { interior, area, enclosed: area > 0 };
}

/** 到建筑的距离（4 邻域 BFS）——用于"贴墙一圈"和小屋选址。 */
export function depthFromWalls(w, h, solid, interior) {
  const d = new Int16Array(w * h).fill(-1);
  const q = [];
  for (let i = 0; i < w * h; i++) {
    if (!interior[i]) continue;
    const x = i % w, y = (i / w) | 0;
    const near = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || solid[yy * w + xx];
    if (near(x + 1, y) || near(x - 1, y) || near(x, y + 1) || near(x, y - 1)) {
      d[i] = 1; q.push(i);
    }
  }
  for (let head = 0; head < q.length; head++) {
    const i = q[head];
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (!interior[j] || d[j] !== -1) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  return d;
}

/** 确定性哈希（同一 seed 出同一张院子，才能做 A/B）。 */
function hash2(x, y, seed) {
  // 全部走 32 位整数（Math.imul），避免超 2^53 后丢精度导致"同 seed 不同结果"
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export const RING_PTS = [[7, 5], [20, 4], [24, 10], [25, 20], [19, 25], [8, 24], [4, 16], [4, 9]];

/** 多边形内的格子（射线法）。用来画"地面已经铺了石板、但还没变成后院"的状态。 */
export function pointInRing(x, y, pts = RING_PTS) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 演示用的一圈房子（不规则八边形环、2 格厚）。gap=true 时去掉第一段，
 * 用来证明"判定靠可达性"—— 同一个院子上开个门洞，内容立刻全没。
 */
export function exampleRing(w, h, { gap = false } = {}) {
  const solid = new Uint8Array(w * h);
  const pts = RING_PTS;
  for (let p = 0; p < pts.length; p++) {
    if (gap && p === 0) continue;
    const [x0, y0] = pts[p], [x1, y1] = pts[(p + 1) % pts.length];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (const [dx, dy] of [[0, 0], [0, 1], [-1, 0], [-1, 1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) solid[yy * w + xx] = 1;
      }
    }
  }
  return solid;
}

/**
 * 院子里生成内容。
 * 返回 path / tree / shed / bench 四张掩码 + 统计。
 */
export function planBackyard(w, h, solid, opts = {}) {
  const { seed = 7, pathWidth = 1.0, treeDensity = 0.55, perimeter = false } = opts;
  const { interior, area, enclosed } = detectInterior(w, h, solid);
  const out = {
    enclosed, area,
    interior,
    path: new Uint8Array(w * h),
    tree: new Uint8Array(w * h),
    shed: new Uint8Array(w * h),
    bench: new Uint8Array(w * h),
    sites: [],
    stats: {},
  };
  if (!enclosed) { out.stats = { area: 0, path: 0, pathPct: 0, trees: 0, clearance: 0 }; return out; }

  const depth = depthFromWalls(w, h, solid, interior);

  // —— 1. 选站点：最远点采样（比随机稳，院子里不会出现两块大小差十倍的胞）
  const cells = [];
  for (let i = 0; i < w * h; i++) if (interior[i]) cells.push(i);
  const k = Math.max(3, Math.round(area / 62));   // 片子里一个胞 ≈ 60~70 格
  const sites = [cells[Math.floor(hash2(1, 1, seed) * cells.length)]];
  while (sites.length < k && sites.length < cells.length) {
    let best = -1, bestD = -1;
    for (const i of cells) {
      const x = i % w, y = (i / w) | 0;
      let dmin = Infinity;
      for (const s of sites) {
        const sx = s % w, sy = (s / w) | 0;
        dmin = Math.min(dmin, (x - sx) ** 2 + (y - sy) ** 2);
      }
      if (dmin > bestD) { bestD = dmin; best = i; }
    }
    sites.push(best);
  }
  out.sites = sites.map((i) => [i % w, (i / w) | 0]);

  // —— 2. Voronoi 边 → 小路（d2−d1 小的地方就是胞边界）
  let pathCount = 0;
  for (const i of cells) {
    const x = i % w, y = (i / w) | 0;
    let d1 = Infinity, d2 = Infinity;
    for (const s of sites) {
      const sx = s % w, sy = (s / w) | 0;
      const d = Math.hypot(x - sx, y - sy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < pathWidth) { out.path[i] = 1; pathCount++; }
  }
  // 贴墙一圈也算路（片子里建筑边上有一条浅色窄带）
  if (perimeter) {
    for (const i of cells) if (depth[i] === 1 && !out.path[i]) { out.path[i] = 1; pathCount++; }
  }

  // —— 3. 树：落在草地上、且离路至少 1 格（片子里没有一棵压路）
  const pathNear = new Uint8Array(w * h);
  for (const i of cells) {
    if (!out.path[i]) continue;
    const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      pathNear[yy * w + xx] = 1;
    }
  }

  // —— 4. 小屋：挑一块离墙最远的草地的 2×3 脚印（片子 1.581s 才出现）
  let shedAt = null, bestClear = -1;
  for (const i of cells) {
    if (out.path[i] || pathNear[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
    const fits = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]].every(([dx, dy]) => {
      const j = (y + dy) * w + (x + dx);
      return interior[j] && !out.path[j];
    });
    if (!fits) continue;
    const c = depth[i] + hash2(x, y, seed) * 0.9;
    if (c > bestClear) { bestClear = c; shedAt = [x, y]; }
  }
  let trees = 0;
  for (const i of cells) {
    const x = i % w, y = (i / w) | 0;
    if (out.path[i] || pathNear[i] || depth[i] < 2) continue;
    if (shedAt) {
      const [sx, sy] = shedAt;
      if (x >= sx - 1 && x <= sx + 2 && y >= sy - 1 && y <= sy + 3) continue;
    }
    if (hash2(x, y, seed) < treeDensity) { out.tree[i] = 1; trees++; }
  }
  if (shedAt) {
    const [sx, sy] = shedAt;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]) {
      out.shed[(sy + dy) * w + (sx + dx)] = 1;
    }
  }

  // —— 5. 长椅：沿路、每隔一段放一张（片子里路边有深色小方块）
  let benches = 0;
  for (const i of cells) {
    if (!out.path[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    if (hash2(x, y, seed + 31) > 0.965 && !out.tree[i] && !out.shed[i]) {
      out.bench[i] = 1; benches++;
    }
  }

  // —— 统计：树到路的最小格距（片子里没有一棵压路，所以这个应该 ≥1）
  let clearance = 99;
  for (let i = 0; i < w * h; i++) {
    if (!out.tree[i]) continue;
    const x = i % w, y = (i / w) | 0;
    for (let r = 1; r <= 4; r++) {
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r && !hit; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (out.path[yy * w + xx]) hit = true;
      }
      if (hit) { clearance = Math.min(clearance, r); break; }
    }
  }
  out.stats = {
    area,
    path: pathCount,
    pathPct: (pathCount / area) * 100,
    trees,
    benches,
    shed: shedAt,
    clearance: trees ? clearance : 0,
    cellsPerYard: k,
  };
  return out;
}
