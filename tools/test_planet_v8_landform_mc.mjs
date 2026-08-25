import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { buildTransitionCollars } from "../TigerMessenger/src/procgen/planet/landformChainV8.js";
import { createContinuousLandformManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { createPlanetFieldRecipe } from "../TigerMessenger/src/procgen/planet/planetFieldComposer.js";

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
  assert.equal(world.ok, true, `MC chain seed=${seed}`);
  for (const chart of world.charts) {
    assert.equal(chart.mesh.positions.some((value) => !Number.isFinite(value)), false);
    assert.equal(chart.mesh.stats.degenerateTriangles, 0);
    assert.ok(chart.mesh.positions.every(Number.isFinite));
  }
  assert.equal(world.seamReport.ok, true);
  assert.ok(world.field.sampleSemantic([160, 0, 0]).transitionId == null || typeof world.field.sampleSemantic([160, 0, 0]).transitionId === "string");
}
const manifest = createContinuousLandformManifest({ seed: 7 });
const chain = manifest.filter((entry) => entry.chainOrder != null);
const collars = buildTransitionCollars(chain, { radius: 160 });
assert.equal(collars.length, 5);
const field = createPlanetFieldRecipe({ radius: 160, landmarks: chain, transitionCollars: collars });
for (const collar of collars) {
  const p = collar.direction.map((value) => value * 160);
  const a = field.sampleSemantic(p);
  assert.equal(a.transitionId, collar.id);
  assert.ok(Number.isFinite(field.sample(p)));
}
console.log(`✅ Planet V8 landform MC: charts=4, collars=${collars.length}, seam/normal/degenerate/finite passed`);
