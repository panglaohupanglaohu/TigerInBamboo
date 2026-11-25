/**
 * 格内精细门户 + 形变侧壁（第 55 批 G3；cheesenav / holenav / voxelnav 三个模块的共同缺口，一份实现）。
 *
 * 906425294533394432 "It's like navigating a Swiss cheese" / 797119718477991936 "Got some basic navigation going"：
 * 白点穿的是墙上的**拱洞**，不是整条格边。分层图（layerednav）的通口一直是整条格边；这里按建筑实际画出来的
 * 洞下几何（src/build/buildings.js 的 underside()：方格两对边有支撑 → 椭圆拱；否则平底 + 角上钢柱）
 * 重新算出每个洞道节点里「人真正能站的范围」：
 *   · 拱：净空 c(u) = (spring − 地面) + rise·√(1 − (2u−1)²)，u 是跨向坐标。身高 h 放不下的两条边带封掉，
 *     剩下的 u∈[u0, 1−u0] 才是门户；两侧新出现的「侧壁」是笼形（双线性）映射下 u=u0 的直线 P(u0,v)，
 *     在不规则网格里它跟格边不平行——这就是形变侧壁。
 *   · 平底：角上没有墙托着的地方立了钢柱（mix(角, 格心, .06)，粗 .045），柱子占掉门户两端。
 * 门户 = 本格这一侧的开口区间 ∩ 邻格那一侧（twin 边，参数反向）的开口区间。
 * 只读 World 与网格，不改 buildings / worldmesh；参数与 buildings.js 同源（archFloorBudget、world.archSlab）。
 */
import { archFloorBudget } from '../core/arch-floor-budget.js';
import { MAX_LEVEL } from '../core/world.js';

export const UNIT_HEIGHT = .18;          // battle.js：身体 0..0.12，头心 0.145、半径 0.035 → 头顶 0.18
export const LEG_INSET = .06, LEG_RADIUS = .0225;
const mix = (a, b, t) => a + (b - a) * t;

/** 节点 (cell, floor) 头顶的洞下几何；露天返回 null。 */
export function undersideAt(world, cell, floor, { L = .5, unitHeight = UNIT_HEIGHT } = {}) {
  let lv = -1;
  for (let l = floor + 1; l <= MAX_LEVEL; l++) if (world.isSolid(cell, l)) { lv = l; break; }
  if (lv < 0) return null;
  const below = lv - 1, yFloor = floor * L, yBase = below * L;
  const solid = (c, l) => c !== null && world.isSolid(c, l);
  const axis = cell.n === 4 ? [0, 1].find(i => solid(world.neighbor(cell, i), below) && solid(world.neighbor(cell, i + 2), below)) : undefined;
  if (axis !== undefined) {
    const i = axis, A0 = cell.pts[i], A1 = cell.pts[(i + 1) % 4], B1 = cell.pts[(i + 2) % 4], B0 = cell.pts[(i + 3) % 4];
    const P = (u, v) => { const x0 = mix(A0.x, B0.x, u), z0 = mix(A0.z, B0.z, u), x1 = mix(A1.x, B1.x, u), z1 = mix(A1.z, B1.z, u); return { x: mix(x0, x1, v), z: mix(z0, z1, v) }; };
    const b = archFloorBudget({ base: yBase, floor: yFloor, storey: L, slab: world.archSlab ?? .05 });
    const low = b.spring - yFloor;                                   // 拱脚处的净空
    let u0;
    if (unitHeight <= low) u0 = 0;
    else if (unitHeight >= low + b.rise) u0 = .5;                    // 拱顶都不够高：整格封死
    else { const s = Math.sqrt(1 - ((unitHeight - low) / b.rise) ** 2); u0 = (1 - s) / 2; }
    const side = u0 > 0 && u0 < .5 ? [[P(u0, 0), P(u0, 1)], [P(1 - u0, 0), P(1 - u0, 1)]] : [];
    // 开口边：v=1 面 = 边 i+1（A1→B1，t=u）；v=0 面 = 边 i+3（B0→A0，t=1−u）——区间关于 .5 对称，两面同一个 [u0, 1−u0]
    const open = new Map([[(i + 1) % 4, [u0, 1 - u0]], [(i + 3) % 4, [u0, 1 - u0]]]);
    return { kind: 'arch', axis: i, lv, budget: b, clearanceAtWall: low, u0, P, sideWalls: side, legs: [], open, closedEdges: new Set([i, (i + 2) % 4]) };
  }
  const legs = [];
  for (let k = 0; k < cell.n; k++) {
    const p = cell.pts[k], sharing = world.grid.vertexCells?.get(p.id) ?? [];
    if (sharing.some(id => world.isSolid(world.cells[id], below))) continue;
    legs.push({ k, x: mix(p.x, cell.cx, LEG_INSET), z: mix(p.z, cell.cz, LEG_INSET), r: LEG_RADIUS });
  }
  // 平底：天花板在 yBase（buildings.js 平底面），身高超过就整格封死
  const tooLow = unitHeight > yBase - yFloor + 1e-9;
  return { kind: 'flat', lv, legs, sideWalls: [], open: new Map(), closedEdges: tooLow ? new Set(cell.pts.map((_, k) => k)) : new Set(), clearance: yBase - yFloor };
}

function segDist(x, z, a, b) {
  const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / l2));
  return Math.hypot(x - a.x - ex * t, z - a.z - ez * t);
}

