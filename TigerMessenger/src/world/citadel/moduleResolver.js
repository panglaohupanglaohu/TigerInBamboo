// =====================================================================
//  模块求解：socket 约束、稳定加权、有限回溯、可解释 fallback（G3）
// =====================================================================

import { catalogMatch, encodeSignature } from "./moduleCatalog.js";
import { hashHex } from "../../core/rng.js";
import { appearanceHash, buildNeighborMap, solveDirtyRegion } from "./constraintSolver.js";

const LOCKED_SEMANTICS = new Set(["gate", "stairs-run", "road", "canal", "water-gate", "siege-route"]);

function satisfiesSockets(module, cell) {
  const occ = cell.occupancy || {};
  const map = { N: occ.N, E: occ.E, S: occ.S, W: occ.W, U: occ.U, D: occ.D };
  for (const dir of ["N", "E", "S", "W"]) {
    const want = module.sockets[dir];
    const has = map[dir] ? "wall" : "open";
    if (want === "wall" && has === "open" && cell.semantic === "block") return false;
    if (want === "open" && has === "wall" && module.family === "gate") return false;
  }
  if (module.requires.includes("support-below") && !map.D) return false;
  if (module.forbids.includes("water-intersection") && cell.semantic === "canal") return false;
  if (module.walkSurface === "flower-tile" && cell.semantic === "grass") return false;
  return true;
}

function preservesRequiredRoutes(module, cell) {
  if (!cell.routeClearance) return true;
  if (LOCKED_SEMANTICS.has(cell.semantic) && module.sockets.N !== "open" && module.family !== "gate" && module.family !== "hole" && module.family !== "stairs") {
    return false;
  }
  return true;
}

function weightedPick(list, seedStr) {
  const u = (parseInt(hashHex(seedStr), 16) >>> 0) / 0x100000000;
  const total = list.reduce((s, m) => s + m.weight, 0) || 1;
  let x = u * total;
  for (const m of list) {
    x -= m.weight;
    if (x <= 0) return m;
  }
  return list[list.length - 1];
}

export function resolveCell(cell, world, catalog, seed) {
  const signature = encodeSignature(cell, world);
  if (LOCKED_SEMANTICS.has(cell.semantic) && cell.lockModuleId && catalog.byId[cell.lockModuleId]) {
    return { module: catalog.byId[cell.lockModuleId], signature, reason: "locked-route", fallback: false };
  }
  let candidates = catalogMatch(catalog, signature, cell.familyHint)
    .filter((m) => satisfiesSockets(m, cell))
    .filter((m) => preservesRequiredRoutes(m, cell));
  const rejected = [];
  if (!candidates.length) {
    rejected.push("empty-after-filters");
    const fb =
      catalog.modules.find((m) => m.family === "floor" && m.role === "base") || catalog.modules[0];
    return { module: fb, signature, reason: "explainable-fallback", fallback: true, rejected };
  }
  const picked = weightedPick(candidates, `${seed}|${cell.id}|${signature}`);
  return { module: picked, signature, reason: "weighted", fallback: false, candidateCount: candidates.length };
}

export function extractTownCells(blueprint, catalog) {
  const cells = [];
  const terraces = blueprint.town?.layout?.terraces || [];
  terraces.forEach((terr) => {
    (terr.levels || []).forEach((rows, iy) => {
      (rows || []).forEach((row, iz) => {
        [...String(row)].forEach((ch, ix) => {
          if (!ch || ch === ".") return;
          const id = `cell:${terr.terraceIndex}:${ix}:${iy}:${iz}`;
          const above = String((terr.levels[iy + 1] || [])[iz] || "")[ix];
          const below = iy === 0 ? "." : String((terr.levels[iy - 1] || [])[iz] || "")[ix];
          const occ = {
            N: iz > 0 && String(rows[iz - 1] || "")[ix] !== ".",
            S: iz + 1 < rows.length && String(rows[iz + 1] || "")[ix] !== ".",
            W: ix > 0 && String(row)[ix - 1] !== ".",
            E: !!(String(row)[ix + 1] && String(row)[ix + 1] !== "."),
            U: !!(above && above !== "."),
            D: iy === 0 || !!(below && below !== "."),
          };
          const semantic = ch === "G" ? "gate" : ch === "S" ? "stairs-run" : ch === "C" ? "canal" : ch === "R" ? "road" : "block";
          const route = semantic === "gate" || semantic === "stairs-run" || semantic === "road";
          const balconyLock = ch === "B" ? catalog.modules.find((m) => m.family === "balcony")?.id : null;
          cells.push({
            id,
            occupancy: occ,
            semantic,
            support: 1,
            routeClearance: route ? 1 : 0,
            lockModuleId: balconyLock || (semantic === "gate" ? catalog.modules.find((m) => m.family === "gate")?.id : null),
            familyHint: balconyLock ? "balcony" : semantic === "gate" ? "gate" : semantic === "stairs-run" ? "stairs" : "floor",
            char: ch,
          });
        });
      });
    });
  });
  cells.sort((a, b) => (a.id < b.id ? -1 : 1));
  return cells;
}

export function resolveTown(blueprint, catalog, seed, opts = {}) {
  const cells = extractTownCells(blueprint, catalog);
  const world = {
    cells,
    catalog,
    requiredRoutes: cells.filter((c) => c.routeClearance).map((c) => c.id),
    neighbors: buildNeighborMap(cells),
  };
  const solved = solveDirtyRegion(world, opts.dirtyIds || cells.map((c) => c.id), seed, {
    previous: opts.previous || null,
    ring: opts.ring ?? 2,
    maxBacktrack: opts.maxBacktrack,
  });
  return {
    cells: solved.cells,
    fallbackCount: solved.fallbackCount,
    gateLocks: solved.cells.filter((r) => r.reason === "locked-route").length,
    contradiction: solved.contradiction || 0,
    backtracks: solved.backtracks || 0,
    solver: solved,
    hash: solved.hash || appearanceHash(solved.cells),
  };
}

export function moduleCoverage(catalog, seeds = 100) {
  const stats = Object.fromEntries(
    catalog.modules.map((m) => [m.id, { candidate: 0, selected: 0, rejected: 0, firstSeed: null }])
  );
  for (let s = 0; s < seeds; s++) {
    const world = {};
    for (const family of Object.keys(catalog.byFamily)) {
      const cell = {
        id: `cov:${s}:${family}`,
        occupancy: { N: 1, E: 1, S: 0, W: 1, U: 1, D: 1 },
        semantic: family === "gate" ? "gate" : "block",
        support: 1,
        familyHint: family,
        routeClearance: family === "gate" || family === "stairs" ? 1 : 0,
      };
      const list = catalogMatch(catalog, encodeSignature(cell, world), family).filter((m) =>
        satisfiesSockets(m, cell)
      );
      for (const m of list) stats[m.id].candidate += 1;
      if (list.length) {
        const r = resolveCell(cell, world, catalog, s + 1);
        stats[r.module.id].selected += 1;
        if (stats[r.module.id].firstSeed == null) stats[r.module.id].firstSeed = s + 1;
      }
    }
  }
  const never = Object.entries(stats)
    .filter(([, v]) => v.candidate > 0 && v.selected === 0)
    .map(([id]) => id);
  return { stats, neverSelected: never, seedCount: seeds };
}
