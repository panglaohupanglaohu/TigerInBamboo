/**
 * scenes-r56.js — 第 56 批 C05-D 的对照场景（测试与演示页共用；都写进共享 World 体素，不是手摆网格）。
 *  steelScene：仿 1257213678056857600 frame-0080 —— 石码头上一栋白屋，旁边一栋红屋悬在高处，
 *              靠白屋那侧的腿落到白屋屋面上（曲柄），另一侧长腿落到码头；外加仿 1189902695303458816 的
 *              多体块高架（相邻悬空体块共腿、不同高度、一栋矮屋夹在中间）。
 *  yardScene： 仿 1238474550511308800 —— 一圈 3 层排屋围出的后院（garden.html 同款构造，半径可调）。
 */
const nearest = (grid, x, z) => grid.cells.reduce((a, c) => ((c.cx - x) ** 2 + (c.cz - z) ** 2 < (a.cx - x) ** 2 + (a.cz - z) ** 2 ? c : a));
function ring(world, start, depth) {
  const d = new Map([[start.id, 0]]), q = [start];
  for (let i = 0; i < q.length; i++) { const c = q[i], k = d.get(c.id); if (k >= depth) continue; for (let j = 0; j < c.n; j++) { const o = world.neighbor(c, j); if (o && !d.has(o.id)) { d.set(o.id, k + 1); q.push(o); } } }
  return { d, q };
}
export function steelScene(world, { x = 0, z = 0, palette = [0, 3, 1, 4] } = {}) {
  world.reset();
  const grid = world.grid, col = (c, k) => { world.color[c.id] = k % (world.palette?.colors?.length ?? 5); };
  // A：1257 —— 码头 2 环；白屋在 b（2..4 层，有坡顶）；红屋 a 悬在 6..7 层
  const a = nearest(grid, x, z), { q } = ring(world, a, 1);
  for (const c of q) world.setSolid(c, 1, true);
  const b = world.neighbor(a, 0) ?? q[1];
  for (let l = 2; l <= 4; l++) world.setSolid(b, l, true); col(b, palette[1]);
  for (let l = 6; l <= 7; l++) world.setSolid(a, l, true); col(a, palette[0]);
  // B：1189 —— 东侧一片码头上三块悬空体（两块 8..9 相邻共腿，一块 6 层），中间一栋 3 层矮屋
  const s = nearest(grid, x + 6, z + 1), R = ring(world, s, 2);
  for (const c of R.q) world.setSolid(c, 1, true);
  const s1 = world.neighbor(s, 1) ?? R.q[2], s2 = world.neighbor(s, 2) ?? R.q[3];
  for (const c of [s, s1]) { for (let l = 8; l <= 9; l++) world.setSolid(c, l, true); col(c, palette[2]); }
  const s3 = world.neighbor(s2, 2) ?? R.q[5];
  world.setSolid(s3, 6, true); col(s3, palette[3]);
  for (let l = 2; l <= 3; l++) world.setSolid(s2, l, true); col(s2, palette[1]);
  world.touch();
  return { a: a.id, b: b.id, tower: [s.id, s1.id], low: s2.id, mid: s3.id };
}
export function yardScene(world, { x = 0, z = 0, depth = 4, colors = 5 } = {}) {
  world.reset();
  const start = nearest(world.grid, x, z), { d, q } = ring(world, start, depth);
  for (const c of q) world.setSolid(c, 1, true);
  const wall = [];
  for (const c of q) for (let j = 0; j < c.n; j++) { const o = world.neighbor(c, j); if (o && !d.has(o.id) && !wall.includes(o)) wall.push(o); }
  wall.forEach((o, i) => { for (let l = 1; l <= 3; l++) world.setSolid(o, l, true); world.color[o.id] = i % colors; });
  world.touch();
  return { start: start.id, yard: q.map((c) => c.id), wall: wall.map((c) => c.id) };
}
