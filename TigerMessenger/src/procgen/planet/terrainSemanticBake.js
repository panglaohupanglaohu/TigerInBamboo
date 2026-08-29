// =====================================================================
// Semantic bake shared by terrain shader, vegetation, collision and water.
// No runtime string/object lookup is needed by the render path.

import { terrainPatchBlendAt } from "./terrainPatchBlendingV10.js?v=20260827-terrain-v11";
// =====================================================================

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function normalizeWeights(values) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  return values.map((value) => Math.max(0, value) / total);
}

export function bakeTerrainSemantic({ positions, normals = null, recipe, tileIds = [], ecologyAt = null, climateAt = null } = {}) {
  if (!positions || positions.length % 3 !== 0) throw new Error("semantic bake requires positions");
  const count = positions.length / 3;
  const ids = new Uint32Array(count * 4);
  const weights = new Float32Array(count * 4);
  const terrainData0 = new Float32Array(count * 4);
  const terrainData1 = new Float32Array(count * 4);
  const flowData = new Float32Array(count * 4);
  const climateData1 = new Float32Array(count * 4);
  const ecologyData0 = new Float32Array(count * 4);
  const patchData0 = new Float32Array(count * 4);
  const patchData1 = new Float32Array(count * 4);
  const uv = new Float32Array(count * 2);
  const histogram = {};
  for (let i = 0; i < count; i++) {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const s = recipe.semanticAt(p);
    const ecoCell = ecologyAt?.(p);
    const climCell = climateAt?.(p) || ecoCell;
    const ecology = ecoCell?.ecology;
    const climate = climCell?.climate;
    const wetness = ecology ? ecology.ecologicalWetness : s.wetness;
    const forestness = ecology ? ecology.forestness : s.forestness;
    const slope = normals ? 1 - Math.abs(normals[i * 3] * p[0] + normals[i * 3 + 1] * p[1] + normals[i * 3 + 2] * p[2]) / (Math.hypot(...p) || 1) : 0.2;
    const coastDistance = clamp01(s.coastDistance ?? (1 - s.land) * 0.8 + wetness * 0.2);
    const ao = clamp01(s.ao ?? (0.72 - slope * 0.25 - wetness * 0.08));
    const flow = s.flow || [0, 0, wetness];
    const patch = terrainPatchBlendAt({ direction: p, semantic: s });
    const candidates = [
      { id: tileIds[i] ?? 0, weight: 1 - slope },
      { id: 1, weight: wetness * 0.5 },
      { id: 2, weight: s.rockness * (0.4 + slope) },
      { id: 3, weight: forestness * (1 - slope) },
    ];
    const ws = normalizeWeights(candidates.map((candidate) => candidate.weight));
    for (let k = 0; k < 4; k++) { ids[i * 4 + k] = candidates[k].id; weights[i * 4 + k] = ws[k]; }
    terrainData0.set([s.height, clamp01(slope), clamp01(wetness), clamp01(1 - s.land)], i * 4);
    terrainData1.set([clamp01(forestness), clamp01(s.rockness), coastDistance, ao], i * 4);
    flowData.set([Number(flow[0]) || 0, Number(flow[1]) || 0, Number(flow[2]) || wetness, coastDistance], i * 4);
    climateData1.set([
      clamp01(climate?.precipitationClimatology ?? 0),
      clamp01(climate?.cloudPotential ?? 0),
      clamp01((climate?.cloudBase ?? 0) / 1.6),
      clamp01(ecology?.ecologicalWetness ?? 0),
    ], i * 4);
    ecologyData0.set([
      clamp01(ecology?.forestness ?? 0),
      clamp01(ecology?.grassness ?? 0),
      clamp01(ecology?.reedness ?? 0),
      clamp01(ecology?.mudness ?? 0),
    ], i * 4);
    patchData0.set([
      patch.projectedUv[0],
      patch.projectedUv[1],
      patch.shorelineWeight,
      patch.heightBlend,
    ], i * 4);
    patchData1.set([
      patch.shorelineUv[0],
      patch.shorelineUv[1],
      patch.tileVariation,
      patch.waterWeight,
    ], i * 4);
    // Broad grass/water textures use the spherical projection.  Shoreline
    // detail keeps its authored local UV in patchData1, so the seam does not
    // inherit a longitude wrap or a chart-local planar stretch.
    uv[i * 2] = patch.projectedUv[0];
    uv[i * 2 + 1] = patch.projectedUv[1];
    histogram[s.tileId] = (histogram[s.tileId] || 0) + 1;
  }
  return { ids, weights, terrainData0, terrainData1, flowData, climateData1, ecologyData0, patchData0, patchData1, uv, histogram, count, schema: "terrain-semantic-v10-patch-blend" };
}

export function forestDensityAt({ forestness = 0, wetness = 0, slope = 0, coastExposure = 0, keepout = 0, facing = 0 } = {}) {
  return clamp01(forestness * 0.55 + wetness * 0.25 + facing * 0.12 - slope * 0.7 - coastExposure * 0.18 - keepout);
}

export function sampleForestInstances({ triangles, semantic, seed = 1, maxInstances = 5000, keepouts = [] } = {}) {
  const out = [];
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 0x100000000; };
  for (const triangle of triangles || []) {
    if (out.length >= maxInstances) break;
    const a = triangle.a; const b = triangle.b; const c = triangle.c;
    const u = next(); const v = next(); const su = Math.sqrt(u);
    const bary = [1 - su, su * (1 - v), su * v];
    const p = [
      a[0] * bary[0] + b[0] * bary[1] + c[0] * bary[2],
      a[1] * bary[0] + b[1] * bary[1] + c[1] * bary[2],
      a[2] * bary[0] + b[2] * bary[1] + c[2] * bary[2],
    ];
    if (keepouts.some((keepout) => keepout.position && Math.hypot(p[0] - keepout.position[0], p[1] - keepout.position[1], p[2] - keepout.position[2]) < keepout.radius)) continue;
    const density = forestDensityAt(triangle.semantic || semantic || {});
    if (next() > density) continue;
    out.push({ position: p, species: density > 0.72 ? "pine" : "broadleaf", scale: 0.8 + next() * 0.45, phase: next() });
  }
  return out;
}
