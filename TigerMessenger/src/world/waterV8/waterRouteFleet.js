// Generic boat fleet adapter.  Existing boarding/camera/audio callers can
// keep their public events while route geometry comes from curved water data.

export function createWaterRouteFleet({ routes = [], boats = [] } = {}) {
  const state = { routes, boats, routeById: new Map(routes.map((route) => [route.id, route])) };
  return {
    routes,
    boats,
    update(dt = 0) {
      for (const boat of boats) {
        const route = state.routeById.get(boat.routeId) || routes[0];
        if (!route?.points?.length) continue;
        boat.u = ((boat.u ?? 0) + dt * (boat.speed ?? 0.01)) % 1;
        const index = Math.min(route.points.length - 1, Math.floor(boat.u * (route.points.length - 1)));
        boat.position = route.points[index].position.slice();
        const visual = boat.object || boat.visual || boat.mesh;
        if (visual?.position?.set) {
          visual.position.set(...boat.position);
          const direction = this.directionFor(boat);
          const up = visual.position.clone().normalize();
          const forward = new visual.position.constructor(...direction).sub(up.clone().multiplyScalar(up.dot(new visual.position.constructor(...direction)))).normalize();
          if (forward.lengthSq() > 1e-8) visual.quaternion?.setFromUnitVectors?.(new visual.position.constructor(0, 0, 1), forward);
          visual.userData.waterRouteId = route.id;
        }
        boat.routeId = route.id;
      }
    },
    assignBoat(boat, routeId) {
      if (!state.routeById.has(routeId)) return false;
      boat.routeId = routeId;
      boat.u = 0;
      return true;
    },
    directionFor(boat) {
      const route = state.routeById.get(boat?.routeId);
      if (!route?.points?.length) return [0, 0, 1];
      const index = Math.min(route.points.length - 2, Math.floor((boat.u ?? 0) * (route.points.length - 1)));
      return tangentBetween(route.points[index].position, route.points[index + 1].position);
    },
    directionToTarget(boat, target) {
      const route = state.routeById.get(boat?.routeId);
      if (!route?.points?.length) return [0, 0, 1];
      const index = Math.min(route.points.length - 1, Math.floor((boat.u ?? 0) * (route.points.length - 1)));
      const current = route.points[index].position;
      const destination = Array.isArray(target)
        ? target
        : target?.position || target?.direction || route.points[route.points.length - 1].position;
      return tangentBetween(current, destination);
    },
  };
}

function tangentBetween(from, to) {
  const fromLength = Math.hypot(...from) || 1;
  const toLength = Math.hypot(...to) || 1;
  const up = from.map((value) => value / fromLength);
  const direction = to.map((value) => value / toLength);
  const projection = direction.reduce((sum, value, index) => sum + value * up[index], 0);
  const tangent = direction.map((value, index) => value - up[index] * projection);
  const length = Math.hypot(...tangent) || 1;
  return tangent.map((value) => value / length);
}

export function migrateCanalBoatToWaterRoute(boat, routes, ports = []) {
  if (!boat) return { ok: false, reason: "missing-boat" };
  if (!routes?.length) {
    const dock = ports[0] || null;
    return { ok: false, reason: "no-legal-ocean-route", dockedAt: dock?.id || null, warning: "boat-docked-at-nearest-port" };
  }
  const position = boat.position || boat.worldPosition;
  const score = (route) => {
    if (!position || !route.points?.length) return Number.POSITIVE_INFINITY;
    return route.points.reduce((best, point) => Math.min(best, Math.hypot(...point.position.map((value, index) => value - position[index]))), Number.POSITIVE_INFINITY);
  };
  const route = position ? [...routes].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))[0] : routes[Math.abs(Math.floor((boat.routeIndex ?? 0))) % routes.length];
  const u = Math.max(0, Math.min(1, Number.isFinite(boat.u) ? boat.u : 0));
  return { ok: true, boat: { ...boat, routeId: route.id, u, legacyCanalU: boat.u ?? null, migratedFrom: "canal" }, warning: "boat-migrated-to-nearest-water-route" };
}
