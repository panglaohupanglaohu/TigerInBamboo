/**
 * relax.js — cells pulling themselves towards a desired size.
 *
 * Source note (x.com/OskSta/status/1769641473895432220):
 *
 *   "In cute tile based planets like this you often get a 'mushrooming' issue
 *    where tall mountains get weirdly wide. I managed to mitigate this by a
 *    relax pass where all module-containing cells try to achieve their desired
 *    shape and size. Note the cells on the top left contracting."
 *
 * The problem: a height field that is quantised to whole modules wants *width*
 * to express height. Tall columns end up fat, and the island looks inflated
 * rather than steep.
 *
 * The fix is not another smoothing pass — it is a per-cell target. Each cell
 * over a certain height has a desired area that shrinks as the column rises, and
 * every vertex shared by those cells moves to reduce its cell's area error. The
 * step is deliberately small and clamped: this is a relax, and an aggressive
 * version folds quads inside out.
 */

const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
};

/**
 * @param {object} grid  quad grid (cell.pts are shared point objects)
 * @param {(cell:object)=>number} heightOf  column height per cell
 * @param {object} opts
 */
export function relaxCellAreas(grid, heightOf, {
  passes = 3,
  strength = 0.18,
  shrinkPerLevel = 0.06,   // desired area lost per level of height
  maxStep = 0.035,         // world units per pass; keeps quads from folding
  minHeight = 2,           // cells below this do not aim for anything
} = {}) {
  // vertex -> owning cells (the quad grid shares point objects, so identity works)
  const owners = new Map();
  for (const cell of grid.cells) {
    for (const p of cell.pts) {
      let list = owners.get(p);
      if (!list) owners.set(p, (list = []));
      list.push(cell);
    }
  }

  const heights = new Map();
  let maxH = 1;
  for (const cell of grid.cells) {
    const h = heightOf(cell);
    heights.set(cell, h);
    if (h > maxH) maxH = h;
  }

  const centres = new Map();
  for (const cell of grid.cells) {
    let cx = 0, cz = 0;
    for (const p of cell.pts) { cx += p.x; cz += p.z; }
    centres.set(cell, { x: cx / cell.pts.length, z: cz / cell.pts.length });
  }

  const desired = (cell) => {
    const h = heights.get(cell);
    const a0 = area(cell.pts);
    if (h < minHeight) return a0;
    // the taller the column, the smaller it wants to be
    const k = Math.min(0.4, (h - minHeight + 1) * shrinkPerLevel);
    return a0 * (1 - k);
  };

  let moved = 0;

  for (let pass = 0; pass < passes; pass++) {
    const next = new Map();

    for (const [p, cells] of owners) {
      let dx = 0, dz = 0;
      for (const cell of cells) {
        const a = area(cell.pts);
        const want = desired(cell);
        if (a <= 1e-6) continue;
        // positive when the cell is fatter than it wants to be
        const excess = (a - want) / a;
        if (Math.abs(excess) < 0.02) continue;
        const c = centres.get(cell);
        // move towards the centre to shrink, away to grow
        dx += (c.x - p.x) * excess;
        dz += (c.z - p.z) * excess;
      }
      const n = cells.length || 1;
      dx = (dx / n) * strength;
      dz = (dz / n) * strength;

      const len = Math.hypot(dx, dz);
      if (len > maxStep) { dx = (dx / len) * maxStep; dz = (dz / len) * maxStep; }
      if (len > 1e-5) { next.set(p, { x: p.x + dx, z: p.z + dz }); moved++; }
    }

    for (const [p, to] of next) { p.x = to.x; p.z = to.z; }

    // bounds are consumed by the cell index; refresh them once per pass
    for (const cell of grid.cells) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of cell.pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      cell.minX = minX; cell.maxX = maxX; cell.minZ = minZ; cell.maxZ = maxZ;
      cell.cx = (minX + maxX) / 2;
      cell.cz = (minZ + maxZ) / 2;
    }
  }

  return { moved, passes };
}
