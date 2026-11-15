/**
 * canal-scene-r56.js — 运河小镇演示场景（第 56 批 C05·C；只给演示页 / 测试用，不进 SCENES 表）。
 *
 * 对照 806904557502464000：石砌码头平台中间横穿一条一格宽的水渠，渠上有码头面连续过去的拱桥，
 * 两岸塔楼在高处用一段跨渠楼体相连（楼体下面是 World 已有的拱，buildings.js underside），
 * 另有一座 4 层的“教堂”楼（1275089608758484992 的高拱龛门）与若干排屋。
 * 全部只写 World 体素与 color，几何仍由共享 buildings.js 生成。
 */
import { canalBridgeAxis } from './canal-bridge-r56.js';

export function buildCanalTown(world, { radius = 4.6, bridges = 'auto', seed = 3, axisEdge = 1 } = {}) {
  world.reset?.();
  const cells = world.cells, nb = (c, i) => world.neighbor(c, ((i % c.n) + c.n) % c.n);
  const quay = new Set();
  for (const c of cells) if (c.n === 4 && Math.hypot(c.cx, c.cz) < radius) { world.fill(c, 1); quay.add(c.id); }
  // 1) 水渠：从平台中心那一格出发，沿四边形“对边”向两头直走，直到出平台 → 一条贯穿平台的一格宽水渠
  const c0 = [...quay].map((id) => cells[id]).sort((p, q) => Math.hypot(p.cx, p.cz) - Math.hypot(q.cx, q.cz))[0];
  const seen = new Set([c0.id]);
  const walk = (exit) => { const out = []; let cur = c0, e = exit; for (let n = 0; n < 40; n++) { const nxt = nb(cur, e); if (!nxt || nxt.n !== 4 || !quay.has(nxt.id) || seen.has(nxt.id)) break; seen.add(nxt.id); const back = nxt.edgeNeighbors.indexOf(cur.id); out.push({ c: nxt, back }); cur = nxt; e = back + 2; } return out; };
  const e0 = axisEdge;
  const fwd = walk(e0 + 2), bwd = walk(e0);
  // strip[j].inEdge = 朝 j−1 那条边（水流轴一端）
  const strip = [...bwd.reverse().map(({ c, back }) => ({ c, inEdge: (back + 2) % 4 })), { c: c0, inEdge: e0 % 4 }, ...fwd.map(({ c, back }) => ({ c, inEdge: back }))];
  if (bridges === 'auto') bridges = [Math.round(strip.length * 0.25), Math.round(strip.length * 0.78)];
  const bridgeSet = new Set(bridges.filter((j) => j > 0 && j < strip.length - 1));
  strip.forEach(({ c }, j) => { if (!bridgeSet.has(j)) world.fill(c, 0); });
  const side = (j, s) => { const { c, inEdge: e } = strip[j]; return nb(c, e + (s > 0 ? 1 : 3)); };
  const paint = (c, k) => { world.color[c.id] = k; };
  const canalIds = new Set(strip.map((s) => s.c.id));
  const free = (c) => c && quay.has(c.id) && !canalIds.has(c.id) && world.top(c) === 1;
  // 2) 两岸塔楼 + 跨渠楼体（塔高 5，渠上 4–5 层是楼体，下面留拱）
  const mid = Math.max(1, Math.min(strip.length - 2, [...Array(strip.length).keys()].find((j) => j > 2 && !bridgeSet.has(j) && !bridgeSet.has(j - 1) && !bridgeSet.has(j + 1)) ?? 3));
  const towers = [];
  for (const s of [1, -1]) { const t = side(mid, s); if (free(t)) { world.fill(t, 5); paint(t, 2); towers.push(t.id); } }
  if (towers.length === 2) { const c = strip[mid].c; world.setSolid(c, 4, true); world.setSolid(c, 5, true); paint(c, 2); }
  // 3) 教堂：远离水渠的一块 2 格高楼（4 层），门朝开阔码头
  const dist = (c) => Math.min(...strip.map((s) => Math.hypot(s.c.cx - c.cx, s.c.cz - c.cz)));
  const far = [...quay].map((id) => cells[id]).filter((c) => free(c) && dist(c) > 2.2 && Math.hypot(c.cx, c.cz) < radius - 1.3).sort((a, b) => a.cz - b.cz || a.cx - b.cx);
  const church = far[0] ?? null, churchCells = [];
  if (church) {
    world.fill(church, 4); paint(church, 0); churchCells.push(church.id);
    for (let i = 0; i < 4; i++) { const o = nb(church, i); if (free(o) && dist(o) > 1.6) { world.fill(o, 3); paint(o, 0); churchCells.push(o.id); break; } }
  }
  // 4) 排屋：沿渠两岸零散 2–3 层
  let k = 0;
  for (let j = 0; j < strip.length; j++) for (const s of [1, -1]) {
    if (Math.abs(j - mid) <= 1 || bridgeSet.has(j)) continue;
    const t = side(j, s), h = 2 + (((j * 7 + (s > 0 ? 3 : 0) + seed) % 3) === 0 ? 1 : 0);
    const back = t && nb(t, t.edgeNeighbors.indexOf(strip[j].c.id) + 2);
    if (((j + seed + (s > 0 ? 1 : 0)) % 2) === 0 && free(back)) { world.fill(back, h); paint(back, [1, 3, 4, 5][k++ % 4]); }
  }
  world.touch();
  const bridgeCells = strip.filter(({ c }) => canalBridgeAxis(world, c) >= 0).map(({ c }) => c.id);
  return { strip: strip.map((s) => s.c.id), bridges: bridgeCells, towers, mid: strip[mid]?.c.id, church: church?.id ?? null, churchCells };
}
