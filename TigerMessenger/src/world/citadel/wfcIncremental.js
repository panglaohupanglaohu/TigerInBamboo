// =====================================================================
//  WFC 增量重解：编辑格 + ring 邻域重置为全集，其余格 pins 为上次解。
//  失败且冲突格在区域外时 ring+1 重试 ≤2 次。不整城重解，不静默填格。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { solveTownSelection, defaultBanPolicy } from "./wfcTownSelection.js";

function parseKey(key) {
  const [ix, iy, iz] = String(key).split(",").map(Number);
  return [ix, iy, iz];
}

export function manhattanNeighbors(key, ring) {
  const [ix, iy, iz] = parseKey(key);
  const out = [];
  for (let dy = -ring; dy <= ring; dy++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > ring) continue;
        out.push(`${ix + dx},${iy + dy},${iz + dz}`);
      }
    }
  }
  return out;
}

function involvedOutside(failure, region) {
  const cells = failure?.conflict?.involvedCells ?? [];
  if (!cells.length) return false;
  return cells.every((id) => id != null && !region.has(String(id)));
}

/**
 * @param {object} opts
 * @param {Map<string,string>} opts.grid
 * @param {object[]} opts.prototypes
 * @param {number} opts.seed
 * @param {object} opts.previous  上次 byCell
 * @param {string[]} opts.dirtyKeys
 * @param {number} [opts.ring=2]
 * @param {Function} [opts.banPolicy]
 */
export function resolveIncremental({
  grid,
  prototypes,
  seed,
  previous = {},
  dirtyKeys = [],
  ring = 2,
  banPolicy = defaultBanPolicy,
} = {}) {
  let ringUsed = ring;
  let last = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    ringUsed = ring + attempt;
    const region = new Set();
    for (const k of dirtyKeys) {
      for (const n of manhattanNeighbors(k, ringUsed)) {
        if (grid.has(n)) region.add(n);
      }
    }
    const pins = [];
    for (const [id] of grid) {
      if (!region.has(id) && previous[id]?.key) {
        pins.push({ cell: id, variant: previous[id].key, source: "previous" });
      }
    }
    const r = solveTownSelection({ grid, prototypes, seed, pins, banPolicy });
    last = { ...r, region: [...region], ringUsed };
    if (r.ok) return last;
    if (!involvedOutside(r.failure, region)) return last;
  }
  return last;
}
