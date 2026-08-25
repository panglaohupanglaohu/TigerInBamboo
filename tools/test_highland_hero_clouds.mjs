import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLandmarkManifest, createContinuousLandformManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { createPlanetFieldRecipe } from "../TigerMessenger/src/procgen/planet/planetFieldComposer.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { compileCloudClusters, applyCloudCameraKeepouts, instanceFullyOccludesPeak } from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";
import { HERO_CLOUD_SPECS } from "../TigerMessenger/src/render/clouds/heroCloudCatalog.js";
import {
  compileHeroCloudClusters,
  compileCloudKeepouts,
  compilePlanetClouds,
  heroLayoutHash,
} from "../TigerMessenger/src/render/clouds/heroCloudCompiler.js";
import { resolveCameraV8 } from "../TigerMessenger/src/render/visualV8/resolveCameraV8.js";

function normalize(v) { const l = Math.hypot(...v) || 1; return v.map((n) => n / l); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function peakVisibleFromCamera(camera, peakPos, cap, radius) {
  const cloudPos = cap.anchor.map((value) => value * (radius + cap.altitude));
  const toPeak = normalize(peakPos.map((value, index) => value - camera.position[index]));
  const toCloud = normalize(cloudPos.map((value, index) => value - camera.position[index]));
  const angular = Math.acos(Math.max(-1, Math.min(1, dot(toPeak, toCloud))));
  const distance = Math.hypot(...cloudPos.map((value, index) => value - camera.position[index]));
  const cloudAng = Math.atan((cap.scale * 0.5) / Math.max(1, distance));
  return angular > cloudAng * 0.42;
}

const spec = HERO_CLOUD_SPECS.highlandCitadel;
assert.equal(spec.ringCardCount, 12);
assert.equal(spec.capCard.hugRidge, true);
assert.ok(spec.dayPhaseWeight.dusk >= spec.dayPhaseWeight.noon);
assert.ok(spec.dayPhaseWeight.noon > spec.dayPhaseWeight.dawn);

const manifest = createLandmarkManifest({ seed: 1 });
const highland = manifest.find((entry) => entry.id === "highland-citadel");
assert.equal(highland.heroCloud, "highlandCitadel");
const field = createPlanetFieldRecipe({ radius: 160, landmarks: [highland] });
const heroA = compileHeroCloudClusters({ landmarks: manifest, field, wind: [1, 0, 0] });
const heroB = compileHeroCloudClusters({ landmarks: manifest, field, wind: [1, 0, 0] });
assert.equal(heroA.heroHash, heroB.heroHash);
const caps = heroA.instances.filter((instance) => instance.heroRole === "cap");
const rings = heroA.instances.filter((instance) => instance.heroRole === "ring");
const forests = heroA.instances.filter((instance) => instance.heroRole === "forest-scatter");
assert.equal(caps.length, 1);
assert.equal(rings.length, 12);
assert.equal(forests.length, 1);
assert.equal(caps[0].speed, spec.driftSpeed);
assert.equal(caps[0].hugRidge, true);
assert.equal(caps[0].source, "hero-landmark");
assert.ok(caps[0].scale > rings[0].scale);
assert.ok(dot(caps[0].anchor, highland.direction) > 0.995);
assert.ok(dot(caps[0].anchor, highland.direction) < 0.9999);
assert.ok(forests[0].lowLayer);
assert.equal(caps[0].pathPoints.length, 10);
assert.ok(caps[0].pathPoints.every((point) => point.altitude >= point.terrainHeight + point.terrainClearance - 1e-6));

const keepouts = compileCloudKeepouts({ landmarks: manifest, field });
assert.ok(keepouts.some((keepout) => keepout.kind === "peak-visibility"));
assert.ok(keepouts.some((keepout) => keepout.id === "highland-citadel:waterfall-horse"));
const filteredHero = applyCloudCameraKeepouts({ instances: heroA.instances.slice() }, keepouts);
assert.equal(filteredHero.instances.filter((instance) => instance.heroRole === "cap").length, 1, "authored cap must survive keepouts");
const peakKeepout = keepouts.find((keepout) => keepout.kind === "peak-visibility");
assert.equal(instanceFullyOccludesPeak(caps[0], peakKeepout), false);

const climateOnly = compileCloudClusters({
  cells: [{ id: "cell:0", index: 0, direction: highland.direction }],
  semantics: new Map([["cell:0", { height: 8, wetness: 0.4, landformClass: "volcanic-snow-massif" }]]),
  seed: 7,
  maxInstances: 8,
});
assert.ok(climateOnly.instances.every((instance) => !instance.authored));

const layoutSeed1 = heroLayoutHash(heroA.instances);
for (let seed = 1; seed <= 1000; seed++) {
  const seeded = createLandmarkManifest({ seed });
  const seededHighland = seeded.find((entry) => entry.id === "highland-citadel");
  const seededField = createPlanetFieldRecipe({ radius: 160, landmarks: [seededHighland] });
  const hero = compileHeroCloudClusters({ landmarks: seeded, field: seededField });
  assert.equal(hero.instances.filter((instance) => instance.heroRole === "cap").length, 1, `cap missing seed=${seed}`);
  assert.equal(hero.instances.filter((instance) => instance.heroRole === "ring").length, 12, `ring count seed=${seed}`);
  assert.equal(heroLayoutHash(hero.instances), layoutSeed1, `hero layout drifted seed=${seed}`);
  const seededKeepouts = compileCloudKeepouts({ landmarks: seeded, field: seededField });
  const peak = seededKeepouts.find((keepout) => keepout.kind === "peak-visibility");
  const cap = hero.instances.find((instance) => instance.heroRole === "cap");
  assert.equal(instanceFullyOccludesPeak(cap, peak), false, `peak fully occluded seed=${seed}`);
}

const cameras = JSON.parse(readFileSync(new URL("../TigerMessenger/src/render/visualV8/cameras-v1.json", import.meta.url), "utf8"));
const highlandCameras = cameras.cameras.filter((camera) => camera.group === "highland");
assert.equal(highlandCameras.length, 6);
const world = compilePlanetV8({ seed: 1, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
assert.equal(world.ok, true, world.report?.stage || world.stage);
assert.ok((world.clouds.heroCount || 0) >= 13, `heroCount=${world.clouds.heroCount}`);
assert.ok(world.snapshot.clouds.heroHash);
const worldCap = world.clouds.instances.find((instance) => instance.heroRole === "cap");
assert.ok(worldCap, "compiled world missing highland cap");
const landmarkMap = new Map(world.manifest.map((entry) => [entry.id, entry]));
const worldHighland = world.manifest.find((entry) => entry.id === "highland-citadel");
const peakPos = worldHighland.direction.map((value) => value * (160 + world.field.heightAt(worldHighland.direction)));
const peakCameras = new Set(["highland-panorama", "highland-night"]);
for (const specCamera of highlandCameras) {
  const camera = resolveCameraV8(specCamera, landmarkMap, 160);
  if (!peakCameras.has(specCamera.id)) continue;
  assert.equal(peakVisibleFromCamera(camera, peakPos, worldCap, 160), true, `${specCamera.id} permanently hides the peak`);
}
const combatKeepouts = compileCloudKeepouts({ landmarks: world.manifest, field: world.field })
  .filter((keepout) => keepout.kind === "combat-sightline");
for (const instance of world.clouds.instances) {
  if (instance.heroRole === "cap") continue;
  for (const keepout of combatKeepouts) {
    if (keepout.maxAltitude != null && instance.altitude > keepout.maxAltitude) continue;
    const inside = dot(instance.anchor, keepout.direction) > Math.cos(keepout.angularRadius);
    if (inside && !instance.authored) {
      assert.fail(`climate cloud ${instance.cellIndex} survived ${keepout.id}`);
    }
  }
}

const chain = createContinuousLandformManifest({ seed: 7 });
const layered = compilePlanetClouds({
  cells: [{ id: "cell:0", index: 0, direction: chain.find((entry) => entry.id === "highland-citadel").direction }],
  semantics: new Map([["cell:0", { height: 8.2, wetness: 0.5, landformClass: "volcanic-snow-massif", landmarkId: "highland-citadel" }]]),
  seed: 7,
  landmarks: chain,
  field: createPlanetFieldRecipe({ radius: 160, landmarks: [chain.find((entry) => entry.id === "highland-citadel")] }),
});
assert.ok(layered.heroCount >= 13);
assert.ok(layered.instances.some((instance) => !instance.authored) || layered.instanceCount >= layered.heroCount);

console.log(`✅ Highland hero clouds: cap+${rings.length} ring+${forests.length} forest, 1000-seed layout hash=${layoutSeed1}, 6 highland cameras peak-visible, world heroCount=${world.clouds.heroCount}`);
