// Global validators run after local WFC/MC compilation. They make failures
// actionable instead of silently replacing an invalid region with grass.

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function angle(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); }

export function validatePlanetTopology({ grid, assignment, manifest = [], water = null, navigation = null } = {}) {
  const errors = [];
  if (!grid?.dual?.validate?.().ok) errors.push("dual-non-manifold");
  const landCells = [...(assignment?.values?.() || [])].filter((tile) => tile?.land > 0.5).length;
  const total = grid?.dual?.cellCount || 0;
  const landRatio = total ? landCells / total : 0;
  if (landRatio < 0.1 || landRatio > 0.9) errors.push(`land-ratio:${landRatio.toFixed(3)}`);
  for (const landmark of manifest) {
    const nearest = [...(grid?.dual?.cells?.() || [])].reduce((best, cell) => {
      const current = angle(grid.dual.directionOf(cell.index), landmark.direction);
      return current < best ? current : best;
    }, Infinity);
    const nearestCells = [...(grid?.dual?.cells?.() || [])].sort((a, b) => angle(grid.dual.directionOf(a.index), landmark.direction) - angle(grid.dual.directionOf(b.index), landmark.direction) || a.index - b.index).slice(0, 4);
    const nearestCell = nearestCells[0];
    const nearestTile = nearestCell ? assignment?.get?.(nearestCell.id) : null;
    const requiresLand = ["highland-citadel", "crystal-canyon", "saihoji-moss-garden", "bookshop-town", "triple-gate"].includes(landmark.id);
    if (requiresLand && (nearest > Math.max(landmark.angularRadius * 2.5, 0.7) || !nearestCells.some((cell) => (assignment?.get?.(cell.id)?.land ?? 0) > 0.5))) errors.push(`landmark-off-land:${landmark.id}`);
  }
  // Deep ocean is the global body.  Shelf/coast tiles are allowed to form
  // local shoreline bands around land patches and are reported separately;
  // treating every shelf as one connected component would reject valid
  // coarse geodesic charts with islands between shoreline bands.
  const ocean = new Set([...((assignment?.entries?.() || []))].filter(([, tile]) => tile?.id?.startsWith?.("ocean.deep")).map(([id]) => id));
  let oceanComponents = 0;
  if (ocean.size) {
    const remaining = new Set(ocean);
    while (remaining.size) {
      oceanComponents++;
      const stack = [remaining.values().next().value];
      while (stack.length) { const id = stack.pop(); if (!remaining.delete(id)) continue; const cell = grid.dual.cells().find((entry) => entry.id === id); for (const edge of cell ? grid.dual.neighborsOf(cell.index) : []) { const next = grid.dual.cellId(edge.to); if (ocean.has(next) && remaining.has(next)) stack.push(next); } }
    }
    if (oceanComponents > 1) errors.push(`deep-ocean-disconnected:${oceanComponents}`);
  }
  if (water && !water.ocean?.curved) errors.push("ocean-not-curved");
  if (navigation && navigation.nodes?.some((node) => node.edges.some((edge) => edge.kind === "air"))) errors.push("airborne-nav-edge");
  return { ok: errors.length === 0, errors, landRatio, oceanComponents };
}

export function validateCurvedWaterRoutes(water) {
  const errors = [];
  for (const route of water?.routes || []) {
    for (const point of route.points || []) {
      const length = Math.hypot(...point.position);
      if (!Number.isFinite(length) || length <= 0) errors.push(`route-point:${route.id}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
