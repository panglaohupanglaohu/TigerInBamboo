import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";

let tested = 0;
let lakeCount = 0;
let vegetationBuckets = 0;
for (let seed = 1; seed <= 100; seed++) {
  const world = compilePlanetV8({ seed, subdivision: 1, chartLimit: 6, resolution: 6 });
  assert.equal(world.ok, true, `scene matrix compile failed at seed ${seed}: ${world.stage}`);
  const byId = new Map(world.manifest.map((landmark) => [landmark.id, landmark]));
  for (const id of ["saihoji-moss-garden", "swamp-lake", "bookshop-town"]) {
    assert.ok(byId.has(id), `missing ${id} at seed ${seed}`);
  }
  assert.ok(world.water.lakes.length >= 3, `closed lake set incomplete at seed ${seed}`);
  assert.ok(world.water.lakes.every((lake) => lake.curved && lake.angularRadius > 0), `curved lake contract failed at seed ${seed}`);
  assert.ok(world.vegetation.every((bucket) => Number.isInteger(bucket.instanceCount) && bucket.instanceCount >= 0));
  vegetationBuckets += world.vegetation.length;
  lakeCount += world.water.lakes.length;
  assert.ok(world.terrainRoutes.routes.every((route) => route.edges.every((edge) => edge.kind !== "air")));
  tested++;
}
console.log(`✅ Planet V8 scene matrix: ${tested} seeds, curved lakes=${lakeCount}, vegetation charts=${vegetationBuckets}`);
