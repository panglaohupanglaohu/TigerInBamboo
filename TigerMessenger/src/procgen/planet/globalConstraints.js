// Macro constraints evaluated after spherical WFC and before MC submission.

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function angularDistance(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); }

function nearestCell(grid, direction) {
  return [...grid.dual.cells()].sort((a, b) => angularDistance(grid.dual.directionOf(a.index), direction) - angularDistance(grid.dual.directionOf(b.index), direction) || a.index - b.index)[0];
}

function landCellSet({ assignment } = {}) {
  return new Set([...assignment?.entries?.() || []]
    .filter(([, tile]) => (tile?.land ?? 0) > 0.5)
    .map(([id]) => id));
}

function nearestLandCell({ grid, assignment, direction } = {}) {
  return [...grid.dual.cells()]
    .filter((cell) => (assignment?.get?.(cell.id)?.land ?? 0) > 0.5)
    .sort((a, b) => angularDistance(grid.dual.directionOf(a.index), direction) - angularDistance(grid.dual.directionOf(b.index), direction) || a.index - b.index)[0] || null;
}

function reachableLand({ grid, land, startId } = {}) {
  if (!startId || !land.has(startId)) return new Set();
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    const cell = grid.dual.cells().find((entry) => entry.id === id);
    for (const edge of cell ? grid.dual.neighborsOf(cell.index) : []) {
      const next = grid.dual.cellId(edge.to);
      if (land.has(next) && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

function componentSizes({ grid, ids } = {}) {
  const remaining = new Set(ids);
  const sizes = [];
  while (remaining.size) {
    const stack = [remaining.values().next().value];
    let size = 0;
    while (stack.length) {
      const id = stack.pop();
      if (!remaining.delete(id)) continue;
      size++;
      const cell = grid.dual.cells().find((entry) => entry.id === id);
      for (const edge of cell ? grid.dual.neighborsOf(cell.index) : []) {
        const next = grid.dual.cellId(edge.to);
        if (remaining.has(next)) stack.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

function hasClosedCurvedBasin(water, index) {
  const lake = water?.lakes?.[index];
  return !!(lake?.curved && lake?.positions?.length >= 9 && lake?.indices?.length >= 3 && lake?.angularRadius > 0);
}

/**
 * Validate relationships which cannot be expressed by a single WFC edge:
 * the bookshop/saihoji hill chain, a highland-to-gate saddle, and closed
 * curved basins. This is data-only and can run in Node or a browser Worker.
 */
export function validatePlanetLandmarkLinks({ grid, assignment, manifest = [], water = null } = {}) {
  const errors = [];
  const land = landCellSet({ assignment });
  const byId = new Map(manifest.map((entry) => [entry.id, entry]));
  const connections = [];
  const pairs = [
    ["bookshop-town", "saihoji-moss-garden", "bookshop-saihoji-hills"],
    ["highland-citadel", "triple-gate", "highland-gate-highground"],
  ];
  for (const [fromId, toId, label] of pairs) {
    const from = byId.get(fromId); const to = byId.get(toId);
    if (!from || !to) continue;
    const start = nearestLandCell({ grid, assignment, direction: from.direction });
    const goal = nearestLandCell({ grid, assignment, direction: to.direction });
    const reachable = reachableLand({ grid, land, startId: start?.id });
    const connected = !!goal && reachable.has(goal.id);
    const saddle = connected && [...reachable].some((id) => assignment.get(id)?.family === "saddle");
    connections.push({ from: fromId, to: toId, connected, saddle });
    if (!connected) errors.push(label + ":disconnected");
    if (label === "highland-gate-highground" && !saddle) errors.push(label + ":missing-saddle");
  }
  const basinManifest = manifest.filter((entry) => entry.waterNeeds === "closed-lake-basin");
  const basinChecks = basinManifest.map((entry, index) => ({ id: entry.id, closed: hasClosedCurvedBasin(water, index) }));
  for (const check of basinChecks) if (!check.closed) errors.push("lake-basin-open:" + check.id);
  const waterfallEntry = manifest.find((entry) => entry.waterNeeds === "lower-waterfall-basin");
  const waterfallBasin = waterfallEntry
    ? (water?.lakes || []).find((lake) => lake.semantic === "waterfall-basin" && lake.centerDirection)
    : null;
  if (waterfallEntry && !waterfallBasin) errors.push("waterfall-l1-basin-missing");
  return { ok: errors.length === 0, errors, connections, basinChecks, waterfallBasin: !!waterfallBasin, landCells: land.size };
}

export function measurePlanetArea({ grid, assignment } = {}) {
  let land = 0; let ocean = 0; let coast = 0;
  for (const cell of grid?.dual?.cells?.() || []) {
    const tile = assignment?.get?.(cell.id);
    if ((tile?.land ?? 0) > 0.5) land++; else ocean++;
    if (tile?.family === "coast") coast++;
  }
  const total = land + ocean || 1;
  const landComponents = componentSizes({
    grid,
    ids: [...assignment?.entries?.() || []].filter(([, tile]) => (tile?.land ?? 0) > 0.5).map(([id]) => id),
  });
  return {
    landCells: land,
    oceanCells: ocean,
    coastCells: coast,
    landFraction: land / total,
    oceanFraction: ocean / total,
    landComponents,
    mainLandFraction: landComponents[0] ? landComponents[0] / total : 0,
  };
}

export function validatePlanetGlobalConstraints({ grid, assignment, manifest = [], water = null } = {}) {
  const errors = []; const area = measurePlanetArea({ grid, assignment });
  if (area.landFraction < 0.1 || area.landFraction > 0.9) errors.push("land-area-range");
  // subdivision=1 is a debug/preview graph with too few cells to preserve
  // every art-directed landmark and still express a 52% ocean ratio. The
  // production subdivision gate remains ocean-majority; the preview gate is
  // deliberately looser and is reported instead of silently changing pins.
  const oceanFloor = (grid?.dual?.cellCount || 0) < 40 ? 0.2 : 0.5;
  if (area.oceanFraction < oceanFloor) errors.push(`ocean-coverage:${area.oceanFraction.toFixed(3)}<${oceanFloor.toFixed(2)}`);
  if (!area.landComponents.length || area.landComponents.length > 8 || area.mainLandFraction < 0.25) errors.push("landmass-range");
  for (const landmark of manifest) {
    const nearby = [...grid.dual.cells()].sort((a, b) => angularDistance(grid.dual.directionOf(a.index), landmark.direction) - angularDistance(grid.dual.directionOf(b.index), landmark.direction) || a.index - b.index).slice(0, 4);
    const cell = nearby[0];
    const tile = cell ? assignment?.get?.(cell.id) : null;
    const landRequired = ["highland-citadel", "crystal-canyon", "saihoji-moss-garden", "bookshop-town", "triple-gate"].includes(landmark.id);
    if (landRequired && !nearby.some((entry) => (assignment?.get?.(entry.id)?.land ?? 0) > 0.5)) errors.push(`landmark-land:${landmark.id}`);
    if (landmark.waterNeeds === "coast" && !nearby.some((entry) => ["coast", "ocean"].includes(assignment?.get?.(entry.id)?.family))) errors.push(`harbor-coast:${landmark.id}`);
  }
  const lakeCount = manifest.filter((landmark) => landmark.waterNeeds === "closed-lake-basin").length;
  if (water && (water.lakes?.length || 0) < lakeCount) errors.push("closed-lake-count");
  const links = validatePlanetLandmarkLinks({ grid, assignment, manifest, water });
  errors.push(...links.errors);
  return { ok: errors.length === 0, errors, area, oceanFloor, lakeCount, links };
}
