// =====================================================================
// Curved ocean/lake compiler.  Water is data first: positions/indices are
// generated on the planet surface and can be handed to Three.js later.
// No CircleGeometry/ShapeGeometry is used as a production source.
// =====================================================================

function normalize(v) { const l = Math.hypot(...v) || 1; return v.map((n) => n / l); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function add(a, b, scale = 1) { return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale]; }
function slerpDirection(a, b, t) {
  const start = normalize(a); const end = normalize(b);
  const cosine = Math.max(-1, Math.min(1, dot(start, end)));
  if (cosine > 0.9995) return normalize(start.map((value, index) => value * (1 - t) + end[index] * t));
  const theta = Math.acos(cosine);
  const sine = Math.sin(theta) || 1;
  const aWeight = Math.sin((1 - t) * theta) / sine;
  const bWeight = Math.sin(t * theta) / sine;
  return normalize(start.map((value, index) => value * aWeight + end[index] * bWeight));
}
import { createWaterSurfaceSemantics } from "./waterSemantics.js";
function basis(direction) {
  const ref = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize([ref[1] * direction[2] - ref[2] * direction[1], ref[2] * direction[0] - ref[0] * direction[2], ref[0] * direction[1] - ref[1] * direction[0]]);
  const v = normalize([direction[1] * u[2] - direction[2] * u[1], direction[2] * u[0] - direction[0] * u[2], direction[0] * u[1] - direction[1] * u[0]]);
  return { u, v };
}

export function buildGeodesicWaterShell({ grid, radius, level = 0, semantic = "ocean", fieldRecipe = null } = {}) {
  if (!grid?.main) throw new Error("water shell requires geodesic grid");
  const positions = new Float32Array(grid.main.positions.length * 3);
  const waterData0 = new Float32Array(grid.main.positions.length * 4);
  const waterData1 = new Float32Array(grid.main.positions.length * 4);
  const scale = radius + level;
  for (let vertex = 0; vertex < grid.main.positions.length; vertex++) {
    const i = vertex * 3;
    const p = grid.main.positions[vertex];
    const l = Math.hypot(...p) || 1;
    positions[i] = p[0] / l * scale;
    positions[i + 1] = p[1] / l * scale;
    positions[i + 2] = p[2] / l * scale;
    const radial = [p[0] / l, p[1] / l, p[2] / l];
    const terrain = fieldRecipe?.semanticAt?.(radial) || {};
    const landness = Math.max(0, Math.min(1, Number(terrain.land) || 0));
    const terrainHeight = Number.isFinite(terrain.height) ? terrain.height : level - 1;
    const depth = Math.max(0, Math.min(1, (level - terrainHeight + 1.4) / 7.5)) * (1 - landness * 0.78);
    const shoreDistance = Math.max(0, Math.min(1, depth * 1.65 + (1 - landness) * 0.04));
    const fetch = Math.max(0.05, Math.min(1, 0.28 + Math.max(0, dot(radial, normalize([1, 0.2, -0.35]))) * 0.72));
    const foamSeed = ((vertex * 37) % 101) / 100;
    const flow = Array.isArray(terrain.flow) ? terrain.flow : [radial[0], radial[2], 1];
    const curvature = Math.max(0, Math.min(1, Number(terrain.canyon) || 0));
    waterData0.set([depth, shoreDistance, fetch, foamSeed], vertex * 4);
    waterData1.set([Number(flow[0]) || radial[0], Number(flow[1]) || radial[2], curvature, 1 - landness * 0.4], vertex * 4);
  }
  const indices = Uint32Array.from(grid.main.faces.flat());
  return { kind: "curved-ocean-shell-v8", radius: scale, positions, indices, waterData0, waterData1, semantic, curved: true, irregular: true, topology: { source: "main/dual-grid+field+mc", nearShoreData: true, stableVertexIds: true }, hash: `ocean:${grid.hash}:${scale}` };
}

