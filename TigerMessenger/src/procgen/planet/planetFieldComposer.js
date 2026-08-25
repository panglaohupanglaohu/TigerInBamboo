// =====================================================================
// Planet V8 scalar field.  The field is global and radial; local charts only
// sample it.  Profiles add smooth, art-directed terrain and subtractive
// canyon/lake/waterfall features without allowing noise to decide coastlines.
// =====================================================================

const TAU = Math.PI * 2;
import { clampNormalizeWeights, planarBarycentric, tangentBasis } from "./barycentric.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function length(v) { return Math.hypot(v[0], v[1], v[2]); }
function normalize(v) { const l = length(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function angleBetween(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); }
function smoothstep(a, b, value) { const t = Math.max(0, Math.min(1, (value - a) / Math.max(1e-6, b - a))); return t * t * (3 - 2 * t); }
function smoothMin(a, b, k = 1) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k / 6;
}
function smoothMax(a, b, k = 1) { return -smoothMin(-a, -b, k); }

function profileInfluence(dir, landmark, radiusScale = 1) {
  const distance = angleBetween(dir, landmark.direction);
  return 1 - smoothstep(landmark.angularRadius * 0.35 * radiusScale, landmark.angularRadius * radiusScale, distance);
}

function hillBump(dir, landmark, height) {
  const w = profileInfluence(dir, landmark, 1.2);
  return height * w * w * (0.72 + 0.28 * Math.cos(angleBetween(dir, landmark.direction) * Math.PI / Math.max(landmark.angularRadius, 1e-4)));
}

function highlandPeakBump(dir, landmark) {
  const peakBasis = tangentBasis(landmark.direction);
  const offsets = [
    [0, 0],
    [0.11, 0.035],
    [-0.095, 0.05],
  ];
  const heights = [8.6, 7.2, 6.4];
  return Math.max(...offsets.map(([right, forward], index) => {
    const peak = normalize([
      landmark.direction[0] + peakBasis.right[0] * right + peakBasis.forward[0] * forward,
      landmark.direction[1] + peakBasis.right[1] * right + peakBasis.forward[1] * forward,
      landmark.direction[2] + peakBasis.right[2] * right + peakBasis.forward[2] * forward,
    ]);
    const influence = 1 - smoothstep(landmark.angularRadius * 0.12, landmark.angularRadius * 0.72, angleBetween(dir, peak));
    return heights[index] * influence * influence;
  }));
}

function canyonCut(dir, landmark) {
  const w = profileInfluence(dir, landmark, 1.08);
  const forward = normalize(landmark.forward || [1, 0, 0]);
  const side = normalize([
    forward[1] * landmark.direction[2] - forward[2] * landmark.direction[1],
    forward[2] * landmark.direction[0] - forward[0] * landmark.direction[2],
    forward[0] * landmark.direction[1] - forward[1] * landmark.direction[0],
  ]);
  const lateral = Math.abs(dot(dir, side));
  const corridor = 1 - smoothstep(0.035, landmark.angularRadius * 0.38, lateral);
  const along = 0.4 + 0.6 * smoothstep(-0.2, 0.8, dot(dir, forward));
  return w * corridor * along;
}

function lowerWaterfallDirection(landmark) {
  const direction = normalize(landmark.direction);
  const forward = normalize(landmark.forward || [0, 0, 1]);
  const projected = forward.map((value, index) => value - direction[index] * dot(forward, direction));
  const projectedLength = length(projected) || 1;
  const offset = Math.max(0.08, landmark.angularRadius * 1.6);
  return normalize(direction.map((value, index) => value + projected[index] / projectedLength * offset));
}

