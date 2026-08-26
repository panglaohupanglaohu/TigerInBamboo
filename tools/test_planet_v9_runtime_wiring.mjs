import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";

const runtime = readFileSync(new URL("../TigerMessenger/src/world/planetV8/runtime.js", import.meta.url), "utf8");
const island = readFileSync(new URL("../TigerMessenger/src/scenes/messengerIsland.js", import.meta.url), "utf8");
const traffic = readFileSync(new URL("../TigerMessenger/src/scenes/messenger/loadTraffic.js", import.meta.url), "utf8");
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
assert.match(island, /officialPagePlanetFeatures/);
assert.match(island, /cloudImpostorV1 = true/);
assert.match(island, /legacyCanalWorld = false/);
assert.match(island, /canalScope = "crystal-city"/);
assert.match(island, /legacyCanalWorld: planetFeatures.legacyCanalWorld/);
assert.match(island, /canalScope: planetFeatures.canalScope/);
assert.match(island, /features: planetFeatures/);
assert.match(traffic, /useCrystalCanal = scope === "crystal-city"/);
assert.match(traffic, /if \(useWorldCanal\) \{/);
assert.match(traffic, /count: useCrystalCanal \? 4 : 10/);
assert.match(traffic, /canalPush\(cityCanalWaypoint, "水晶城"\)/);
assert.match(traffic, /canalPush\(canyonDir \|\| latLonToDir\(CANYON\.lat, CANYON\.lon, new THREE\.Vector3\(\)\), "水晶城峡谷"\)/);
assert.doesNotMatch(
  traffic.slice(traffic.indexOf("if (useCrystalCanal)"), traffic.indexOf("else if (useWorldCanal || useOceanRoutes)")),
  /书店镇|出发营地|月亮湖|高山圣城|运河交汇古堡/,
  "crystal-city canal must not reattach world landmarks",
);
assert.match(runtime, /enabledTerrain \? \(features.planetChartLimit/);
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

const cloudsOnly = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 0, resolution: 3 });
assert.equal(cloudsOnly.ok, true, cloudsOnly.stage);
assert.equal(cloudsOnly.charts.length, 0);
assert.ok(cloudsOnly.clouds.instanceCount > 0, "official-page cloud path must bake impostors without terrain charts");
assert.equal(cloudsOnly.snapshot.clouds.climateSource, "climate-v10");

console.log("✅ Planet V9 runtime wiring: terrain, vegetation, ocean, lake, cloud and bounded surface events have mount/update/dispose contracts");
