import assert from "node:assert/strict";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { sampleBarycentricDirection } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { buildPlanetGridDebug, planetGridDebugSvg } from "../TigerMessenger/src/procgen/planet/planetDebugExport.js";
for (const subdivision of [1, 2, 3, 4, 5]) {
  const grid = buildGeodesicMainAndDualGrid({ subdivision, radius: 160, seed: 42 });
  assert.equal(grid.dual.validate().ok, true);
  assert.equal(grid.main.faces.length, 20 * subdivision * subdivision);
  assert.equal(grid.main.positions.length, 10 * subdivision * subdivision + 2);
  assert.ok(grid.charts.every((chart) => chart.haloRings >= 2));
}
const a = buildGeodesicMainAndDualGrid({ subdivision: 3, seed: 42 });
const b = buildGeodesicMainAndDualGrid({ subdivision: 3, seed: 42 });
assert.equal(a.hash, b.hash);
assert.equal(a.dual.vertexValidate().ok, true);
assert.equal(a.dual.vertexCells().filter((cell) => a.dual.vertexNeighborsOf(cell.index).length === 5).length, 12);
const sample = sampleBarycentricDirection(a, a.dual.directionOf(0));
assert.equal(sample.indices.length, 3);
assert.ok(Math.abs(sample.weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-6);
assert.ok(sample.weights.every((weight) => weight >= 0));
const debug = buildPlanetGridDebug(a, [{ id: "pin", direction: [0, 1, 0] }]);
assert.ok(debug.mainEdges.length > 0 && debug.dualEdges.length > 0 && debug.pentagons.length === 12);
assert.match(planetGridDebugSvg(debug), /^<svg/);
console.log("✅ Planet V8 graph: subdivision 1..5 topology, stable hash and chart halo passed");
