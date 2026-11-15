/**
 * 第 56 批 C02：北境岛的「洞穴 tileset」变体（默认关；URL `?bncaves=1` 或 generateBadNorth(world, seed, { caves: n })）。
 *
 *   906416813810049025 "New cave tileset. These levels really challenge your spacial skills"
 *   906425294533394432 "It's like navigating a Swiss cheese"
 *   片中紫色厚岩体被掏出一个个拱洞：洞底与沙滩 / 低台同高，可以从洞里穿到岩体另一侧；洞顶上面仍是可站的高台，
 *   于是同一格上下有两层可走面（洞底 + 洞顶），战斗在两层同时发生。
 *
 * 做法（与 terrain/generate.js 第 7 步洞窟同一套体素规则，只是挑格更讲究）：
 *   从「高台（top ≥ 4）且有一个低邻格（top ≤ 2）」的崖脚格出发，朝高台内部走 2–4 格，
 *   优先走向**另一侧也有低邻格**的格（= 穿山拱），把洞口外低地高度 f 之上的 f+1、f+2 两层挖空（洞底与洞外平接，
 *   f+3 以上留作洞顶，不够厚就补 1 层岩）。洞顶厚度至少 1 层，净空 2 层 = 1.0（> 单位身高 0.42），
 *   所以共享 BattleNavigation / layerednav 会在这些格上同时生成洞底节点与洞顶节点。
 * 只改共享 World 的体素位；网格 / 导航 / 战斗全走原管线。
 */
import { makeRng } from '../core/noise.js';

export function carveBadNorthCaves(world, seed = 7, { count = 2, maxLen = 4 } = {}) {
  const rng = makeRng(seed * 97 + 13), cells = world.cells, nb = (c) => c.edgeNeighbors.filter((id) => id >= 0).map((id) => cells[id]);
  // 洞底 f = 洞口外那块低地的高度（沙滩 1 / 低台 2），挖 f+1、f+2 两层 → 洞底与洞外平接；洞顶至少 1 层：
  // 高台只有 f+2 层厚（北境常见的 4 层台紧挨 2 层台）时，在洞顶上补 1 层岩（片中洞穴岛的岩体本来就是鼓起来的厚岩包）
  const low = (c, f) => world.top(c) >= 1 && world.top(c) <= f + 1 && world.top(c) >= f;
  const high = (c, f, carved) => world.top(c) >= f + 2 && !carved.has(c.id) && world.isSolid(c, f + 1) && world.isSolid(c, f + 2) && world.isSolid(c, f);
  const starts = [];
  for (const c of cells) for (const f of [1, 2]) if (high(c, f, new Set()) && nb(c).some((o) => world.top(o) === f)) { starts.push([c, f]); break; }
  const tunnels = []; const used = new Set();
  for (let n = 0; n < count && starts.length; n++) {
    let best = null;
    for (let tries = 0; tries < 32; tries++) {
      const [s, f] = starts[(rng() * starts.length) | 0]; if (used.has(s.id)) continue;
      const mouth = nb(s).filter((o) => world.top(o) === f);
      const path = [s], carved = new Set([s.id]); let cur = s, through = false;
      // 起点自己若另一侧就有低地（薄岩墙），一格就是穿山拱
      if (nb(s).some((o) => low(o, f) && !mouth.includes(o) && nb(o).every((q) => !mouth.includes(q)))) through = true;
      for (let step = 1; step < maxLen && !through; step++) {
        // 下一格：仍是够厚的高台；有「另一侧低邻」的优先（穿山）
        const cand = nb(cur).filter((o) => high(o, f, carved) && !used.has(o.id));
        if (!cand.length) break;
        cand.sort((a, b) => (nb(b).filter((o) => low(o, f)).length - nb(a).filter((o) => low(o, f)).length) || (rng() - 0.5));
        cur = cand[0]; path.push(cur); carved.add(cur.id);
        if (nb(cur).some((o) => low(o, f) && !mouth.includes(o) && !carved.has(o.id))) { through = true; break; }
      }
      const score = path.length + (through ? 10 : 0);
      if (!best || score > best.score) best = { path, through, score, f };
      if (through && path.length >= 2) break;
    }
    if (!best) break;
    for (const c of best.path) {
      if (world.top(c) < best.f + 3) world.setSolid(c, best.f + 3, true, { rock: true });   // 补洞顶
      world.setSolid(c, best.f + 1, false); world.setSolid(c, best.f + 2, false); used.add(c.id); for (const o of nb(c)) used.add(o.id);
    }
    tunnels.push({ cells: best.path.map((c) => c.id), through: best.through, floor: best.f });
  }
  world.touch();
  world.bnCaves = tunnels;
  return tunnels;
}

/** URL 开关（浏览器里 `?bncaves=1|2|3`），node 里返回 0。 */
export function cavesFromUrl() {
  const v = new URLSearchParams(globalThis.location?.search ?? '').get('bncaves');
  return v == null ? 0 : Math.max(0, Math.min(6, parseInt(v, 10) || 0));
}
