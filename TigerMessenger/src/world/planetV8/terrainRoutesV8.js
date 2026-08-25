// Landmark routes are derived from the same surface navigation graph used by
// walkers. This module deliberately returns data only: tram, soldier and
// editor adapters can consume the route without inventing a second height
// field or an airborne shortcut.

import { findPlanetPath, validatePlanetPath } from "./navigationV8.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function nearestNode(graph, direction) {
  return graph?.nodes
    ?.map((node) => ({ node, score: dot(node.direction, direction) }))
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id))[0]?.node || null;
}

function edgeFor(graph, from, to) {
  return graph?.nodes?.find((node) => node.id === from)?.edges?.find((edge) => edge.to === to) || null;
}

function pathWithRequiredPortal(graph, startId, goalId, preferredKinds) {
  const direct = findPlanetPath(graph, startId, goalId, { preferKinds: preferredKinds });
  if (direct.ok && direct.edges.some((edge) => preferredKinds.includes(edge.kind))) return direct;
  const portalEdges = graph.nodes
    .flatMap((node) => node.edges.map((edge) => ({ from: node.id, edge })))
    .filter(({ edge }) => preferredKinds.includes(edge.kind))
    .sort((a, b) => `${a.from}:${a.edge.to}`.localeCompare(`${b.from}:${b.edge.to}`));
  for (const portal of portalEdges) {
    const prefix = findPlanetPath(graph, startId, portal.from);
    const suffix = findPlanetPath(graph, portal.edge.to, goalId);
    if (!prefix.ok || !suffix.ok) continue;
    const nodes = [...prefix.nodes, portal.edge.to, ...suffix.nodes.slice(1)];
    const edges = nodes.slice(1).map((id, index) => edgeFor(graph, nodes[index], id)).filter(Boolean);
    return { ok: true, nodes, edges };
  }
  return direct;
}

function routePoints(graph, path) {
  return path.nodes.map((id) => graph.nodes.find((node) => node.id === id)?.position?.slice()).filter(Boolean);
}

function routeLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
      points[i][2] - points[i - 1][2],
    );
  }
  return length;
}

export const LEGACY_ROUTE_DEFINITIONS = Object.freeze([
  { id: "route:bookshop-saihoji", from: "bookshop-town", to: "saihoji-moss-garden", mode: "walk-tram" },
  { id: "route:highland-triple-gate", from: "highland-citadel", to: "triple-gate", mode: "walk-stairs" },
  { id: "route:crystal-canyon-triple-gate", from: "crystal-canyon", to: "triple-gate", mode: "walk-tram" },
]);

export const LANDFORM_CHAIN_ROUTE_DEFINITIONS = Object.freeze([
  { id: "route:highland-triple-gate", from: "highland-citadel", to: "triple-gate", mode: "walk-stairs", advantage: "height-and-choke" },
  { id: "route:triple-gate-crystal", from: "triple-gate", to: "crystal-canyon", mode: "walk-tram", advantage: "saddle-and-corridor" },
  { id: "route:crystal-swamp", from: "crystal-canyon", to: "swamp-lake", mode: "walk-boat", advantage: "alluvial-fan-and-water" },
  { id: "route:swamp-bookshop", from: "swamp-lake", to: "bookshop-town", mode: "walk-boat", advantage: "shoreline-and-slope" },
  { id: "route:bookshop-saihoji", from: "bookshop-town", to: "saihoji-moss-garden", mode: "walk-tram", advantage: "low-slope-plain" },
]);

export function compileLandmarkTerrainRoutes({ navigation, manifest = [], definitions = LEGACY_ROUTE_DEFINITIONS } = {}) {
  const byId = new Map(manifest.map((entry) => [entry.id, entry]));
  const routes = [];
  const errors = [];
  for (const definition of definitions) {
    const fromLandmark = byId.get(definition.from);
    const toLandmark = byId.get(definition.to);
    if (!fromLandmark || !toLandmark) {
      errors.push(definition.id + ":missing-landmark");
      continue;
    }
    const start = nearestNode(navigation, fromLandmark.direction);
    const goal = nearestNode(navigation, toLandmark.direction);
    const preferredKinds = definition.mode === "walk-stairs" ? ["stairs", "surface-transition"] : ["surface-transition"];
    const path = pathWithRequiredPortal(navigation, start?.id, goal?.id, preferredKinds);
    const validation = validatePlanetPath(path, {
      requirePortalKinds: definition.mode === "walk-stairs" ? ["stairs", "surface-transition"] : [],
    });
    if (!validation.ok) {
      errors.push(definition.id + ":" + validation.errors.join(","));
      continue;
    }
    const points = routePoints(navigation, path);
    const edges = path.nodes.slice(1).map((id, index) => edgeFor(navigation, path.nodes[index], id)).filter(Boolean);
    routes.push({
      id: definition.id,
      from: definition.from,
      to: definition.to,
      mode: definition.mode,
      landformAdvantage: definition.advantage || null,
      nodes: path.nodes,
      edges,
      points,
      length: routeLength(points),
      portalCount: edges.filter((edge) => edge.surfaceTransition).length,
      surfaceIds: path.nodes.slice(1).map((id) => navigation.nodes.find((node) => node.id === id)?.surfaceId || "planet-land"),
    });
  }
  return { ok: errors.length === 0, errors, routes, hash: hashRoutes(routes) };
}

function hashRoutes(routes) {
  let hash = 2166136261;
  for (const route of routes) {
    for (const character of route.id + ":" + route.nodes.join(",") + ":" + route.portalCount) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  }
  return "terrain-routes-" + (hash >>> 0).toString(16).padStart(8, "0");
}
