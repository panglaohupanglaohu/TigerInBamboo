/**
 * rivers.js — carving rivers the way the 2024-03-18 note describes.
 *
 * Source note (x.com/OskSta/status/1769691526924292506):
 *
 *   "Mega river system! ... I've sort of special cased the rivers by collapsing
 *    them depth-first to let them wiggle real far, and then the rest is
 *    collapsed breadth-first, making nice gentle slopes that only occasionally
 *    meet steep cliffs."
 *
 * Two different traversals for two different jobs, and the difference is visible:
 *
 *   depth-first   follows one branch all the way down before touching the next,
 *                 so a river runs far instead of diving straight at the sea.
 *                 That is what produces the long meanders and the tributaries
 *                 that join late.
 *   breadth-first the rest of the terrain is levelled in rings away from the
 *                 water, so slopes come out gentle and cliffs appear only where
 *                 two rings meet at very different heights.
 *
 * This module carves into the same voxel field the rest of the engine uses, so a
 * river is simply "columns lowered to a channel profile" — no second mesher.
 */

import { makeRng } from './noise.js';

/**
 * @param {object} town  voxel field (mutated)
 * @param {object} grid  quad grid
 * @param {object} opts
 * @returns {{cells:number[], mouths:number[]}}
 */
export function carveRivers(town, grid, {
  seed = 1,
  count = 3,          // how many independent rivers
  maxSteps = 220,     // depth-first budget per river
  wiggle = 0.45,      // how much the walk prefers not going straight down
  depth = 2,          // how many levels the channel is cut
} = {}) {
  const rng = makeRng(seed);
  const cells = grid.cells;

  const heightOf = (c) => town.top(c);
  const riverCells = new Set();
  const mouths = [];

  // sources: the highest cells, spread out
  const ranked = cells
    .filter((c) => heightOf(c) > 2)
    .sort((a, b) => heightOf(b) - heightOf(a));
  const sources = [];
  for (const c of ranked) {
    if (sources.length >= count) break;
    if (sources.some((s) => Math.hypot(s.cx - c.cx, s.cz - c.cz) < 6)) continue;
    sources.push(c);
  }

  for (const source of sources) {
    // Depth-first with an explicit stack and real backtracking. A greedy walk
    // (pick the best neighbour, repeat) dies in a dead end after a few cells —
    // that version produced four-cell rivers. Backtracking is what lets one
    // branch run all the way down before the next one starts.
    const seen = new Set();
    const stack = [{ cell: source, prev: null }];
    const path = [];

    while (stack.length && path.length < maxSteps) {
      const top = stack[stack.length - 1];
      const cur = top.cell;
      const h = heightOf(cur);

      if (h <= 0) break;                      // reached the sea

      // candidates: unvisited neighbours, scored with descent as a weak bias
      const options = [];
      for (let i = 0; i < 4; i++) {
        const nid = cur.edgeNeighbors[i];
        if (nid < 0) continue;
        const nb = cells[nid];
        if (seen.has(nb.id)) continue;
        if (heightOf(nb) > h + 1) continue;   // no climbing more than one course
        const drop = h - heightOf(nb);
        const straight = top.prev && nb === top.prev ? -1 : 0;
        options.push({ cell: nb, score: drop * 0.4 + rng() * wiggle * 5 + straight });
      }

      if (options.length === 0) {
        stack.pop();                          // dead end: back up and try elsewhere
        if (path.length) path.pop();
        continue;
      }

      options.sort((a, b) => b.score - a.score);
      const next = options[0].cell;
      seen.add(next.id);
      path.push(next);
      stack.push({ cell: next, prev: cur });
    }

    // carve: monotone channel from source down to the mouth
    let bed = null;
    for (const c of path) {
      const h = heightOf(c);
      const level = bed === null ? Math.max(1, h - depth) : Math.min(bed, Math.max(1, h - 1));
      bed = Math.max(1, level);
      town.fill(c, bed);
      riverCells.add(c.id);
    }
    if (path.length) mouths.push(path[path.length - 1].id);
  }

  // Banks: lower the cells either side of the channel by one, which gives the
  // V-shaped cross-section a river cuts. An earlier version ran a breadth-first
  // levelling over the whole island here and simply planed it flat — the note's
  // "breadth-first" refers to collapsing the mesh hierarchy, not to flattening
  // terrain, and that distinction is worth keeping straight.
  for (const id of [...riverCells]) {
    const cell = cells[id];
    const h = town.top(cell);
    for (let i = 0; i < 4; i++) {
      const nid = cell.edgeNeighbors[i];
      if (nid < 0 || riverCells.has(nid)) continue;
      const nb = cells[nid];
      if (town.top(nb) > h + 1) town.fill(nb, h + 1);
    }
  }

  town.version++;
  return { cells: [...riverCells], mouths };
}

/** Paint river cells so the channel reads as water rather than a dry ditch. */
export function paintRivers(town, grid, riverCells, slot = 2) {
  for (const id of riverCells) {
    const cell = grid.cells[id];
    if (!cell) continue;
    town.colors[id] = slot;
  }
  town.version++;
}
