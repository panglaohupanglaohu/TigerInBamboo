/**
 * town.js — the voxel graph + the region graph.
 *
 * Mirrors Placemaker.Graphs.Graph / Qube from the shipped build:
 *   solid[]          -> Voxel presence per cube. One bit per level, because a
 *                       cube can be removed from the middle of a column and the
 *                       cubes above stay up (that is how arches and stilted
 *                       towers are made)
 *   colors[]         -> VoxelType (the 15 palette slots the enum exposes:
 *                       Red, Green, Blue, Yellow, Color4..Color14)
 *   roofColors[]     -> the paint on the top cube, so roofs and walls can differ
 *   edgeNeighbors[4] -> Qube.cornerValues / sideVariationMask inputs
 *   regions()        -> module propagation: neighbours whose top is at the same
 *                       level belong to one building, and that building — not
 *                       the individual cube — owns one roof and one wall run
 */

export const MAX_HEIGHT = 9;

/** The 15 palette slots the game's VoxelType enum exposes. */
export const PALETTES = {
  town: {
    name: 'Town',
    colors: [
      '#dd6a5f', '#eec463', '#85b780', '#6f9dc6', '#ac91c9',
      '#e8a377', '#c2ab8b', '#ecdfc4', '#8b9fa6', '#cf5348',
      '#dd9057', '#d3b96b', '#63a291', '#9dbdd7', '#cf9ab5',
    ],
  },
  pastel: {
    name: 'Pastel',
    colors: [
      '#eda1a1', '#f3d5a5', '#b8dcc4', '#a9c8e8', '#c9b6e4',
      '#f0b7a4', '#dcc7b0', '#f7ecdc', '#b9c4c6', '#d98f8f',
      '#e8b98d', '#f0dfae', '#a8cfba', '#9bb9dd', '#bfaede',
    ],
  },
  dusk: {
    name: 'Dusk',
    colors: [
      '#cf6a58', '#dcae63', '#5d8f7f', '#57799f', '#8a74a6',
      '#c07d63', '#a9907a', '#e2d5bf', '#728388', '#b95147',
      '#c47a52', '#cbb072', '#5d8a7d', '#6484a5', '#93789f',
    ],
  },
};

// Colours lifted from the reference capture: cream plaster, warm grey-brown
// roofs, grey masonry quay, and the pavement of the walkways.
export const TERRAIN = {
  plaster: '#e9dcc6',
  roofBare: '#ad9580',
  pavement: '#cfc6b2',
  pavementAlt: '#c4bba6',
  quay: '#b9b09b',
  quayDark: '#9d9380',
  mortar: '#9a907c',
  grass: '#8fae5f',
  grassDark: '#7a9a52',
  trunk: '#8a6b4f',
  metal: '#3b4148',
  timber: '#4a4038',
  glass: '#41525c',
  frame: '#f7f3e8',
};

export class Town {
  /** @param {ReturnType<import('./grid.js').buildGrid>} grid */
  constructor(grid) {
    this.grid = grid;
    const n = grid.cellCount;
    this.solid = new Uint16Array(n);
    this.colors = new Int8Array(n).fill(-1);
    this.roofColors = new Int8Array(n).fill(-1);
    this.palette = PALETTES.town;
    this.version = 0;
    this._regions = null;
    this._regionsVersion = -1;
  }

  get cells() { return this.grid.cells; }

  reset() {
    this.solid.fill(0);
    this.colors.fill(-1);
    this.roofColors.fill(-1);
    this.version++;
  }

  /* ---------------------------------------------------------------- voxels */

  isSolid(cell, level) {
    if (level < 1 || level > MAX_HEIGHT) return false;
    return (this.solid[cell.id] & (1 << (level - 1))) !== 0;
  }

  setSolid(cell, level, on) {
    if (level < 1 || level > MAX_HEIGHT) return false;
    const bit = 1 << (level - 1);
    const before = this.solid[cell.id];
    const after = on ? before | bit : before & ~bit;
    if (after === before) return false;
    this.solid[cell.id] = after;
    this.version++;
    return true;
  }

  /** Highest solid level of a column, 0 when empty. */
  top(cell) {
    const mask = this.solid[cell.id];
    for (let l = MAX_HEIGHT; l >= 1; l--) if (mask & (1 << (l - 1))) return l;
    return 0;
  }

  /** Lowest solid level of a column, 0 when empty. */
  bottom(cell) {
    const mask = this.solid[cell.id];
    for (let l = 1; l <= MAX_HEIGHT; l++) if (mask & (1 << (l - 1))) return l;
    return 0;
  }

  /** True when the column stands on nothing (it needs stilts). */
  isFloating(cell) {
    const b = this.bottom(cell);
    return b > 1;
  }