export function triangulateCurvedCap({ direction, radius, level = 0, angularRadius = 0.1, segments = 24, rings = 4, elongation = 1, semantic = "inland-water", islandCount = 0 } = {}) {
  const center = normalize(direction); const { u, v } = basis(center); const positions = []; const waterData0 = []; const waterData1 = []; const indices = [];
  for (let ring = 0; ring <= rings; ring++) {
    const theta = angularRadius * ring / rings;
    const count = ring === 0 ? 1 : segments;
    for (let segment = 0; segment < count; segment++) {
      const phi = (Math.PI * 2 * segment) / Math.max(1, count);
      const major = Math.sin(theta) * Math.cos(phi) * Math.max(1, elongation);
      const minor = Math.sin(theta) * Math.sin(phi);
      const local = add(add(center, u, major), v, minor);
      const p = normalize(add(local, center, Math.cos(theta) - 1));
      positions.push(p[0] * (radius + level), p[1] * (radius + level), p[2] * (radius + level));
      const shoreDistance = 1 - ring / Math.max(1, rings);
      const depth = 0.45 + shoreDistance * 0.55;
      const rippleSeed = ((ring * 41 + segment * 17) % 97) / 96;
      waterData0.push(depth, shoreDistance, 0.28 + depth * 0.22, rippleSeed);
      waterData1.push(u[0] * Math.cos(phi) + v[0] * Math.sin(phi), u[2] * Math.cos(phi) + v[2] * Math.sin(phi), 1 - shoreDistance, 1);
    }
  }
  // Fan around the center and then regular ring quads.  All triangles stay on
  // the same curved sphere; there is no planar projection.
  for (let segment = 0; segment < segments; segment++) indices.push(0, 1 + segment, 1 + ((segment + 1) % segments));
  let previousStart = 1;
  for (let ring = 1; ring < rings; ring++) {
    const currentStart = previousStart + segments;
    for (let segment = 0; segment < segments; segment++) {
      const a = previousStart + segment; const b = previousStart + ((segment + 1) % segments);
      const c = currentStart + segment; const d = currentStart + ((segment + 1) % segments);
      indices.push(a, c, b, b, c, d);
    }
    previousStart = currentStart;
  }
  const islands = Array.from({ length: Math.max(0, islandCount) }, (_, index) => ({
    id: `${semantic}:islet:${index}`,
    direction: normalize(add(add(center, u, (angularRadius * 0.35) * Math.cos(index * 2.399)), v, (angularRadius * 0.2) * Math.sin(index * 2.399))),
    radius: Math.max(0.006, angularRadius * 0.08),
    walkable: true,
  }));
  return { kind: "curved-lake-cap-v8", radius: radius + level, centerDirection: center, positions: Float32Array.from(positions), indices: Uint32Array.from(indices), waterData0: Float32Array.from(waterData0), waterData1: Float32Array.from(waterData1), semantic, curved: true, angularRadius, elongation, islands };
}

export function compileCurvedWater({ grid, radius, seaLevel = 0, basins = [], harborAnchors = [], fieldRecipe = null } = {}) {
  const ocean = buildGeodesicWaterShell({ grid, radius, level: seaLevel, fieldRecipe });
  const lakes = basins.map((basin) => triangulateCurvedCap({
    direction: basin.direction,
    radius,
    level: basin.level ?? seaLevel + 0.05,
    angularRadius: basin.angularRadius ?? 0.06,
    segments: basin.segments ?? 32,
    rings: basin.rings ?? 5,
    elongation: basin.elongation ?? 1,
    islandCount: basin.islandCount ?? 0,
    semantic: basin.semantic || "inland-water",
  }));
  const routes = compileWaterRoutes({ harborAnchors, radius, fieldRecipe });
  const water = { kind: "curved-water-v8", radius: ocean.radius, ocean, lakes, shorelineHash: `${ocean.hash}:${lakes.length}`, routes, semantic: { ocean: "ocean", lakes: lakes.map((lake) => lake.semantic) } };
  water.surfaceSemantics = createWaterSurfaceSemantics(water);
  return water;
}

export function compileWaterRoutes({ harborAnchors = [], radius = 160, fieldRecipe = null } = {}) {
  const routes = [];
  for (let i = 0; i < harborAnchors.length; i++) {
    const start = harborAnchors[i];
    const end = harborAnchors[(i + 1) % harborAnchors.length];
    if (!start?.direction || !end?.direction) continue;
    const points = [];
    const segments = Math.max(4, Math.ceil(Math.acos(Math.max(-1, Math.min(1, dot(start.direction, end.direction)))) * radius / 8));
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const p = slerpDirection(start.direction, end.direction, t);
      const height = fieldRecipe?.heightAt?.(p) ?? 0;
      points.push({ position: p.map((n) => n * (radius + Math.min(0, height) + 0.04)), clearance: start.clearance ?? 2.4 });
    }
    routes.push({
      id: `sea-route:${i}`,
      from: start.id || `anchor:${i}`,
      to: end.id || `anchor:${(i + 1) % harborAnchors.length}`,
      points,
      minWidth: start.minWidth ?? 2.4,
      maxDraft: start.maxDraft ?? 0.8,
      surfaceId: start.surfaceId || "curved-ocean-shell-v8",
      edgeType: "water-route",
      slope: 0,
      landformClass: start.landformClass || end.landformClass || "coastal-water",
    });
  }
  return routes;
}

export function validateCurvedWater(water) {
  const errors = [];
  if (!water?.ocean?.curved) errors.push("ocean-not-curved");
  for (const lake of water?.lakes || []) {
    if (!lake.curved) errors.push("lake-not-curved");
    if (!lake.indices?.length) errors.push("lake-empty");
  }
  for (const route of water?.routes || []) {
    if (route.points.some((point) => {
      const length = Math.hypot(...(point.position || []));
      return !Number.isFinite(length) || length <= 0 || Math.abs(length - (water.radius || length)) > 8;
    })) errors.push('route:' + route.id + ':non-finite-or-off-sphere');
  }
  return { ok: errors.length === 0, errors };
}
