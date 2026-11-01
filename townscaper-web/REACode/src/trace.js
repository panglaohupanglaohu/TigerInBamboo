/**
 * trace.js — topologically straight lines across the grid, by cell.
 *
 * Source note (x.com/OskSta/status/1384958097542819845):
 *
 *   "I wrote a script to trace topologically straight lines across the
 *    Townscaper grid. I think I'll use it for a thing in the gamepad controls
 *    and possibly some drag-to-paint mode."
 *
 * "Topologically straight" is not "geometrically straight": the grid is
 * irregular, so a line that keeps going in the same *direction* would drift off
 * the lattice within two cells. What is straight here is the *walk* — enter a
 * cell through one edge, leave through the edge that is most nearly parallel to
 * it. Every step is a legal move (cells are neighbours), so the line never
 * leaves the grid, and because the choice is made by direction rather than by
 * screen position, it survives rotation and zoom unchanged.
 *
 * Two things the note's wording forces on the implementation, both found by
 * measuring rather than by reading:
 *
 *   1. Local parallelism alone is not enough. On a closed rim the walk can keep
 *      turning ~10° per cell and spiral for 95+ cells while every single step
 *      still looks "most parallel". So a run also carries the heading it
 *      started with, and stops once the travel direction has drifted away from
 *      it (`dirCos`). Without this, "straight lines" came out as spirals.
 *   2. A deterministic rule can revisit a cell on a closed grid — so the walk
 *      stops at the first repeat. Otherwise painting a line paints a ring.
 *
 * Uses of the result, both mentioned in the note:
 *   - gamepad navigation: a straight run is a natural "hold this direction" path;
 *   - drag-to-paint: click a cell, paint the whole run (the `line` tool).
 */

/** Unit direction of edge i of a cell (from pts[i] to pts[i+1]). */
function edgeDir(cell, i) {
  const n = cell.pts.length;
  const a = cell.pts[i % n];
  const b = cell.pts[(i + 1) % n];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

/** Index of the edge of `cell` that it shares with `otherId`, or -1. */
function sharedEdge(cell, otherId) {
  for (let i = 0; i < cell.edgeNeighbors.length; i++) {
    if (cell.edgeNeighbors[i] === otherId) return i;
  }
  return -1;
}

/** One deterministic step: cross `cur` leaving by the straightest legal edge. */
function walker(grid) {
  const byId = new Map();
  for (const c of grid.cells) byId.set(c.id, c);

  return function walk(start, enterEdge, { minCos, dirCos, limit, head0 } = {}) {
    const path = [start];
    const dots = [];
    const visited = new Set([start.id]);
    let cur = start;
    let prevEdge = enterEdge;

    // heading of the whole run, taken from the edge it enters on; every later
    // step must keep travelling roughly this way (that is what kills spirals)
    const d0 = head0 || edgeDir(start, enterEdge);
    const t0 = { x: -d0.z, z: d0.x };

    for (let step = 0; step < limit; step++) {
      const dIn = edgeDir(cur, prevEdge);
      let best = -1;
      let bestHead = -1;
      let bestDot = -1;
      const n = cur.pts.length;
      for (let k = 0; k < n; k++) {
        if (k === prevEdge) continue;
        if (cur.edgeNeighbors[k] < 0) continue;
        const d = edgeDir(cur, k);
        // travel is perpendicular to the edge, so "straight on" means the next
        // edge is *parallel* to the one just crossed
        const dot = Math.abs(d.x * dIn.x + d.z * dIn.z);
        if (dot < minCos) continue;
        let tx = -d.z;
        let tz = d.x;
        if (tx * t0.x + tz * t0.z < 0) { tx = -tx; tz = -tz; }
        const head = tx * t0.x + tz * t0.z;
        if (head > bestHead) { bestHead = head; bestDot = dot; best = k; }
      }
      if (best < 0 || bestHead < dirCos) break;
      const next = byId.get(cur.edgeNeighbors[best]);
      if (!next) break;
      const nextEdge = sharedEdge(next, cur.id);
      if (nextEdge < 0) break;
      if (visited.has(next.id)) break;
      visited.add(next.id);
      dots.push(bestDot);
      path.push(next);
      cur = next;
      prevEdge = nextEdge;
    }
    return { path, dots };
  };
}

function summarise(path, dots) {
  let turn = 0;
  for (const d of dots) turn += Math.acos(Math.min(1, Math.max(-1, d)));
  return {
    cells: path.map((c) => c.id),
    centres: path.map((c) => ({ x: c.cx, z: c.cz })),
    length: path.length,
    meanTurnDeg: dots.length ? (turn / dots.length) * 180 / Math.PI : 0,
  };
}

/**
 * Trace every maximal straight run, seeded from the rim.
 *
 * A line that crosses the island has both ends on the rim, so starting at the
 * cells that own a rim edge and walking inward reaches the whole line; the same
 * line traced from its other end comes back reversed and is dropped by the
 * cell-set dedupe.
 */
export function traceStraightRuns(grid, { minCos = 0.55, dirCos = 0.82, limit = 240, minLength = 3 } = {}) {
  const walk = walker(grid);
  const starts = [];
  for (const c of grid.cells) {
    for (let i = 0; i < c.edgeNeighbors.length; i++) {
      if (c.edgeNeighbors[i] === -1) starts.push([c, i]);
    }
  }

  const opts = { minCos, dirCos, limit };
  const seen = new Set();
  const runs = [];
  let turnsTotal = 0;
  let longest = 0;
  let straightest = 0;

  // longest first, so the maximal run is kept and its reversed twin is dropped
  const raw = starts.map(([c, i]) => walk(c, i, opts)).sort((a, b) => b.path.length - a.path.length);

  for (const { path, dots } of raw) {
    if (path.length < minLength) continue;
    const key = path.map((c) => c.id).sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);

    const run = summarise(path, dots);
    turnsTotal += run.meanTurnDeg;
    longest = Math.max(longest, run.length);
    straightest = straightest ? Math.min(straightest, run.meanTurnDeg) : run.meanTurnDeg;
    runs.push(run);
  }

  // cell -> longest run through it (what the `line` paint tool uses)
  const byCell = new Map();
  for (let i = 0; i < runs.length; i++) {
    for (const id of runs[i].cells) {
      const prev = byCell.get(id);
      if (prev === undefined || runs[prev].length < runs[i].length) byCell.set(id, i);
    }
  }

  return {
    runs,
    byCell,
    stats: {
      runs: runs.length,
      starts: starts.length,
      meanLength: runs.length ? +(runs.reduce((s, r) => s + r.length, 0) / runs.length).toFixed(2) : 0,
      longest,
      straightest: +straightest.toFixed(2),
      meanTurnDeg: runs.length ? +(turnsTotal / runs.length).toFixed(2) : 0,
      covered: byCell.size,
    },
  };
}

