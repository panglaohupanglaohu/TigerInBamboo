import assert from "node:assert/strict";
import { createHighlandTerrainProfile } from "../TigerMessenger/src/procgen/planet/profiles/highlandTerrainProfileV8.js";
import { createLandmarkManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { validateBookshopHillChain, validateHighlandProfile, validateCanyonTransit, validateHillsProfile } from "../TigerMessenger/src/world/planetV8/profileValidators.js";
import { sdTorusXZ, sdCave } from "../TigerMessenger/src/procgen/field/sdf.js";
import { buildCloudImpostorAtlas } from "../TigerMessenger/src/render/clouds/impostorAtlasBuilder.js";
import { compileCloudClusters } from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";
import { cloudLodForDistance, createCloudShadowProjection, validateCloudRuntimePolicy } from "../TigerMessenger/src/render/clouds/cloudRuntimePolicy.js";
import { createPlanetFieldRecipe } from "../TigerMessenger/src/procgen/planet/planetFieldComposer.js";
import { tangentBasis } from "../TigerMessenger/src/procgen/planet/barycentric.js";
import { validateSurfaceTransportRoute } from "../TigerMessenger/src/world/planetV8/transportProjection.js";

const manifest = createLandmarkManifest({ seed: 7 });
const highland = createHighlandTerrainProfile({ landmark: manifest.find((entry) => entry.id === "highland-citadel") });
assert.equal(validateHighlandProfile(highland).ok, true);
const highlandField = createPlanetFieldRecipe({ radius: 160, landmarks: [highland.landmark] });
const peakBasis = tangentBasis(highland.landmark.direction);
const peakDirections = [
  highland.landmark.direction,
  highland.landmark.direction.map((value, index) => value + peakBasis.right[index] * 0.11 + peakBasis.forward[index] * 0.035),
  highland.landmark.direction.map((value, index) => value - peakBasis.right[index] * 0.095 + peakBasis.forward[index] * 0.05),
];
const peakHeights = peakDirections.map((direction) => highlandField.heightAt(direction));
assert.ok(Math.max(...peakHeights) > Math.min(...peakHeights));
assert.equal(validateCanyonTransit({ route: [[0, 0, 0], [1, 0.2, 0], [2, 0.3, 0]], clearances: [{ id: "gate", width: 4, height: 5 }] }).ok, true);
assert.equal(validateSurfaceTransportRoute([[0, 0, 0], [2, 0.2, 0], [4, 0.3, 0]], { clearances: [{ id: "tram", width: 3, height: 4, radius: 2 }] }).ok, true);
assert.equal(validateHillsProfile({ slope: 0.3, doorSlope: 0.2, connected: true, forestCoverage: 0.6 }).ok, true);
assert.equal(validateBookshopHillChain({ route: [[0, 160, 0], [1, 160.2, 0], [2, 160.3, 0]], doorSlope: 0.2, connected: true, saddle: true, tramRoute: true }).ok, true);
assert.ok(sdTorusXZ([1, 0, 0], [0, 0, 0], 1, 0.25) < 0);
assert.ok(Number.isFinite(sdCave([0, 0, 0], [0, 0, 0], [2, 2, 2])));

const cells = manifest.map((entry, index) => ({ id: entry.id, index, direction: entry.direction }));
const semantics = new Map(cells.map((cell, index) => [cell.id, { wetness: index / cells.length, height: index * 0.8 }]));
const clusters = compileCloudClusters({ cells, semantics, seed: 7, maxInstances: 100 });
assert.ok(clusters.instances.every((instance) => ["cluster-detail", "octa-impostor", "weather-band"].includes(instance.lod)));
const policy = createCloudShadowProjection();
assert.equal(validateCloudRuntimePolicy(policy).ok, true);
assert.equal(cloudLodForDistance(200), "weather-band");
assert.equal(buildCloudImpostorAtlas({ views: 8 }).views, 8);
console.log(`✅ Planet V8 profiles/cloud policy: peaks=${highland.recipe.peaks}, cloudInstances=${clusters.instanceCount}, shadow=projected`);
