// =====================================================================
// V10 hydrology field (G21-B, DeepSeek data layer).
//
// Derives water from the final terrain elevation field only: the sea-level
// intersection for the ocean, terrain-driven fill/spill for closed
// depression lakes, and authored basin locks as hard level/spill
// constraints that may adjust a basin's water level but never bypass the
// terrain (no standalone rectangular/circular water meshes as data
// sources).  Also exposes signed coast distance, drainage/flow and stable
// shoreline boundary IDs that share the WFC water-tile socket vocabulary.
// Pure Node data code; no Three.js.
// =====================================================================

import { createSemanticCellV10, DEFAULT_SEMANTIC_CELL_V10 } from "./semanticFieldV10.js";

const EPSILON = 1e-6;

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
export function angularDistance(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))); }
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function reject(v, axis) { const d = dot(v, axis); return [v[0] - axis[0] * d, v[1] - axis[1] * d, v[2] - axis[2] * d]; }

/**
 * Build per-cell helpers over the dual graph.
 */
function cellIndex(grid) {
  const cells = grid.dual.cells();
  const byId = new Map(cells.map((cell) => [cell.id, cell.index]));
  return { cells, byId, directionOf: (index) => grid.dual.directionOf(index), neighborsOf: (index) => grid.dual.neighborsOf(index), cellId: (index) => grid.dual.cellId(index) };
}

/**
 * @param {object} options
 *   grid          geodesic grid (dual graph)
 *   elevationAt   (direction:[x,y,z]) => number   final terrain height
 *   seaLevel      ocean surface height (default 0)
 *   basinLocks    [{id, direction, angularRadius, level, spill?}]
 *                 authored lakes: hard level + optional declared spill;
 *                 the terrain must still support the water body.
 *   shallowWaterDepth  depth below which water is "shallow" (default 0.5)
 *   maxCoastDistance   coast SDF propagation cap (default 6 rad*radius)
 */
