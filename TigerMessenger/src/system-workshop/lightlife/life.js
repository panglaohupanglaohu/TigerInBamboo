/**
 * life.js — 风、烟、动物接进场景管线（R68，Guide §10 R61–R70）。纯数据（Node / Worker 共用），全部读同一份虚拟体素空间（scene-voxels.js）。
 *   风   core/wind-flow.js traceWind：虚拟风粒子在共享体素里积分，撞到实心就先去掉竖直分量、再去掉水平分量、最后停在支撑面上，永远不进岩体
 *        （926903893866541057「my wind vectors … can be used by all kinds of systems」、931196707236392960 wind simulation）。
 *        风场本身（盛行风 + 迎风坡抬升）是这里的局部选择：帖子没公开原作的解算器，结构照帖子。
 *   烟   core/smoke-order.js smokeDepthOrder：烟团在两遍里各自按远到近排序（1015142746372366336「z-depth and draw order … 2 passes」）；
 *        烟源 = 区域图里每栋楼的最高格（烟囱），烟团随风场漂。
 *   动物 world/navmesh-flow.js 的导航面流场 + core/swarm-maze.js spawnSwarm（810157485638189056「fluid pathfinding on a triangle graph」、
 *        816748103193817088「flowing right on the nav mesh」）：小动物（螃蟹 / 鸡）在陆地导航面上像液体一样流向目标，不穿出导航面。
 * 输出都是关键帧（坐标 = 贴球舞台坐标，米），实景预览在 src/world/rea/lightlifeCandidate.js 里画。
 */
import { traceWind } from '../../../../townscaper-web/REACodeRefactoring/src/core/wind-flow.js';
import { smokeDepthOrder } from '../../../../townscaper-web/REACodeRefactoring/src/core/smoke-order.js';
import { buildNavMesh, locate, buildVertexField, buildFaceDirs, stepCrowd, heightAt } from '../../../../townscaper-web/REACodeRefactoring/src/world/navmesh-flow.js';
import { spawnSwarm } from '../../../../townscaper-web/REACodeRefactoring/src/core/swarm-maze.js';

const r2 = (v) => Math.round(v * 100) / 100;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** 体素空间的探针：某点所在格的地面高度、是否在实心里（traceWind 的 probes 接口） */
export function probesOf(V) {
  const { grid, world, n, step, L } = V, x0 = grid.x0, z0 = grid.z0;
  const cellAt = (x, z) => { const i = Math.floor((x - x0) / step), j = Math.floor((z - z0) / step); return i < 0 || j < 0 || i >= n || j >= n ? null : grid.cells[j * n + i]; };
  const groundY = (x, z) => { const c = cellAt(x, z); return c ? world.top(c) * L : 0; };
  return { cellAt, groundY, occupied: (x, y, z) => { const c = cellAt(x, z); if (!c) return false; const lv = Math.floor(y / L) + 1; return !!world.isSolid(c, lv); } };
}
/** 风场：盛行风（方位角 dir°，速度 speed）+ 迎风坡抬升（前方一格比当前高就向上吹）。 */
export function windField(V, { dir = 225, speed = 1.2 } = {}) {
  const P = probesOf(V), a = dir * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), look = V.step;
  return { ux, uz, speed, sample: (x, y, z) => { const ahead = P.groundY(x + ux * look, z + uz * look), lift = Math.max(0, Math.min(1.5, (ahead + 0.5 * V.L - y) / look)); return [ux * speed, lift * speed, uz * speed]; } };
}
export function windRun(V, { dir = 225, speed = 1.2, lines = 14, steps = 40 } = {}) {
  const P = probesOf(V), F = windField(V, { dir, speed }), { n, step, L, grid } = V, out = [];
  let blocked = 0, inside = 0, rise = 0;
  const span = n * step, cx = grid.x0 + span / 2, cz = grid.z0 + span / 2, ox = cx - F.ux * span * 0.55, oz = cz - F.uz * span * 0.55;
  for (let k = 0; k < lines; k++) {
    const t = (k + 0.5) / lines - 0.5, sx = ox - F.uz * t * span, sz = oz + F.ux * t * span, sy = P.groundY(sx, sz) + L * (0.6 + (k % 3) * 0.8);
    if (P.occupied(sx, sy, sz)) continue;
    const r = traceWind(F.sample, P, [sx, sy, sz], { steps, dt: step * 0.35 / speed });
    blocked += r.blocked; rise += r.points.at(-1)[1] - sy;
    for (const p of r.points) if (P.occupied(...p)) inside++;
    out.push(r.points.map((p) => p.map(r2)));
  }
  return { dir, speed, lines: out, metrics: { windLines: out.length, windBlocked: out.length ? r2(blocked / (out.length * steps)) : 0, windInside: inside, windRise: out.length ? r2(rise / out.length) : 0 } };
}

