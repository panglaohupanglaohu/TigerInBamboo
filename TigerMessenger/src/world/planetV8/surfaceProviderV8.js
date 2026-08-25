// =====================================================================
// One source of truth for V8 visual/collision/nav/water projection.
// It is deliberately data-only and can be mirrored in a Worker.
// =====================================================================

function asVec3(v) { return Array.isArray(v) ? v : [v?.x ?? 0, v?.y ?? 0, v?.z ?? 0]; }
function normalize(v) { const values = asVec3(v); const l = Math.hypot(...values) || 1; return values.map((n) => n / l); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function angle(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); }

export function createSurfaceProviderV8({ radius = 160, field, charts = [], water = null, portals = [] } = {}) {
  if (!field?.heightAt) throw new Error("SurfaceProviderV8 requires a field with heightAt");
  const portalList = portals.map((portal, index) => ({ ...portal, id: portal.id || `portal:${index}`, direction: normalize(portal.direction) }));
  const surfaces = [];
  const registerCharts = (nextCharts = []) => {
    for (const chart of nextCharts) surfaces.push({ id: chart.id, kind: "mc-land", chartId: chart.id, semantic: "land" });
  };
  registerCharts(charts);
  function waterSurfaceAt(direction) {
    for (let index = 0; index < (water?.lakes || []).length; index++) {
      const lake = water.lakes[index];
      if (lake.centerDirection && angle(direction, lake.centerDirection) <= (lake.angularRadius || 0)) {
        return { id: "water:lake:" + index, radius: lake.radius };
      }
    }
    const semantic = field.semanticAt(direction);
    if (water?.ocean && semantic.land < 0.45) return { id: "water:ocean", radius: water.ocean.radius || radius };
    return null;
  }
  if (water?.ocean) surfaces.push({ id: "water:ocean", kind: "curved-water", semantic: water.surfaceSemantics?.ocean?.semantic || "deep-ocean" });
  for (let index = 0; index < (water?.lakes || []).length; index++) surfaces.push({ id: `water:lake:${index}`, kind: "curved-water", semantic: water.surfaceSemantics?.lakes?.[index]?.semantic || "deep-lake" });
  const provider = {
    version: 8,
    radius,
    field,
    charts,
    water,
    surfaces,
    portals: portalList,
    surfaceIdAt(position) {
      const direction = normalize(position);
      const waterSurface = waterSurfaceAt(direction);
      if (waterSurface) return waterSurface.id;
      const chart = charts.reduce((best, candidate) => {
        if (!candidate?.centerDirection) return best;
        const score = dot(direction, candidate.centerDirection);
        return !best || score > best.score ? { chart: candidate, score } : best;
      }, null);
      return chart?.chart?.id || "planet-land";
    },
    sample(position) {
      const direction = normalize(position);
      const semantic = field.semanticAt(direction);
      const height = semantic.height;
      const waterSurface = waterSurfaceAt(direction);
      const isWater = !!waterSurface;
      const surfaceRadius = isWater ? waterSurface.radius : radius + height;
      return {
        surfaceId: waterSurface?.id || this.surfaceIdAt(position),
        position: direction.map((n) => n * surfaceRadius),
        point: direction.map((n) => n * surfaceRadius),
        normal: direction,
        height: surfaceRadius - radius,
        semantic,
        isWater,
      };
    },
    project(position, out = {}) {
      const sample = this.sample(position);
      out.surfaceId = sample.surfaceId;
      out.position = sample.position.slice();
      out.normal = sample.normal.slice();
      out.height = sample.height;
      out.semantic = sample.semantic;
      out.isWater = sample.isWater;
      return out;
    },
    portalBetween(from, to) {
      const a = normalize(from); const b = normalize(to);
      let best = null; let bestScore = -Infinity;
      for (const portal of portalList) {
        const score = dot(a, portal.direction) + dot(b, portal.direction);
        if (score > bestScore && score > 1.5) { best = portal; bestScore = score; }
      }
      return best;
    },
    neighbors(position, maxAngle = 0.12) {
      const direction = normalize(position);
      return portalList.filter((portal) => angle(direction, portal.direction) <= maxAngle);
    },
    validate() {
      const errors = [];
      if (!(radius > 0)) errors.push("radius");
      for (const portal of portalList) {
        if (!portal.from || !portal.to) errors.push(`portal-endpoints:${portal.id}`);
        if (!portal.direction || portal.direction.length !== 3) errors.push(`portal-direction:${portal.id}`);
      }
      return { ok: errors.length === 0, errors };
    },
    registerCharts(nextCharts) { registerCharts(nextCharts); return surfaces; },
    registerPortals(nextPortals) { portalList.push(...nextPortals.map((portal, index) => ({ ...portal, id: portal.id || `portal:dynamic:${index}`, direction: normalize(portal.direction || [0, 1, 0]) }))); return portalList; },
  };
  return provider;
}
