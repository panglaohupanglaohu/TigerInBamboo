/**
 * island.js — Bad North 的小岛，写进共享 World（之后的网格 / 平滑 / 植被 / 导航全走共享管线）。
 *
 * 依据：
 *   REACode/BADNORTH-REA.md (2)：岛是"叠层岩板"，高度量化成台阶；一座岛约 80–150 格。
 *   官网 summer1 截图：一座主台地 + 两三级矮台 + 一圈沙滩 + 一根孤立石柱 + 海里一两块礁石，
 *   台地上几座白墙绿顶的小屋，崖脚一团树。
 *   917405214638006273 "a heuristic for deliberately generating navigable levels"：
 *     画面是一个个"能走上去"的台阶（黄色的可走连线）。→ 生成后检查：每块台地都要能从海滩走上去
 *     （相邻台阶差 ≤ 2 层，用 navgraph 验证），走不到的台地削低一档。
 */

import { fbm, makeRng } from '../core/noise.js';
import { buildNav } from '../world/navgraph.js';

export function generateBadNorth(world, seed = 7) {
  world.reset();
  const rng = makeRng(seed * 53 + 1);
  const cells = world.cells;
  const R = 5.4;
  const ox = (rng() - 0.5) * 0.8, oz = (rng() - 0.5) * 0.8;
  const ang = rng() * Math.PI;
  // 1. 高度：被拉长的椭圆 + 噪声，量化成 0 / 1（沙滩）/ 2 / 4 / 6
  for (const c of cells) {
    const x = c.cx - ox, z = c.cz - oz;
    const u = x * Math.cos(ang) + z * Math.sin(ang), v = -x * Math.sin(ang) + z * Math.cos(ang);
    const d = Math.hypot(u / 1.15, v / 0.85) / R;
    const n = fbm(c.cx * 0.22 + seed, c.cz * 0.22 - seed, { octaves: 3, freq: 1.4, seed });
    const e = 1 - d + (n - 0.5) * 0.55;
    if (e < 0.06) continue;
    const lv = e < 0.16 ? 1 : e < 0.38 ? 2 : e < 0.58 ? 4 : 6;
    world.fill(c, lv, { rock: true });
  }
  // 2. 孤立石柱（截图左边那根）+ 海里的礁石
  const coast = cells.filter((c) => world.top(c) === 0 && c.edgeNeighbors.some((id) => id >= 0 && world.top(cells[id]) >= 1));
  if (coast.length) world.fill(coast[(rng() * coast.length) | 0], 6, { rock: true });
  for (let k = 0; k < 2; k++) {
    const far = cells.filter((c) => world.top(c) === 0 && Math.hypot(c.cx - ox, c.cz - oz) > R * 1.15 && Math.hypot(c.cx - ox, c.cz - oz) < R * 1.45);
    if (far.length) world.fill(far[(rng() * far.length) | 0], 1, { rock: true });
  }
  // 3. 可走性：每块台地都要能从沙滩走上去（917405214638006273）
  for (let pass = 0; pass < 6; pass++) {
    const beach = cells.find((c) => world.top(c) === 1);
    if (!beach) break;
    const nav = buildNav(world, { start: beach });
    let fixed = 0;
    for (const c of cells) {
      const t = world.top(c);
      if (t >= 2 && !Number.isFinite(nav.tree.time[c.id])) { world.fill(c, t - 2, { rock: true }); fixed++; }
    }
    if (!fixed) break;
  }
  // 4. 小屋：台地上（≥2 层）四周平的格子，挑 3–5 个，彼此隔开；墙色 -1 = 主题的白墙
  const flat = cells.filter((c) => { const g = world.ground(c); return g >= 2 && world.top(c) === g && c.edgeNeighbors.every((id) => id >= 0 && world.ground(cells[id]) === g); });
  const houses = [];
  for (let tries = 0; tries < 200 && houses.length < 4 + ((rng() * 2) | 0); tries++) {
    const c = flat[(rng() * flat.length) | 0];
    if (!c || houses.some((h) => Math.hypot(h.cx - c.cx, h.cz - c.cz) < 2.2)) continue;
    const g = world.ground(c);
    world.setSolid(c, g + 1, true);
    world.color[c.id] = -1;
    // 有的小屋多一格（L 形 / 长条）
    if (rng() < 0.5) { const o = cells[c.edgeNeighbors[(rng() * c.n) | 0]]; if (o && world.top(o) === g) { world.setSolid(o, g + 1, true); world.color[o.id] = -1; } }
    houses.push(c);
  }
  world.touch();
  world.bnHouses = houses;
  return { houses: houses.length };
}
