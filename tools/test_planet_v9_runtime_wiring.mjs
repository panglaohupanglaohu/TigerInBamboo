import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { compileOfficialOcean, drapeOceanOnLegacyPlanet, officialOceanLevelAt } from "../TigerMessenger/src/world/waterV8/officialOcean.js";
import { CANYON, canyonOffsetDir } from "../TigerMessenger/src/world/canyon.js";
import { latLonToDir } from "../TigerMessenger/src/world/sphereMath.js";
import { BOOKSHOP_TOWN, BOOKSHOP_OCEAN_ISLAND_LIFT, ISLAND_BASE_LIFT, groundLiftAt } from "../TigerMessenger/src/world/hills.js";
import { crystalCanyonSwampDir } from "../TigerMessenger/src/world/citySeaLake.js";
import * as THREE from "../TigerMessenger/vendor/three.module.js";

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
assert.match(island, /curvedWaterV1 = true/);
assert.match(island, /oceanWorldRoutesV1 = true/);
assert.match(island, /legacyCanalWorld = false/);
assert.match(island, /canalScope = "crystal-city"/);
assert.match(island, /highlandIslandLift = 0/);
assert.match(island, /saihojiIslandLift = 3.2/);
assert.match(island, /baseLift: planetFeatures.saihojiIslandLift/);
assert.match(island, /legacyCanalWorld: planetFeatures.legacyCanalWorld/);
assert.match(island, /canalScope: planetFeatures.canalScope/);
assert.match(island, /oceanWorldRoutes: planetFeatures.oceanWorldRoutesV1/);
assert.match(island, /features: planetFeatures/);
assert.match(traffic, /useCrystalCanal = scope === "crystal-city"/);
assert.match(traffic, /kind: "ocean-warship"/);
assert.match(traffic, /buildOceanPatrolCurve/);
assert.match(
  readFileSync(new URL("../TigerMessenger/src/scenes/messenger/loadMoebius.js", import.meta.url), "utf8"),
  /crystalCanyonSwampDir/,
);
assert.match(runtime, /enabledWater && enabledTerrain && planet/);
assert.match(runtime, /compileOfficialOcean/);
assert.match(runtime, /paintPlanetOceanBed/);
assert.match(runtime, /OFFICIAL_OCEAN_COLOR/);
assert.match(traffic, /canalPush\(cityCanalWaypoint, "水晶城"\)/);
assert.match(traffic, /canalPush\(canyonDir \|\| latLonToDir\(CANYON\.lat, CANYON\.lon, new THREE\.Vector3\(\)\), "水晶城峡谷"\)/);
assert.doesNotMatch(
  traffic.slice(traffic.indexOf("if (useCrystalCanal)"), traffic.indexOf("} else if (useWorldCanal)")),
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

const officialOcean = compileOfficialOcean({ radius: 160, seaLevel: 0.12, widthSegments: 32, heightSegments: 24 });
assert.equal(officialOcean.ocean.curved, true);
const seaRadii = [];
let canyonNearestR = Infinity;
let canyonNearestAng = Infinity;
const canyonDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), canyonDir).normalize();
const rimDir = canyonDir.clone().multiplyScalar(Math.cos(CANYON.rim * 0.98)).addScaledVector(east, Math.sin(CANYON.rim * 0.98)).normalize();
const midDir = canyonDir.clone().multiplyScalar(Math.cos(CANYON.rim * 0.70)).addScaledVector(east, Math.sin(CANYON.rim * 0.70)).normalize();
const rimLevel = officialOceanLevelAt(rimDir, 0.12);
const midLevel = officialOceanLevelAt(midDir, 0.12);
const floorLevel = officialOceanLevelAt(canyonDir, 0.12);
assert.ok(Math.abs(rimLevel - 0.12) < 0.35, `canyon rim must keep ocean at sea level (level=${rimLevel.toFixed(2)})`);
assert.ok(floorLevel < -8, `canyon floor ocean must drop well below sea level (level=${floorLevel.toFixed(2)})`);
assert.ok(midLevel < rimLevel - 1 && midLevel > floorLevel + 1, "ocean must slope from rim into the canyon instead of dropping as a lid");
for (let i = 0; i < officialOcean.ocean.positions.length; i += 3) {
  const x = officialOcean.ocean.positions[i];
  const y = officialOcean.ocean.positions[i + 1];
  const z = officialOcean.ocean.positions[i + 2];
  const r = Math.hypot(x, y, z);
  const dir = new THREE.Vector3(x, y, z).normalize();
  const ang = dir.angleTo(canyonDir);
  if (ang < canyonNearestAng) {
    canyonNearestAng = ang;
    canyonNearestR = r;
  }
  if (ang > 0.9) seaRadii.push(r);
}
assert.ok(seaRadii.length > 0 && Math.max(...seaRadii) - Math.min(...seaRadii) < 0.4, "open ocean must stay on the curved shell");
assert.ok(Math.min(...seaRadii) > 160.05, "open ocean must sit above the planet ground, not chord under it");
assert.ok(canyonNearestR < 160 - 4, `canyon ocean must drape into the rift (r=${canyonNearestR.toFixed(2)} ang=${canyonNearestAng.toFixed(3)})`);
const fitted = compileOfficialOcean({ radius: 160 });
const fittedSea = [];
for (let i = 0; i < fitted.ocean.positions.length; i += 3) {
  const x = fitted.ocean.positions[i];
  const y = fitted.ocean.positions[i + 1];
  const z = fitted.ocean.positions[i + 2];
  const dir = new THREE.Vector3(x, y, z).normalize();
  if (dir.angleTo(canyonDir) > 0.9) fittedSea.push(Math.hypot(x, y, z));
}
assert.ok(fittedSea.length > 0 && Math.min(...fittedSea) > 160.5, "production ocean shell must rest above the ground everywhere except the canyon");
const sample = new Float32Array([160, 0, 0, 0, 160, 0, 0, 0, 160]);
drapeOceanOnLegacyPlanet(sample, 160, 0.12);
assert.ok(Math.abs(Math.hypot(sample[0], sample[1], sample[2]) - 160.12) < 1e-3);

const bookshopLift = groundLiftAt(BOOKSHOP_TOWN.x, BOOKSHOP_TOWN.z);
assert.ok(bookshopLift > ISLAND_BASE_LIFT + BOOKSHOP_OCEAN_ISLAND_LIFT, "bookshop town must sit on a plateau above sea level");
assert.match(readFileSync(new URL("../TigerMessenger/src/world/mossyGround.js", import.meta.url), "utf8"), /baseLift/);
const swampDir = crystalCanyonSwampDir(new THREE.Vector3());
assert.ok(canyonOffsetDir(swampDir) < -8, "marsh must sit on a canyon terrace, not outside the rift");
assert.ok(swampDir.angleTo(canyonDir) < CANYON.rim, "marsh direction must remain inside the canyon rim");

console.log("✅ Planet V9 runtime wiring: terrain, vegetation, ocean, lake, cloud and bounded surface events have mount/update/dispose contracts");
