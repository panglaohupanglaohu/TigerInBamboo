/** r55 housekit 撒村接口（REACode/housekit buildVillage + makeHouse，781027725452648448 "House kit"）。
 * 原版在空地上撒随机矩形；共享 World 里占地由格子决定，所以这里在地形平台上挑平整、无河、
 * 不贴已有建筑的格，每栋 1–3 格（沿边相邻生长），层数取 FLOORS 池，坡度取 8 档 PITCHES 池中
 * 满足原版 ratioOK（屋顶抬升 / 墙高 ∈ [0.20, 0.95]）的一档，按概率配茅草顶。
 * 写进 World 体素（非岩石实心层）+ world.roofSpecs（cellId → {pitch, thatch, floors, house}），
 * 屋顶由 buildings.js 读取（hipSkeleton 打开时茅草才有分条几何）。 */
import { PITCHES, FLOORS, pitchPool } from '../core/house-kit.js';
import { makeRng } from '../core/noise.js';

export function scatterVillage(world, { seed = 7, count = 10, maxCells = 3, thatchShare = 0.65, colors = [0, 1, 3, 2, 7], L = 0.5, minGround = 2 } = {}) {
  const rng = makeRng(seed * 977 + 13), cells = world.cells;
  const nb = (c, i) => world.neighbor(c, i);
  const flat = (c) => {
    const g = world.ground(c);
    if (g < minGround || world.top(c) !== g || world.river[c.id]) return false;
    for (let i = 0; i < c.n; i++) { const o = nb(c, i); if (!o || world.ground(o) !== g || world.river[o.id]) return false; }
    return true;
  };
  const taken = new Set();
  const free = (c) => flat(c) && !taken.has(c.id) && c.edgeNeighbors.every((id) => id < 0 || !taken.has(id)) && [...Array(c.n).keys()].every((i) => { const o = nb(c, i); return !o || world.top(o) === world.ground(o); });
  const pool = cells.filter(flat);
  const houses = [];
  world.roofSpecs ??= new Map();
  let attempts = 0;
  while (houses.length < count && attempts++ < count * 40 && pool.length) {
    const seedCell = pool[(rng() * pool.length) | 0];
    if (!free(seedCell)) continue;
    const g = world.ground(seedCell), want = 1 + ((rng() * maxCells) | 0), members = [seedCell], ids = new Set([seedCell.id]);
    while (members.length < want) {
      const opts = [];
      for (const m of members) for (let i = 0; i < m.n; i++) { const o = nb(m, i); if (o && !ids.has(o.id) && free(o) && world.ground(o) === g && o.edgeNeighbors.every((id) => id < 0 || ids.has(id) || !taken.has(id))) opts.push(o); }
      if (!opts.length) break;
      const o = opts[(rng() * opts.length) | 0]; members.push(o); ids.add(o.id);
    }
    const floors = FLOORS[(rng() * FLOORS.length) | 0];
    // footprint depth ≈ smallest cell inradius proxy: sqrt(area)
    const area = members.reduce((s, c) => { let a = 0; for (let i = 0; i < c.n; i++) { const p = c.pts[i], q = c.pts[(i + 1) % c.n]; a += p.x * q.z - q.x * p.z; } return s + Math.abs(a) / 2; }, 0) / members.length;
    const ok = pitchPool(Math.sqrt(area), floors * L), pitch = ok.length ? ok[(rng() * ok.length) | 0] : PITCHES[4];
    const thatch = rng() < thatchShare, color = colors[(rng() * colors.length) | 0], house = houses.length;
    for (const c of members) {
      for (let lv = g + 1; lv <= g + floors; lv++) world.setSolid(c, lv, true);
      world.color[c.id] = color;
      world.roofSpecs.set(c.id, { pitch, thatch, floors, house });
      taken.add(c.id);
    }
    houses.push({ house, cells: members.map((c) => c.id), ground: g, floors, pitch, thatch, pitchPool: ok, color });
  }
  world.touch();
  world.village = { seed, houses };
  return world.village;
}