/** 烟：每个烟源一串烟团（frames 个时刻），随风漂、往上升、变大；最后一刻按固定正面机位做两遍远近排序。 */
export function smokeRun(V, sources, { wind = null, puffs = 10, rise = 0.9, spread = 0.12 } = {}) {
  const F = wind || windField(V), out = [];
  for (const [si, s] of sources.entries()) for (let k = 0; k < puffs; k++) {
    const age = k / puffs, t = age * 6, [vx, , vz] = F.sample(s.x, s.y + t * rise, s.z);
    out.push({ src: si, serial: si * 1000 + k, age: r2(age), x: r2(s.x + vx * t * 0.6), y: r2(s.y + t * rise), z: r2(s.z + vz * t * 0.6), r: r2(V.step * (0.18 + age * (0.5 + spread * 4))) });
  }
  // 固定机位：正面、略俯（视图矩阵，列主序；z 轴朝镜头），与实景 front 机位同方向
  const view = [1, 0, 0, 0, 0, 0.94, 0.34, 0, 0, -0.34, 0.94, 0, 0, 0, -60, 1];
  const thin = out.filter((p) => p.age < 0.5), thick = out.filter((p) => p.age >= 0.5);
  const order = [...smokeDepthOrder(thick, view), ...smokeDepthOrder(thin, view)].map((p) => p.serial);
  const top = out.length ? Math.max(...out.map((p) => p.y - sources[p.src].y)) : 0;
  return { sources: sources.map((s) => ({ x: r2(s.x), y: r2(s.y), z: r2(s.z), cell: s.cell })), puffs: out, order, view, metrics: { smokeSources: sources.length, smokePuffs: out.length, smokeRise: r2(top) } };
}

/** 陆地导航面：每个地形格（非建筑）的顶面两个三角，相邻且同高的格共用顶点（这样才连通）。 */
export function landNavMesh(V, site) {
  const { grid, world, n, step, L } = V, key = new Map(), verts = [], polys = [], cellOfPoly = [];
  const v = (i, j, lv) => { const k = (lv * (n + 1) + j) * (n + 1) + i; if (!key.has(k)) { key.set(k, verts.length); verts.push({ x: grid.x0 + i * step, y: lv * L, z: grid.z0 + j * step }); } return key.get(k); };
  const ccw = (vs) => { let s2 = 0; for (let k = 0; k < 3; k++) { const p = verts[vs[k]], q = verts[vs[(k + 1) % 3]]; s2 += p.x * q.z - q.x * p.z; } return s2 < 0 ? vs.slice().reverse() : vs; };
  for (const c of grid.cells) {
    const t = world.top(c); if (!t || (site.kind?.[c.id] ?? 1) === 2) continue;
    const a = v(c.i, c.j, t), b = v(c.i + 1, c.j, t), cc = v(c.i + 1, c.j + 1, t), d = v(c.i, c.j + 1, t);
    polys.push(ccw([a, b, cc]), ccw([a, cc, d])); cellOfPoly.push(c.id, c.id);
  }
  if (!polys.length) return null;
  const mesh = buildNavMesh(verts, polys), comp = new Int32Array(mesh.polys.length).fill(-1);
  let best = -1, bestN = 0;
  for (let s = 0, k = 0; s < mesh.polys.length; s++) { if (comp[s] >= 0) continue; const st = [s]; comp[s] = k; let cnt = 0; while (st.length) { const p = st.pop(); cnt++; for (const q of mesh.polys[p].nb) if (q >= 0 && comp[q] < 0) { comp[q] = k; st.push(q); } } if (cnt > bestN) { bestN = cnt; best = k; } k++; }
  mesh.component = comp; mesh.mainComponent = best; mesh.cellOfPoly = cellOfPoly; mesh.mainSize = bestN;
  return mesh;
}
export function animalsRun(V, site, { count = 24, frames = 12, stepsPer = 5, seed = 3 } = {}) {
  const mesh = landNavMesh(V, site);
  if (!mesh || mesh.mainSize < 6) return { agents: 0, frames: [], metrics: { animals: 0, animalsOnLand: 0, animalsLeft: 0, animalsTravel: 0 }, note: '陆地导航面太小' };
  const R = rng(seed + (site.seed || 0)), main = mesh.polys.filter((p) => mesh.component[p.id] === mesh.mainComponent);
  const a = main[Math.floor(R() * main.length)];
  let far = a, fd = -1; for (const p of main) { const d = Math.hypot(p.cx - a.cx, p.cz - a.cz); if (d > fd) { fd = d; far = p; } }
  const agents = spawnSwarm(mesh, count, { x: a.cx, z: a.cz, r: V.step * 2.5, seed: seed + 1 }, locate);
  for (const g of agents) g.y = mesh.polys[g.poly].plane.a * g.x + mesh.polys[g.poly].plane.b * g.z + mesh.polys[g.poly].plane.c;
  const field = buildVertexField(mesh, { goal: { x: far.cx, z: far.cz, r: V.step * 1.5 } }), faceDirs = buildFaceDirs(mesh, field), start = agents.map((g) => [g.x, g.z]);
  const out = [agents.map((g) => [r2(g.x), r2(g.y), r2(g.z)])]; let left = 0;
  for (let f = 1; f < frames; f++) {
    for (let s = 0; s < stepsPer; s++) left += stepCrowd(mesh, field, agents, 0.1, { speed: V.step * 0.9, radius: V.step * 0.12, faceDirs }).left;
    for (const g of agents) if (g.poly < 0) { let bp = main[0], bd = Infinity; for (const p of main) { const d = Math.hypot(p.cx - g.x, p.cz - g.z); if (d < bd) { bd = d; bp = p; } } g.x = bp.cx; g.z = bp.cz; g.poly = bp.id; g.vx = g.vz = 0; g.y = heightAt(mesh, bp.id, g.x, g.z); }
    out.push(agents.map((g) => [r2(g.x), r2(g.y), r2(g.z)]));
  }
  const onMesh = agents.filter((g) => g.poly >= 0).length, travel = agents.reduce((s, g, i) => s + Math.hypot(g.x - start[i][0], g.z - start[i][1]), 0) / Math.max(1, agents.length);
  return { agents: agents.length, goal: { x: r2(far.cx), z: r2(far.cz) }, frames: out, metrics: { animals: agents.length, animalsOnLand: agents.length ? r2(onMesh / agents.length) : 0, animalsLeft: left, animalsTravel: r2(travel) } };
}