  /** Fill 1..h, drop everything above. */
  fill(cell, h) {
    const v = Math.max(0, Math.min(MAX_HEIGHT, h | 0));
    const mask = v === 0 ? 0 : (1 << v) - 1;
    if (this.solid[cell.id] === mask) return false;
    this.solid[cell.id] = mask;
    this.version++;
    return true;
  }

  /** Top of the neighbour on edge `i`, or 0 outside the grid. */
  neighborTop(cell, i) {
    const nid = cell.edgeNeighbors[i];
    return nid < 0 ? 0 : this.top(this.grid.cells[nid]);
  }

  /* ---------------------------------------------------------------- colours */

  color(cell) { return this.colors[cell.id]; }

  setColor(cell, c) {
    if (this.colors[cell.id] === c) return false;
    this.colors[cell.id] = c;
    this.version++;
    return true;
  }

  setRoofColor(cell, c) {
    if (this.roofColors[cell.id] === c) return false;
    this.roofColors[cell.id] = c;
    this.version++;
    return true;
  }

  /* ---------------------------------------------------------------- regions */

  /**
   * Connected components of columns whose top sits at the same level. A
   * component is one building (or one walkway at level 1) — the unit that owns
   * a single roof plane, a single run of perimeter wall and a single railing.
   */
  regions() {
    if (this._regionsVersion === this.version && this._regions !== null) return this._regions;

    const cells = this.grid.cells;
    const regionOf = new Int32Array(cells.length).fill(-1);
    const regions = [];
    const tops = new Int32Array(cells.length);
    for (const c of cells) tops[c.id] = this.top(c);

    for (const start of cells) {
      if (regionOf[start.id] !== -1) continue;
      const h = tops[start.id];
      if (h === 0) { regionOf[start.id] = -2; continue; }

      const id = regions.length;
      const members = [];
      const stack = [start];
      regionOf[start.id] = id;

      while (stack.length > 0) {
        const cell = stack.pop();
        members.push(cell);
        for (const nid of cell.edgeNeighbors) {
          if (nid < 0 || regionOf[nid] !== -1) continue;
          if (tops[nid] !== h) continue;
          regionOf[nid] = id;
          stack.push(cells[nid]);
        }
      }
      regions.push({ id, h, cells: members, isWalkway: h === 1 });
    }

    this._regions = { regionOf, regions };
    this._regionsVersion = this.version;
    return this._regions;
  }

  /* -------------------------------------------------------------- snapshots */

  snapshot() {
    return {
      solid: this.solid.slice(),
      colors: this.colors.slice(),
      roofColors: this.roofColors.slice(),
    };
  }

  restore(snap) {
    this.solid.set(snap.solid);
    this.colors.set(snap.colors);
    this.roofColors.set(snap.roofColors);
    this.version++;
  }
}

/** Attach convenience metrics used by the mesh builder. */
export function decorateCells(grid) {
  for (const cell of grid.cells) {
    const [a, b, c, d] = cell.pts;
    const w = Math.hypot(c.x - a.x, c.z - a.z) * 0.5;
    const hgt = Math.hypot(d.x - b.x, d.z - b.z) * 0.5;
    cell.size = (w + hgt) * 0.5;
    cell.edgeLength = (i) => {
      const p = cell.pts[i];
      const q = cell.pts[(i + 1) % 4];
      return Math.hypot(q.x - p.x, q.z - p.z);
    };
    cell.minX = Math.min(a.x, b.x, c.x, d.x);
    cell.maxX = Math.max(a.x, b.x, c.x, d.x);
    cell.minZ = Math.min(a.z, b.z, c.z, d.z);
    cell.maxZ = Math.max(a.z, b.z, c.z, d.z);
  }
  return grid;
}

/** Spatial hash so picking can jump straight to the few candidate cells. */
export function buildCellIndex(grid) {
  const bucket = 4;
  const map = new Map();
  const key = (ix, iz) => `${ix},${iz}`;
  for (const cell of grid.cells) {
    for (let ix = Math.floor(cell.minX / bucket); ix <= Math.floor(cell.maxX / bucket); ix++) {
      for (let iz = Math.floor(cell.minZ / bucket); iz <= Math.floor(cell.maxZ / bucket); iz++) {
        const k = key(ix, iz);
        let list = map.get(k);
        if (list === undefined) map.set(k, (list = []));
        list.push(cell);
      }
    }
  }
  return {
    bucket,
    at(x, z) {
      const ix = Math.floor(x / bucket);
      const iz = Math.floor(z / bucket);
      const near = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = map.get(key(ix + dx, iz + dz));
          if (list) near.push(...list);
        }
      }
      return near;
    },
  };
}

/** Point in quad (XZ). */
export function pointInQuad(pts, x, z) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const k = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(k) < 1e-9) continue;
    const s = Math.sign(k);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
