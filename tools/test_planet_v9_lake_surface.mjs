import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { createWaterSurfaceEventBuffer, createWaterWakeRibbonBuffer } from "../TigerMessenger/src/world/waterV8/waterSurfaceEvents.js";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../TigerMessenger/src/render/water/curvedWaterMaterial.js", import.meta.url), "utf8");
assert.match(source, /uWaterKind/);
assert.match(source, /waterData0/);
assert.match(source, /shorelineFoam/);
assert.match(source, /lakeRipple/);

const world = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
assert.equal(world.ok, true, world.report?.stage);
assert.ok(world.water.ocean.waterData0.length === world.water.ocean.positions.length / 3 * 4);
assert.ok(world.water.lakes.length > 0);
for (const lake of world.water.lakes) {
  assert.equal(lake.waterData0.length, lake.positions.length / 3 * 4);
  assert.equal(lake.waterData1.length, lake.positions.length / 3 * 4);
  assert.equal(lake.curved, true);
  assert.ok(lake.islands.every((island) => island.walkable));
}

const events = createWaterSurfaceEventBuffer({ capacity: 2 });
events.add({ type: "rain", radius: 0.2, life: 1 });
events.add({ type: "footstep", radius: 0.4, life: 1 });
events.add({ type: "projectile", radius: 0.8, life: 1 });
assert.equal(events.size, 2, "ripple buffer must be bounded");
assert.equal(events.active().length, 2);
events.update(1.01);
assert.equal(events.size, 0, "expired ripples must be removed");

const wakes = createWaterWakeRibbonBuffer({ capacity: 2 });
wakes.push({ position: [1, 2, 3], tangent: [0, 0, 1], life: 2 });
wakes.push({ position: [2, 2, 3], tangent: [0, 0, 1], life: 2 });
wakes.push({ position: [3, 2, 3], tangent: [0, 0, 1], life: 2 });
assert.equal(wakes.size, 2, "wake ribbon must be bounded");
assert.deepEqual(wakes.active()[0].position, [2, 2, 3]);
wakes.update(2.01);
assert.equal(wakes.size, 0);

console.log("✅ Planet V9 lake surface: separated shader semantics, curved cap data, bounded wake/ripple buffers passed");
