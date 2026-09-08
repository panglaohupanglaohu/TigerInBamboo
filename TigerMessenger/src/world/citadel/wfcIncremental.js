// =====================================================================
//  WFC 增量重解：编辑格 + ring 邻域重置为全集，其余格 pins 为上次解。
//  小范围失败后扩圈，最终升级到受影响连通分量；无关分量始终 pin 旧解。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { solveTownSelection, defaultBanPolicy, assertTownGraphMatchesGrid } from "./wfcTownSelection.js";
import { createCitadelCellGraph, CITADEL_DELTA, CITADEL_OPP } from "./wfcGraphAdapter.js";

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

// A deletion has no node in the new graph. Its surviving immediate neighbors
// still changed exposure; a recolor can likewise affect both former sides.
export function affectedComponent(grid, dirtyKeys) {
  const graph = createCitadelCellGraph(grid);
  const pending = [];
  const affected = new Set();
  const add = (id) => {
    const index = graph.indexOfId(id);
    if (index < 0 || affected.has(id)) return;
    affected.add(id);
    pending.push(index);
  };
  for (const key of dirtyKeys) {
    add(String(key));
    const [x, y, z] = parseKey(key);
    for (const [dx, dy, dz] of Object.values(CITADEL_DELTA)) {
      add(`${x + dx},${y + dy},${z + dz}`);
    }
  }
  for (let head = 0; head < pending.length; head++) {
    for (const edge of graph.neighborsOf(pending[head])) add(graph.cellId(edge.to));
  }
  return affected;
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
  graph = null,
  prototypes,
  seed,
  previous = {},
  dirtyKeys = [],
  ring = 2,
  banPolicy = defaultBanPolicy,
} = {}) {
  if (graph) {
    assertTownGraphMatchesGrid(graph, grid);
    const legacy = createCitadelCellGraph(grid);
    if (graph.cellCount !== legacy.cellCount) throw new Error("incremental face graph must preserve legacy cells");
    for (const {id, index} of legacy.cells()) {
      const target = graph.indexOfId(id);
      const oldEdges = legacy.neighborsOf(index).map(e => `${legacy.cellId(e.to)}:${e.direction}:${CITADEL_OPP[e.direction]}`).sort();
      const newEdges = graph.neighborsOf(target).map(e => `${graph.cellId(e.to)}:${e.sourceSide}:${e.targetSide}`).sort();
      if (target < 0 || graph.levelOf(target) !== parseKey(id)[1] ||
          Object.keys(CITADEL_DELTA).some(side => graph.exposure(target)[side] !== legacy.exposure(index)[side]) ||
          JSON.stringify(oldEdges) !== JSON.stringify(newEdges)) {
        throw new Error("incremental face graph requires legacy-preserving adjacency");
      }
    }
  }
  const affected = affectedComponent(grid, dirtyKeys);
  let ringUsed = ring;
  let last = null;
  for (let attempt = 0; attempt <= 3; attempt++) {
    ringUsed = ring + attempt;
    const componentFallback = attempt === 3;
    const region = componentFallback ? new Set(affected) : new Set();
    for (const k of dirtyKeys) {
      for (const n of manhattanNeighbors(k, ringUsed)) {
        if (affected.has(n)) region.add(n);
      }
    }
    const pins = [];
    for (const [id] of grid) {
      if (!region.has(id) && previous[id]?.key) {
        pins.push({ cell: id, variant: previous[id].key, source: "previous" });
      }
    }
    const r = solveTownSelection({ grid, graph, prototypes, seed, pins, banPolicy });
    last = { ...r, region: [...region], ringUsed: componentFallback ? null : ringUsed,
      scope: componentFallback ? "affected-component" : "local", attempts: attempt + 1 };
    if (r.ok) return last;
    // Mixed inside/outside conflicts can require distant changes too. Do not
    // depend on the optional conflict explanation to decide whether to expand.
    if (region.size === affected.size) return last;
  }
  return last;
}
