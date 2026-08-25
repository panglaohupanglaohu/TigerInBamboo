// =====================================================================
// V10 climate field (G21-C, DeepSeek data layer).
//
// Projects the world wind onto each cell's tangent plane (no pole flip,
// no seam zeroing), advects a true upwind ocean fetch along dual edges
// (water length accumulates, land decays), computes orographic lift from
// the tangent terrain gradient and integrates a rain shadow from upwind
// ridges, then derives vapor / precipitationClimatology / cloudPotential /
// cloudBase on the same semantic cells.  Deterministic, reproducible,
// pure Node data code.
// =====================================================================

import { createSemanticCellV10, DEFAULT_SEMANTIC_CELL_V10 } from "./semanticFieldV10.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
export function angularDistance(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))); }

/**
 * Project a global wind direction onto the tangent plane of `dir`.
 * Returns the tangent unit vector; at exact alignment (degenerate
 * projection) falls back to the first tangent basis vector instead of
 * zeroing or flipping, so poles/seams stay continuous.
 */
export function projectWindTangent(dir, wind) {
  const d = normalize(dir);
  const rejected = [wind[0] - d[0] * dot(wind, d), wind[1] - d[1] * dot(wind, d), wind[2] - d[2] * dot(wind, d)];
  const length = Math.hypot(rejected[0], rejected[1], rejected[2]);
  if (length > 1e-6) return [rejected[0] / length, rejected[1] / length, rejected[2] / length];
  // Degenerate: pick a stable tangent basis (deterministic, not zero).
  const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize([
    ref[1] * d[2] - ref[2] * d[1],
    ref[2] * d[0] - ref[0] * d[2],
    ref[0] * d[1] - ref[1] * d[0],
  ]);
  return u;
}

/** Upwind neighbors: neighbors whose position projects FURTHER AGAINST the wind
 * (lower axis score) — the air arrives from them, so fetch/shadow advect
 * downwind through them without ever flowing back upstream. */
export function upwindNeighbors(grid, index, windUnit, threshold = 1e-6) {
  const dir = grid.dual.directionOf(index);
  const axis = dot(dir, windUnit);
  const out = [];
  for (const edge of grid.dual.neighborsOf(index)) {
    if (dot(grid.dual.directionOf(edge.to), windUnit) < axis - threshold) out.push(edge.to);
  }
  return out;
}

/**
 * @param {object} options
 *   grid            geodesic grid
 *   hydrology       result of solveHydrologyV10 (per-cell water/lake)
 *   elevationAt     (direction) => height (final terrain field)
 *   wind            global wind direction [x,y,z]
 *   radius          planet radius (fetch/edge units)
 *   fetchScale      vapor gain per unit fetch
 *   landDecay       fetch multiplier per land step
 *   maxFetchDistance  fetch advection budget (radians)
 *   maxShadowDistance rain-shadow advection budget (radians)
 *   iterations      advection pass count
 *   liftScale       gradient magnitude -> lift01 denominator
 */
