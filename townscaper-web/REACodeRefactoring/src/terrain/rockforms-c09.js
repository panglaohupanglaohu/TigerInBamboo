/**
 * rockforms-c09.js — 第 56 批 C09-B：斜向崖脊 / 圆岩柱群 / 架空岩檐（石桌）写进共享 World。
 *
 * 1708815475801505819 "a cool cliff I came across"：小岛上一块从低处斜着升到高处的狭长岩脊，顶端搭在另一根
 *   高岩柱上，中间留出可穿过的空洞；周围几根粗细高低不同的圆岩柱（侧面有层线），柱顶和岛面各有小屋。
 * 1671808851895627776 "If your terrain generator supports overhangs you gotta flaunt it."：几根圆柱撑着一块
 *   厚岩盖（石桌 / 岩檐），岩盖下面是空的，能看到下层地面；环绕低机位展示。
 *
 * 做法：形状全部用 XZ 平面里的几何体（圆盘、线段胶囊）去圈格子，与网格种类无关（四边 / 三角混合都行），
 * 斜向就是线段方向不沿网格轴。World 只写整数层的 rock 位：
 *   - leaningRidge：胶囊内每格填到 lerp(h0,h1,t) 层 → 每格一层的台阶；打开 world.softTops 后
 *     soft-tops.js 把一层台阶连成连续斜面（“斜着升上去”的岩脊），两侧落差 ≥2 层仍是竖崖。
 *   - pillar：圆盘内整列岩石到 h 层。
 *   - capSlab：圆盘内只写 [top−thick+1, top] 层，下面保留原地面 → 真正的悬空岩盖，terrainmesh 画底面。
 *     厚度默认 2 层、半径 ≥1.3 格，避免单格薄檐被层级平滑削没（之前的“薄檐形变收缩”问题）。
 *   - house：柱顶 / 岛面上写非 rock 实心层 = 建筑管线画的小屋。
 */
/** 这一列里第一块“下面是空气”的岩石层（悬空底面所在层），没有则 0。 */
export function overhangLevel(world, c) {
  const t = world.top(c);
  for (let lv = 2; lv <= t; lv++) if (world.isSolid(c, lv) && !world.isSolid(c, lv - 1) && world.isRock(c, lv)) return lv;
  return 0;
}
const near = (cells, x, z) => cells.reduce((a, c) => ((c.cx - x) ** 2 + (c.cz - z) ** 2 < (a.cx - x) ** 2 + (a.cz - z) ** 2 ? c : a));
const segT = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; return Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)); };

export function islandBase(world, { x = 0, z = 0, r = 6, wobble = 0.22, level = 1, seed = 1 } = {}) {
  const out = [];
  for (const c of world.cells) {
    const a = Math.atan2(c.cz - z, c.cx - x), rr = r * (1 + wobble * Math.sin(3 * a + seed) * Math.cos(2 * a - seed * 0.7));
    if (Math.hypot(c.cx - x, c.cz - z) <= rr) { world.fill(c, Math.max(level, world.ground(c)), { rock: true }); out.push(c); }
  }
  return out;
}

export function pillar(world, { x, z, r = 1.2, h = 8 }) {
  const out = [];
  for (const c of world.cells) if (Math.hypot(c.cx - x, c.cz - z) <= r) { for (let lv = 1; lv <= h; lv++) world.setSolid(c, lv, true, { rock: true }); out.push(c); }
  return out;
}

/** 悬空岩盖：只写顶上 thick 层；下面不动（保留空洞）。 */
export function capSlab(world, { x, z, r = 1.5, top = 8, thick = 2 }) {
  const out = [];
  for (const c of world.cells) if (Math.hypot(c.cx - x, c.cz - z) <= r) { for (let lv = top - thick + 1; lv <= top; lv++) world.setSolid(c, lv, true, { rock: true }); out.push(c); }
  return out;
}

/** 斜脊：A→B 线段胶囊，高度从 h0 线性升到 h1（整列岩石，每格一层的台阶 → softTops 连成斜面）。 */
export function leaningRidge(world, { a, b, width = 1.1, h0 = 2, h1 = 8 }) {
  const out = [];
  for (const c of world.cells) {
    const t = segT(c.cx, c.cz, a, b), px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
    if (Math.hypot(c.cx - px, c.cz - pz) > width) continue;
    const h = Math.round(h0 + (h1 - h0) * t);
    if (h > world.ground(c)) { world.fill(c, h, { rock: true }); out.push({ c, t, h }); }
  }
  return out;
}

/** 悬空岩桥：A→B 胶囊内只写顶上 thick 层（两端搭在岩脊 / 岩柱上，中段下面是空的）。 */
export function bridge(world, { a, b, width = 0.8, top = 9, thick = 2 }) {
  const out = [];
  for (const c of world.cells) {
    const t = segT(c.cx, c.cz, a, b), px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
    if (Math.hypot(c.cx - px, c.cz - pz) > width) continue;
    for (let lv = top - thick + 1; lv <= top; lv++) world.setSolid(c, lv, true, { rock: true });
    out.push(c);
  }
  return out;
}

