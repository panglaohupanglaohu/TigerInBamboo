/**
 * field-plots.js — 田块耕纹：按「地块」共享一条主轴，而不是逐格随机取角
 *
 * 1798310423554658732（2024-06-05，六边格地形工具的实录，无文字说明）：
 *   - 农田是一片片「地块」：几格连成一块，**同一块里耕纹方向完全一致**，
 *     走到地块边界才改向（frame-0600 放大可见左右两块垄沟夹角约 30°，各自内部笔直）；
 *   - 每块地的垄在中线两侧对折成「人字」（chevron），所以一块地看着像倒伏的麦子，
 *     而不是一片平行直条；
 *   - 地块边界有一圈浅色田埂，垄沟到田埂前就停住。
 *
 * 本仓 src/terrain/terrainmesh.js:143 现在是 `hash01(c.id*19+5)*PI` —— 逐格随机角度，
 * 相邻两格的垄沟会互相顶死，正是这条片子反着来的地方（fields.html 用的是同一条路径）。
 *
 * 这里只做纯几何/数学：地块划分（并查集）、主轴（格心 PCA）、人字坐标、田埂。
 * 不碰 THREE、不碰 world，方便 node 直接测。
 */

/** 与 grid.js 同款的确定性随机。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 格心的主轴：把点集投影到 2x2 协方差矩阵，取主特征向量。
 * 主轴 = 垄沟方向；地块长得越长，主轴越稳（细长地块的主轴就是它的长边）。
 */
export function principalAxis(points) {
  const n = points.length;
  if (!n) throw new RangeError('principalAxis: empty');
  let cx = 0, cz = 0;
  for (const p of points) { cx += p.x ?? p.cx; cz += p.z ?? p.cz; }
  cx /= n; cz /= n;
  let sxx = 0, szz = 0, sxz = 0;
  for (const p of points) {
    const dx = (p.x ?? p.cx) - cx, dz = (p.z ?? p.cz) - cz;
    sxx += dx * dx; szz += dz * dz; sxz += dx * dz;
  }
  sxx /= n; szz /= n; sxz /= n;
  // 单一格（方差为 0）时主轴无意义，交给调用方给的 fallback 角
  if (sxx + szz < 1e-12) return { angle: NaN, cx, cz, len: 0, wide: 0 };
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz); // 主特征向量方向
  const ux = Math.cos(angle), uz = Math.sin(angle);
  let lo = Infinity, hi = -Infinity, wo = Infinity, wh = -Infinity;
  for (const p of points) {
    const dx = (p.x ?? p.cx) - cx, dz = (p.z ?? p.cz) - cz;
    const u = dx * ux + dz * uz, v = -dx * uz + dz * ux;
    lo = Math.min(lo, u); hi = Math.max(hi, u);
    wo = Math.min(wo, v); wh = Math.max(wh, v);
  }
  return { angle, cx, cz, len: hi - lo, wide: wh - wo };
}

/** 两块之间格心连线方向（用来给退化地块一个"顺着邻居"的角）。 */
function axisAlong(from, to) {
  return Math.atan2((to.cz ?? to.z) - (from.cz ?? from.z), (to.cx ?? to.x) - (from.cx ?? from.x));
}

/**
 * 地块划分：相邻且同类（same(a,b) 为真）的格按 joinChance 连成一块，
 * 单块最多 maxCells 格 —— 原片里地块大小 2–8 格，不会铺满整座岛。
 * 返回 { plotOf: Map<cellId, plotIndex>, plots: [{ cells:[id], axis, len, wide }] }
 */
