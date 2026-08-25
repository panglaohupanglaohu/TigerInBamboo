// =====================================================================
// V10 unified semantic cell contract (G21-A, DeepSeek data layer).
//
// Every dual cell carries one stable SemanticCellV10 with the
// terrain/water/climate/ecology/locks groups defined in PLAN 12.30.3.
// The module owns the schema (field ranges), a strict validator that
// throws errors carrying the cell ID, and a clamping helper.  It is pure
// data code: no Three.js, no renderer imports, no feature flags.
// =====================================================================

export const SEMANTIC_FIELD_V10_VERSION = "semanticFieldV10";

// Numeric ranges.  Fields with `range: null` are free numeric (signed
// distances, depths, radian measures); fields with a fixed token domain
// carry `enum`.
export const SEMANTIC_CELL_V10_SCHEMA = Object.freeze({
  terrain: Object.freeze({
    elevation: Object.freeze({ min: -12, max: 24 }),
    slope: Object.freeze({ min: 0, max: 1 }),
    aspect: Object.freeze({ min: 0, max: Math.PI * 2 }),
    northFacing: Object.freeze({ min: 0, max: 1 }),
    curvature: Object.freeze({ min: -1, max: 1 }),
    coarseAO: Object.freeze({ min: 0, max: 1 }),
    rockness: Object.freeze({ min: 0, max: 1 }),
    snowness: Object.freeze({ min: 0, max: 1 }),
  }),
  water: Object.freeze({
    landMask: Object.freeze({ min: 0, max: 1 }),
    waterDepth: Object.freeze({ min: 0, max: null }),
    lakeMask: Object.freeze({ min: 0, max: 1 }),
    coastDistance: Object.freeze({ min: null, max: null }),
    drainage: Object.freeze({ enum: [0, 1, 2, 3, 4, 5, 6, 7] }),
    flowX: Object.freeze({ min: -1, max: 1 }),
    flowY: Object.freeze({ min: -1, max: 1 }),
    baseWetness: Object.freeze({ min: 0, max: 1 }),
  }),
  climate: Object.freeze({
    windX: Object.freeze({ min: -1, max: 1 }),
    windY: Object.freeze({ min: -1, max: 1 }),
    upwindOceanFetch: Object.freeze({ min: 0, max: null }),
    evaporativeMoisture: Object.freeze({ min: 0, max: 1 }),
    vapor: Object.freeze({ min: 0, max: 1 }),
    orographicLift: Object.freeze({ min: 0, max: null }),
    rainShadow: Object.freeze({ min: 0, max: 1 }),
    precipitationClimatology: Object.freeze({ min: 0, max: 1 }),
    cloudPotential: Object.freeze({ min: 0, max: 1 }),
    cloudBase: Object.freeze({ min: 0, max: null }),
  }),
  ecology: Object.freeze({
    ecologicalWetness: Object.freeze({ min: 0, max: 1 }),
    forestness: Object.freeze({ min: 0, max: 1 }),
    grassness: Object.freeze({ min: 0, max: 1 }),
    reedness: Object.freeze({ min: 0, max: 1 }),
    mudness: Object.freeze({ min: 0, max: 1 }),
    speciesBand: Object.freeze({ enum: [0, 1, 2, 3, 4, 5, 6, 7, 8] }),
  }),
  locks: Object.freeze({
    building: Object.freeze({ min: 0, max: 1 }),
    route: Object.freeze({ min: 0, max: 1 }),
    combat: Object.freeze({ min: 0, max: 1 }),
    camera: Object.freeze({ min: 0, max: 1 }),
    authoredBiome: Object.freeze({ min: 0, max: 1 }),
  }),
});

export const DEFAULT_SEMANTIC_CELL_V10 = Object.freeze({
  terrain: Object.freeze({ elevation: 0, slope: 0, aspect: 0, northFacing: 0, curvature: 0, coarseAO: 0.6, rockness: 0, snowness: 0 }),
  water: Object.freeze({ landMask: 1, waterDepth: 0, lakeMask: 0, coastDistance: 2, drainage: 0, flowX: 0, flowY: 0, baseWetness: 0.15 }),
  climate: Object.freeze({ windX: 0, windY: 0, upwindOceanFetch: 0, evaporativeMoisture: 0, vapor: 0, orographicLift: 0, rainShadow: 0, precipitationClimatology: 0, cloudPotential: 0, cloudBase: 1.2 }),
  ecology: Object.freeze({ ecologicalWetness: 0, forestness: 0, grassness: 0.8, reedness: 0, mudness: 0, speciesBand: 3 }),
  locks: Object.freeze({ building: 0, route: 0, combat: 0, camera: 0, authoredBiome: 0 }),
});

