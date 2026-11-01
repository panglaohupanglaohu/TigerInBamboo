/**
 * mesa.js — the island from the first two clips: mesa plateaus with vertical
 * cliffs, caves bored through the base, and a handful of single-cell houses
 * with steep gable roofs standing on the flat tops.
 *
 * Everything here is the same quad grid and the same voxel field as the town;
 * only the height curve and the paint differ. That is the whole trick the clips
 * demonstrate: a cliff is a column that noise placed, a house is a column you
 * placed.
 */

import { buildGrid } from '../src/grid.js';
import { decorateCells, Town } from '../src/town.js';
import { fbm, ridged, clamp01, smoothstep, makeRng } from './noise.js';

/** Rock / sand / moss, sampled off the reference frames. */
export const MESA_PALETTE = {
  name: 'Mesa',
  colors: [
    '#a7a49d', // 0 stone, lit
    '#96938d', // 1 stone, shaded
    '#c9b691', // 2 sand cap
    '#8d8f62', // 3 moss
    '#7e8155', // 4 moss, deeper
    '#bbb5a6', // 5 pale stone
    '#d4c4a1', // 6 pale sand
    '#8f8d88', // 7 cool stone
    '#aaa79f', // 8 warm stone
    '#6f7a55', // 9 dark moss
    '#9a999b', // 10 mid stone
    '#ded0ae', // 11 bright sand
    '#a49f95', // 12 scree
    '#85837e', // 13 dark stone
    '#c2b896', // 14 sand, warm
    '#5d8ea6', // 15 river water
  ],
};

export const WALL_SLOTS = new Set([0, 1, 5, 7, 8, 10, 12, 13]);
export const TOP_SLOTS = new Set([2, 6, 11, 14]);

/**
 * Build the mesa island.
 * @returns {{grid, town, houses: Array<{cell, top, spire}>}}
 */
