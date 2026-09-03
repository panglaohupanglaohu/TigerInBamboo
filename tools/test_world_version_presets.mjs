import assert from "node:assert/strict";

const {
  FEATURES,
  WORLD_VERSION_PRESETS,
  applyUrlOverrides,
  applyWorldVersionPreset,
  getPlanetPresentationVersion,
  getWorldVersion,
} = await import("../TigerMessenger/src/core/params.js");

assert.deepEqual(Object.keys(WORLD_VERSION_PRESETS), ["v8", "v9"]);

// V7 预设已删（2026-09-01）：它的三个 flag 全仓零运行时分支，只是名字；
// 且 V7 = 旧运河世界无海面，与主人验收过的夜港画面矛盾。
// WFC 仍是选定方向，procgen/wfc/ 下的真实能力一行未动。
assert.equal(applyWorldVersionPreset("v7"), false, "v7 预设已删除，应拒绝套用");
assert.equal(FEATURES.procgenEngineV1, undefined, "procgenEngineV1 已删除");
assert.equal(FEATURES.wfcCastleV1, undefined, "wfcCastleV1 已删除");
assert.equal(FEATURES.marchingTerrainV1, undefined, "marchingTerrainV1 已删除");
assert.equal(FEATURES.planetGraphV1, undefined, "planetGraphV1 已删除（零消费者）");

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

console.log("✅ V8/V9 world presets: atomic flags, presentation version and rollback boundaries passed");
