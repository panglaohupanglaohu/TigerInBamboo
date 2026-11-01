/**
 * gridmodes.js — 同一种地形，分别铺在方块 / 六边 / 三角网格上，看清楚差在哪。
 *
 * 原文（x.com/OskSta/status/1670790425232175108, 2023-06-19）：
 *
 *   "I'm prepping for a talk in Cambridge next week, thus all the gifs. I made my
 *    generator also output pure triangle/hex and square grids, to illustrate why
 *    I'm going for my mixed approach."
 *
 * 画面（24 帧，三段各 6 帧）：
 *   · 0~5   方块网格：黄色台地上一格格的方格，方格边缘横平竖直；房子是方的；
 *            切到线框后能看到方格是均匀的正交网格，然后是纯黑剪影；
 *   · 12~17 六边网格：线框是菱形的斜向网格（hex 的边有三个方向），
 *            台地边缘出现 60° 的锯齿台阶；
 *   · 18~23 三角网格：线框是密密的三角形，一个方块被切成两个三角；
 *            黑剪影的边缘锯齿方向更多（六个方向）。
 *
 * 三段的差异不在"好不好看"，而在**可读性与成本**，这也是原文那句 mixed 的根据：
 *   · 方块：边只有两个方向 → 最容易读（房子、街道都是正交的），
 *           但斜向的崖面只能靠"阶梯"近似，等面积下顶点最少；
 *   · 六边：每个顶点 3 条边、夹角 120°，最"圆"，但**没有正方方向**，
 *           房子这类正交模块放上去会很别扭；
 *   · 三角：边有三个方向、每个顶点 6 条边，最细腻，但一个正方形要两个三角，
 *           面数翻倍，而且三角面之间的硬边容易在着色上炸开。
 *
 * 本文件只做"骨架 + 量化"，不参与渲染管线（我们的 voxel 管线假定 4 边格）。
 * 量化的是原文想讲的那三句话：边方向数、顶点度数、面内最小角。
 */

/** 方块网格：n×n。 */
export function squareLattice(n = 12, size = 1) {
  const verts = [], faces = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) verts.push([i * size, j * size]);
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  }
  return { verts, faces, name: 'square' };
}

/** 六边网格（尖顶朝上），用轴向坐标铺成矩形。 */
export function hexLattice(cols = 10, rows = 10, size = 0.6) {
  const verts = [], faces = [];
  const key = new Map();
  const vid = (x, z) => {
    const k = x.toFixed(4) + ',' + z.toFixed(4);
    let i = key.get(k);
    if (i === undefined) { i = verts.length; verts.push([x, z]); key.set(k, i); }
    return i;
  };
  const dx = size * Math.sqrt(3), dz = size * 1.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * dx + (r % 2 ? dx * 0.5 : 0);
      const cz = r * dz;
      const ring = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + k * Math.PI / 3;
        ring.push(vid(cx + Math.cos(a) * size, cz + Math.sin(a) * size));
      }
      faces.push(ring);
    }
  }
  return { verts, faces, name: 'hex' };
}

/** 三角网格：把方块网格的每个正方形沿对角线切开。 */
export function triLattice(n = 12, size = 1) {
  const { verts, faces } = squareLattice(n, size);
  const at = (i, j) => j * (n + 1) + i;
  const tris = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    tris.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)]);
    tris.push([at(i, j), at(i + 1, j + 1), at(i, j + 1)]);
  }
  return { verts, faces: tris, name: 'tri' };
}

/**
 * 量化三件事：
 *   · dirs         边的方向数（按 15° 分箱统计主方向）——方块 2、六边 3、三角 3
 *   · valence      顶点度数分布（内部顶点：方块 4、六边 3、三角 6）
 *   · minAngle     面内最小角的中位数（度）——太小的角在着色/描边上会炸
 */
/**
 * 不规则三角网格：把引擎**真实**的四边形格子（`src/grid.js`，带抖动、大小不一）
 * 每格从重心扇出 4 个三角形。
 *
 * 原文（x.com/OskSta/status/1447496205282549761, 2021-10-11）：
 *
 *   "The base graph is just a humble irregular triangle grid"
 *
 * 注意这里的重点是 **irregular**，不是 **triangle**。上面 `triLattice()` 是规则的
 * 等边三角网格（Cambridge 那次演讲里用来对照的），而这条片子里的三角网格：
 *   · 三角形大小明显不一（有的一片大、一片碎）；
 *   · 三个方向之外还有大量"歪"的方向 —— 因为它们来自抖动的四边形；
 *   · 整体轮廓是六边形，但内部没有一条贯穿的直线。
 * 所以正确做法不是"再生成一张规则三角网"，而是**从现有的不规则网格派生**：
 * 每格取四个角点 + 重心，连成 4 个三角形。这正好也是 Townscaper 真实的做法
 * （"The squares are cut along each diagonal to create 4 triangles"）。
 *
 * 好处是三角网格和四边形网格**共用同一批顶点**：顶点的度数、边的方向数都能直接
 * 和四边形版对照，差异只来自"多了一个重心顶点、每条边多了一个邻居"。
 */
