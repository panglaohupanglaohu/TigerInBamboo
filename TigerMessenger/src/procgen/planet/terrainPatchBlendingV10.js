// ============================================================================
// Oskar-style spherical patch blending.
//
// Generation owns the projection frames and blend weights.  The renderer only
// receives compact numeric channels, so grass/water can use projected UVs while
// the shoreline keeps an authored local UV.  This keeps a patch continuous
// across a chart boundary instead of painting each chart as an isolated card.
// ============================================================================

const PI = Math.PI;

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
}
function smoothstep(a, b, value) {
  const t = clamp01((value - a) / Math.max(1e-6, b - a));
  return t * t * (3 - 2 * t);
}
function fract(value) { return value - Math.floor(value); }

/** Longitude/latitude projection for broad grass and water patches. */
export function sphericalProjectedUv(direction) {
  const d = normalize(direction || [0, 1, 0]);
  return [
    0.5 + Math.atan2(d[2], d[0]) / (2 * PI),
    0.5 - Math.asin(Math.max(-1, Math.min(1, d[1]))) / PI,
  ];
}

/** Local shoreline UV: distance along the spherical coast + signed height. */
export function shorelineManualUv(direction, height = 0) {
  const d = normalize(direction || [0, 1, 0]);
  const along = Math.atan2(d[2], d[0]) / (2 * PI) + 0.5;
  return [along, clamp01(0.5 + height / 2.4)];
}

/**
 * Compile the fields consumed by the terrain shader.
 * patchData0 = projectedU, projectedV, shorelineWeight, heightBlend
 * patchData1 = shorelineU, shorelineV, tileVariation, waterWeight
 */
export function terrainPatchBlendAt({ direction, semantic = {} } = {}) {
  const d = normalize(direction || [0, 1, 0]);
  const height = Number.isFinite(semantic.height) ? semantic.height : 0;
  const land = clamp01(Number(semantic.land) || 0);
  const wetness = clamp01(Number(semantic.wetness) || 0);
  const projectedUv = sphericalProjectedUv(d);
  const shorelineUv = shorelineManualUv(d, height);

  // Height is the final authority for the land/water seam.  WFC landness and
  // wetness soften it, but never replace the signed field used by MC.
  const waterWeight = clamp01(Math.max(1 - land, smoothstep(0.2, -0.35, height)));
  const shorelineWeight = clamp01(
    smoothstep(0.9, 0.05, Math.abs(height)) * (0.45 + wetness * 0.55),
  );
  const heightBlend = smoothstep(-0.5, 5.8, height);
  const tileVariation = fract(
    Math.sin(d[0] * 127.1 + d[1] * 311.7 + d[2] * 74.7) * 43758.5453,
  );
  return {
    projectedUv,
    shorelineUv,
    shorelineWeight,
    heightBlend,
    tileVariation,
    waterWeight,
    version: "terrain-patch-blend-v10",
  };
}
