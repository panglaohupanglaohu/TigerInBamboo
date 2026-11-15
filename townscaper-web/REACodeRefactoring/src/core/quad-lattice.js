/**
 * quad-lattice.js — 等距方格格网（quad-regular 档）
 *
 * 依据：1120036868966502401「It's marching squares on irregular quadrilateral grids」。
 * 第 76 轮把原片 frame-0330 按 460×460 原尺寸 + 3× 裁切量过一遍，格网硬数字是：
 *   · 等距方格，格距中位 **22px**（p25 14.2 / p75 29.5 是透视压缩，不是格距不均）；
 *   · 每格边只画**一条**线，格内**没有对角线**；
 *   · 线宽中位 **2px**（n=107）；
 *   · 每个交点上一个比线更亮的**圆斑 2–3px**。
 * 本仓地形网格是不规则三角/四边混合（每格边 2.724 段、且带三角格的对角边），
 * 直接画「每格每条边」永远得不到上面那四条。所以这一档单独建格：等距方格 + 每边一次 + 交点亮斑，
 * 与地形网格解耦；`latticeForGrid()` 只借用地形的外接框与中位格距，不借用它的拓扑。
 *
 * 纯逻辑模块（不引 three）：几何、去重、规整度统计都在这里，Node 与浏览器同源。
 */

const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 从一组四边格建格网线。用于校验「本仓的方格网格本来就是等距方格」（buildSquareGrid）。
 * 三角格直接报错：这一档只接受四边格，混进来就说明调用方拿错了 grid。
 */
export function gridToLattice(grid, { y = 0 } = {}) {
  if (!grid || !Array.isArray(grid.cells)) throw new RangeError('grid.cells must be an array');
  for (const c of grid.cells) if (c.n !== 4) throw new RangeError('quad-regular 档只吃四边格，遇到 n=' + c.n);
  return buildFrom({
    vertices: grid.verts.map((v) => ({ id: v.id, x: v.x, z: v.z })),
    edges: uniqueEdges(grid.cells),
    y,
  });
}

function uniqueEdges(cells) {
  const seen = new Map();
  for (const c of cells) {
    for (let i = 0; i < c.n; i++) {
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      const k = key(a.id, b.id);
      if (!seen.has(k)) seen.set(k, [a, b]);
    }
  }
  return [...seen.values()];
}

function buildFrom({ vertices, edges, y = 0 }) {
  const deg = new Map();
  for (const [a, b] of edges) {
    deg.set(a.id, (deg.get(a.id) || 0) + 1);
    deg.set(b.id, (deg.get(b.id) || 0) + 1);
  }
  return finish({ vertices, edges, deg, y });
}

function finish({ vertices, edges, deg, y }) {
  const positions = [], lens = [], diagonals = [];
  for (const [a, b] of edges) {
    const dx = b.x - a.x, dz = b.z - a.z;
    positions.push(a.x, y, a.z, b.x, y, b.z);
    lens.push(Math.hypot(dx, dz));
    // 对角线：x 与 z 同时变化。等距方格上这条必须是 0，否则就是把三角格的斜边也画进去了。
    if (Math.abs(dx) > 1e-9 && Math.abs(dz) > 1e-9) diagonals.push({ a: a.id, b: b.id });
  }
  const cornerPositions = [];
  const used = [...deg.keys()];
  for (const v of vertices) if (deg.has(v.id)) cornerPositions.push(v.x, y, v.z);
  const lo = lens.length ? Math.min(...lens) : 0, hi = lens.length ? Math.max(...lens) : 0, med = median(lens);
  const degree = {};
  for (const v of vertices) {
    const d = deg.get(v.id) || 0;
    if (d > 0) degree[d] = (degree[d] || 0) + 1;
  }
  const stats = {
    edges: edges.length,
    corners: cornerPositions.length / 3,
    vertices: vertices.length,
    diagonals: diagonals.length,
    spacing: { min: +lo.toFixed(6), median: +med.toFixed(6), max: +hi.toFixed(6), spread: lo > 0 ? +((hi - lo) / lo).toFixed(6) : 0 },
    degree,          // {2: 角点, 3: 边上, 4: 内部}，等距方格必须只有这三档
    interiorQuads: degree[4] || 0,
    y: +y.toFixed(4),
    regular: diagonals.length === 0 && lo > 0 && (hi - lo) / lo < 1e-6 && !degree[5] && !degree[6],
  };
  return { positions, cornerPositions, stats, diagonals, vertices, edges };
}