export function buildMesa({
  radius = 19,
  hexSize = 0.46,
  seed = 7,
  maxLevels = 10,
  towers = 3,
  caves = 3,
  houses = 5,
  jitter = 0.2,
} = {}) {
  const grid = decorateCells(buildGrid({ radius, hexSize, jitter }));
  const town = new Town(grid);
  town.palette = MESA_PALETTE;
  const rng = makeRng(seed);
  const cells = grid.cells;
  const span = radius * hexSize * Math.SQRT2;

  // ---- 1. height field: broad mass + hard plateau steps -------------------
  const raw = new Float32Array(cells.length);
  for (const cell of cells) {
    const u = cell.cx / span + 0.5;
    const v = cell.cz / span + 0.5;

    // domain warp keeps the outlines from looking like a noise contour
    const wx = fbm(u * 2.6 + 3.1, v * 2.6 + 8.4, { octaves: 3, freq: 2, seed: seed + 11 });
    const wy = fbm(u * 2.6 + 12.7, v * 2.6 + 1.9, { octaves: 3, freq: 2, seed: seed + 29 });
    const x = u + (wx - 0.5) * 0.2;
    const y = v + (wy - 0.5) * 0.2;

    let e = fbm(x * 1.7, y * 1.7, { octaves: 4, freq: 2.1, gain: 0.52, seed });
    e = e * 0.78 + ridged(x * 2.1, y * 2.1, { octaves: 3, freq: 2.3, seed: seed + 3 }) * 0.22;

    const dx = (u - 0.5) * 2;
    const dy = (v - 0.5) * 2;
    const r = Math.hypot(dx, dy) / 0.92;
    const falloff = 1 - smoothstep(0.6, 1.02, r);
    raw[cell.id] = clamp01(e * 1.3 - 0.26) * falloff;
  }

  // A mesa is a *thresholded* field: below the line there is sea, above it the
  // land jumps straight to several levels, so the sides come out vertical.
  const level = new Float32Array(cells.length);
  for (const cell of cells) {
    const t = raw[cell.id];
    if (t < 0.34) { level[cell.id] = 0; continue; }
    const k = (t - 0.34) / 0.66;
    // quantise to even steps: 1 step == a full cliff course
    const step = Math.round(Math.pow(k, 0.62) * (maxLevels / 2));
    level[cell.id] = Math.max(2, step * 2);
  }

  // ---- 2. free-standing towers ------------------------------------------
  for (let n = 0; n < towers; n++) {
    const ang = rng() * Math.PI * 2;
    const dist = (0.18 + rng() * 0.5) * radius;
    const tx = Math.cos(ang) * dist;
    const tz = Math.sin(ang) * dist;
    const rad = (1.1 + rng() * 2.2);
    const top = (maxLevels / 2 + 1 + (rng() < 0.5 ? 1 : 0)) * 2;
    for (const cell of cells) {
      const d = Math.hypot(cell.cx - tx, cell.cz - tz);
      if (d < rad) level[cell.id] = Math.max(level[cell.id], Math.min(top, maxLevels));
    }
  }

  // ---- 3. de-speckle: no one-cell spikes or pits --------------------------
  for (let pass = 0; pass < 2; pass++) {
    const copy = level.slice();
    for (const cell of cells) {
      const h = copy[cell.id];
      if (h === 0) continue;
      let maxN = 0;
      let minN = Infinity;
      for (let i = 0; i < 4; i++) {
        const nid = cell.edgeNeighbors[i];
        if (nid < 0) continue;
        maxN = Math.max(maxN, copy[nid]);
        minN = Math.min(minN, copy[nid]);
      }
      if (minN !== Infinity && maxN - h >= 3) level[cell.id] = maxN - 2;
      if (minN !== Infinity && h - minN >= 3) level[cell.id] = minN + 1;
    }
  }

  // Channels: a ridged noise near its zero crossings becomes a canyon, which is
  // what separates the mass into buttes instead of one pancake with cliffs.
  for (const cell of cells) {
    if (level[cell.id] === 0) continue;
    const ch = ridged(cell.cx * 0.42 + 7.3, cell.cz * 0.42 + 2.1, { octaves: 2, freq: 1.5, seed: seed + 91 });
    if (ch < 0.24) level[cell.id] = 0;
    else if (ch < 0.32) level[cell.id] = Math.min(level[cell.id], 2);
  }

  for (const cell of cells) town.fill(cell, Math.min(maxLevels, level[cell.id]));

  // ---- 4. caves bored through the base -----------------------------------
  // Walk a short line of boundary cells and punch levels 1-2: the voxel mesher
  // gives the hole a ceiling for free, which is what makes it read as a cave.
  const boundary = cells.filter((c) => {
    if (town.top(c) < 3) return false;
    for (let i = 0; i < 4; i++) if (town.neighborTop(c, i) === 0) return true;
    return false;
  });
  for (let n = 0; n < caves && boundary.length; n++) {
    const start = boundary[(rng() * boundary.length) | 0];
    let cur = start;
    const carved = new Set();
    for (let step = 0; step < 3; step++) {
      if (!cur || carved.has(cur.id)) break;
      carved.add(cur.id);
      for (let lv = 1; lv <= 2; lv++) town.setSolid(cur, lv, false);
      // step inward: neighbour furthest from the sea
      let best = null;
      let bestScore = -1;
      for (let i = 0; i < 4; i++) {
        const nid = cur.edgeNeighbors[i];
        if (nid < 0) continue;
        const nb = cells[nid];
        if (carved.has(nb.id)) continue;
        const score = town.top(nb) - (town.isSolid(nb, 1) ? 0 : 2);
        if (score > bestScore) { bestScore = score; best = nb; }
      }
      cur = best;
    }
  }

  // ---- 5. paint -----------------------------------------------------------
  // Walls are cool stone, caps are warm sand, and flat tops pick up moss. The
  // strata shading inside TownMesh does the banding; the slot only sets the hue.
  for (const cell of cells) {
    const h = town.top(cell);
    if (h === 0) { town.colors[cell.id] = -1; continue; }
    let drop = 0;
    let flat = true;
    for (let i = 0; i < 4; i++) {
      const nid = cell.edgeNeighbors[i];
      const nh = nid < 0 ? 0 : town.top(cells[nid]);
      drop = Math.max(drop, h - nh);
      if (nh !== h) flat = false;
    }
    let slot;
    if (h <= 2) slot = rng() < 0.5 ? 1 : 13;
    else if (flat) {
      // moss grows in patches, so pick it from low-frequency noise rather than
      // per-cell dice — dice gives a speckled lawn instead of a meadow
      const patch = fbm(cell.cx * 0.9 + 40, cell.cz * 0.9 + 12, { octaves: 2, freq: 1.6, seed: seed + 77 });
      slot = patch > 0.56 ? (rng() < 0.5 ? 3 : 4) : (rng() < 0.6 ? 2 : 11);
    } else if (drop >= 2) slot = rng() < 0.6 ? 0 : 5;
    else slot = rng() < 0.5 ? 8 : 12;
    town.colors[cell.id] = slot;
  }

  // ---- 6. place a few houses on flat caps --------------------------------
  const candidates = cells.filter((c) => {
    const h = town.top(c);
    if (h < 4) return false;
    for (let i = 0; i < 4; i++) if (town.neighborTop(c, i) !== h) return false;
    return true;
  });
  const picks = [];
  const used = new Set();
  for (let n = 0; n < houses * 6 && picks.length < houses; n++) {
    const c = candidates[(rng() * candidates.length) | 0];
    if (!c || used.has(c.id)) continue;
    // keep them apart so each reads as its own building
    if (picks.some((p) => Math.hypot(p.cell.cx - c.cx, p.cell.cz - c.cz) < hexSize * 1.9)) continue;
    used.add(c.id);
    picks.push({ cell: c, top: town.top(c), spire: rng() < 0.35 });
  }

  town.version++;
  return { grid, town, houses: picks };
}
