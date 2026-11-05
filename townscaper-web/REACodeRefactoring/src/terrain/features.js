/**
 * features.js — 地形"特征"：悬垂、岩石拱、海中石柱、强制放置的大模块。
 *
 * 依据：
 *   1671808851895627776 "If your terrain generator supports overhangs you gotta flaunt it."
 *     画面：崖顶的岩石往外伸出一截，底下是空的。
 *   1670794261669769217 "this lovely rock feature … sometimes you build a cool tile and it wont show up in forever,
 *     since it's conditions are so specific … and then suddenly: poof!"  画面：两根岩柱之间架着一道天然石拱。
 *   1708815475801505819 "a cool cliff I came across"：斜向崖脊/柱群和小屋；本地蘑菇石扩展并非该片已证实的生成法。
 *   1751932427272909032 "force specific modules to appear. To do this I first generate the specific bit of grid they need.
 *     A large module like this would be highly unlikely to appear by chance"  画面：岛中央一座带尖塔的教堂。
 *
 * World 本来就允许"岩石体素下面是空的"（洞窟），所以悬垂 / 拱只是往空中写岩石位；
 * terrainmesh.js 会画出它们的侧壁、底面（洞顶）和下面那块地面。
 * 强制模块：先找一块"差不多平"的台地，把它压平到同一高度（= 先生成它需要的那一小块地），再把教堂写进去。
 */

import { makeRng } from '../core/noise.js';

export function addFeatures(world, { seed = 7, overhangs = 4, arches = 1, stacks = 3 } = {}) {
  const rng = makeRng(seed * 977 + 13);
  const cells = world.cells;
  const nb = (c, i) => world.neighbor(c, i);
  const g = (c) => world.ground(c);
  const out = { overhangs: 0, arches: 0, stacks: 0, at: [] };   // at: 每个特征的 [种类, cellId]（调试 / 镜头用）

  /* ---- 悬垂：崖顶往外伸一格，底下留空 ---- */
  const lips = [];
  for (const c of cells) {
    const h = g(c);
    if (h < 4 || world.top(c) !== h || world.river[c.id]) continue;
    for (let i = 0; i < c.n; i++) {
      const o = nb(c, i);
      if (o && g(o) <= h - 3 && world.top(o) === g(o) && !world.river[o.id]) lips.push([c, o, h]);
    }
  }
  for (let k = 0; k < overhangs && lips.length; k++) {
    const [c, o, h] = lips.splice((rng() * lips.length) | 0, 1)[0];
    if (world.top(o) >= h) continue;
    world.setSolid(o, h, true, { rock: true });            // 只写最上面一层 → 下面是空的
    out.overhangs++; out.at.push(['overhang', o.id]);
  }

  /* ---- 岩石拱：两根足够高的岩柱之间架一道 ---- */
  const tall = cells.filter((c) => g(c) >= 5 && world.top(c) === g(c));
  for (let tries = 0; tries < 400 && out.arches < arches && tall.length > 1; tries++) {
    const a = tall[(rng() * tall.length) | 0];
    // 从 a 往随机方向走 2–4 格，找另一根柱子，中间要低（下面能穿过去）
    let cur = a, path = [];
    const dir = (rng() * a.n) | 0;
    let edge = dir;
    for (let s = 0; s < 4; s++) {
      const nx = nb(cur, edge);
      if (!nx) break;
      const back = cur.edgeTwins ? cur.edgeTwins[edge] : -1;
      cur = nx;
      if (g(cur) >= 5 && path.length >= 1) {
        const h = Math.min(g(a), g(cur));
        if (path.every((p) => g(p) <= h - 2 && world.top(p) === g(p))) {
          // 拱至少留一层空：底下差 2 层 → 拱厚 1，差 ≥3 → 拱厚 2
          for (const p of path) { world.setSolid(p, h, true, { rock: true }); if (g(p) <= h - 3) world.setSolid(p, h - 1, true, { rock: true }); }
          out.arches++; out.at.push(['arch', path[0].id]);
        }
        break;
      }
      path.push(cur);
      // 直着走：方格走对边，三角格随便拐
      edge = cur.n === 4 && back >= 0 ? (back + 2) % 4 : (rng() * cur.n) | 0;
    }
  }

  /* ---- 海中石柱：离岸 1–3 格的水里竖一根，顶上压一块更宽的 ---- */
  const water = cells.filter((c) => world.top(c) === 0 && c.edgeNeighbors.every((id) => id >= 0));
  const nearCoast = (c, d) => {
    let frontier = [c], seen = new Set([c.id]);
    for (let s = 0; s < d; s++) {
      const next = [];
      for (const x of frontier) for (let i = 0; i < x.n; i++) { const o = nb(x, i); if (!o || seen.has(o.id)) continue; if (world.top(o) > 0) return true; seen.add(o.id); next.push(o); }
      frontier = next;
    }
    return false;
  };
  for (let tries = 0; tries < 200 && out.stacks < stacks && water.length; tries++) {
    const c = water[(rng() * water.length) | 0];
    if (world.top(c) || nearCoast(c, 1) || !nearCoast(c, 3)) continue;
    const h = 4 + ((rng() * 3) | 0);
    world.fill(c, h, { rock: true });
    // 一格的柱子会被形状平滑削成细杆 → 邻居给一圈矮一截的基座（浪蚀的台脚），
    // 再让最上面一层往一两个邻居伸出去 = 蘑菇帽
    for (let i = 0; i < c.n; i++) {
      const o = nb(c, i);
      if (!o || world.top(o) !== 0) continue;
      world.fill(o, Math.max(1, h - 2 - ((rng() * 2) | 0)), { rock: true });
      if (rng() < 0.45) world.setSolid(o, h, true, { rock: true });
    }
    out.stacks++; out.at.push(['stack', c.id]);
  }
  world.touch();
  return out;
}