/** 本格这一侧边 e 的开口参数区间 [t0, t1]（t 沿 pts[e]→pts[e+1]）。钢柱按投影 + 半径占掉两端。 */
function sideInterval(cell, e, under) {
  if (!under) return [0, 1];
  if (under.closedEdges.has(e)) return null;
  let [t0, t1] = under.open.get(e) ?? [0, 1];
  const p = cell.pts[e], q = cell.pts[(e + 1) % cell.n], ex = q.x - p.x, ez = q.z - p.z, len = Math.hypot(ex, ez) || 1;
  for (const g of under.legs) {
    if (g.k !== e && g.k !== (e + 1) % cell.n) continue;
    const t = ((g.x - p.x) * ex + (g.z - p.z) * ez) / (len * len), r = g.r / len;
    if (g.k === e) t0 = Math.max(t0, t + r); else t1 = Math.min(t1, t - r);
  }
  return t1 > t0 ? [t0, t1] : null;
}

/** 给 layerednav 的图挂上精细门户。返回查询对象；graph.portals 的 width / x / z / fine 会被改写（只在开关打开时调用）。 */
export function buildFinePortals(world, graph, { L = .5, unitHeight = UNIT_HEIGHT } = {}) {
  const under = graph.nodes.map(n => undersideAt(world, n.cell, n.floor, { L, unitHeight }));
  const apertures = new Map();
  let narrowed = 0, closed = 0, narrowing = 0;
  for (const [from, list] of graph.adj.entries()) {
    const a = graph.nodes[from];
    for (const e of list) {
      const p = e.portal, b = graph.nodes[e.to], cell = a.cell, edge = p.edge;
      const ia = sideInterval(cell, edge, under[from]);
      const twin = cell.edgeTwins?.[edge] ?? b.cell.edgeNeighbors.indexOf(cell.id);
      const ibRaw = twin >= 0 ? sideInterval(b.cell, twin, under[e.to]) : [0, 1];
      const ib = ibRaw && [1 - ibRaw[1], 1 - ibRaw[0]];                 // twin 边方向相反
      const t0 = ia && ib ? Math.max(ia[0], ib[0]) : 1, t1 = ia && ib ? Math.min(ia[1], ib[1]) : 0;
      const P0 = cell.pts[edge], P1 = cell.pts[(edge + 1) % cell.n], full = Math.hypot(P1.x - P0.x, P1.z - P0.z);
      const fine = t1 > t0 ? { t0, t1, p: { x: mix(P0.x, P1.x, t0), z: mix(P0.z, P1.z, t0) }, q: { x: mix(P0.x, P1.x, t1), z: mix(P0.z, P1.z, t1) }, width: (t1 - t0) * full } : { t0, t1, p: null, q: null, width: 0 };
      p.fullWidth ??= p.width; p.width = fine.width; p.fine = fine;
      if (fine.p) { p.x = (fine.p.x + fine.q.x) / 2; p.z = (fine.p.z + fine.q.z) / 2; }
      if (fine.width <= 0) closed++; else if (fine.width < full - 1e-9) { narrowed++; narrowing += 1 - fine.width / full; }
      apertures.set(from + ':' + edge, fine);
    }
  }
  return {
    under, apertures, unitHeight,
    aperture(fromId, edge) { return apertures.get(fromId + ':' + edge) ?? null; },
    /** 圆盘（身体）是否碰到门户两端被封的部分、拱下侧壁、钢柱。只管「图里连通的边」；不通的边由 discFits 管。 */
    fits(node, x, z, radius) {
      const u = under[node.id]; if (!u && !node.cell) return true;
      const c = node.cell;
      for (const e of graph.adj[node.id]) {
        const f = apertures.get(node.id + ':' + e.portal.edge); if (!f) continue;
        const P0 = c.pts[e.portal.edge], P1 = c.pts[(e.portal.edge + 1) % c.n];
        if (f.width <= 0) { if (segDist(x, z, P0, P1) + 1e-9 < radius) return false; continue; }
        if (f.t0 > 1e-9 && segDist(x, z, P0, f.p) + 1e-9 < radius) return false;
        if (f.t1 < 1 - 1e-9 && segDist(x, z, f.q, P1) + 1e-9 < radius) return false;
      }
      if (!u) return true;
      for (const g of u.legs) if (Math.hypot(x - g.x, z - g.z) + 1e-9 < radius + g.r) return false;
      for (const [a, b] of u.sideWalls) {
        // 圆心必须在侧壁靠格心的一侧，且离侧壁 ≥ 半径
        const ex = b.x - a.x, ez = b.z - a.z, s = ex * (z - a.z) - ez * (x - a.x), sc = ex * (c.cz - a.z) - ez * (c.cx - a.x);
        if (s * sc < 0 || segDist(x, z, a, b) + 1e-9 < radius) return false;
      }
      if (u.kind === 'arch' && u.u0 >= .5) return false;
      return true;
    },
    stats() {
      const arch = under.filter(u => u?.kind === 'arch'), flat = under.filter(u => u?.kind === 'flat');
      return { covered: arch.length + flat.length, archNodes: arch.length, flatNodes: flat.length, sideWalls: arch.reduce((s, u) => s + u.sideWalls.length, 0), legs: flat.reduce((s, u) => s + u.legs.length, 0),
        portals: apertures.size, narrowed, closed, meanNarrowing: narrowed ? narrowing / narrowed : 0, unitHeight };
    },
  };
}
