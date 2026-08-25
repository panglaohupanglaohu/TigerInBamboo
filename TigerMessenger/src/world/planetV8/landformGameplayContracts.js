// Cross-system checks for the new continuous landform chain.  These are
// engine contracts, not presentation guesses: water, terrain, navigation and
// combat must agree on a surface before visual work is allowed to proceed.

function length(v) { return Math.hypot(...v); }
function normalize(v) { const l = length(v) || 1; return v.map((n) => n / l); }

export function validateHighlandWaterfallLanding({ field, water, manifest = [], radius = 160, tolerance = 1.5 } = {}) {
  const highland = manifest.find((entry) => entry.id === "highland-citadel");
  const basin = water?.lakes?.find((lake) => lake.semantic === "waterfall-basin");
  if (!highland || !basin || !field?.heightAt) return { ok: false, errors: ["missing-highland-or-l1-basin"] };
  const terrainRadius = (radius + field.heightAt(basin.centerDirection));
  const waterRadius = basin.radius;
  const gap = Math.abs(terrainRadius - waterRadius);
  return { ok: gap <= tolerance, errors: gap <= tolerance ? [] : [`l1-waterfall-gap:${gap.toFixed(3)}`], gap, surfaceId: "water:lake:0" };
}

export function validateLandformRouteMetadata(routes = []) {
  const errors = [];
  for (const route of routes) {
    for (const edge of route.edges || []) {
      if (!edge.surfaceId || !edge.edgeType || !Number.isFinite(edge.slope) || !edge.landformClass) errors.push(`${route.id}:missing-edge-metadata:${edge.to}`);
      if (edge.kind === "air") errors.push(`${route.id}:air-edge`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function compileLandformAdvantages() {
  return Object.freeze({
    "highland-citadel": "height-and-choke",
    "triple-gate": "saddle-and-corridor",
    "crystal-canyon": "bottleneck-and-escarpment",
    "swamp-lake": "cross-water-and-alluvial-fan",
    "bookshop-town": "volcanic-slope-cover",
    "saihoji-moss-garden": "open-low-slope-battlefield",
  });
}

export function projectActorToLandformSurface(surface, actor, { lift = 0.08 } = {}) {
  const sample = surface?.sample?.(actor?.position);
  if (!sample?.position || sample.isWater) return { ok: false, reason: sample?.isWater ? "water-not-walkable" : "surface-miss" };
  const normal = normalize(sample.normal || [0, 1, 0]);
  return { ok: true, actorId: actor.id || null, surfaceId: sample.surfaceId, position: sample.position.map((n, index) => n + normal[index] * lift), normal };
}

export function validateCombatKeepouts(combatSurface) {
  const errors = [];
  for (const zone of combatSurface?.zones || []) {
    if (!zone.surfaceId || zone.offSurfacePolicy !== "reject-and-reproject") errors.push(`${zone.id}:surface-policy`);
    if (!(zone.keepouts || []).length) errors.push(`${zone.id}:missing-keepout`);
    for (const keepout of zone.keepouts || []) if (!(keepout.radius > 0) || keepout.position?.some((value) => !Number.isFinite(value))) errors.push(`${zone.id}:${keepout.id}:invalid-keepout`);
  }
  return { ok: errors.length === 0, errors };
}