function isFiniteNumber(value) { return typeof value === "number" && Number.isFinite(value); }

function fieldErrors(cell, group, schema, fields) {
  const errors = [];
  for (const [name, rule] of Object.entries(schema[group])) {
    const value = fields?.[name];
    if (value == null) { errors.push(`${group}.${name}:missing`); continue; }
    if (rule.enum) {
      if (!rule.enum.includes(value)) errors.push(`${group}.${name}:enum(${value})`);
      continue;
    }
    if (!isFiniteNumber(value)) { errors.push(`${group}.${name}:non-finite`); continue; }
    if (rule.min != null && value < rule.min) errors.push(`${group}.${name}:below(${value})`);
    if (rule.max != null && value > rule.max) errors.push(`${group}.${name}:above(${value})`);
  }
  return errors;
}

/**
 * Strict validation.  Throws an Error that always carries the cell ID so a
 * bad producer can be located in a 1000-seed run.
 */
export function validateSemanticCellV10(cell) {
  if (!cell || typeof cell.id !== "string" || !cell.id) throw new Error(`semantic-cell-v10: missing stable cell id`);
  const errors = [];
  for (const group of ["terrain", "water", "climate", "ecology", "locks"]) {
    if (!cell[group] || typeof cell[group] !== "object") { errors.push(`${group}:missing`); continue; }
    errors.push(...fieldErrors(cell, group, SEMANTIC_CELL_V10_SCHEMA, cell[group]));
  }
  if (errors.length) {
    throw new Error(`semantic-cell-v10 ${cell.id}: ${errors.join(", ")}`);
  }
  return { ok: true, id: cell.id };
}

export function clamp01(value) { return Math.max(0, Math.min(1, value)); }

function clampField(value, rule) {
  if (rule.enum) return value;
  let out = value;
  if (rule.min != null && out < rule.min) out = rule.min;
  if (rule.max != null && out > rule.max) out = rule.max;
  return out;
}

export function clampSemanticCellV10(cell) {
  const out = { id: cell.id };
  for (const group of ["terrain", "water", "climate", "ecology", "locks"]) {
    out[group] = {};
    for (const [name, rule] of Object.entries(SEMANTIC_CELL_V10_SCHEMA[group])) {
      const value = cell[group]?.[name];
      if (value == null) out[group][name] = DEFAULT_SEMANTIC_CELL_V10[group][name] ?? 0;
      else if (!Number.isFinite(value) && !rule.enum) out[group][name] = 0;
      else out[group][name] = clampField(value, rule);
    }
  }
  return Object.freeze(out);
}

/**
 * Strict factory: every group must be a plain object and every schema field
 * must be present (producers spread DEFAULT_SEMANTIC_CELL_V10 first and then
 * override).  Missing groups/fields, NaN and out-of-range values throw an
 * Error carrying the cell ID, per PLAN 12.30.3.
 */
export function createSemanticCellV10({ id, terrain, water, climate, ecology, locks } = {}) {
  const cell = { id };
  for (const group of ["terrain", "water", "climate", "ecology", "locks"]) {
    const fields = { terrain, water, climate, ecology, locks }[group];
    if (!fields || typeof fields !== "object") {
      throw new Error(`semantic-cell-v10 ${id || "?"}: ${group}:missing-group`);
    }
    cell[group] = { ...fields };
  }
  validateSemanticCellV10(cell);
  return Object.freeze({
    id,
    terrain: Object.freeze(cell.terrain),
    water: Object.freeze(cell.water),
    climate: Object.freeze(cell.climate),
    ecology: Object.freeze(cell.ecology),
    locks: Object.freeze(cell.locks),
  });
}

/** Stable ordering helper used by the texture baker and hashes. */
export function stableCellOrder(ids) {
  return ids.slice().sort((a, b) => {
    const na = Number(a.split(":")[1]);
    const nb = Number(b.split(":")[1]);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