/**
 * 等距方格格网本体：cols×rows 个格、每格 size 宽。
 * 顶点 id 按 row*(cols+1)+col 编号；边去重后共 cols*(rows+1) + rows*(cols+1) 条，全部轴对齐。
 */
export function buildRegularLattice({ cols = 8, rows = 8, size = 1, origin = { x: 0, z: 0 }, y = 0 } = {}) {
  if (!Number.isInteger(cols) || cols < 1) throw new RangeError('cols must be a positive integer');
  if (!Number.isInteger(rows) || rows < 1) throw new RangeError('rows must be a positive integer');
  if (!Number.isFinite(size) || size <= 0) throw new RangeError('size must be > 0');
  const ox = origin.x || 0, oz = origin.z || 0;
  const vertices = [];
  const at = (c, r) => r * (cols + 1) + c;
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    vertices.push({ id: at(c, r), x: ox + c * size, z: oz + r * size });
  }
  const edges = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) edges.push([vertices[at(c, r)], vertices[at(c + 1, r)]]);
  for (let c = 0; c <= cols; c++) for (let r = 0; r < rows; r++) edges.push([vertices[at(c, r)], vertices[at(c, r + 1)]]);
  const out = finish({ vertices, edges, deg: (() => { const d = new Map(); for (const [a, b] of edges) { d.set(a.id, (d.get(a.id) || 0) + 1); d.set(b.id, (d.get(b.id) || 0) + 1); } return d; })(), y });
  out.stats.cols = cols; out.stats.rows = rows; out.stats.cells = cols * rows;
  out.stats.expectedEdges = cols * (rows + 1) + rows * (cols + 1);
  // 第 96 轮：窗口要对齐到这张格子的实际原点，否则自动定的窗口会与格线错半格。
  out.stats.origin = { x: ox, z: oz }; out.stats.size = size;
  return out;
}

/**
 * 按一张真实地形的外接框铺一张等距方格：格距取该网格边的中位长度（片里就是 22px 那个格距的
 * 世界单位版），cols/rows 取外接框最大边 / 格距。地形自己不规整，这张格子是「对照档」，
 * 不参与任何碰撞/寻路，只用于把原片的格网观感摆到同一机位下比对。
 */
export function latticeForGrid(grid, { size = 0, y = 0, pad = 1 } = {}) {
  if (!grid?.verts?.length) throw new RangeError('grid.verts is empty');
  const seen = new Map();
  const lens = [];
  for (const c of grid.cells) {
    for (let i = 0; i < c.n; i++) {
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      const k = key(a.id, b.id);
      if (seen.has(k)) continue;
      seen.set(k, 1);
      lens.push(Math.hypot(b.x - a.x, b.z - a.z));
    }
  }
  const step = Number.isFinite(size) && size > 0 ? size : median(lens);
  if (!(step > 0)) throw new RangeError('cannot derive a positive cell size');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of grid.verts) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }
  const cols = Math.max(1, Math.round((maxX - minX) / step) + (pad ? 2 * pad : 0));
  const rows = Math.max(1, Math.round((maxZ - minZ) / step) + (pad ? 2 * pad : 0));
  const origin = { x: minX - (pad ? pad : 0) * step, z: minZ - (pad ? pad : 0) * step };
  const out = buildRegularLattice({ cols, rows, size: step, origin, y });
  out.stats.gridSpacing = { median: +step.toFixed(6), faceSegmentsPerCell: +(lens.length / Math.max(1, grid.cells.length)).toFixed(3) };
  return out;
}

