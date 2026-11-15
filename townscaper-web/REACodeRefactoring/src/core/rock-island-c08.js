// r56 C08 · 1471817524148940807「Some rocky islands. Trying to make the grid natural and readable, yet funky.
// Square, yet hex.」— 原片是方格地形岛：顶面能看到方格线，崖边却是一折一折的「六边形感」轮廓。
// 这里把共享 corner-footprint.js 的切角方案（顶点图二分着色 → 每格切一对对角）真正接进 3D 地形：
// 逐层（level）只切「落在该层区域边界上的」着色顶点，区域内部顶点不切 → 内部方格完整相接、边界一折一折；
// 墙体逐层按该层轮廓挤出。World / 拓扑 / 导航不变（只读几何）。
import { cornerCutPlan, cornerFootprint } from './corner-footprint.js';

export function rockIslandMesh(world, { cut = .5, L = .5 } = {}) {
  const grid = world.grid, plan = cornerCutPlan(grid);
  if (!plan.bipartite) throw new RangeError('rocky island needs an all-quad bipartite grid');
  const vcells = new Map();
  for (const c of grid.cells) for (const p of c.pts) (vcells.get(p.id) || vcells.set(p.id, []).get(p.id)).push(c);
  const maxG = Math.max(0, ...grid.cells.map((c) => world.ground(c)));
  const P = [], C = [], lines = [];
  const tri = (a, b, c, col) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1, d = .55 + .45 * Math.abs((n[0] * .35 + n[1] * .85 + n[2] * .4) / l); for (const q of [a, b, c]) { P.push(...q); C.push(col[0] * d, col[1] * d, col[2] * d); } };
  let cutCorners = 0, walls = 0;
  const TOP = [.62, .72, .58], WALL = [.5, .55, .72];
  for (let l = 1; l <= maxG; l++) {
    const inR = (c) => world.ground(c) >= l;
    for (const c of grid.cells) {
      if (c.n !== 4 || !inR(c)) continue;
      const corners = c.pts.map((p) => plan.cut.has(p.id) && !vcells.get(p.id).every(inR) && vcells.get(p.id).length >= 1);
      const f = cornerFootprint(c, { cut, corners }); cutCorners += corners.filter(Boolean).length;
      const pts = f.points, y0 = (l - 1) * L, y1 = l * L;
      if (world.ground(c) === l) {
        for (let i = 1; i + 1 < pts.length; i++) tri([pts[0].x, y1, pts[0].z], [pts[i + 1].x, y1, pts[i + 1].z], [pts[i].x, y1, pts[i].z], TOP);
        for (let i = 0; i < 4; i++) { const a = c.pts[i], b = c.pts[(i + 1) % 4]; lines.push(a.x, y1 + .004, a.z, b.x, y1 + .004, b.z); }
      }
      // walls: every footprint segment not lying on an edge shared with an in-region neighbour
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        let shared = false;
        for (let e = 0; e < 4; e++) {
          const p = c.pts[e], q = c.pts[(e + 1) % 4], dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz);
          const off = (r) => Math.abs((r.x - p.x) * dz - (r.z - p.z) * dx) / len;
          if (off(a) < 1e-7 && off(b) < 1e-7) { const n = c.edgeNeighbors[e]; shared = n >= 0 && inR(grid.cells[n]); break; }
        }
        if (shared) continue;
        tri([a.x, y0, a.z], [a.x, y1, a.z], [b.x, y1, b.z], WALL); tri([a.x, y0, a.z], [b.x, y1, b.z], [b.x, y0, b.z], WALL); walls++;
      }
    }
  }
  return { position: P, color: C, lines, cutCorners, walls, levels: maxG };
}