export function classifyProfileField(direction, { landmarks = [], assignment = new Map(), grid = null } = {}) {
  const dir = normalize(direction);
  let tile = null;
  let tileBlend = [];
  if (grid && assignment) {
    const cells = grid.dual.cells();
    let best = -1; let score = -Infinity;
    for (const cell of cells) {
      const d = grid.dual.directionOf(cell.index);
      const s = dot(d, dir);
      if (s > score) { score = s; best = cell.index; }
    }
    const primary = cells.find((cell) => cell.index === best);
    const candidateIndices = primary
      ? [best, ...grid.dual.neighborsOf(best).map((edge) => edge.to).sort((a, b) => {
        const da = grid.dual.directionOf(a); const db = grid.dual.directionOf(b);
        return dot(db, dir) - dot(da, dir) || a - b;
      })].slice(0, 3)
      : [];
    if (candidateIndices.length >= 3) {
      const dirs = candidateIndices.map((index) => grid.dual.directionOf(index));
      tileBlend = candidateIndices.map((index, indexInTriangle) => ({ tile: assignment.get(grid.dual.cellId(index)), weight: indexInTriangle === 0 ? 0 : 0 }));
      const rawWeights = planarBarycentric(dir, dirs, tangentBasis(dir));
      const weights = clampNormalizeWeights(rawWeights);
      tileBlend = candidateIndices.map((index, indexInTriangle) => ({ tile: assignment.get(grid.dual.cellId(index)), weight: weights[indexInTriangle] })).filter((entry) => entry.tile);
      tile = assignment.get(grid.dual.cellId(best)) || tileBlend[0]?.tile || null;
    } else tile = assignment.get(grid.dual.cellId(best)) || null;
  }
  const blendField = (field, fallback) => tileBlend.length ? tileBlend.reduce((sum, entry) => sum + (entry.tile[field] ?? entry.tile.fields?.[field] ?? fallback) * entry.weight, 0) : (tile?.[field] ?? tile?.fields?.[field] ?? fallback);
  let land = blendField("land", 0);
  let height = blendField("elevation", -2.4);
  let wetness = blendField("wetness", 1);
  let forestness = blendField("forestness", 0);
  let rockness = blendField("rockness", 0);
  let snowness = blendField("snowness", 0);
  let ashness = blendField("ashness", 0);
  let sediment = blendField("sediment", 0);
  let mossness = blendField("mossness", 0);
  let flow = tileBlend.length
    ? tileBlend.reduce((sum, entry) => {
      const vector = entry.tile.flow || entry.tile.fields?.flow || [0, 0, wetness];
      return sum.map((value, index) => value + (Number(vector[index]) || 0) * entry.weight);
    }, [0, 0, 0])
    : (tile?.flow || tile?.fields?.flow || [0, 0, wetness]).slice();
  let canyon = 0;
  let lake = 0;
  let waterfallLanding = 0;
  for (const landmark of landmarks) {
    const influence = profileInfluence(dir, landmark);
    if (landmark.waterNeeds === "lower-waterfall-basin") {
      const basinDirection = lowerWaterfallDirection(landmark);
      const basinDistance = angleBetween(dir, basinDirection);
      waterfallLanding = Math.max(waterfallLanding, 1 - smoothstep(landmark.angularRadius * 0.12, landmark.angularRadius * 0.9, basinDistance));
    }
    // A profile pass must be a local contribution.  In particular, the lake
    // branch uses Math.min(height, -0.3 * influence); applying it with zero
    // influence would turn every positive mountain height into -0 and erase
    // the global elevation narrative.
    if (influence <= 1e-6) continue;
    const landform = landmark.landformClass || landmark.profile;
    if (landform === "volcanic-snow-massif" || landmark.profile === "highland-citadel" || landmark.profile === "highland-snow-massif") {
      // The continuous chain uses highland-snow-massif as the production
      // profile.  It must keep the authored three-peak silhouette; falling
      // back to one rounded hill made the transition collar flatten the
      // supposed highest mountain into the gate shoulder.
      height = Math.max(height, highlandPeakBump(dir, landmark) + 0.8 * influence);
      land = Math.max(land, influence);
      rockness = Math.max(rockness, influence * 0.82);
      snowness = Math.max(snowness, influence * (0.55 + Math.min(0.45, Math.max(0, height - 4) / 8)));
      ashness = Math.max(ashness, influence * 0.46);
      flow = [flow[0] * (1 - influence) + landmark.direction[0] * influence, flow[1] * (1 - influence) - influence * 0.45, flow[2] * (1 - influence) + landmark.direction[2] * influence];
    } else if (landform === "rift-shoulder-pass" || landmark.profile === "triple-gate-highland") {
      height = Math.max(height, 5.5 * influence + hillBump(dir, landmark, 2.4));
      land = Math.max(land, influence);
      rockness = Math.max(rockness, influence * 0.78);
      ashness = Math.max(ashness, influence * 0.28);
    } else if (landform === "rift-escarpment" || landmark.profile === "crystal-canyon" || landmark.profile === "crystal-rift-canyon") {
      height = Math.max(height, 2.8 * influence);
      canyon = Math.max(canyon, canyonCut(dir, landmark));
      land = Math.max(land, influence);
      rockness = Math.max(rockness, influence * 0.92);
      sediment = Math.max(sediment, influence * 0.6);
      flow = [flow[0] * (1 - influence), flow[1] * (1 - influence) - influence * 0.6, flow[2] * (1 - influence)];
    } else if (landform === "japanese-alluvial-plain" || landmark.profile === "saihoji-hills" || landmark.profile === "saihoji-plain") {
      height = Math.max(height, 0.45 * influence + hillBump(dir, landmark, 0.25));
      land = Math.max(land, influence);
      forestness = Math.max(forestness, influence * 0.34);
      wetness = Math.max(wetness, influence * 0.62);
      sediment = Math.max(sediment, influence * 0.92);
      mossness = Math.max(mossness, influence * 0.86);
      flow = [flow[0], flow[1] * (1 - influence) - influence * 0.22, flow[2] + influence * 0.12];
    } else if (landform === "auckland-volcanic-hills" || landmark.profile === "bookshop-hill-chain" || landmark.profile === "bookshop-auckland-hills") {
      height = Math.max(height, 1.7 * influence + hillBump(dir, landmark, 1.4));
      land = Math.max(land, influence);
      forestness = Math.max(forestness, influence * 0.42);
      wetness = Math.max(wetness, influence * 0.55);
      ashness = Math.max(ashness, influence * 0.72);
      rockness = Math.max(rockness, influence * 0.54);
      sediment = Math.max(sediment, influence * 0.3);
    } else if (landform === "rift-long-lake" || landmark.profile === "swamp-lake" || landmark.profile === "swamp-rift-lake" || landmark.profile === "curved-lake") {
      lake = Math.max(lake, influence);
      height = Math.min(height, -0.3 * influence);
      wetness = Math.max(wetness, influence);
      land = Math.max(land, influence * 0.35);
      sediment = Math.max(sediment, influence * 0.8);
      mossness = Math.max(mossness, influence * 0.5);
      flow = [flow[0], flow[1] * (1 - influence) - influence * 0.15, flow[2]];
    } else if (landmark.profile === "coastal-harbor-citadel") {
      height = Math.max(height, 0.7 * influence);
      land = Math.max(land, influence * 0.8);
      wetness = Math.max(wetness, influence * 0.7);
    }
  }
  // The canyon is a field subtraction, not a second mesh or a flat painted cut.
  height -= canyon * 2.25;
  // Keep the authored waterfall landing at the waterline while retaining the
  // massif around it.  This is a local notch, not a global flattening pass.
  if (waterfallLanding > 0) height = height * (1 - waterfallLanding) + 0.02 * waterfallLanding;
  return {
    land,
    height,
    wetness: Math.min(1, wetness),
    forestness: Math.min(1, forestness),
    rockness: Math.min(1, rockness),
    snowness: Math.min(1, snowness),
    ashness: Math.min(1, ashness),
    sediment: Math.min(1, sediment),
    mossness: Math.min(1, mossness),
    flow,
    canyon,
    lake,
    waterfallLanding,
    tileId: tile?.id || "ocean.deep",
  };
}