/**
 * 强制放置一座教堂（1751932427272909032）：
 *   1) 找一块"差不多平"的台地（中心格周围两圈内高度差 ≤ 1、没有河）
 *   2) 把这块地压平到同一高度 —— "先生成它需要的那一小块"
 *   3) 中殿：一排 3 格、高 2 层；钟楼：中殿一端的一格、高 5 层（孤立的高格子自动得到尖顶）
 */
export function forceChurch(world, { seed = 7, color = 3 } = {}) {
  const rng = makeRng(seed * 131 + 5);
  const cells = world.cells;
  const g = (c) => world.ground(c);
  const ring = (c, r) => {
    const set = new Set([c.id]);
    let frontier = [c];
    for (let s = 0; s < r; s++) {
      const next = [];
      for (const x of frontier) for (const id of x.edgeNeighbors) if (id >= 0 && !set.has(id)) { set.add(id); next.push(cells[id]); }
      frontier = next;
    }
    return [...set].map((id) => cells[id]);
  };
  let best = null, bestScore = -1;
  for (const c of cells) {
    const h = g(c);
    if (h < 2 || world.top(c) !== h || world.river[c.id]) continue;
    const area = ring(c, 2);
    if (area.some((x) => !g(x) || world.river[x.id] || Math.abs(g(x) - h) > 1 || world.top(x) !== g(x))) continue;
    const score = area.length + rng() * 2 + h * 0.3;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best) return null;
  const h = g(best);
  const area = ring(best, 2);
  for (const x of area) world.fill(x, h, { rock: true });           // 压平
  // 中殿：从中心沿一条直线走 3 格（方格走对边）
  const nave = [best];
  let cur = best, edge = (rng() * best.n) | 0;
  while (nave.length < 3) {
    const id = cur.edgeNeighbors[edge];
    if (id < 0) break;
    const nx = cells[id];
    if (!area.includes(nx)) break;
    const back = cur.edgeTwins[edge];
    nave.push(nx);
    cur = nx;
    edge = nx.n === 4 ? (back + 2) % 4 : (back + 1) % nx.n;
  }
  for (const x of nave) { for (let lv = h + 1; lv <= h + 2; lv++) world.setSolid(x, lv, true); world.color[x.id] = color; }
  // 钟楼：中殿末端外面一格
  const end = nave[nave.length - 1];
  const towerCell = end.edgeNeighbors.map((id) => (id >= 0 ? cells[id] : null)).find((x) => x && area.includes(x) && !nave.includes(x)) || end;
  for (let lv = h + 1; lv <= h + 5; lv++) world.setSolid(towerCell, lv, true);
  world.color[towerCell.id] = color;
  world.touch();
  return { center: best, nave, tower: towerCell, flattened: area.length };
}
