import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { compileLandformChain, validateChainCoverage, validateElevationNarrative } from "../TigerMessenger/src/procgen/planet/landformChainV8.js";

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 });
  assert.equal(world.ok, true, `route world seed=${seed}`);
  assert.equal(world.terrainRoutes.routes.length, 5);
  for (const route of world.terrainRoutes.routes) {
    assert.ok(route.points.length >= 2, `${route.id}:points`);
    assert.ok(route.edges.every((edge) => edge.kind !== "air"), `${route.id}:air`);
    assert.ok(route.edges.every((edge) => edge.surfaceId == null || typeof edge.surfaceId === "string"), `${route.id}:surface`);
    if (route.id === "route:highland-triple-gate") assert.ok(route.portalCount > 0);
  }
}
// 1000 deterministic route contracts without rebuilding MC geometry for every
// seed. Full surface worlds are covered by the four golden seeds above; this
// still exercises the chain ordering/elevation/transition route contract for
// every seed requested by the gate.
for (let seed = 1; seed <= 1000; seed++) {
  const chain = compileLandformChain({ seed });
  assert.equal(validateChainCoverage({ chain }).ok, true, `route seed=${seed}`);
  assert.equal(validateElevationNarrative({ chain }).ok, true, `elevation seed=${seed}`);
}
for (let seed = 1; seed <= 1000; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 });
  assert.equal(world.ok, true, `surface route seed=${seed}`);
  assert.equal(world.terrainRoutes.routes.length, 5);
  assert.ok(world.terrainRoutes.routes.every((route) => route.edges.every((edge) => edge.kind !== "air")));
}
console.log("✅ Planet V8 chain routes: 5 route definitions, golden surface routes and 1000-seed chain/no-air gate passed");