export function createPlanetFieldRecipe({ radius = 160, seaLevel = 0, grid, landmarks = [], assignment = new Map(), foundationCollars = [], transitionCollars = [] } = {}) {
  // P0-1 (2026-08-24): transition collars must interpolate between the two
  // endpoints' REAL field heights.  The old collar carried a normalized
  // elevationBand value (0..1) as an absolute height, which flattened every
  // saddle between sections to ~0.2-0.7 while the section cores stood at
  // 6-9: the "six bumps in shallow water" profile.  Endpoint centres are
  // core-guarded, so this precomputation never recurses through collars.
  const collarTargets = new Map(transitionCollars.map((collar) => {
    const from = landmarks.find((landmark) => landmark.id === collar.from);
    const to = landmarks.find((landmark) => landmark.id === collar.to);
    if (!from || !to) return [collar.id, null];
    const hFrom = classifyProfileField(from.direction, { grid, landmarks, assignment }).height;
    const hTo = classifyProfileField(to.direction, { grid, landmarks, assignment }).height;
    return [collar.id, hFrom + (hTo - hFrom) * 0.5];
  }));
  const sampleSemantic = (worldP) => {
    const r = length(worldP);
    const dir = normalize(worldP);
    const semantic = classifyProfileField(dir, { grid, landmarks, assignment });
    let result = { ...semantic, radial: r, dir };
    for (const collar of transitionCollars) {
      const distance = angleBetween(dir, collar.direction);
      const alpha = 1 - smoothstep(collar.angularRadius * 0.35, collar.angularRadius, distance);
      if (alpha <= 0) continue;
      // A transition is allowed to affect the saddle between landmarks, not
      // the authored core of either landmark.  Without this guard, the broad
      // chain collars overlap every peak and make the final field disagree
      // with its elevation narrative.
      const endpointInCore = [collar.from, collar.to].some((endpointId) => {
        const endpoint = landmarks.find((landmark) => landmark.id === endpointId);
        if (!endpoint) return false;
        return angleBetween(dir, endpoint.direction) <= (endpoint.coreRadius ?? endpoint.angularRadius * 0.42);
      });
      if (endpointInCore) continue;
      // Hard subtractive features (e.g. the L1 waterfall notch) live outside
      // the endpoint core but must not be flattened by the transition collar:
      // the waterfall basin is authored to sit at the waterline, not at the
      // interpolated saddle height.  Fade the collar weight to zero inside
      // the notch instead of cutting it, so the saddle midpoint keeps its
      // interpolated height while the basin floor stays at the waterline.
      const notchWeight = Math.max(0, Math.min(1, result.waterfallLanding ?? 0));
      const collarWeight = alpha * (1 - notchWeight);
      // A collar is a bounded transition field, not a rectangle pasted over
      // the world.  Keep the local semantic identity while blending the
      // elevation/sediment/wetness channels used by MC and the shader.  The
      // height target is the arc midpoint of the two sections' real heights,
      // so the geological profile stays monotonic between section cores.
      const collarTarget = collarTargets.get(collar.id) ?? result.height;
      result = {
        ...result,
        height: result.height * (1 - collarWeight) + collarTarget * collarWeight,
        sediment: Math.min(1, (result.sediment ?? 0) * (1 - collarWeight) + collarWeight * 0.42),
        wetness: Math.min(1, (result.wetness ?? 0) * (1 - collarWeight) + collarWeight * 0.5),
        transitionId: collar.id,
        transitionWeight: collarWeight,
      };
    }
    return result;
  };
  const sample = (worldP) => {
    const semantic = sampleSemantic(worldP);
    const surfaceRadius = radius + semantic.height;
    let value = semantic.radial - surfaceRadius;
    for (const collar of foundationCollars) {
      const distance = angleBetween(semantic.dir, collar.direction);
      const collarSdf = distance - collar.angularRadius;
      value = smoothMin(value, collarSdf * radius, collar.smoothness ?? 0.6);
    }
    return value;
  };
  return Object.freeze({
    kind: "planet-field-recipe-v8",
    radius,
    seaLevel,
    sample,
    sampleSemantic,
    heightAt(direction) { return sampleSemantic(direction).height; },
    semanticAt(direction) { return sampleSemantic(direction); },
  });
}

export function createRadialChartField(recipe, { centerDirection, tangentU, tangentV, radialMin = -4, radialMax = 8, span = 10, resolution = 24 } = {}) {
  const du = normalize(tangentU); const dv = normalize(tangentV); const dc = normalize(centerDirection);
  const basisPoint = (u, radial, v) => normalize([
    dc[0] + du[0] * u + dv[0] * v,
    dc[1] + du[1] * u + dv[1] * v,
    dc[2] + du[2] * u + dv[2] * v,
  ]).map((n, i, p) => n * (recipe.radius + radial));
  return {
    min: [-span, radialMin, -span],
    max: [span, radialMax, span],
    resolution,
    worldPosition(x, y, z) {
      const u = -span + (2 * span * x) / (resolution - 1);
      const radial = radialMin + ((radialMax - radialMin) * y) / (resolution - 1);
      const v = -span + (2 * span * z) / (resolution - 1);
      return basisPoint(u, radial, v);
    },
    sample(position) { return recipe.sample(position); },
  };
}
