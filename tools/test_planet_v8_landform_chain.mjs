import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { createTerrainTiles } from "../TigerMessenger/src/procgen/planet/terrainTiles.js";
import { solveSphericalTerrain, terrainAssignmentMap } from "../TigerMessenger/src/procgen/planet/sphericalWfc.js";
import { createContinuousLandformManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { compileLandformChain, landformChainHash, validateChainCoverage, validateElevationNarrative, LANDFORM_CHAIN_VERSION } from "../TigerMessenger/src/procgen/planet/landformChainV8.js";

function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

const golden = [1, 7, 42, 884];
const hashes = golden.map((seed) => landformChainHash(compileLandformChain({ seed })));
assert.equal(new Set(hashes).size, 1, "chain structure must not depend on seed");
for (const seed of golden) {
  const manifest = createContinuousLandformManifest({ seed });
  const chain = manifest.filter((entry) => entry.chainOrder != null);
  assert.equal(chain.length, 6);
  assert.equal(chain[0].chainVersion, LANDFORM_CHAIN_VERSION);
  assert.deepEqual(chain.map((entry) => entry.chainOrder), [0, 1, 2, 3, 4, 5]);
  assert.equal(validateChainCoverage({ chain }).ok, true);
  assert.equal(validateElevationNarrative({ chain }).ok, true);
}

const tiles = createTerrainTiles();
const profileIds = ["peak.glacier", "peak.snowline", "rift.escarpment", "rift.floor", "rift.fault-step", "lake.rift", "lake.reed-shore", "volcanic.cone", "volcanic.tuff", "plain.alluvial", "plain.moss", "plain.stream"];
for (const seed of golden) {
  const manifest = createContinuousLandformManifest({ seed });
  const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 1, seed, preserve: manifest.map((entry) => entry.direction) });
  const result = solveSphericalTerrain({ graph: grid.dual, landmarks: manifest.filter((entry) => entry.chainOrder != null), tiles, seed });
  assert.equal(result.ok, true, `chain WFC seed=${seed}`);
  assert.equal(validateChainCoverage({ chain: manifest.filter((entry) => entry.chainOrder != null), grid, assignment: new Map(Object.entries(terrainAssignmentMap(result))) }).ok, true);
  assert.ok(profileIds.every((id) => tiles.some((tile) => tile.id === id)), `tile catalogue seed=${seed}`);
}

let compiled = 0;
for (let seed = 1; seed <= 100; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 });
  assert.equal(world.ok, true, `continuous world seed=${seed}: ${world.stage}`);
  assert.equal(world.snapshot.graph.landformChainVersion, LANDFORM_CHAIN_VERSION);
  assert.equal(world.terrainRoutes.routes.length, 5);
  compiled++;
}

// The pure chain route gate is intentionally cheap enough to run a complete
// 1000-seed set in CI; the full MC fixture above catches surface regressions.
for (let seed = 1; seed <= 1000; seed++) {
  const chain = compileLandformChain({ seed });
  assert.equal(validateChainCoverage({ chain }).ok, true, `route chain seed=${seed}`);
  assert.equal(validateElevationNarrative({ chain }).ok, true, `elevation seed=${seed}`);
}
console.log(`✅ Planet V8 landform chain: version=${LANDFORM_CHAIN_VERSION}, golden=${golden.length}, fullWorld=${compiled}, pureRouteSeeds=1000, hash=${digest(hashes).slice(0, 12)}`);
