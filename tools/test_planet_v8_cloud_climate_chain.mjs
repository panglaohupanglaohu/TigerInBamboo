import assert from "node:assert/strict";
import { classifyCloudBand, cloudBaseForBand, compileCloudClusters } from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";

const expected = ["snowline-crown", "windward-wall", "rift-low-fog", "lake-low-cloud", "sea-breeze-scatter", "open-sky-edge"];
for (const [landform, band] of [
  ["volcanic-snow-massif", "snowline-crown"],
  ["rift-shoulder-pass", "windward-wall"],
  ["rift-escarpment", "rift-low-fog"],
  ["rift-long-lake", "lake-low-cloud"],
  ["auckland-volcanic-hills", "sea-breeze-scatter"],
  ["japanese-alluvial-plain", "open-sky-edge"],
]) assert.equal(classifyCloudBand(landform, 0.7, 0.7, 0.8), band);
for (const band of expected) assert.ok(cloudBaseForBand(band) > 0);

const landforms = ["volcanic-snow-massif", "rift-shoulder-pass", "rift-escarpment", "rift-long-lake", "auckland-volcanic-hills", "japanese-alluvial-plain"];
const cells = landforms.map((landformClass, index) => ({ id: `cell:${index}`, index, direction: [0, 1, 0] }));
const semantics = new Map(cells.map((cell, index) => [cell.id, { height: index, wetness: index / 6, landformClass: landforms[index] }]));
const a = compileCloudClusters({ cells, semantics, seed: 42, maxInstances: 100 });
const b = compileCloudClusters({ cells, semantics, seed: 42, maxInstances: 100 });
assert.equal(a.climateHash, b.climateHash);
assert.ok(a.instances.every((instance) => expected.includes(instance.climateBand)));
assert.ok(a.instances.every((instance) => Number.isFinite(instance.cloudBase)));
assert.ok(a.instances.every((instance) => instance.shadowMode === "projected-low-resolution"));

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 2, resolution: 4 });
  assert.equal(world.ok, true, `cloud climate world seed=${seed}`);
  assert.ok(world.clouds.instances.every((instance) => Number.isFinite(instance.cloudBase)));
  assert.ok(world.clouds.instances.every((instance) => expected.includes(instance.climateBand) || ["windward-mountain", "rain-shadow"].includes(instance.climateBand)));
}
for (let seed = 1; seed <= 100; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 });
  assert.equal(world.ok, true);
}
console.log("✅ Planet V8 cloud climate chain: six bands, deterministic impostor motion, keepout-ready cloud bases and 100 seeds passed");