/**
 * 把一张等距方格**贴到地形表面上**，并按岛体轮廓裁掉出界的部分（第 78 轮，1120036868966502401 缺口 ①）。
 *
 * 原片证据（460×460 原尺寸复核）：
 *   · frame-0280 —— 格网外缘不是一条直边，而是**一格一格退让的锯齿**（左下与下缘各有 1–2 格缺角），
 *     说明格网是按「这点有没有地面」逐交点裁的，不是铺满一个矩形外接框；
 *   · frame-0470 —— 抬高的平台顶面上有整片方格，平台**侧面（竖直面）上没有白格线**，
 *     格线在台沿处终止；同一张片子里交点亮斑只在平台顶面上出现。
 *
 * 所以这里做两件事：① 每个交点按 `sample(x,z)` 取该处地表高，把整张格子抬到表面（不再是 y=0.02 一张平板）；
 * ② 取不到地面的交点（水面 / 出岛）直接丢掉，边只在**两端都有地面**时才画 —— 外缘自然形成原片那种锯齿。
 *
 * 第 79 轮三处修正（同一段片 460×460 原尺寸 + 4–6× 最近邻裁切复核）：
 *   · **跨层不画竖线**（`breakMode='none'`，新默认）。frame-0072 的抬高台面与低地交界、frame-0300 的台地、
 *     frame-0470 的台沿、frame-0076 的建筑基座：白格线到台沿就**停住**，没见过把上下两层交点连起来的竖短线；
 *     旧默认每条跨边落**两根**竖线（两端各一根），细格网上会叠成一排短竖线，正是缺口 ③。
 *     `'pair'` / `'single'` 保留成对照档，供与第 71 轮的旧观感 A/B。
 *   · **外缘顶点是黑色空心小方块**（≈5px，黑框浅心），只有内部交点是白色亮点：frame-0072 / frame-0470 /
 *     frame-0076 / step-e 裁切都在「白格网被裁断的那一圈」看到黑方块，内部交点全是白点。
 *     这里把顶点分两类返回：`cornerPositions`（全部保留交点，白点）与 `rimPositions`（外缘，黑方块）。
 *   · 外缘判据：该点至少挂了一条**被裁掉的边**（对端没地面 / 出岛）。跨层边不算外缘 ——
 *     原片外缘黑方块只出现在「白格网被裁断的那一圈」，台面中间有落差的地方并没有。 */
