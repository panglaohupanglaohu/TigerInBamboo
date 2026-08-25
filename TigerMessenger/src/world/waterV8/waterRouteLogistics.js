// Port/boat logistics adapter for curved water routes.  It keeps the old
// boarding/cargo event vocabulary but makes route, draft and target direction
// explicit; no canal curve or flat-world heading is consulted.

import { createWaterRouteFleet } from "./waterRouteFleet.js";

export function compileWaterRouteLogistics({ routes = [], ports = [], fleet = null } = {}) {
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const portById = new Map(ports.map((port) => [port.id, port]));
  const issues = [];
  for (const port of ports) {
    if (!port?.id || !port.direction) issues.push(`port:${port?.id || "unknown"}:direction`);
    if (port.routeId && !routeById.has(port.routeId)) issues.push(`port:${port.id}:missing-route`);
  }
  for (const route of routes) {
    if (!route?.surfaceId || route.edgeType !== "water-route") issues.push(`route:${route?.id || "unknown"}:surface-contract`);
    if (!(route.minWidth > 0) || !(route.maxDraft >= 0)) issues.push(`route:${route.id}:clearance`);
  }
  const adapter = fleet || createWaterRouteFleet({ routes });
  return {
    ok: issues.length === 0,
    issues,
    routes,
    ports,
    assignBoat(boat, { routeId, portId = null } = {}) {
      const route = routeById.get(routeId) || portById.get(portId)?.routeId && routeById.get(portById.get(portId).routeId);
      if (!route) return { ok: false, reason: "missing-water-route" };
      const draft = boat?.draft ?? 0;
      if (draft > route.maxDraft) return { ok: false, reason: "draft-exceeds-route", routeId: route.id, maxDraft: route.maxDraft, draft };
      adapter.assignBoat(boat, route.id);
      boat.portId = portId;
      boat.logisticsSurfaceId = route.surfaceId;
      return { ok: true, routeId: route.id, portId };
    },
    directionToTarget(boat, target) { return adapter.directionToTarget(boat, target); },
  };
}

export function validateWaterRouteLogistics(logistics) {
  const errors = [...(logistics?.issues || [])];
  for (const route of logistics?.routes || []) {
    for (const point of route.points || []) {
      if (!Array.isArray(point.position) || point.position.some((value) => !Number.isFinite(value))) errors.push(`route:${route.id}:invalid-point`);
    }
  }
  return { ok: errors.length === 0, errors };
}
