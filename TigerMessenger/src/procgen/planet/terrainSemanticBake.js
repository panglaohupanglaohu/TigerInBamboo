// =====================================================================
// Semantic bake shared by terrain shader, vegetation, collision and water.
// No runtime string/object lookup is needed by the render path.
// =====================================================================

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function normalizeWeights(values) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  return values.map((value) => Math.max(0, value) / total);
}

export function bakeTerrainSemantic({ positions, normals = null, recipe, tileIds = [] } = {}) {
  if (!positions || positions.length % 3 !== 0) throw new Error("semantic bake requires positions");
  const count = positions.length / 3;
  const ids = new Uint32Array(count * 4);
  const weights = new Float32Array(count * 4);
  const terrainData0 = new Float32Array(count * 4);
  const terrainData1 = new Float32Array(count * 4);
  const flowData = new Float32Array(count * 4);
  const uv = new Float32Array(count * 2);
  const histogram = {};
  for (let i = 0; i < count; i++) {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const s = recipe.semanticAt(p);
    const slope = normals ? 1 - Math.abs(normals[i * 3] * p[0] + normals[i * 3 + 1] * p[1] + normals[i * 3 + 2] * p[2]) / (Math.hypot(...p) || 1) : 0.2;
    const coastDistance = clamp01(s.coastDistance ?? (1 - s.land) * 0.8 + s.wetness * 0.2);
    const ao = clamp01(s.ao ?? (0.72 - slope * 0.25 - s.wetness * 0.08));
    const flow = s.flow || [0, 0, s.wetness];
    const candidates = [
      { id: tileIds[i] ?? 0, weight: 1 - slope },
      { id: 1, weight: s.wetness * 0.5 },
      { id: 2, weight: s.rockness * (0.4 + slope) },
      { id: 3, weight: s.forestness * (1 - slope) },
    ];
    const ws = normalizeWeights(candidates.map((candidate) => candidate.weight));
    for (let k = 0; k < 4; k++) { ids[i * 4 + k] = candidates[k].id; weights[i * 4 + k] = ws[k]; }
    terrainData0.set([s.height, clamp01(slope), clamp01(s.wetness), clamp01(1 - s.land)], i * 4);
    terrainData1.set([clamp01(s.forestness), clamp01(s.rockness), coastDistance, ao], i * 4);
    flowData.set([Number(flow[0]) || 0, Number(flow[1]) || 0, Number(flow[2]) || s.wetness, coastDistance], i * 4);
    // Chart-local planar UV is derived from the normalized world direction;
    // hard semantic edges remain encoded in ids/weights, not texture names.
    const length = Math.hypot(...p) || 1;
    uv[i * 2] = 0.5 + p[0] / length * 0.5;
    uv[i * 2 + 1] = 0.5 + p[2] / length * 0.5;
    histogram[s.tileId] = (histogram[s.tileId] || 0) + 1;
  }
  return { ids, weights, terrainData0, terrainData1, flowData, uv, histogram, count, schema: "terrain-semantic-v8" };
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