export function drapeLattice(lattice, sample, { breakRatio = 0.5, tol = 1e-6, breakMode = 'none' } = {}) {
  if (!lattice || !Array.isArray(lattice.vertices) || !Array.isArray(lattice.edges)) throw new RangeError('drapeLattice 需要带 vertices/edges 的格网（buildRegularLattice / latticeForGrid 的产物）');
  if (typeof sample !== 'function') throw new TypeError('sample must be (x,z) => height | null');
  if (!['none', 'single', 'pair'].includes(breakMode)) throw new RangeError("breakMode must be 'none' | 'single' | 'pair'");
  const h = new Map();
  let kept = 0, dropped = 0, minY = Infinity, maxY = -Infinity;
  for (const v of lattice.vertices) {
    const y = sample(v.x, v.z);
    if (Number.isFinite(y)) {
      h.set(v.id, y); kept++;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else { h.set(v.id, null); dropped++; }
  }
  const step = lattice.stats?.spacing?.median || 0;
  const brk = step > 0 ? step * breakRatio : Infinity;
  const positions = [], corners = [], rim = [], used = new Set();
  const rimIds = new Set();
  let drawn = 0, stepped = 0, vertical = 0, skipped = 0;
  for (const [a, b] of lattice.edges) {
    const ya = h.get(a.id), yb = h.get(b.id);
    if (!Number.isFinite(ya) || !Number.isFinite(yb)) {           // 出岛 / 水上：不画（外缘锯齿从这里来）
      if (Number.isFinite(ya)) rimIds.add(a.id);
      if (Number.isFinite(yb)) rimIds.add(b.id);
      continue;
    }
    if (Math.abs(ya - yb) > brk) {                                    // 跨层：原片不画连接线，两端也不算外缘
      used.add(a.id); used.add(b.id);
      if (breakMode === 'pair') {
        positions.push(a.x, ya, a.z, a.x, yb, a.z);
        positions.push(b.x, yb, b.z, b.x, ya, b.z);
        vertical += 2;
      } else if (breakMode === 'single') {
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        positions.push(mx, Math.max(ya, yb), mz, mx, Math.min(ya, yb), mz);
        vertical++;
      } else {
        skipped++;                                                   // 默认档：这条跨层边一条线都不画
      }
      continue;
    }
    positions.push(a.x, ya, a.z, b.x, yb, b.z);
    drawn++;
    if (Math.abs(ya - yb) > tol) stepped++;
    used.add(a.id); used.add(b.id);
  }
  for (const v of lattice.vertices) {
    const y = h.get(v.id);
    if (!Number.isFinite(y) || !used.has(v.id)) continue;
    corners.push(v.x, y, v.z);
    if (rimIds.has(v.id)) rim.push(v.x, y, v.z);
  }
  const stats = {
    drape: true,
    breakMode,
    vertices: lattice.vertices.length,
    kept, dropped,
    edges: lattice.edges.length,
    drawn, stepped, vertical, skipped,
    corners: corners.length / 3,
    rim: rim.length / 3,
    inner: corners.length / 3 - rim.length / 3,
    yFlat: +((maxY - minY)).toFixed(4),
    minY: kept ? +minY.toFixed(4) : 0,
    maxY: kept ? +maxY.toFixed(4) : 0,
    breakRatio,
    spacing: lattice.stats?.spacing || null,
    regular: lattice.stats?.regular === true,
  };
  return { positions, cornerPositions: corners, rimPositions: rim, heights: h, stats };
}

/**
 * 四边形 → 两个三角形（第 80 轮，1120036868966502401 缺口 ②「黄色三角化轮廓」）。
 *
 * 原片证据（460×460 原尺寸 + 5–6× 最近邻裁切）：
 *   · frame-0301 —— 浅色地面上散着 **6 个黄色三角轮廓**，每个三角形的一个直角边沿格线、另一边是**格对角线**，
 *     即「四边格被对角线切成两个三角」里的**其中一个**；相邻格子没有被描边，说明这是**局部/区域**调试层，
 *     不是整张格网都画对角线；
 *   · frame-0105 / frame-0400 / frame-0520 附近同一批黄三角反复出现，且方向（对角线 "\" / "/"）逐格交替，
 *     所以切分方向不能写死一个 —— 默认按 `(col+row)` 奇偶交替；
 *   · 黄三角只有**描边没有填充**，线宽与白格线同量级。
 *
 * 因此这一档只做一件事：给**指定区域**里的每个四边格画它被切出来的那个三角形（3 条边），
 * 出界/没地面的格子丢掉（与 `drapeLattice` 同口径），方向由 `split` 决定。
 *
 * @param lattice  buildRegularLattice / latticeForGrid 的产物（需要 stats.cols/rows）
 * @param region   {minX,maxX,minZ,maxZ}，按**格心**判；null = 全格网
 * @param heights  id → y 的 Map（`drapeLattice(...).heights`）；不传则用 lattice.stats.y
 * @param split    'auto'（按 col+row 奇偶交替）| 'a'（对角线 v00–v11）| 'b'（对角线 v10–v01）
 */
/**
 * 第 84 轮（1120036868966502401 缺口 ①）：三角线框**按区域分组取色**。
 * 实测 frame-0300 同帧里有**两组不同颜色的三角**——右侧一组是深蓝（#2233aa 量级）、左下角一组是黄绿，
 * 4× 裁切里两组各自覆盖连续的若干格、组与组之间不接壤，说明颜色不是「整层固定黄」而是逐 patch 的。
 * 旧实现把颜色钉死在 `gridQuads(..., [0.914,0.890,0.235])` 一处，永远只有一种颜色。
 * 这里把 `colors` 做成 `(x,z)=>[r,g,b]|null` 的回调：返回 null 的格直接不选（比 bbox 更精确地挑格子），
 * 返回色值就写进逐顶点色属性，view 侧再按组把多段结果拼一条几何。
 */
export function latticeTriangles(lattice, { region = null, heights = null, split = 'auto', colors = null } = {}) {
  const cols = lattice?.stats?.cols, rows = lattice?.stats?.rows;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) throw new RangeError('latticeTriangles 需要带 stats.cols/rows 的等距格网（buildRegularLattice 的产物）');
  if (!['auto', 'a', 'b'].includes(split)) throw new RangeError("split must be 'auto' | 'a' | 'b'");
  const flatY = Number.isFinite(lattice.stats?.y) ? lattice.stats.y : 0;
  const at = (c, r) => r * (cols + 1) + c;
  const vById = new Map();
  for (const v of lattice.vertices) vById.set(v.id, v);
  const yOf = (id) => {
    if (!heights) return flatY;
    const y = heights.get ? heights.get(id) : heights[id];
    return Number.isFinite(y) ? y : null;
  };
  const inRegion = (x, z) => !region || (x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ);
  const colorAt = typeof colors === 'function' ? colors : null;
  const positions = [], vcolors = [];
  let quads = 0, skipped = 0, a = 0, b = 0, dropped = 0;
  let minY = Infinity, maxY = -Infinity;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v00 = vById.get(at(c, r)), v10 = vById.get(at(c + 1, r));
    const v11 = vById.get(at(c + 1, r + 1)), v01 = vById.get(at(c, r + 1));
    if (!v00 || !v10 || !v11 || !v01) { skipped++; continue; }
    if (!inRegion((v00.x + v11.x) / 2, (v00.z + v11.z) / 2)) continue;      // 区域外不算跳过，只是不选
    let rgb = null;
    if (colorAt) {
      rgb = colorAt((v00.x + v11.x) / 2, (v00.z + v11.z) / 2, c, r);
      if (!rgb) { dropped++; continue; }        // 回调没给色 = 这一格不属于本组
    }
    const y00 = yOf(v00.id), y10 = yOf(v10.id), y11 = yOf(v11.id), y01 = yOf(v01.id);
    if (y00 === null || y10 === null || y11 === null || y01 === null) { skipped++; continue; }
    quads++;
    const dir = split === 'auto' ? (((c + r) & 1) ? 'a' : 'b') : split;
    // 'a'：对角线 v00–v11，取三角 (v00, v10, v11)；'b'：对角线 v10–v01，取三角 (v00, v10, v01)
    const tri = dir === 'a'
      ? [[v00, y00], [v10, y10], [v11, y11]]
      : [[v00, y00], [v10, y10], [v01, y01]];
    if (dir === 'a') a++; else b++;
    for (let i = 0; i < 3; i++) {
      const [p, py] = tri[i], [q, qy] = tri[(i + 1) % 3];
      positions.push(p.x, py, p.z, q.x, qy, q.z);
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      if (rgb) for (let k = 0; k < 2; k++) vcolors.push(rgb[0], rgb[1], rgb[2]);
    }
  }
  const stats = {
    split, quads, skipped, dropped, triangles: quads, edges: quads * 3, splits: { a, b },
    region: region ? { ...region } : null, colored: !!colorAt,
    yMin: quads ? +minY.toFixed(4) : 0, yMax: quads ? +maxY.toFixed(4) : 0,
  };
  return { positions, colors: colorAt ? vcolors : null, stats };
}