export function solveClimateV10({
  grid, hydrology, elevationAt = () => 0, wind = [0, 0, 1], radius = 160,
  fetchScale = 0.5, landDecay = 0.9, maxFetchDistance = 1.6, maxShadowDistance = 1.2,
  iterations = 24, liftScale = 0.45,
} = {}) {
  if (!grid?.dual || !hydrology?.cells) throw new Error("climate-v10: grid and hydrology required");
  const cells = grid.dual.cells();
  const count = cells.length;
  const windUnit = normalize(wind);

  // --- per-cell tangent wind ---
  const windTangent = new Array(count);
  const windSpeed = new Array(count);
  for (let i = 0; i < count; i++) {
    const dir = grid.dual.directionOf(i);
    windTangent[i] = projectWindTangent(dir, windUnit);
    windSpeed[i] = Math.max(0, Math.hypot(wind[0], wind[1], wind[2]) * Math.sqrt(Math.max(0, 1 - dot(dir, windUnit) ** 2)));
  }

  // --- water fraction (shared with hydrology) ---
  const shallow = hydrology.shallowWaterDepth ?? 0.5;
  const waterFraction = hydrology.cells.map((cell) => clamp01(cell.water.waterDepth / Math.max(1e-6, shallow)));

  // --- upwind ocean fetch (advect along upwind dual edges) ---
  const fetch = new Array(count).fill(0);
  const fetchBudget = new Array(count).fill(0);
  for (let i = 0; i < count; i++) if (waterFraction[i] > 0) fetchBudget[i] = maxFetchDistance;
  for (let pass = 0; pass < iterations; pass++) {
    let changed = false;
    for (let i = 0; i < count; i++) {
      const dir = grid.dual.directionOf(i);
      const axis = dot(dir, windUnit);
      let best = fetch[i];
      let bestBudget = fetchBudget[i];
      for (const edge of grid.dual.neighborsOf(i)) {
        const n = edge.to;
        // only TRUE upwind neighbors may contribute (air arrives from them)
        if (dot(grid.dual.directionOf(n), windUnit) > axis - 1e-9) continue;
        const step = angularDistance(dir, grid.dual.directionOf(n));
        if (fetchBudget[n] < step - 1e-9) continue;
        const candidate = fetch[n] * landDecay + step * waterFraction[n];
        const budget = fetchBudget[n] - step;
        if (candidate > best + 1e-12) { best = candidate; bestBudget = budget; changed = true; }
        else if (Math.abs(candidate - best) <= 1e-12 && budget > bestBudget) { bestBudget = budget; changed = true; }
      }
      fetch[i] = best;
      fetchBudget[i] = bestBudget;
    }
    if (!changed) break;
  }

  // --- tangent gradient, orographic lift, rain shadow ---
  const lift = new Array(count).fill(0);
  const shadow = new Array(count).fill(0);
  const shadowBudget = new Array(count).fill(0);
  const shadowContribution = (i) => {
    const s = clamp01(lift[i] / liftScale);
    return s * s * (3 - 2 * s); // smoothstep, ridge contribution
  };
  for (let i = 0; i < count; i++) {
    const dir = grid.dual.directionOf(i);
    const elevation = elevationAt(dir);
    let gx = 0; let gy = 0; let gz = 0; let weightSum = 0;
    for (const edge of grid.dual.neighborsOf(i)) {
      const nDir = grid.dual.directionOf(edge.to);
      const step = angularDistance(dir, nDir) || 1e-6;
      const w = 1 / step;
      const delta = elevationAt(nDir) - elevation;
      gx += w * delta * (nDir[0] - dir[0] * dot(nDir, dir));
      gy += w * delta * (nDir[1] - dir[1] * dot(nDir, dir));
      gz += w * delta * (nDir[2] - dir[2] * dot(nDir, dir));
      weightSum += w;
    }
    if (weightSum > 0) { gx /= weightSum; gy /= weightSum; gz /= weightSum; }
    const grad = normalize([gx, gy, gz] || [0, 1, 0]);
    lift[i] = Math.max(0, dot(windTangent[i], grad) * Math.hypot(gx, gy, gz));
  }
  // Ridge cells emit a downwind shadow budget; the shadow itself is always
  // received from upwind neighbours, never self-applied.
  for (let i = 0; i < count; i++) {
    if (shadowContribution(i) > 0) shadowBudget[i] = maxShadowDistance;
  }
  for (let pass = 0; pass < iterations; pass++) {
    let changed = false;
    for (let i = 0; i < count; i++) {
      const dir = grid.dual.directionOf(i);
      const axis = dot(dir, windUnit);
      let best = shadow[i];
      let bestBudget = shadowBudget[i];
      // A cell's shadow comes from UPWIND ridges only — its own lift must
      // not shadow itself (that would make windward flanks darker than the
      // leeward rain shadow), and downwind neighbours must never feed the
      // shadow back upstream.
      for (const edge of grid.dual.neighborsOf(i)) {
        const n = edge.to;
        if (dot(grid.dual.directionOf(n), windUnit) > axis - 1e-9) continue;
        const step = angularDistance(dir, grid.dual.directionOf(n));
        if (shadowBudget[n] < step - 1e-9) continue;
        const candidate = shadow[n] * 0.88 + shadowContribution(n) * step;
        const budget = shadowBudget[n] - step;
        if (candidate > best + 1e-12) { best = candidate; bestBudget = budget; changed = true; }
        else if (Math.abs(candidate - best) <= 1e-12 && budget > bestBudget) { bestBudget = budget; changed = true; }
      }
      shadow[i] = clamp01(best);
      shadowBudget[i] = Math.max(bestBudget, 0);
    }
    if (!changed) break;
  }

  // --- vapor / precipitation / cloud potential / cloud base ---
  const cellsOut = cells.map((cell, i) => {
    const hyd = hydrology.cells[i].water;
    const evaporativeMoisture = clamp01(waterFraction[i] * 0.65 + hyd.baseWetness * 0.35);
    const vapor = clamp01(evaporativeMoisture + fetch[i] * fetchScale);
    const lift01v = clamp01(lift[i] / liftScale);
    const precipitationClimatology = clamp01(vapor * (0.42 + lift01v * 0.78) - shadow[i] * 0.64);
    const cloudPotential = clamp01(0.08 + vapor * 0.48 + lift01v * 0.32 - shadow[i] * 0.38);
    const cloudBase = Math.max(0.25, 1.4 - vapor * 0.9 - lift01v * 0.5);
    return createSemanticCellV10({
      id: cell.id,
      terrain: { ...DEFAULT_SEMANTIC_CELL_V10.terrain, ...hydrology.cells[i].terrain },
      water: { ...hydrology.cells[i].water },
      climate: {
        windX: windTangent[i][0],
        windY: windTangent[i][2],
        upwindOceanFetch: fetch[i],
        evaporativeMoisture,
        vapor,
        orographicLift: lift[i],
        rainShadow: shadow[i],
        precipitationClimatology,
        cloudPotential,
        cloudBase,
      },
      ecology: { ...DEFAULT_SEMANTIC_CELL_V10.ecology },
      locks: { ...DEFAULT_SEMANTIC_CELL_V10.locks },
    });
  });

  return Object.freeze({
    kind: "climate-field-v10",
    cells: cellsOut,
    byId: new Map(cellsOut.map((cell) => [cell.id, cell])),
    wind: windUnit,
    windTangent,
    windSpeed,
    upwindOceanFetch: fetch,
    orographicLift: lift,
    rainShadow: shadow,
    fetchBudget,
    shadowBudget,
    iterations: iterations,
    hash: hashClimateFieldV10(cellsOut),
  });
}

export function hashClimateFieldV10(cells = []) {
  let hash = 2166136261;
  for (const cell of cells) {
    const climate = cell.climate || {};
    const token = `${cell.id}:${Number(climate.upwindOceanFetch || 0).toFixed(4)}:${Number(climate.orographicLift || 0).toFixed(4)}:${Number(climate.rainShadow || 0).toFixed(4)}:${Number(climate.vapor || 0).toFixed(4)}:${Number(climate.cloudBase || 0).toFixed(4)}`;
    for (const character of token) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(16);
}