export function solveHydrologyV10({ grid, elevationAt = () => -2, seaLevel = 0, basinLocks = [], shallowWaterDepth = 0.5, radius = 160, maxCoastDistance = 6 } = {}) {
  if (!grid?.dual) throw new Error("hydrology-v10: grid.dual required");
  const { cells, byId, directionOf, neighborsOf, cellId } = cellIndex(grid);
  const count = cells.length;
  const elevation = new Array(count);
  for (let i = 0; i < count; i++) elevation[i] = Number(elevationAt(directionOf(i)));
  if (elevation.some((value) => !Number.isFinite(value))) throw new Error("hydrology-v10: non-finite elevation from terrain field");

  // --- authored basin water: pour-point flood fill ---
  // A hard lock may set a basin's water level/spill, but the water body
  // itself must come from the terrain: pour at the lock direction's nearest
  // cell and flood every connected cell below the lock level.  A lock whose
  // pour point is above the level stays dry (reported, not a leak).
  const waterLevel = new Array(count).fill(seaLevel);
  const lakeMask = new Array(count).fill(0);
  const basinOf = new Array(count).fill(-1);
  for (let b = 0; b < basinLocks.length; b++) {
    const lock = basinLocks[b];
    if (!lock?.direction || !(lock.angularRadius > 0)) continue;
    const level = lock.level ?? seaLevel;
    let pour = -1;
    let best = Infinity;
    for (let i = 0; i < count; i++) {
      const d = angularDistance(directionOf(i), lock.direction);
      if (d < best) { best = d; pour = i; }
    }
    if (pour < 0 || elevation[pour] >= level) continue; // dry lock
    const queue = [pour];
    basinOf[pour] = b;
    while (queue.length) {
      const current = queue.pop();
      for (const edge of neighborsOf(current)) {
        const next = edge.to;
        if (basinOf[next] >= 0) continue;
        if (elevation[next] < level) {
          basinOf[next] = b;
          queue.push(next);
        }
      }
    }
    for (let i = 0; i < count; i++) {
      if (basinOf[i] === b) {
        waterLevel[i] = level;
        lakeMask[i] = 1;
      }
    }
  }
  // Ocean: below sea level outside any authored basin.
  for (let i = 0; i < count; i++) {
    if (elevation[i] < seaLevel && basinOf[i] < 0) {
      waterLevel[i] = seaLevel;
      lakeMask[i] = 0;
    }
  }
  const waterDepth = new Array(count);
  const landMask = new Array(count);
  for (let i = 0; i < count; i++) {
    waterDepth[i] = Math.max(0, waterLevel[i] - elevation[i]);
    landMask[i] = waterDepth[i] > EPSILON ? 0 : 1;
  }

  // --- natural depression lakes: below-sea components not connected to the
  // dominant water body ---
  // The ocean is the largest below-sea component; any other below-sea
  // component is a closed depression whose water level is its terrain spill
  // rim (fill/spill by the terrain field, never a rectangle/circle source).
  {
    const visitedDepression = new Set();
    const components = [];
    for (let i = 0; i < count; i++) {
      if (landMask[i] !== 0 || lakeMask[i] !== 0 || visitedDepression.has(i)) continue;
      const component = [];
      const queue = [i];
      visitedDepression.add(i);
      while (queue.length) {
        const current = queue.pop();
        component.push(current);
        for (const edge of neighborsOf(current)) {
          if (landMask[edge.to] === 0 && lakeMask[edge.to] === 0 && !visitedDepression.has(edge.to)) {
            visitedDepression.add(edge.to);
            queue.push(edge.to);
          }
        }
      }
      components.push(component);
    }
    components.sort((a, b) => b.length - a.length);
    for (let c = 1; c < components.length; c++) {
      let spill = Infinity;
      for (const index of components[c]) {
        for (const edge of neighborsOf(index)) if (landMask[edge.to] === 1) spill = Math.min(spill, elevation[edge.to]);
      }
      if (!Number.isFinite(spill)) continue;
      for (const index of components[c]) {
        waterLevel[index] = Math.max(spill, seaLevel);
        lakeMask[index] = 1;
        waterDepth[index] = Math.max(0, waterLevel[index] - elevation[index]);
        landMask[index] = waterDepth[index] > EPSILON ? 0 : 1;
      }
    }
  }

  // --- basin closure / spill report ---
  const basins = basinLocks.map((lock, b) => {
    const waterCells = [];
    const boundary = [];
    for (let i = 0; i < count; i++) {
      if (basinOf[i] !== b) continue;
      waterCells.push(i);
      for (const edge of neighborsOf(i)) {
        if (landMask[edge.to] === 1) { boundary.push({ water: i, land: edge.to, elevation: elevation[edge.to] }); break; }
      }
    }
    const spillElevation = boundary.length ? Math.min(...boundary.map((entry) => entry.elevation)) : Infinity;
    const closed = boundary.length > 0 && spillElevation >= (lock.level ?? seaLevel) - EPSILON;
    const hasValidSpillOrLock = closed || (lock.spill != null && Number.isFinite(lock.spill));
    return Object.freeze({
      id: lock.id,
      waterCellCount: waterCells.length,
      dry: waterCells.length === 0,
      boundaryCount: boundary.length,
      spillElevation,
      closed,
      hasValidSpillOrLock,
    });
  });
  // A lock that lands on dry terrain is an unsatisfied lock, not an open
  // basin; only water-bearing basins that are neither closed nor spilled
  // count as leaks ("悬空水片/开放湖盆").
  const openBasins = basins.filter((basin) => !basin.dry && !basin.hasValidSpillOrLock);

  // --- coast distance: signed multi-source BFS from shoreline ---
  const coastDistance = new Array(count).fill(0);
  {
    let maxStep = 0.5;
    for (let i = 0; i < count; i++) {
      const dir = directionOf(i);
      for (const edge of neighborsOf(i)) {
        maxStep = Math.max(maxStep, angularDistance(dir, directionOf(edge.to)));
      }
    }
    const meanStep = Math.max(1e-3, maxStep) * radius;
    const visited = new Set();
    const frontier = [];
    for (let i = 0; i < count; i++) {
      const hasWaterNeighbor = neighborsOf(i).some((edge) => landMask[edge.to] === 0);
      const isWater = landMask[i] === 0;
      const hasLandNeighbor = neighborsOf(i).some((edge) => landMask[edge.to] === 1);
      if ((isWater && hasLandNeighbor) || (!isWater && hasWaterNeighbor)) {
        coastDistance[i] = (landMask[i] === 1 ? 0.5 : -0.5) * meanStep;
        visited.add(i);
        frontier.push(i);
      }
    }
    while (frontier.length) {
      const current = frontier.shift();
      if (Math.abs(coastDistance[current]) >= maxCoastDistance * radius) continue;
      for (const edge of neighborsOf(current)) {
        const next = edge.to;
        if (visited.has(next)) continue;
        if (landMask[next] === landMask[current]) {
          visited.add(next);
          const step = angularDistance(directionOf(current), directionOf(next)) * radius;
          coastDistance[next] = coastDistance[current] + (landMask[next] === 1 ? step : -step);
          frontier.push(next);
        }
      }
    }
  }

  // --- drainage / flow: steepest descent on land; sinks get token 7 ---
  const drainage = new Array(count).fill(0);
  const flowX = new Array(count).fill(0);
  const flowY = new Array(count).fill(0);
  for (let i = 0; i < count; i++) {
    if (landMask[i] === 0) { drainage[i] = 7; continue; }
    const dir = directionOf(i);
    const lower = neighborsOf(i)
      .map((edge) => ({ to: edge.to, elevation: elevation[edge.to], id: cellId(edge.to) }))
      .filter((entry) => entry.elevation < elevation[i] - EPSILON)
      .sort((a, b) => a.elevation - b.elevation || (a.id < b.id ? -1 : 1));
    if (!lower.length) { drainage[i] = 7; continue; }
    const target = lower[0];
    const rank = neighborsOf(i).slice().sort((a, b) => (cellId(a.to) < cellId(b.to) ? -1 : 1)).findIndex((edge) => edge.to === target.to);
    drainage[i] = rank >= 0 ? rank : 7;
    const t = reject(normalize(directionOf(target.to)), dir);
    const tl = Math.hypot(t[0], t[1], t[2]) || 1;
    flowX[i] = t[0] / tl;
    flowY[i] = t[2] / tl;
  }

  // --- base wetness ---
  const baseWetness = new Array(count);
  for (let i = 0; i < count; i++) {
    if (landMask[i] === 0) baseWetness[i] = 1;
    else if (waterDepth[i] > 0 && waterDepth[i] < shallowWaterDepth) baseWetness[i] = 0.75; // wetland
    else baseWetness[i] = clamp01(0.15 + 0.55 * clamp01(coastDistance[i] / (1.2 * radius)));
  }

  // --- per-cell semantic output ---
  const cellsOut = cells.map((cell, i) => createSemanticCellV10({
    id: cell.id,
    terrain: { ...DEFAULT_SEMANTIC_CELL_V10.terrain, elevation: elevation[i] },
    water: {
      landMask: landMask[i],
      waterDepth: waterDepth[i],
      lakeMask: lakeMask[i],
      coastDistance: coastDistance[i],
      drainage: drainage[i],
      flowX: flowX[i],
      flowY: flowY[i],
      baseWetness: baseWetness[i],
    },
    climate: { ...DEFAULT_SEMANTIC_CELL_V10.climate },
    ecology: { ...DEFAULT_SEMANTIC_CELL_V10.ecology },
    locks: { ...DEFAULT_SEMANTIC_CELL_V10.locks },
  }));

  return Object.freeze({
    kind: "hydrology-field-v10",
    cells: cellsOut,
    byId: new Map(cellsOut.map((cell) => [cell.id, cell])),
    waterLevel,
    landMask,
    waterDepth,
    lakeMask,
    basinOf,
    basins,
    openBasins,
    coastDistance,
    drainage,
    flowX,
    flowY,
    baseWetness,
    shallowWaterDepth,
    seaLevel,
    radius,
    surfaceEverywhereSupported: !openBasins.length,
  });
}