/**
 * 窗口补丁（第 94 轮，1120036868966502401 缺口 ③「白格网补丁是**有界的**」）。
 *
 * 原片证据（460×460 原尺寸 + 4× 最近邻裁切，frame-0300 / 0445 / 0620）：
 *   · 白格网在片子里从来不是「铺满整岛」，而是**一块矩形补丁**——边界是直的一刀切（不是按地形退让的锯齿），
 *     补丁内约 7–8 格 × 5–6 格，格线随地形起伏弯（= 贴面档），补丁外一格都不画；
 *   · 补丁位置逐段变化：0300 在右上、0445 在中上、0620 在高台上 —— 跟着正在编辑的对象走，不是固定的。
 *   · 本仓 `setGridRegular(true)` 一直铺满 `latticeForGrid` 的整个外接框，没有「窗口」这一档。
 *
 * 这里只做裁剪：**两个端点都在窗口内**才留（单端在外的不留），因为原片补丁边界是硬切的竖边，
 * 没有半截悬在外面的线；点（交点亮斑）同理；三角层则改走 `intersectRect` 求区域交集。
 */
export function clipSegmentsToRect(seg, rect) {
  if (!rect) return { positions: seg.slice(), kept: seg.length / 6, total: seg.length / 6 };
  const out = [];
  let kept = 0, total = 0;
  const inRect = (x, z) => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
  for (let o = 0; o + 5 < seg.length; o += 6) {
    total++;
    if (!inRect(seg[o], seg[o + 2]) || !inRect(seg[o + 3], seg[o + 5])) continue;
    out.push(seg[o], seg[o + 1], seg[o + 2], seg[o + 3], seg[o + 4], seg[o + 5]);
    kept++;
  }
  return { positions: out, kept, total };
}

