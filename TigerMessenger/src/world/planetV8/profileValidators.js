// Profile-level gates catch geometry/routing mistakes before visual work.

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function distance(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); }

export function validateHighlandProfile(profile, { manifest = [], navigation = null } = {}) {
  const errors = [];
  if ((profile?.recipe?.peaks ?? 0) < 3) errors.push("highland-peaks");
  if ((profile?.recipe?.terraceCount ?? 0) !== 5) errors.push("terrace-count");
  if ((profile?.recipe?.waterfallCount ?? 0) < 4) errors.push("waterfall-count");
  if (!profile?.landmark?.hardLocks?.horse?.heading) errors.push("horse-heading-lock");
  if (!profile?.landmark?.hardLocks?.portals?.length) errors.push("terrace-portals");
  if (navigation && navigation.nodes?.some((node) => node.edges.some((edge) => edge.kind === "air"))) errors.push("air-nav-edge");
  return { ok: errors.length === 0, errors };
}

export function validateCanyonTransit({ route = [], maxSlope = 0.42, minRadius = 1.8, clearances = [] } = {}) {
  const errors = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]; const b = route[i];
    const horizontal = Math.hypot((b[0] || 0) - (a[0] || 0), (b[2] || 0) - (a[2] || 0)) || 1e-6;
    if (Math.abs((b[1] || 0) - (a[1] || 0)) / horizontal > maxSlope) errors.push(`slope:${i}`);
  }
  if (minRadius <= 0) errors.push("min-radius");
  for (const clearance of clearances) if (!(clearance.width > 0 && clearance.height > 0)) errors.push(`clearance:${clearance.id || "unknown"}`);
  return { ok: errors.length === 0, errors };
}

export function validateHillsProfile({ slope = 0, doorSlope = 0.22, connected = true, forestCoverage = 0 } = {}) {
  const errors = [];
  if (slope > 0.55) errors.push("hill-too-steep");
  if (doorSlope > 0.3) errors.push("door-inaccessible");
  if (!connected) errors.push("hill-chain-disconnected");
  if (forestCoverage < 0 || forestCoverage > 1) errors.push("forest-coverage");
  return { ok: errors.length === 0, errors };
}

export function validateBookshopHillChain({ route = [], doorSlope = 0, connected = true, saddle = true, tramRoute = true, maxSlope = 0.55 } = {}) {
  const errors = [];
  let routeSlope = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]; const b = route[i];
    const ra = Math.hypot(...a); const rb = Math.hypot(...b);
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-6;
    routeSlope = Math.max(routeSlope, Math.abs(rb - ra) / distance);
  }
  if (routeSlope > maxSlope) errors.push("bookshop-route-too-steep");
  if (doorSlope > 0.3) errors.push("bookshop-door-inaccessible");
  if (!connected) errors.push("bookshop-saihoji-disconnected");
  if (!saddle) errors.push("bookshop-chain-missing-saddle");
  if (!tramRoute) errors.push("bookshop-tram-route-missing");
  return { ok: errors.length === 0, errors, routeSlope, doorSlope };
}
