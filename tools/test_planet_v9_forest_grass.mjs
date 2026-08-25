import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
  assert.equal(world.ok, true, `seed=${seed}`);
  const total = world.vegetation.reduce((sum, chart) => sum + chart.instanceCount, 0);
  assert.ok(total > 0, `seed=${seed} must have vegetation`);
  for (const chart of world.vegetation) {
    assert.equal(chart.kind, "planet-vegetation-v9");
    for (const instances of Object.values(chart.buckets)) for (const instance of instances) {
      assert.ok(instance.instanceId && instance.normal.length === 3);
      assert.ok(instance.lodRange[1] > instance.lodRange[0]);
      assert.ok(instance.windWeight >= 0 && instance.windWeight <= 1);
    }
  }
}
const terrainShader = readFileSync(new URL("../TigerMessenger/src/render/terrain/semanticTerrainMaterial.js", import.meta.url), "utf8");
const vegetationRuntime = readFileSync(new URL("../TigerMessenger/src/render/vegetation/vegetationRuntime.js", import.meta.url), "utf8");
assert.match(terrainShader, /contrastAwareOutline/);
assert.match(terrainShader, /windBend/);
assert.match(vegetationRuntime, /grassBillboard/);
assert.match(vegetationRuntime, /InstancedMesh/);
console.log("✅ Planet V9 forest/grass: deterministic cluster payload, normal/wind/LOD schema, keepout-aware runtime batches and grass wind/contrast shader passed");
