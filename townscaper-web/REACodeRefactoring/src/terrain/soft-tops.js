/**
 * soft-tops.js — continuous soft-slope surface on top of the integer World (r55).
 *
 * 1447488323845509121 "Properly combine seamless soft slopes with distinct sharp cliffs" /
 * REACode overhangterrain heightField + terracecliff fieldSmooth: the World stores whole levels only,
 * so the continuous field lives in the terrain-mesh layer. At every grid vertex whose surrounding cells
 * are all plain rock tops (no sea, river, lake, building, splice, cave or overhang), the cells are
 * grouped by "soft links" — same level, or a one-level step where both cells sit in the soft
 * province of World.slopeMask (no mask = every one-level step is soft). Each group shares one corner
 * height (the mean of its levels), so linked neighbours meet edge-to-edge with no wall: the 1-level
 * terrace steps melt into a continuous piecewise-linear slope, while unlinked steps (≥2 levels or
 * sharp province) keep their vertical cliff, stretched to the new corner heights.
 * Vertices touching anything that is not a plain top keep the exact level heights, so coastlines,
 * river banks, lakes and buildings are untouched.
 */
import { liveLakes } from './drainage.js';

export function softCorners(world, { L = 0.5 } = {}) {
  const cells = world.cells, grid = world.grid, mask = world.slopeMask ?? null;
  const lakeCell = new Set(liveLakes(world).flatMap((l) => l.cells));
  const plain = new Uint8Array(cells.length);
  for (const c of cells) {
    const g = world.ground(c);
    if (!g || world.river[c.id] || lakeCell.has(c.id) || world.splicedHouses?.get?.(c.id)) continue;
    const full = (1 << g) - 1;
    if (world.solid[c.id] !== full || world.rock[c.id] !== full) continue;   // contiguous bare rock column only
    plain[c.id] = 1;
  }
  const soft = (id) => !mask || mask[id] < 0.5;
  const linked = (a, b) => {
    if (!plain[a.id] || !plain[b.id]) return false;
    const d = Math.abs(world.ground(a) - world.ground(b));
    return d === 0 || (d === 1 && soft(a.id) && soft(b.id));
  };
  const Y = new Map(), key = (cid, vid) => cid * 1048576 + vid;
  let vertices = 0, groups = 0;
  for (const [vid, ids] of grid.vertexCells) {
    if (ids.length < 2 || ids.some((id) => !plain[id])) continue;
    if (ids.some((id) => { const c = cells[id]; return c.edgeNeighbors.some((o, i) => o < 0 && (c.pts[i].id === vid || c.pts[(i + 1) % c.n].id === vid)); })) continue;
    // all cells around this vertex must exist (no open map border) for a closed fan
    const vcells = ids.map((id) => cells[id]);
    const par = new Map(ids.map((id) => [id, id]));
    const find = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    for (const c of vcells) for (let i = 0; i < c.n; i++) {
      const o = c.edgeNeighbors[i];
      if (o < 0 || !par.has(o)) continue;
      const a = c.pts[i].id, b = c.pts[(i + 1) % c.n].id;
      if (a !== vid && b !== vid) continue;
      if (linked(c, cells[o])) par.set(find(c.id), find(o));
    }
    const byRoot = new Map();
    for (const id of ids) { const r = find(id); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(id); }
    let touched = false;
    for (const members of byRoot.values()) {
      const lv = members.map((id) => world.ground(cells[id]));
      if (Math.min(...lv) === Math.max(...lv)) continue;
      const y = (lv.reduce((s, v) => s + v, 0) / lv.length) * L;
      for (const id of members) Y.set(key(id, vid), y);
      groups++; touched = true;
    }
    if (touched) vertices++;
  }
  return {
    vertices, groups, plain, linked,
    /** corner height of cell c at grid vertex p, or undefined when it is the exact level height */
    y: (cid, vid) => Y.get(key(cid, vid)),
    has: (cid, vid) => Y.has(key(cid, vid)),
  };
}
