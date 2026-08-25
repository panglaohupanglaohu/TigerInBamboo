// =====================================================================
// V10 semantic texture baker (G21-A, DeepSeek data layer).
//
// Packs an ordered list of SemanticCellV10 into typed arrays:
//   terrainData0: [elevation01, slope, baseWetness, 1-landMask]
//   terrainData1: [forestness, rockness, coastDistance(signed), coarseAO]
//   climateData0: [fetch01, vapor, lift01, rainShadow]
//   climateData1: [precipitation, cloudPotential, cloudBase01, ecologicalWetness]
//   ecologyData0: [forest, grass, reed, mud]
// terrainData0/1 keep the channel order of the existing
// terrainSemanticBake (height, slope, wetness, 1-land / forestness,
// rockness, coastDistance, ao) so shader/vegetation consumers stay
// source-compatible; coastDistance is now the signed V10 value (Float32
// carries the sign; shaders clamp at the boundary).
// =====================================================================

import { SEMANTIC_FIELD_V10_VERSION, stableCellOrder, SEMANTIC_CELL_V10_SCHEMA } from "./semanticFieldV10.js";

function clamp01(value) { return Math.max(0, Math.min(1, value)); }

function fnv1a32(bytes) {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Normalize an absolute elevation into 0..1 using the schema range. */
export function elevation01(elevation, schema = SEMANTIC_CELL_V10_SCHEMA) {
  const rule = schema.terrain.elevation;
  return clamp01((elevation - rule.min) / ((rule.max ?? 24) - rule.min));
}

export function lift01(lift, maxLift = 12) {
  return clamp01(lift / maxLift);
}

export function fetch01(fetch, maxFetch = 1.5) {
  return clamp01(fetch / maxFetch);
}

export function cloudBase01(cloudBase, maxCloudBase = 1.6) {
  return clamp01(cloudBase / maxCloudBase);
}

/**
 * cells: iterable of SemanticCellV10 (or anything exposing the groups).
 * order: "stable" sorts by numeric cell suffix; otherwise the given array
 * is used as-is.
 */
export function bakeSemanticTexturesV10({ cells = [], order = "stable" } = {}) {
  const list = Array.isArray(cells) ? cells : [...cells];
  const sorted = order === "stable"
    ? stableCellOrder(list.map((cell) => cell.id)).map((id) => list.find((cell) => cell.id === id))
    : list;
  const count = sorted.length;
  const terrainData0 = new Float32Array(count * 4);
  const terrainData1 = new Float32Array(count * 4);
  const climateData0 = new Float32Array(count * 4);
  const climateData1 = new Float32Array(count * 4);
  const ecologyData0 = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const cell = sorted[i];
    if (!cell) throw new Error(`semantic-texture-v10: missing cell at stable order ${i}`);
    const t = cell.terrain || {};
    const w = cell.water || {};
    const c = cell.climate || {};
    const e = cell.ecology || {};
    terrainData0.set([elevation01(t.elevation), clamp01(t.slope), clamp01(w.baseWetness), 1 - clamp01(w.landMask)], i * 4);
    terrainData1.set([clamp01(e.forestness), clamp01(t.rockness), Number(w.coastDistance) || 0, clamp01(t.coarseAO)], i * 4);
    climateData0.set([fetch01(c.upwindOceanFetch), clamp01(c.vapor), lift01(c.orographicLift), clamp01(c.rainShadow)], i * 4);
    climateData1.set([
      clamp01(c.precipitationClimatology),
      clamp01(c.cloudPotential),
      cloudBase01(c.cloudBase),
      clamp01(e.ecologicalWetness),
    ], i * 4);
    ecologyData0.set([clamp01(e.forestness), clamp01(e.grassness), clamp01(e.reedness), clamp01(e.mudness)], i * 4);
  }
  const bytes = Buffer.concat([
    Buffer.from(terrainData0.buffer), Buffer.from(terrainData1.buffer),
    Buffer.from(climateData0.buffer), Buffer.from(climateData1.buffer),
    Buffer.from(ecologyData0.buffer),
  ]);
  return Object.freeze({
    schemaVersion: SEMANTIC_FIELD_V10_VERSION,
    count,
    terrainData0,
    terrainData1,
    climateData0,
    climateData1,
    ecologyData0,
    channelManifest: Object.freeze([
      Object.freeze({ name: "terrainData0", components: 4, source: "elevation01,slope,baseWetness,1-landMask" }),
      Object.freeze({ name: "terrainData1", components: 4, source: "forestness,rockness,coastDistance(signed),coarseAO" }),
      Object.freeze({ name: "climateData0", components: 4, source: "fetch01,vapor,lift01,rainShadow" }),
      Object.freeze({ name: "climateData1", components: 4, source: "precipitation,cloudPotential,cloudBase01,ecologicalWetness" }),
      Object.freeze({ name: "ecologyData0", components: 4, source: "forest,grass,reed,mud" }),
    ]),
    byteLength: bytes.length,
    hash: `stx${fnv1a32(bytes)}`,
  });
}