export function house(world, cell, { floors = 2, color = 2 } = {}) {
  const t = world.top(cell);
  for (let lv = t + 1; lv <= Math.min(12, t + floors); lv++) world.setSolid(cell, lv, true);
  world.color[cell.id] = color;
  return cell;
}

/**
 * 组合场景。kind='ridge'（1708815475801505819）/ 'dolmen'（1671808851895627776）。
 * s = 格子尺度（四边网格 1，混合网格约 0.62），所有尺寸按它缩放，两种网格得到同样大小的形体。
 */
export function rockScene(world, { kind = 'ridge', s = 1, seed = 1 } = {}) {
  world.reset();
  const cells = world.cells, S = (v) => v * s, rep = { kind, parts: {} };
  islandBase(world, { r: S(7.5), seed });
  if (kind === 'ridge') {
    // 斜脊：从岛西南低处沿对角线升到东北，高端搭在“高柱”上；脊与高柱之间留一段悬空岩盖 = 空洞
    const A = [S(-4.6), S(3.0)], B = [S(-0.4), S(-1.0)], P = [S(3.0), S(-3.2)];
    rep.parts.ridge = leaningRidge(world, { a: A, b: B, width: S(0.95), h0: 2, h1: 9 }).length;
    rep.parts.tall = pillar(world, { x: P[0], z: P[1], r: S(1.25), h: 10 }).length;
    rep.parts.bridge = bridge(world, { a: B, b: P, width: S(0.95), top: 10, thick: 2 }).length;
    rep.parts.side = pillar(world, { x: S(3.4), z: S(1.0), r: S(1.0), h: 5 }).length;      // 右侧矮圆柱（原片的红顶石柱位置）
    rep.parts.west = pillar(world, { x: S(-4.6), z: S(-1.2), r: S(0.9), h: 6 }).length;    // 左侧带屋的细柱
    rep.houses = [house(world, near(cells, S(-4.6), S(-1.2)), { floors: 2, color: 1 }), house(world, near(cells, S(2.4), S(3.4)), { floors: 2, color: 2 }), house(world, near(cells, S(3.0), S(4.2)), { floors: 1, color: 2 })].map((c) => c.id);
    rep.voidCells = cells.filter((c) => overhangLevel(world, c)).length;
  } else {
    // 石桌：三根圆柱撑一块两层厚的圆岩盖，盖下空洞直通下层岛面；旁边一道斜坡台地和小屋
    const legs = [[S(-2.4), S(0.2)], [S(-0.3), S(-1.9)], [S(0.5), S(1.3)]];
    rep.parts.legs = legs.map(([x, z], i) => pillar(world, { x, z, r: S(0.95), h: 6 + (i === 1 ? 1 : 0) }).length);
    rep.parts.cap = capSlab(world, { x: S(-0.7), z: S(-0.1), r: S(2.35), top: 8, thick: 2 }).length;
    rep.parts.front = pillar(world, { x: S(-3.6), z: S(2.6), r: S(1.15), h: 4 }).length;
    rep.parts.slope = leaningRidge(world, { a: [S(5.4), S(3.0)], b: [S(4.4), S(-3.8)], width: S(1.2), h0: 2, h1: 7 }).length;
    rep.houses = [house(world, near(cells, S(2.0), S(3.4)), { floors: 2, color: 2 }), house(world, near(cells, S(4.4), S(-3.9)), { floors: 2, color: 1 })].map((c) => c.id);
    rep.voidCells = cells.filter((c) => overhangLevel(world, c)).length;
  }
  world.slopeMask = null;      // 所有一层台阶都算软坡省 → 斜脊连成斜面；≥2 层落差仍是崖
  world.touch();
  return rep;
}

/**
 * 量岩盖底面在形变后的面积（shape.at 是 WorldMesh/terrainmesh 用的同一个笼映射）：
 * 每个悬空格底面 = 它的角点在“盖底那一层切面”上的多边形。ratio = 形变后 / 逻辑面积。
 */
export function capUndersideArea(world, shape) {
  let logical = 0, drawn = 0, cellsN = 0, minRatio = Infinity;
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
  for (const c of world.cells) {
    const lv = overhangLevel(world, c); if (!lv) continue;              // 第一块悬空岩石层
    const la = area(c.pts.map((p) => [p.x, p.z])), da = area(c.pts.map((p) => shape ? shape.at(p, lv - 1) : [p.x, p.z]));
    logical += la; drawn += da; cellsN++; minRatio = Math.min(minRatio, da / la);
  }
  return { cells: cellsN, logical, drawn, ratio: logical ? drawn / logical : 0, minRatio: cellsN ? minRatio : 0 };
}