export function irregularTriFromCells(cells) {
  const verts = [];
  const faces = [];
  const index = new Map();
  const vid = (p) => {
    // 用**基准坐标**（bx/bz）做键：抖动后的坐标是唯一的，但基准坐标才是
    // "同一个顶点"的身份 —— 相邻格子共用角点时，它们的 bx/bz 相同。
    const k = p.bx.toFixed(4) + ',' + p.bz.toFixed(4);
    let i = index.get(k);
    if (i === undefined) { i = verts.length; verts.push([p.x, p.z]); index.set(k, i); }
    return i;
  };
  let fanTriangles = 0;
  for (const c of cells) {
    if (!c.pts || c.pts.length !== 4) continue;
    const ids = c.pts.map(vid);
    let cx = 0, cz = 0;
    for (const p of c.pts) { cx += p.x; cz += p.z; }
    cx /= 4; cz /= 4;
    const ci = verts.length;
    verts.push([cx, cz]);
    for (let i = 0; i < 4; i++) {
      const a = ids[i], b = ids[(i + 1) % 4];
      // 绕向跟着角点走（cells 的 pts 已经是逆时针）
      faces.push([a, b, ci]);
      fanTriangles++;
    }
  }
  return { verts, faces, name: 'tri', irregular: true, cells: cells.length, fanTriangles };
}

/**
 * 四边形网格的**顶点度数**分布 —— 用来量化"6 度顶点要减少"这件事。
 *
 * 原文（x.com/OskSta/status/1147881669350891521, 2019-07-07）：
 *
 *   "I present: Fairly even irregular quads grid in a hex.
 *    Todo: 1. Heuristic to reduce (or eliminate) 6 quad verts 2. Tile these babies to infinity"
 *
 * 画面：背景是一层细密的六边点阵（理想顶点位置），黄四边形一格一格长出来；
 * 有几个顶点**挂了 6 个格子**，那几个地方看起来像"扇子"，一眼就不对。
 *
 * 为什么 6 度是问题：四边形网格里绝大多数顶点是 4 度（欧拉公式要求平均 4），
 * 3 度和 5 度必须成对出现才不产生弯曲；而**一个 6 度顶点等价于两个 +2 缺陷**，
 * 它周围的四边形会被压得很扁（内角趋近 0），接着就会触发 `repairInvertedCells`。
 * 所以这个数不是审美指标，是**几何健康度**指标。
 *
 * 我们的 `src/grid.js` 是从六边取 4 边子集来的，天生会有 5/6 度顶点 ——
 * 以前只用 `badRatio`（面积/反向）衡量，看不出"缺陷密度"。这里补上。
 */
export function quadDegreeStats(cells) {
  const use = new Map();          // 顶点对象 -> 被几个格子用到
  for (const c of cells) {
    if (!c.pts) continue;
    for (const p of c.pts) use.set(p, (use.get(p) || 0) + 1);
  }
  const hist = {};
  let six = 0, five = 0, total = 0;
  for (const n of use.values()) {
    hist[n] = (hist[n] || 0) + 1;
    if (n === 6) six++;
    if (n === 5) five++;
    total++;
  }
  // 边界顶点（度数 1~2）天然存在，混进比例里会把问题稀释掉，
  // 所以**内部顶点**（度数 ≥3）单独统计 —— 缺陷只可能发生在内部。
  let interior = 0, defect = 0;
  for (const n of use.values()) {
    if (n >= 3) interior++;
    defect += Math.abs(4 - n);
  }
  return {
    verts: total,
    hist,
    six,
    five,
    interior,
    // 6 度顶点占**内部**顶点的百分比：这才是"要减少"的那个数
    sixPct: +((six / Math.max(1, interior)) * 100).toFixed(2),
    meanDefect: +(defect / Math.max(1, total)).toFixed(3),
  };
}

export function latticeStats(lat) {
  const { verts, faces } = lat;
  const valence = new Array(verts.length).fill(0);
  const edges = new Set();
  const dirBuckets = new Map();
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const k = a < b ? a + '-' + b : b + '-' + a;
      if (edges.has(k)) continue;
      edges.add(k);
      valence[a]++; valence[b]++;
      const ang = Math.atan2(verts[b][1] - verts[a][1], verts[b][0] - verts[a][0]);
      const deg = ((ang * 180 / Math.PI) % 180 + 180) % 180;
      const bucket = Math.round(deg / 15) % 12;   // 15° 一箱，180° 周期
      dirBuckets.set(bucket, (dirBuckets.get(bucket) || 0) + 1);
    }
  }

  const angles = [];
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const p = verts[f[i]], q = verts[f[(i + 1) % f.length]], r = verts[f[(i + 2) % f.length]];
      angles.push(angleAt(p, q, r));
    }
  }
  angles.sort((a, b) => a - b);

  const hist = {};
  for (const v of valence) hist[v] = (hist[v] || 0) + 1;

  const dirs = [...dirBuckets.values()].sort((a, b) => b - a);
  const total = dirs.reduce((a, b) => a + b, 0);
  // 占 10% 以上的方向算"主方向"
  const majorDirs = dirs.filter((c) => c / total >= 0.10).length;

  const types = {};
  for (const f of faces) types[f.length] = (types[f.length] || 0) + 1;

  return {
    name: lat.name,
    verts: verts.length,
    faces: faces.length,
    edges: edges.size,
    faceTypes: types,
    valence: hist,
    majorDirs,
    minAngleMedian: +angles[angles.length >> 1].toFixed(1),
    minAngleP05: +angles[Math.floor(angles.length * 0.05)].toFixed(1),
    // 欧拉示性数：闭合网格应为 2，这里是平面片，用"面-边+顶点"看结构对不对
    euler: verts.length - edges.size + faces.length,
  };
}

function angleAt(p, q, r) {
  const v1 = [p[0] - q[0], p[1] - q[1]];
  const v2 = [r[0] - q[0], r[1] - q[1]];
  const d = (v1[0] * v2[0] + v1[1] * v2[1]) /
    (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}
