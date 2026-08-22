// 古堡蓝图编译层验收：输入归一化、阶段顺序和热重建使用同一份纯数据。
import assert from "node:assert/strict";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const {
  CITADEL_BLUEPRINT_VERSION,
  CITADEL_BUILD_STAGES,
  citadelBlueprintSummary,
  createCitadelBlueprint,
  normalizeCitadelBlueprintTerrain,
  citadelBlueprintTerraceMetrics,
} = await import(new URL("src/world/citadelBlueprint.js", BASE).href);

const blueprint = createCitadelBlueprint({
  spec: CITADEL_TOWN_SPEC,
  contour: {
    layerCount: 5,
    baseRadius: 24,
    shrink: 0.9,
    layerHeight: 2,
    cascadeEnabled: true,
    cascadePoolsEnabled: true,
  },
  floors: 5,
  instanceId: "highland",
  terrainObjects: [
    { type: "trojanHorse", terraceIndex: 4, x: 2, z: 3, scale: 0.9 },
    { type: "invalid", terraceIndex: 1 },
  ],
});

assert.equal(blueprint.version, CITADEL_BLUEPRINT_VERSION);
assert.deepEqual(blueprint.stages.map((stage) => stage.id), CITADEL_BUILD_STAGES);
assert.equal(blueprint.town.terraceCount, 5);
assert.equal(blueprint.floors, 5);
assert.equal(blueprint.objects.length, 1);
assert.equal(blueprint.objects[0].type, "trojanHorse");
assert.equal(blueprint.terrain.metrics[0].top, 12);
assert.equal(blueprint.terrain.metrics[4].bottom, 2);
assert.equal(blueprint.terrain.config.terraces[4].radius > blueprint.terrain.config.terraces[0].radius, true);
assert.deepEqual(citadelBlueprintSummary(blueprint), {
  version: 1,
  instanceId: "highland",
  floors: 5,
  terraces: 5,
  gridSize: 25,
  objectCount: 1,
  stages: ["foundation", "terraces", "waterfalls", "town", "terrain-objects", "presentation"],
});

const normalized = normalizeCitadelBlueprintTerrain({
  terraces: [
    { radius: 20, height: 2 },
    { radius: 18, height: 1 },
  ],
  cascadeEnabled: false,
});
assert.equal(normalized.notchedLayers, 0);
assert.equal(normalized.notchHalf, 0);
assert.equal(normalized.terraces[1].radius >= normalized.terraces[0].radius + 0.5, true);
assert.equal(citadelBlueprintTerraceMetrics(normalized).length, 5);

console.log("古堡蓝图编译层验收通过 ✅");
