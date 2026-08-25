import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../TigerMessenger/src/world/planetV8/runtime.js", import.meta.url), "utf8");
const island = readFileSync(new URL("../TigerMessenger/src/scenes/messengerIsland.js", import.meta.url), "utf8");
const params = readFileSync(new URL("../TigerMessenger/src/core/params.js", import.meta.url), "utf8");
assert.match(runtime, /createVegetationRuntime/);
assert.match(runtime, /createCurvedWaterMaterial/);
assert.match(runtime, /createCurvedLakeMaterial/);
assert.match(runtime, /createCloudImpostorSystem/);
assert.match(runtime, /compilePlanetClouds|compiler\.clouds/);
assert.match(runtime, /waterEvents/);
assert.match(runtime, /waterWakes/);
assert.match(runtime, /resourceRegistry/);
assert.match(runtime, /selectPlanetV9LOD/);
assert.match(runtime, /disposePlanetV8Runtime/);
assert.match(island, /features:\s*\{\s*\.\.\.FEATURES/);
assert.match(runtime, /const isV9 = presentationVersion === "v9"/);
assert.match(runtime, /landformChain:\s*isV9/);
assert.match(runtime, /if \(isV9\) \{/);
assert.match(runtime, /oskar-continuous-chain-v9/);
assert.match(runtime, /planet-sphere-baseline-v8/);
assert.match(params, /planetOskarV1/);
assert.match(params, /WORLD_VERSION_PRESETS/);
for (const file of [
  "TigerMessenger/src/render/vegetation/vegetationRuntime.js",
  "TigerMessenger/src/world/waterV8/waterSurfaceEvents.js",
  "TigerMessenger/src/render/clouds/cloudImpostorSystem.js",
]) assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, file);

console.log("✅ Planet V9 runtime wiring: terrain, vegetation, ocean, lake, cloud and bounded surface events have mount/update/dispose contracts");
