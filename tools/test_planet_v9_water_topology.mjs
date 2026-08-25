import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { validateCurvedWater } from "../TigerMessenger/src/world/waterV8/curvedWaterCompiler.js";

function edgeHistogram(indices) {
  const edges = new Map();
  for (let index = 0; index < indices.length; index += 3) {
    for (const [a, b] of [[indices[index], indices[index + 1]], [indices[index + 1], indices[index + 2]], [indices[index + 2], indices[index]]]) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  return edges;
}

const world = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
assert.equal(world.ok, true, world.report?.stage);
assert.equal(validateCurvedWater(world.water).ok, true);
assert.equal(world.water.ocean.topology.source, "main/dual-grid+field+mc");
assert.equal(world.water.ocean.topology.stableVertexIds, true);
const oceanEdges = edgeHistogram(world.water.ocean.indices);
assert.ok([...oceanEdges.values()].every((count) => count === 2), "closed ocean shell must be manifold");
for (const lake of world.water.lakes) {
  const lengths = [];
  for (let index = 0; index < lake.positions.length; index += 3) lengths.push(Math.hypot(lake.positions[index], lake.positions[index + 1], lake.positions[index + 2]));
  assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-4, "lake cap must remain on the sphere");
  for (let index = 0; index < lake.waterData0.length; index += 4) {
    assert.ok(lake.waterData0[index] >= 0 && lake.waterData0[index] <= 1);
    assert.ok(lake.waterData0[index + 1] >= 0 && lake.waterData0[index + 1] <= 1);
    assert.ok(lake.waterData0[index + 2] >= 0 && lake.waterData0[index + 2] <= 1);
  }
}
for (const route of world.water.routes) for (const point of route.points) assert.ok(Math.abs(Math.hypot(...point.position) - world.water.radius) < 8);
const shader = readFileSync(new URL("../TigerMessenger/src/render/water/curvedWaterMaterial.js", import.meta.url), "utf8");
assert.doesNotMatch(shader, /\b(?:NaN|Infinity)\b/);
assert.match(shader, /shorelineFoam/);
assert.match(shader, /lakeRipple/);
console.log("✅ Planet V9 water topology: manifold curved shell/cap, field-backed shore data, spherical routes and finite GPU shader contract passed");
