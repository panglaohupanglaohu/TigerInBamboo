import assert from "node:assert/strict";
import { buildCloudImpostorAtlas } from "../TigerMessenger/src/render/clouds/impostorAtlasBuilder.js";
import { compileCloudClusters, applyCloudCameraKeepouts, compileOskarCloudChain, OSKAR_CLOUD_CHAIN_BANDS } from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";
import { HERO_CLOUD_SPECS } from "../TigerMessenger/src/render/clouds/heroCloudCatalog.js";

const atlasA = buildCloudImpostorAtlas({ views: 8, size: 24, sourceHash: "test-cloud-source" });
const atlasB = buildCloudImpostorAtlas({ views: 8, size: 24, sourceHash: "test-cloud-source" });
assert.equal(atlasA.hash, atlasB.hash);
assert.equal(atlasA.colorAlpha.length, 8 * 24 * 24 * 4);
assert.equal(atlasA.distance.length, 8 * 24 * 24);
assert.ok(atlasA.channels.includes("distance"));
assert.equal(atlasA.shape, "stacked-lowpoly-puffs-sdf");
assert.equal(compileOskarCloudChain().bands.length, 5);
assert.equal(OSKAR_CLOUD_CHAIN_BANDS.at(-1).snowCap, true);

const cells = Array.from({ length: 64 }, (_, index) => {
  const angle = index / 64 * Math.PI * 2;
  return { id: `cell:${index}`, index, direction: [Math.cos(angle), 0.35, Math.sin(angle)] };
});
const semantics = new Map(cells.map((cell, index) => [cell.id, {
  wetness: index % 4 / 4,
  height: index % 7,
  forestness: index % 3 / 3,
}]));
const clusterA = compileCloudClusters({ cells, semantics, wind: [1, 0.1, 0], seed: 7, maxInstances: 20 });
const clusterB = compileCloudClusters({ cells, semantics, wind: [1, 0.1, 0], seed: 7, maxInstances: 20 });
assert.equal(clusterA.climateHash, clusterB.climateHash);
assert.equal(clusterA.instanceCount, clusterB.instanceCount);
assert.ok(clusterA.instanceCount <= 20);
assert.ok(clusterA.instances.every((instance) => instance.anchor.length === 3 && instance.inDir.length === 3 && instance.outDir.length === 3));
const filtered = applyCloudCameraKeepouts(clusterA, [{ direction: [1, 0, 0], angularRadius: 0.9 }]);
assert.ok(filtered.instanceCount <= clusterA.instanceCount);
assert.equal(filtered.instanceCount, filtered.instances.length);
assert.equal(filtered.cloudChain.algorithm, "oskar-semantic-five-band-cloud-chain-v1");
assert.equal(HERO_CLOUD_SPECS.highlandCitadel.capCard.hugRidge, true);
console.log(`✅ Planet V8 clouds: atlas=${atlasA.hash}, instances=${filtered.instanceCount}, budget=20`);