/**
 * The run through one cell, traced on demand.
 *
 * Rim seeding only covers the lines that reach the rim, which leaves interior
 * cells (courtyards, the middle of a dense town) with no run — and a paint tool
 * that silently does nothing on half the town is worse than no tool. Here the
 * cell picks its own straightest axis (the two most nearly parallel edges) and
 * walks both arms, so every cell on the grid has a line.
 */
export function runAtCell(grid, cellId, { minCos = 0.55, dirCos = 0.82, limit = 240 } = {}) {
  const cell = grid.cells[cellId];
  if (!cell) return null;
  const walk = walker(grid);
  const n = cell.pts.length;

  let bi = 0;
  let bj = 1;
  let bestDot = -1;
  for (let i = 0; i < n; i++) {
    const di = edgeDir(cell, i);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dj = edgeDir(cell, j);
      const d = Math.abs(di.x * dj.x + di.z * dj.z);
      if (d > bestDot) { bestDot = d; bi = i; bj = j; }
    }
  }

  const opts = { minCos, dirCos, limit };
  const a = walk(cell, bi, opts);           // arm heading one way
  const b = walk(cell, bj, opts);           // arm heading the other way
  const path = [...b.path.slice(1).reverse(), ...a.path];
  const dots = [...b.dots, ...a.dots];
  return summarise(path, dots);
}

/** Polyline geometry for the debug layer, lifted above the water plane. */
export function runGeometry(trace, { y = 0.055, minLength = 4 } = {}) {
  const out = [];
  for (const run of trace.runs) {
    if (run.length < minLength) continue;
    for (let i = 0; i < run.centres.length - 1; i++) {
      const a = run.centres[i];
      const b = run.centres[i + 1];
      out.push(a.x, y, a.z, b.x, y, b.z);
    }
  }
  return new Float32Array(out);
}

/** Cells of the longest pre-traced run through `cellId` (null when none). */
export function runThrough(trace, cellId) {
  const idx = trace.byCell.get(cellId);
  if (idx === undefined) return null;
  return trace.runs[idx];
}