/** Stable shoreline boundary IDs shared with WFC water tile sockets. */
export function shorelineEdgesV10(grid, hydrology) {
  if (!grid?.dual || !hydrology?.landMask) return [];
  const edges = [];
  const seen = new Set();
  const cells = grid.dual.cells();
  for (let i = 0; i < cells.length; i++) {
    for (const edge of grid.dual.neighborsOf(i)) {
      const a = cells[i].id;
      const b = grid.dual.cellId(edge.to);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const landA = hydrology.landMask[i] === 1;
      const landB = hydrology.landMask[edge.to] === 1;
      if (landA !== landB) {
        edges.push(Object.freeze({
          id: `shore:${a < b ? a : b}:${a < b ? b : a}`,
          a: a < b ? a : b,
          b: a < b ? b : a,
          landSide: landA ? a : b,
          waterSide: landA ? b : a,
          centerDirection: normalize([
            grid.dual.directionOf(i)[0] + grid.dual.directionOf(edge.to)[0],
            grid.dual.directionOf(i)[1] + grid.dual.directionOf(edge.to)[1],
            grid.dual.directionOf(i)[2] + grid.dual.directionOf(edge.to)[2],
          ]),
        }));
      }
    }
  }
  return edges.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** WFC water-tile socket vocabulary for a cell (shared stable boundary). */
export function shoreTokenV10(hydrology, cellId) {
  const cell = hydrology.byId.get(cellId);
  if (!cell) return "unknown";
  const w = cell.water;
  const coastBand = 0.35 * (hydrology.radius ?? 160);
  if (w.landMask === 1) return w.coastDistance < coastBand ? "coast" : "land";
  if (w.lakeMask === 1) return w.waterDepth < 0.01 ? "wetland" : "lake";
  return w.waterDepth < hydrology.shallowWaterDepth ? "shelf" : "ocean";
}
