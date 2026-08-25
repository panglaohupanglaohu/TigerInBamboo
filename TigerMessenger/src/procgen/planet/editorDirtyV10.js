// =====================================================================
// V10 editor dirty regions (G21-G, DeepSeek data layer).
//
// PLAN 12.30.6 dependency invalidation as pure functions over the dual
// graph: terrain/water edits dirty a local hydrology halo and a climate
// DOWNWIND CONE (bounded by maxFetchDistance, crossing chart seams by
// construction because it walks the dual graph, not chart bounds);
// wind edits dirty global climate; vegetation edits dirty a local ecology
// halo.  Undo/redo and failed transactions are compared by stable dirty
// hashes.  The editor UI wiring belongs to the Codex integration side.
// =====================================================================

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

/** BFS halo of `rings` steps around the source cell set. */
export function localHaloV10(grid, sourceCells, rings = 2) {
  const dirty = new Set();
  const frontier = [];
  for (const id of sourceCells) {
    const index = grid.dual.indexOfId(id);
    if (index < 0) throw new Error(`editor-dirty-v10: unknown cell ${id}`);
    dirty.add(id);
    frontier.push({ index, depth: 0 });
  }
  const visited = new Set(dirty);
  while (frontier.length) {
    const { index, depth } = frontier.shift();
    if (depth >= rings) continue;
    for (const edge of grid.dual.neighborsOf(index)) {
      const next = grid.dual.cellId(edge.to);
      if (visited.has(next)) continue;
      visited.add(next);
      dirty.add(next);
      frontier.push({ index: edge.to, depth: depth + 1 });
    }
  }
  return dirty;
}

/**
 * Downwind cone: from each source cell, cells reachable by walking with the
 * wind (axis score increasing) within maxDistanceRad, with a lateral spread
 * that grows with downwind distance up to maxHalfWidth.  The cone is
 * computed on the dual graph, so it crosses chart seams by construction and
 * is bounded by the same budget used by the climate fetch advection.
 */
export function downwindConeV10(grid, { sourceCells, wind = [0, 0, 1], maxDistanceRad = 1.6, maxHalfWidth = 0.5, coneHalfAngle = 0.35 } = {}) {
  const windUnit = normalize(wind);
  const dirty = new Set();
  const frontier = [];
  for (const id of sourceCells) {
    const index = grid.dual.indexOfId(id);
    if (index < 0) throw new Error(`editor-dirty-v10: unknown cell ${id}`);
    dirty.add(id);
    frontier.push({ index, budget: maxDistanceRad, axis: dot(grid.dual.directionOf(index), windUnit) });
  }
  const visited = new Set(dirty);
  while (frontier.length) {
    const { index, budget, axis } = frontier.shift();
    if (budget <= 0) continue;
    const dir = grid.dual.directionOf(index);
    for (const edge of grid.dual.neighborsOf(index)) {
      const nDir = grid.dual.directionOf(edge.to);
      const nextAxis = dot(nDir, windUnit);
      if (nextAxis < axis - 1e-9) continue; // never walk upwind
      const step = Math.acos(Math.max(-1, Math.min(1, dot(dir, nDir))));
      const nextBudget = budget - step;
      if (nextBudget < 0) continue;
      const next = grid.dual.cellId(edge.to);
      if (visited.has(next)) continue;
      // lateral spread: distance from the wind line through the source
      const lateral = Math.sqrt(Math.max(0, 1 - nextAxis * nextAxis));
      const downwindDist = maxDistanceRad - nextBudget;
      const allowedWidth = Math.min(maxHalfWidth, downwindDist * coneHalfAngle + 0.08);
      if (lateral > allowedWidth + 1e-9) continue;
      visited.add(next);
      dirty.add(next);
      frontier.push({ index: edge.to, budget: nextBudget, axis: nextAxis });
    }
  }
  return dirty;
}

/**
 * PLAN 12.30.6 invalidation table for one edit.
 * edit: { touches: ["terrain"] | ["water"] | ["wind"] | ["vegetation"] | [...],
 *         cells: [cellId, ...] }
 * Returns per-stage dirty cell sets plus stable hashes for undo/redo.
 */
export function invalidateRegionsV10(grid, edit, { wind = [0, 0, 1], maxFetchDistance = 1.6, maxShadowDistance = 1.2, haloRings = 2 } = {}) {
  const touches = new Set(edit.touches || []);
  const source = edit.cells || [];
  const hydrology = new Set();
  const climate = new Set();
  const cloud = new Set();
  const ecology = new Set();
  const vegetation = new Set();
  if (touches.has("terrain") || touches.has("water")) {
    for (const id of localHaloV10(grid, source, haloRings)) hydrology.add(id);
  }
  if (touches.has("terrain") || touches.has("water") || touches.has("wind")) {
    const cone = downwindConeV10(grid, { sourceCells: source, wind, maxDistanceRad: Math.max(maxFetchDistance, maxShadowDistance) });
    for (const id of cone) climate.add(id);
    for (const id of cone) cloud.add(id);
  }
  if (touches.has("wind")) {
    // global wind edit: every cell is downstream of the new wind at some point
    for (const cell of grid.dual.cells()) { climate.add(cell.id); cloud.add(cell.id); }
  }
  for (const id of hydrology) ecology.add(id);
  for (const id of climate) ecology.add(id);
  if (touches.has("vegetation")) for (const id of localHaloV10(grid, source, haloRings)) { ecology.add(id); vegetation.add(id); }
  const regions = { hydrology, climate, cloud, ecology, vegetation };
  return Object.freeze({
    regions,
    hash: dirtyRegionHashV10(regions),
    counts: Object.fromEntries(Object.entries(regions).map(([key, set]) => [key, set.size])),
  });
}

export function dirtyRegionHashV10(regions) {
  let hash = 2166136261;
  const update = (value) => { hash ^= value; hash = Math.imul(hash, 16777619); };
  for (const key of ["hydrology", "climate", "cloud", "ecology", "vegetation"]) {
    for (const character of key) update(character.charCodeAt(0));
    for (const id of [...(regions[key] || [])].sort()) for (const character of id) update(character.charCodeAt(0));
    update(0);
  }
  return `dirty${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