/** 点数组（每 3 个数一个 xyz）按窗口裁剪：只有落在窗口内的点留下。 */
export function clipPointsToRect(pts, rect) {
  if (!rect) return { positions: pts.slice(), kept: pts.length / 3, total: pts.length / 3 };
  const out = [];
  let total = 0;
  for (let o = 0; o + 2 < pts.length; o += 3) {
    total++;
    const x = pts[o], z = pts[o + 2];
    if (x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ) out.push(pts[o], pts[o + 1], pts[o + 2]);
  }
  return { positions: out, kept: out.length / 3, total };
}

/** 两个矩形的交（三角层要同时满足「分组区域」和「窗口」）；不相交返回 null。 */
export function intersectRect(a, b) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const r = {
    minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX),
    minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ),
  };
  return r.minX <= r.maxX && r.minZ <= r.maxZ ? r : null;
}

/**
 * 窗口随「选中对象包围盒」自动定（第 96 轮，1120036868966502401 缺口 ①）。
 *
 * 原片证据（frame-0300 / 0445 / 0620，4× 裁切）：白格网补丁**跟着正在编辑的对象跑** ——
 * 0300 贴在右上那栋房子周围、0445 移到中上、0620 爬到高台；补丁始终约 7–8 格 × 5–6 格，
 * 边界是硬切的一刀，比对象包围盒每边多出约 1 格。第 94/95 轮只能手拖，这里把它做成
 * 「给包围盒 → 自动出窗口」。
 *
 * 注意窗口必须**对齐格线**（origin + k·step），否则补丁边界会落在两条格线之间，
 * 裁出来既不是原片的硬切边、也会把最外一圈格线整条丢掉。
 *
 * @param {{minX,maxX,minZ,maxZ}} bounds 对象包围盒（世界 XZ）
 * @param {{step:number, origin?:{x,z}, pad?:number, maxCells?:number}} opts
 *        step = 格距（米/格）；pad = 每边额外留几格（默认 1）；maxCells = 补丁边长上限（默认 8 格，原片 7–8）
 */
export function windowForBounds(bounds, { step, origin = { x: 0, z: 0 }, pad = 1, maxCells = 8 } = {}) {
  if (!bounds) return null;
  for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) {
    if (!Number.isFinite(bounds[k])) throw new RangeError(`bounds.${k} 必须是有限数`);
  }
  if (!(step > 0)) throw new RangeError('step must be > 0');
  if (bounds.minX > bounds.maxX || bounds.minZ > bounds.maxZ) throw new RangeError('bounds 的 min 不能大于 max');
  const ox = origin.x || 0, oz = origin.z || 0;
  const lo = (v, o) => o + Math.floor((v - o) / step + 1e-9) * step;
  const hi = (v, o) => o + Math.ceil((v - o) / step - 1e-9) * step;
  const m = (pad > 0 ? pad : 0) * step;
  let minX = lo(bounds.minX - m, ox), maxX = hi(bounds.maxX + m, ox);
  let minZ = lo(bounds.minZ - m, oz), maxZ = hi(bounds.maxZ + m, oz);
  // 边长上限：以包围盒中心为心收，收完仍是格点的整数倍（不破坏对齐）
  const cap = (a, b, o) => {
    const n = Math.round((b - a) / step);
    if (n <= maxCells) return [a, b];
    const c = (Math.round((a - o) / step) + Math.round((b - o) / step)) / 2;
    const half = maxCells / 2;
    const lo2 = o + Math.round(c - half) * step, hi2 = o + Math.round(c + half) * step;
    return [lo2, hi2];
  };
  [minX, maxX] = cap(minX, maxX, ox);
  [minZ, maxZ] = cap(minZ, maxZ, oz);
  return {
    minX: +minX.toFixed(6), maxX: +maxX.toFixed(6), minZ: +minZ.toFixed(6), maxZ: +maxZ.toFixed(6),
    cols: Math.round((maxX - minX) / step), rows: Math.round((maxZ - minZ) / step),
  };
}