export function partitionPlots({ cells, neighbors, seed = 1, joinChance = 0.5, maxCells = 8, same = null }) {
  if (!Array.isArray(cells) || !cells.length) throw new TypeError('partitionPlots: cells required');
  if (typeof neighbors !== 'function') throw new TypeError('partitionPlots: neighbors(cell) required');
  const rng = mulberry32(seed);
  const parent = new Map(), size = new Map();
  for (const c of cells) { parent.set(c.id, c.id); size.set(c.id, 1); }
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const byId = new Map(cells.map((c) => [c.id, c]));
  // 先随机、后确定：同一 seed 下并查集顺序稳定
  const order = cells.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const c of order) {
    const nb = neighbors(c) || [];
    for (const other of nb) {
      const o = byId.get(other.id ?? other);
      if (!o || o.id === c.id) continue;
      if (same && !same(c, o)) continue;
      const ra = find(c.id), rb = find(o.id);
      if (ra === rb) continue;
      if (size.get(ra) + size.get(rb) > maxCells) continue;
      if (rng() > joinChance) continue;
      parent.set(rb, ra); size.set(ra, size.get(ra) + size.get(rb));
    }
  }
  const groups = new Map();
  for (const c of cells) {
    const r = find(c.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c.id);
  }
  const plotOf = new Map(), plots = [];
  for (const [, ids] of groups) {
    const idx = plots.length;
    for (const id of ids) plotOf.set(id, idx);
    plots.push({ index: idx, cells: ids, axis: NaN, cx: 0, cz: 0, len: 0, wide: 0 });
  }
  // 主轴：单格地块取"到最近的非本块格"的方向，保证地块里至少有一条垄
  for (const p of plots) {
    const pts = p.cells.map((id) => byId.get(id));
    const ax = principalAxis(pts);
    if (Number.isFinite(ax.angle) && ax.len > 1e-6) {
      Object.assign(p, { axis: ax.angle, cx: ax.cx, cz: ax.cz, len: ax.len, wide: ax.wide });
      continue;
    }
    const c0 = pts[0];
    const nb = (neighbors(c0) || []).map((o) => byId.get(o.id ?? o)).filter((o) => o && plotOf.get(o.id) !== p.index);
    const ang = nb.length ? axisAlong(c0, nb[0]) : rng() * Math.PI;
    Object.assign(p, { axis: ang, cx: c0.cx, cz: c0.cz, len: 0, wide: 0 });
  }
  return { plotOf, plots };
}

/** 地块局部坐标：u 沿主轴，v 垂直主轴（都以地块中心为原点）。 */
export function plotUV(plot, x, z) {
  const dx = x - plot.cx, dz = z - plot.cz;
  const ux = Math.cos(plot.axis), uz = Math.sin(plot.axis);
  return { u: dx * ux + dz * uz, v: -dx * uz + dz * ux };
}

/**
 * 人字垄行号：row = v - skew*|u|，两侧镜像，于是正中那条垄是折线（人字的尖）。
 * skew>0 时垄线朝 u=0 收拢，和片子里"一块地中间一道折痕、两侧对称"一致。
 * 返回值里的 row 是连续量，band = floor(row/width) 才是肉眼看到的垄序号。
 */
export function chevronRow(plot, x, z, { skew = 0.35, width = 0.5 } = {}) {
  const { u, v } = plotUV(plot, x, z);
  const row = v - skew * Math.abs(u);
  return { u, v, row, band: Math.floor(row / width), mirror: u < 0 ? -1 : 1 };
}

/**
 * 田埂：地块里"有邻格不属于本块"的那些格算边界格。
 * 边界格上垄沟要收住（原片里田埂一圈浅色土，垄沟到它前面停）。
 */
export function plotBorderCells({ cells, neighbors, plotOf }) {
  const out = new Set();
  for (const c of cells) {
    const me = plotOf.get(c.id);
    for (const o of neighbors(c) || []) {
      const other = plotOf.get(o.id ?? o);
      if (other === undefined || other !== me) { out.add(c.id); break; }
    }
  }
  return out;
}

/**
 * 整幅取色：给定世界坐标落在哪个地块、第几条垄、是不是田埂。
 * shade 只是明暗权重（0..1），方便页面直接画条纹，测试也能直接断言。
 */
export function sampleField({ cells, plots, plotOf, borders, x, z, skew = 0.35, width = 0.5, cellAt }) {
  const cell = typeof cellAt === 'function' ? cellAt(x, z) : null;
  if (!cell) return null;
  const idx = plotOf.get(cell.id);
  if (idx === undefined) return null;
  const plot = plots[idx];
  const { row, band } = chevronRow(plot, x, z, { skew, width });
  const edge = borders && borders.has(cell.id) ? 1 : 0;
  const t = Math.abs(row / width - band); // 0=垄脊 0.5=垄沟底
  const stripe = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (row / width)); // 垄脊亮、垄沟暗
  return { plot: idx, band, row, stripe, edge, shade: edge ? 1 : 0.55 + 0.45 * stripe };
}

/** 相邻异块之间的主轴夹角（度），边界"改向"有多明显就看这个。 */
export function borderAngleSpread({ cells, neighbors, plots, plotOf }) {
  const seen = new Set(), diffs = [];
  for (const c of cells) {
    const a = plotOf.get(c.id);
    for (const o of neighbors(c) || []) {
      const id = o.id ?? o;
      const b = plotOf.get(id);
      if (b === undefined || a === undefined || a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let d = Math.abs(((plots[a].axis - plots[b].axis) * 180) / Math.PI) % 180;
      if (d > 90) d = 180 - d;
      diffs.push(d);
    }
  }
  diffs.sort((x, y) => x - y);
  return { count: diffs.length, median: diffs.length ? diffs[(diffs.length / 2) | 0] : 0, diffs };
}
