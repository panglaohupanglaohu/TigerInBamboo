// Surface navigation graph.  Walkers move across surface nodes and can only
// change layer through an explicit portal; no airborne shortcut is generated.

function normalize(v) { const l = Math.hypot(...v) || 1; return v.map((n) => n / l); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function compilePlanetNavigationV8({ grid, surface, portals = [], landmarks = [], stepLimit = 0.46 } = {}) {
  const nodes = grid.dual.cells().map((cell) => ({
    id: cell.id,
    index: cell.index,
    direction: normalize(grid.dual.directionOf(cell.index)),
    position: null,
    surfaceId: "planet-land:" + cell.id,
    landformClass: nearestLandform(grid.dual.directionOf(cell.index), landmarks)?.landformClass || null,
    edges: [],
  }));
  for (const node of nodes) {
    const semantic = surface.field.semanticAt(node.direction);
    node.position = node.direction.map((n) => n * (surface.radius + semantic.height));
  }
  for (const node of nodes) {
    for (const edge of grid.dual.neighborsOf(node.index)) {
      const target = nodes[edge.to];
      if (!target) continue;
      const slope = Math.abs((target.position[0] * node.direction[0] + target.position[1] * node.direction[1] + target.position[2] * node.direction[2]) - (node.position[0] * node.direction[0] + node.position[1] * node.direction[1] + node.position[2] * node.direction[2]));
      if (slope <= stepLimit || edge.portal) node.edges.push({
        to: target.id,
        kind: "surface",
        edgeType: "surface",
        direction: edge.direction,
        slope,
        surfaceId: node.surfaceId,
        landformClass: node.landformClass,
      });
    }
  }
  for (const portal of portals) {
    const from = nodes.find((node) => node.id === portal.from || node.index === portal.from);
    const to = nodes.find((node) => node.id === portal.to || node.index === portal.to);
    if (!from || !to) continue;
    from.edges.push({ to: to.id, kind: portal.kind || "stair", edgeType: "portal", portalId: portal.id, surfaceTransition: true, surfaceId: from.surfaceId, slope: 0, landformClass: from.landformClass });
    if (portal.bidirectional !== false) to.edges.push({ to: from.id, kind: portal.kind || "stair", edgeType: "portal", portalId: portal.id, surfaceTransition: true, surfaceId: to.surfaceId, slope: 0, landformClass: to.landformClass });
  }
  const graph = { kind: "planet-surface-nav-v8", nodes, portals, hash: hashNavigation(nodes, portals) };
  return graph;
}

function nearestLandform(direction, landmarks) {
  const candidates = (landmarks || []).filter((landmark) => landmark?.landformClass);
  return candidates.map((landmark) => ({ landmark, score: dot(direction, landmark.direction) })).sort((a, b) => b.score - a.score || a.landmark.id.localeCompare(b.landmark.id))[0]?.landmark || null;
}

export function compileManifestPortals(grid, manifest = []) {
  const portals = [];
  for (const landmark of manifest) {
    const nearest = [...grid.dual.cells()].map((cell) => {
      const direction = grid.dual.directionOf(cell.index);
      return { cell, score: dot(direction, landmark.direction) };
    }).sort((a, b) => b.score - a.score).slice(0, Math.min(5, grid.dual.cellCount));
    for (let i = 0; i < nearest.length - 1; i++) {
      const stairPortal = landmark.id.includes("highland") || landmark.id === "highland-citadel" || landmark.id === "triple-gate" || landmark.landformClass === "volcanic-snow-massif" || landmark.landformClass === "rift-shoulder-pass";
      portals.push({ id: `${landmark.id}:portal:${i}`, from: nearest[i].cell.id, to: nearest[i + 1].cell.id, kind: stairPortal ? "stairs" : "surface-transition", bidirectional: true });
    }
  }
  return portals;
}

function hashNavigation(nodes, portals) {
  let h = 2166136261;
  for (const node of nodes) { for (const c of node.id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } for (const edge of node.edges) { for (const c of `${edge.to}:${edge.kind}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } } }
  h ^= portals.length;
  return `nav${(h >>> 0).toString(16)}`;
}

export function validatePlanetNavigation(graph) {
  const errors = [];
  const ids = new Set(graph?.nodes?.map((node) => node.id) || []);
  for (const node of graph?.nodes || []) for (const edge of node.edges) if (!ids.has(edge.to)) errors.push(`dangling:${node.id}->${edge.to}`);
  if ((graph?.nodes || []).some((node) => node.position?.some((value) => !Number.isFinite(value)))) errors.push("non-finite-position");
  return { ok: errors.length === 0, errors };
}

export function findPlanetPath(graph, startId, goalId, { allowedKinds = null, preferKinds = [] } = {}) {
  if (!graph?.nodes?.some((node) => node.id === startId) || !graph.nodes.some((node) => node.id === goalId)) return { ok: false, reason: "unknown-node", nodes: [] };
  const queue = [{ id: startId, cost: 0 }]; const previous = new Map([[startId, null]]); const costs = new Map([[startId, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
    const current = queue.shift().id;
    if (current === goalId) break;
    const node = graph.nodes.find((entry) => entry.id === current);
    for (const edge of node?.edges || []) {
      if (allowedKinds && !allowedKinds.includes(edge.kind)) continue;
      if (edge.kind === "air") continue;
      const nextCost = (costs.get(current) || 0) + (preferKinds.includes(edge.kind) ? 1 : 4);
      if (costs.has(edge.to) && costs.get(edge.to) <= nextCost) continue;
      costs.set(edge.to, nextCost);
      previous.set(edge.to, current); queue.push({ id: edge.to, cost: nextCost });
    }
  }
  if (!previous.has(goalId)) return { ok: false, reason: "unreachable", nodes: [] };
  const nodes = []; let current = goalId;
  while (current !== null) { nodes.push(current); current = previous.get(current); }
  nodes.reverse();
  return { ok: true, nodes, edges: nodes.slice(1).map((id, index) => graph.nodes.find((node) => node.id === nodes[index])?.edges.find((edge) => edge.to === id) || null).filter(Boolean) };
}

export function validatePlanetPath(path, { requirePortalKinds = [] } = {}) {
  const errors = [];
  if (!path?.ok || !path.nodes?.length) errors.push("empty-path");
  if ((path?.edges || []).some((edge) => edge.kind === "air")) errors.push("air-edge");
  if (requirePortalKinds.length && !(path.edges || []).some((edge) => requirePortalKinds.includes(edge.kind))) errors.push("missing-required-portal");
  return { ok: errors.length === 0, errors };
}
