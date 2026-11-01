/**
 * terrain.js — the same voxel engine, read as landscape.
 *
 * The reference clip makes one thing obvious: Oskar's terrain is built on the
 * *same* irregular quad grid as the town. A cell is a cell — a building is a
 * column of voxels you placed, a cliff is a column the noise placed. So this
 * module does not introduce a second mesher; it fills the town's voxel field
 * from noise and lets the existing TownMesh render it in terrain mode.
 */

import { buildGrid } from '../src/grid.js';
import { decorateCells, Town, PALETTES } from '../src/town.js';
import { fbm, ridged, clamp01, smoothstep, makeRng } from './noise.js';

/** Rock / grass / sand tones read off the reference still. */
export const TERRAIN_PALETTE = {
  name: 'Terrain',
  colors: [
    '#c9a183', // 0 rock
    '#b8906f', // 1 rock, shaded
    '#d8c39c', // 2 sand
    '#9aa565', // 3 grass
    '#8b9757', // 4 grass, deeper
    '#78854c', // 5 grass, dark
    '#cfae8b', // 6 rock, warm
    '#a8967a', // 7 scree
    '#e0cda8', // 8 sand, light
    '#b6a06f', // 9 dry grass
    '#6f7d4a', // 10 moss
    '#c19a76', // 11 rock, pale
    '#8e9a5a', // 12 grass, olive
    '#d2b892', // 13 sand, warm
    '#a58a6b', // 14 rock, mid
  ],
};

/**
 * Fill a quad grid with terraced noise.
 * @returns {{grid: object, town: Town, filled: number}}
 */
export function buildTerrain({
  radius = 16,
  hexSize = 0.62,
  seed = 3,
  levels = 6,
  coast = 0.88,
  jitter = 0.22,
} = {}) {
  const grid = decorateCells(buildGrid({ radius, hexSize, jitter }));
  const town = new Town(grid);
  town.palette = TERRAIN_PALETTE;
  const rng = makeRng(seed);

  const span = radius * hexSize * Math.SQRT2;
  const cells = grid.cells;

  // ---- 1. sample noise at every cell centre -------------------------------
  const raw = new Float32Array(cells.length);
  for (const cell of cells) {
    const u = cell.cx / span + 0.5;
    const v = cell.cz / span + 0.5;

    const wx = fbm(u * 3 + 4.2, v * 3 + 9.7, { octaves: 3, freq: 2, seed: seed + 31 });
    const wy = fbm(u * 3 + 17.1, v * 3 + 2.3, { octaves: 3, freq: 2, seed: seed + 67 });
    const x = u + (wx - 0.5) * 0.22;
    const y = v + (wy - 0.5) * 0.22;

    let e = fbm(x * 1.45, y * 1.45, { octaves: 4, freq: 2.2, gain: 0.5, seed });
    e = e * 0.8 + ridged(x * 2.4, y * 2.4, { octaves: 3, freq: 2.6, seed: seed + 5 }) * 0.2;

    const dx = (u - 0.5) * 2;
    const dy = (v - 0.5) * 2;
    const r = Math.hypot(dx, dy) / coast;
    const falloff = 1 - smoothstep(0.55, 1.05, r);

    raw[cell.id] = clamp01(e * 1.4 - 0.32) * falloff;
  }

  // ---- 2. terrace into discrete levels ------------------------------------
  const level = new Float32Array(cells.length);
  for (const cell of cells) {
    const t = Math.pow(raw[cell.id], 0.9);
    level[cell.id] = Math.round(Math.round(t * levels) / levels * levels);
  }
  // de-speckle: a cell that sits a whole level below every neighbour is a pit
  for (const cell of cells) {
    const h = level[cell.id];
    let maxN = 0;
    for (let i = 0; i < 4; i++) {
      const nid = cell.edgeNeighbors[i];
      if (nid >= 0) maxN = Math.max(maxN, level[nid]);
    }
    if (maxN - h >= 2) level[cell.id] = maxN - 1;
  }
  for (const cell of cells) {
    town.fill(cell, Math.max(0, Math.min(levels, level[cell.id])));
  }

  // ---- 3. paint by height and steepness ----------------------------------
  const idx = (c) => c.id;
  for (const cell of cells) {
    const h = town.top(cell);
    if (h === 0) continue;
    let drop = 0;
    for (let i = 0; i < 4; i++) drop = Math.max(drop, h - town.neighborTop(cell, i));

    let slot;
    if (h <= 1) slot = rng() < 0.55 ? 2 : 8;            // beach
    else if (drop >= 1) slot = rng() < 0.55 ? 0 : 1;    // cliff face
    else slot = [3, 4, 12, 5][(rng() * 4) | 0];         // flat top: grass
    if (h > 3 && drop === 0 && rng() < 0.3) slot = 0;   // bare summit
    town.colors[idx(cell)] = slot;
  }

  town.version++;
  let filled = 0;
  for (const c of cells) if (town.top(c) > 0) filled++;
  return { grid, town, filled };
}
