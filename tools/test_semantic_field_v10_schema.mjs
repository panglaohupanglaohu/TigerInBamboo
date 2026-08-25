// =====================================================================
// G21-A schema/dependency/bake gate (DeepSeek TEST, pure Node).
// Covers: field completeness, clamping, NaN/out-of-range errors carrying
// the cell ID, stable cell ordering, typed-array layout/hash determinism
// and dependency-cycle rejection.  Seeds 1/7/42/884 exercise the real
// geodesic grid.
// =====================================================================

import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import {
  createSemanticCellV10, validateSemanticCellV10, clampSemanticCellV10,
  stableCellOrder, SEMANTIC_CELL_V10_SCHEMA, SEMANTIC_FIELD_V10_VERSION,
  DEFAULT_SEMANTIC_CELL_V10,
} from "../TigerMessenger/src/procgen/planet/semanticFieldV10.js";
import {
  FIELD_DEPENDENCY_GRAPH_V10, validateDependencyGraphV10,
  assertNoCloudEcologyFeedbackV10, allowedDependencyEdgeV10,
} from "../TigerMessenger/src/procgen/planet/fieldDependencyGraphV10.js";
import { bakeSemanticTexturesV10 } from "../TigerMessenger/src/procgen/planet/semanticTextureBakeV10.js";

function fullCell(id, overrides = {}) {
  return createSemanticCellV10({
    id,
    terrain: { ...DEFAULT_SEMANTIC_CELL_V10.terrain, ...(overrides.terrain || {}) },
    water: { ...DEFAULT_SEMANTIC_CELL_V10.water, ...(overrides.water || {}) },
    climate: { ...DEFAULT_SEMANTIC_CELL_V10.climate, ...(overrides.climate || {}) },
    ecology: { ...DEFAULT_SEMANTIC_CELL_V10.ecology, ...(overrides.ecology || {}) },
    locks: { ...DEFAULT_SEMANTIC_CELL_V10.locks, ...(overrides.locks || {}) },
  });
}

// --- 1. valid cell builds ---
const cell = fullCell("cell:3", { terrain: { elevation: 5.2, slope: 0.4, northFacing: 0.7 }, water: { landMask: 1, coastDistance: 3.2 } });
assert.equal(validateSemanticCellV10(cell).ok, true);
assert.equal(cell.id, "cell:3");
assert.equal(cell.terrain.slope, 0.4);
assert.equal(cell.water.coastDistance, 3.2);

// --- 2. errors must carry the cell ID ---
const cases = [
  { name: "missing group", build: () => createSemanticCellV10({ id: "cell:0", ...DEFAULT_SEMANTIC_CELL_V10, terrain: null }) },
  { name: "missing field", build: () => createSemanticCellV10({ id: "cell:0", ...DEFAULT_SEMANTIC_CELL_V10, terrain: { elevation: 1 } }) },
  { name: "NaN", build: () => fullCell("cell:1", { terrain: { elevation: NaN } }) },
  { name: "out of range", build: () => fullCell("cell:2", { terrain: { slope: 1.7 } }) },
  { name: "bad enum", build: () => fullCell("cell:4", { water: { drainage: 9 } }) },
  { name: "missing id", build: () => createSemanticCellV10({ ...DEFAULT_SEMANTIC_CELL_V10 }) },
];
for (const entry of cases) {
  let threw = null;
  try { entry.build(); } catch (error) { threw = error.message; }
  assert.ok(threw, `${entry.name} must throw`);
  if (entry.name === "missing id") assert.match(threw, /cell id/);
  else if (entry.name === "missing field") assert.ok(threw.includes("terrain.aspect:missing"), threw);
  else assert.ok(threw.includes("cell:") && (threw.includes("cell:0") || threw.includes("cell:1") || threw.includes("cell:2") || threw.includes("cell:4")), `${entry.name} must carry cell id, got: ${threw}`);
}

// --- 3. clamp ---
const clamped = clampSemanticCellV10({ id: "cell:5", terrain: { elevation: 99, slope: -2 }, water: { waterDepth: -4 } });
assert.equal(clamped.terrain.elevation, SEMANTIC_CELL_V10_SCHEMA.terrain.elevation.max);
assert.equal(clamped.terrain.slope, 0);
assert.equal(clamped.water.waterDepth, 0);
assert.equal(clamped.climate.cloudBase, 1.2, "missing group falls back to defaults");

// --- 4. stable ordering: numeric suffix, not lexicographic ---
assert.deepEqual(stableCellOrder(["cell:10", "cell:2", "cell:1"]), ["cell:1", "cell:2", "cell:10"]);

// --- 5. dependency graph: DAG ok, forbidden cloud→ecology rejected ---
const graphReport = validateDependencyGraphV10(FIELD_DEPENDENCY_GRAPH_V10);
assert.equal(graphReport.ok, true, graphReport.errors.join("; "));
assert.equal(graphReport.version, "fieldDependencyGraphV10");
assert.equal(validateDependencyGraphV10({ ...FIELD_DEPENDENCY_GRAPH_V10, edges: [...FIELD_DEPENDENCY_GRAPH_V10.edges, { from: "cloud", to: "ecology" }] }).ok, false, "cloud→ecology must be rejected");
assert.equal(validateDependencyGraphV10({ ...FIELD_DEPENDENCY_GRAPH_V10, edges: [...FIELD_DEPENDENCY_GRAPH_V10.edges, { from: "ecology", to: "cloud" }] }).ok, false, "reverse ecology→cloud cycle must be rejected");
assert.equal(allowedDependencyEdgeV10("terrain", "hydrology"), true);
assert.equal(allowedDependencyEdgeV10("cloud", "ecology"), false);
assertNoCloudEcologyFeedbackV10(); // throws if broken

// --- 6. golden seeds: real grid ids + bake layout/hash stable ---
for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `seed=${seed} ${world.stage}`);
  const ids = world.grid.dual.cells().map((cell) => cell.id);
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length, `seed=${seed} stable ids unique`);
  const cells = ids.map((id) => fullCell(id));
  const bake1 = bakeSemanticTexturesV10({ cells });
  const bake2 = bakeSemanticTexturesV10({ cells });
  assert.equal(bake1.schemaVersion, SEMANTIC_FIELD_V10_VERSION);
  assert.equal(bake1.count, ids.length);
  assert.equal(bake1.channelManifest.length, 5);
  assert.equal(bake1.terrainData0.length, ids.length * 4);
  assert.equal(bake1.climateData0.length, ids.length * 4);
  assert.equal(bake1.ecologyData0.length, ids.length * 4);
  assert.equal(bake1.byteLength, ids.length * 4 * 4 * 5);
  assert.equal(bake1.hash, bake2.hash, `seed=${seed} bake hash deterministic`);
  // stable order independent of input order
  const bake3 = bakeSemanticTexturesV10({ cells: [...cells].reverse() });
  assert.equal(bake3.hash, bake1.hash, `seed=${seed} bake hash order-independent`);
  assert.ok(bake1.terrainData0.every((value) => Number.isFinite(value)));
  assert.ok(bake1.climateData1.every((value) => Number.isFinite(value)));
  assert.ok(bake1.ecologyData0.every((value) => Number.isFinite(value)));
}
console.log(`✅ Semantic field V10 schema: contract/NaN/cell-id/clamp/stable-order/DAG/bake-layout hash (seeds 1/7/42/884)`);