/**
 * 第 98 轮 · 选中对象 → 世界 XZ 包围盒（1120036868966502401 缺口 ① 的最后一段）。
 *
 * 第 96 轮把「给包围盒 → 自动出窗口」做完了，但包围盒一直靠手灌（滑杆/拖拽/测试里写死）。
 * 原片里补丁是**跟着正在编辑的对象**跑的，所以还缺一步：把一个「选中态」翻译成包围盒。
 * 这里只做纯几何，不碰 three、不碰交互：
 *   · 选中若干格（编辑对象占的那几格）→ 格子外轮廓的 AABB；
 *   · 选中若干对象（每个对象自带 bounds 或 cells）→ 各自 AABB 的并集。
 *
 * 格子优先用 `pts`（多边形顶点）求外轮廓，拿不到 pts 才退回 `cx/cz ± half`（half 默认半格）。
 */
export function boundsForCells(cells, { half = 0 } = {}) {
  const list = cells ? [...cells] : [];
  if (!list.length) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let any = false;
  for (const c of list) {
    if (!c) continue;
    if (Array.isArray(c.pts) && c.pts.length) {
      for (const p of c.pts) {
        if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) continue;
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        any = true;
      }
    } else if (Number.isFinite(c.cx) && Number.isFinite(c.cz)) {
      minX = Math.min(minX, c.cx - half); maxX = Math.max(maxX, c.cx + half);
      minZ = Math.min(minZ, c.cz - half); maxZ = Math.max(maxZ, c.cz + half);
      any = true;
    }
  }
  if (!any) return null;
  return { minX: +minX.toFixed(6), maxX: +maxX.toFixed(6), minZ: +minZ.toFixed(6), maxZ: +maxZ.toFixed(6) };
}

/** 多个包围盒求并（空列表 → null，单个原样返回）。 */
export function mergeBounds(list) {
  const items = (list || []).filter((b) => b && ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(b[k])));
  if (!items.length) return null;
  return {
    minX: +Math.min(...items.map((b) => b.minX)).toFixed(6),
    maxX: +Math.max(...items.map((b) => b.maxX)).toFixed(6),
    minZ: +Math.min(...items.map((b) => b.minZ)).toFixed(6),
    maxZ: +Math.max(...items.map((b) => b.maxZ)).toFixed(6),
  };
}

/**
 * 选中态 → 包围盒。`sel` 三种写法（都可以混着用）：
 *   `{ bounds }`                 直接给包围盒；
 *   `{ cells: [...] }`           给格子（编辑对象占的那几格）；
 *   `{ objects: [...] }`         给对象列表，每个对象带 `bounds` 或 `cells`。
 * 传 null / 空选中 → null（= 没有选中，窗口该清掉）。
 */
export function selectionBounds(sel) {
  if (!sel) return null;
  if (typeof sel !== 'object') throw new TypeError('selection 必须是对象或 null');
  const parts = [];
  if (sel.bounds) {
    for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) if (!Number.isFinite(sel.bounds[k])) throw new RangeError(`selection.bounds.${k} 必须是有限数`);
    parts.push(sel.bounds);
  }
  if (sel.cells) { const b = boundsForCells(sel.cells); if (b) parts.push(b); }
  if (sel.objects) {
    if (!Array.isArray(sel.objects)) throw new TypeError('selection.objects 需要数组');
    for (const o of sel.objects) {
      if (!o) continue;
      if (o.bounds) parts.push(o.bounds);
      else if (o.cells) { const b = boundsForCells(o.cells); if (b) parts.push(b); }
    }
  }
  return mergeBounds(parts);
}

/**
 * 窗口边缘高亮（第 96 轮，缺口 ②）：原片 frame-0300 的补丁四边有一圈**更亮的框**（比格线粗一点、更白），
 * 它不是格线的一部分（关掉格线后框还在）。这里返回 4 条边线（x,y,z × 2 端点，扁平数组），
 * 由 view 端用和格线同一套 `gridQuads` 画成可见宽度（1px LineSegments 在浅色地面上看不见）。
 *
 * @param {{minX,maxX,minZ,maxZ}} rect
 * @param {number} [y] 统一高度；给了 heights 就忽略它
 * @param {(x:number,z:number)=>number|null} [sample] 逐点取地面高（贴面档）
 */
export function windowEdgeSegments(rect, y = 0, sample = null) {
  if (!rect) return [];
  const { minX, maxX, minZ, maxZ } = rect;
  const corners = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  const at = (c) => {
    const yy = sample ? sample(c[0], c[1]) : null;
    return [c[0], Number.isFinite(yy) ? yy : y, c[1]];
  };
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = at(corners[i]), b = at(corners[(i + 1) % 4]);
    out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  return out;
}
