// =====================================================================
//  增量构建：blueprint transaction → 两环 dirty → 解析/补丁（G4）
// =====================================================================

import { createModuleCatalog } from "./moduleCatalog.js";
import { resolveCell, resolveTown } from "./moduleResolver.js";
import { resolveBuildingTheme } from "./visualTheme.js";
import { expandByTopology } from "./constraintSolver.js";

export const CLUSTER_PARTS = Object.freeze([
  "floor",
  "foundation",
  "fence",
  "flower-tile-balcony",
  "stairs",
  "support",
  "hole",
  "roof",
  "window",
  "lamp",
  "chimney",
]);

export function buildClusterSample(clusterId, seed = 7) {
  const theme = resolveBuildingTheme(clusterId, { seed });
  return {
    cluster: theme,
    parts: CLUSTER_PARTS.map((part) => ({
      part,
      color:
        part === "flower-tile-balcony"
          ? theme.tileAccent
          : part === "roof"
            ? theme.roof
            : part === "window" || part === "lamp"
              ? theme.trim
              : theme.wallMain,
    })),
  };
}

function cellKey(t, ix, iy, iz) {
  return `${t}:${ix}:${iy}:${iz}`;
}

export function expandNeighborhood(cells, ring = 2) {
  const set = new Set(cells);
  const extra = [];
  for (const id of set) {
    const [t, ix, iy, iz] = id.split(":").map(Number);
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        extra.push(cellKey(t, ix + dx, iy, iz + dz));
      }
    }
  }
  return [...new Set([...set, ...extra])].sort();
}

export function diffBlueprintCells(beforeIds, afterIds) {
  const a = new Set(beforeIds);
  const b = new Set(afterIds);
  const changed = [];
  for (const id of b) if (!a.has(id)) changed.push(id);
  for (const id of a) if (!b.has(id)) changed.push(id);
  return [...new Set(changed)].sort();
}

export function createIncrementalBuilder({ catalog = createModuleCatalog(), seed = 1, blueprint = null } = {}) {
  const meshPool = new Map();
  const log = [];
  let previous = null;
  return {
    meshPool,
    apply(transaction) {
      const t0 = nowMs();
      const dirty = expandNeighborhood(transaction.cells || [], 2);
      const rebuilt = [];
      for (const id of dirty) {
        const [terrace, ix, iy, iz] = id.split(":").map(Number);
        const cell = {
          id: `cell:${id}`,
          occupancy: { N: 1, E: 1, S: 1, W: 1, U: 1, D: 1 },
          semantic: transaction.semantic?.[id] || "block",
          support: 1,
          familyHint: "floor",
        };
        const solved = resolveCell(cell, {}, catalog, seed);
        meshPool.set(id, { moduleId: solved.module.id, fallback: solved.fallback });
        rebuilt.push(id);
      }
      const ms = nowMs() - t0;
      log.push({ cells: rebuilt.length, ms, dirty: dirty.length });
      return { dirty, rebuilt, ms, patches: { uv: dirty.length, surface: dirty.length, nav: dirty.length } };
    },
    applyTown(dirtyIds, nextBlueprint = blueprint) {
      const t0 = nowMs();
      const dirty = expandByTopology(dirtyIds || [], 2);
      const solved = resolveTown(nextBlueprint, catalog, seed, { dirtyIds, previous, ring: 2 });
      previous = solved.solver;
      const ms = nowMs() - t0;
      log.push({ cells: solved.cells.length, ms, dirty: dirty.length, backtracks: solved.backtracks });
      return { dirty, rebuilt: solved.solver.region, ms, town: solved, patches: { uv: dirty.length, surface: dirty.length, nav: dirty.length } };
    },
    stats() {
      return { pool: meshPool.size, log: log.slice() };
    },
  };
}

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
