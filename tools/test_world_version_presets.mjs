import assert from "node:assert/strict";

const {
  FEATURES,
  WORLD_VERSION_PRESETS,
  applyUrlOverrides,
  applyWorldVersionPreset,
  getPlanetPresentationVersion,
  getWorldVersion,
} = await import("../TigerMessenger/src/core/params.js");

assert.deepEqual(Object.keys(WORLD_VERSION_PRESETS), ["v7", "v8", "v9"]);

assert.equal(applyWorldVersionPreset("v7"), true);
assert.equal(getWorldVersion(), "v7");
assert.equal(FEATURES.procgenEngineV1, true);
assert.equal(FEATURES.wfcCastleV1, true);
assert.equal(FEATURES.marchingTerrainV1, true);
assert.equal(FEATURES.planetTerrainV1, false);
assert.equal(FEATURES.legacyCanalWorld, true);

applyUrlOverrides("?worldVersion=v8");
assert.equal(getWorldVersion(), "v8");
assert.equal(getPlanetPresentationVersion(), "v8");
assert.equal(FEATURES.planetTerrainV1, true);
assert.equal(FEATURES.curvedWaterV1, true);
assert.equal(FEATURES.cloudImpostorV1, true);
assert.equal(FEATURES.planetSurfaceRidersV1, false);
assert.equal(FEATURES.legacyCanalWorld, false);

applyUrlOverrides("?worldVersion=v9");
assert.equal(getWorldVersion(), "v9");
assert.equal(getPlanetPresentationVersion(), "v9");
assert.equal(FEATURES.planetSurfaceRidersV1, true);
assert.equal(FEATURES.legacyCanalWorld, false);

assert.equal(applyWorldVersionPreset("unknown"), false);
assert.equal(getWorldVersion(), "v9", "非法版本不得破坏当前已测试预设");

console.log("✅ V7/V8/V9 world presets: atomic flags, presentation version and rollback boundaries passed");
