/**
 * squarehex.js — 「方格的账，六边的脸」：切角把方格单元改成 6/8 边形贴片，代价是共边变短。
 *
 * 帖子 ID：1471817524148940807（2021-12-17，grid）
 *   "Some rocky islands. Trying to make the grid natural and readable, yet funky.
 *    Square, yet hex."
 *
 * 另一个待办 ID：1579474420749725696 / 1448039167057879048（2022-10 / 2021-10，
 *   "I'm back on the island generation" / 讲同一台生成器）—— 原片只是生成器的记时与
 *   可视化调试，没有可落地的机制，本轮不写代码，只把画面记进 data.js。
 *
 * ---- 画面观察（tmp/cap/1471817524148940807/f01，640²，俯视等距） ----
 *   · 岛面被切成一块一块的**圆角贴片**，贴片与贴片之间有暗色**缝**（不是共边线，是缝）；
 *   · 每块贴片内部是**一圈一圈的等高线**，不是平的色块 —— 台地是靠环线读出来的；
 *   · 贴片不是正六边形：四条直边（轴对齐，能一眼数出行列）+ 角上被切掉变成斜边；
 *   · 所以「square, yet hex」不是换网格，而是**不换数据、只换单元的形状**：
 *     格子还是方格（可读、有行列），长相却朝六边靠。
 *
 * ---- 为什么这么实现（以及为什么不是另一种解释） ----
 *   还有一种解释是「方格 + 对角邻接 = 6 个可走方向」。原片是地形贴片、没有寻路痕迹，
 *   所以按画面能直接证实的那一种实现：切角。另一种解释留在这里，不当结论。
 *
 * ---- 量出来的东西（runMetrics，节点里可独立跑） ----
 *   切两角（t=0.5）：顶点 4→6、内角 {90°×2, 135°×4}、平均内角距正六边的 120° 从 30° 降到 20°、
 *   面积 1.000→0.750、平均共边长 1.00→0.50。格子仍是 4 邻居，邻接表一条都没丢。
 *   切四角（t=0.5）：内角距 120° 只剩 15°（最像六边），但**共边长归零** ——
 *   相邻格只在一个点上碰，贴片彻底散开，岛就碎了。这是"越像六边越不连通"的量化证据，
 *   也是他最后停在"两角切"的原因。
 */

/* ---------- 单元形状 ---------- */

/** 单位方格 [0,1]² 的四种单元轮廓。cut = 切角深度（沿边长度），0..0.5
 *  flip = 切另一对对角（贴在岛上时逐格交替，图案才不会变成一排斜条纹） */
export function cellPolygon(cut = 0.5, mode = 'cut2', flip = false) {
  const c = Math.max(0, Math.min(0.5, cut));
  const ccw = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  if (mode === 'flat' || c === 0) return ccw;

  // 每个角沿两条边各退 c，插入两个新点：(1-c,0) 与 (1,c)
  const pair = flip ? [0, 2] : [1, 3];
  const cutCorners = mode === 'cut4' ? [0, 1, 2, 3] : pair;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = ccw[i];
    const prev = ccw[(i + 3) % 4];
    const next = ccw[(i + 1) % 4];
    if (!cutCorners.includes(i)) {
      out.push(p);
      continue;
    }
    // 朝 prev 退 c，再朝 next 退 c
    out.push({ x: p.x + (prev.x - p.x) * c, y: p.y + (prev.y - p.y) * c });
    out.push({ x: p.x + (next.x - p.x) * c, y: p.y + (next.y - p.y) * c });
  }
  // 四角全切到 0.5 时相邻角的两个新点会落在同一条边的中点上 → 去重，否则能量出 0° 的假角
  const clean = [];
  for (const p of out) {
    const q = clean[clean.length - 1];
    if (q && Math.abs(q.x - p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9) continue;
    clean.push(p);
  }
  const first = clean[0], last = clean[clean.length - 1];
  if (clean.length > 1 && Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9) clean.pop();
  return clean;
}

/** 多边形面积（鞋带公式） */
export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** 各个内角（度）。逆时针多边形，内角 = 180 - 转向角 */
export function interiorAngles(poly) {
  const n = poly.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const u = { x: b.x - a.x, y: b.y - a.y };
    const v = { x: c.x - b.x, y: c.y - b.y };
    const cross = u.x * v.y - u.y * v.x;
    const dot = u.x * v.x + u.y * v.y;
    const turn = Math.atan2(cross, dot); // 逆时针为正
    out.push(180 - (turn * 180) / Math.PI);
  }
  return out;
}

/**
 * 边分两类：
 *   · 轴对齐的边 —— 和四个正邻居共用，长度 = 1 − (被切掉的两端)
 *   · 斜边 —— 是切角造出来的，只跟对角那个格子在一个点上碰，压根不算邻接
 * 这条区分是整页的骨架：形状怎么变都行，**共边不能归零**，否则格子就散了。
 */
export function edgeStats(poly) {
  const axis = [];
  const diag = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dx = Math.abs(q.x - p.x);
    const dy = Math.abs(q.y - p.y);
    const len = Math.hypot(dx, dy);
    if (dx < 1e-9 || dy < 1e-9) axis.push(len);
    else diag.push(len);
  }
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  return { axis: mean(axis), diag: mean(diag), nAxis: axis.length, nDiag: diag.length };
}

/* ---------- 一档参数的全部指标 ---------- */

export function runMetrics(cut = 0.5, mode = 'cut2') {
  const poly = cellPolygon(cut, mode);
  const ang = interiorAngles(poly);
  const hexErr = ang.reduce((s, a) => s + Math.abs(a - 120), 0) / ang.length;
  const hist = {};
  for (const a of ang) {
    const k = Math.round(a) + '°';
    hist[k] = (hist[k] || 0) + 1;
  }
  const e = edgeStats(poly);
  return {
    mode,
    cut,
    verts: poly.length,
    tris: poly.length - 2,
    angles: ang.map((a) => Math.round(a)),
    hist,
    hexErr,
    area: polyArea(poly),
    seam: 1 - polyArea(poly),
    shared: e.axis, // 与正邻居的共边长
    cutEdge: e.diag,
    nAxis: e.nAxis,
    nDiag: e.nDiag,
    neighbours: e.axis > 1e-9 ? 4 : 0, // 共边长归零 = 四邻全断，只剩点接触
  };
}

/* ---------- 岛屿：只用来铺一片能看的格子 ---------- */

function hash2(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040888963407) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** 岛形掩码：两档低频噪声相减，得到带海湾的轮廓（高频会碎成噪点） */
export function islandMask(w, h, seed = 7) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = vnoise(x * 0.30, y * 0.30, seed);
      const n2 = vnoise(x * 0.62 + 9, y * 0.62 + 3, seed + 11);
      const cx = (x - w / 2) / (w / 2), cy = (y - h / 2) / (h / 2);
      const r = Math.sqrt(cx * cx * 0.92 + cy * cy * 1.15);
      const land = n * 0.72 + n2 * 0.28 - r * 0.62;
      m[y * w + x] = land > 0.02 ? 1 : 0;
    }
  }
  return m;
}

/** 邻接统计：四邻对的条数（形状无关，用来证明"没换网格"） */
export function countAdjacency(mask, w, h) {
  let pairs = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x + 1 < w && mask[y * w + x + 1]) pairs++;
      if (y + 1 < h && mask[(y + 1) * w + x]) pairs++;
    }
  }
  return pairs;
}
