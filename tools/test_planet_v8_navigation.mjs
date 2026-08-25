import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { findPlanetPath, validatePlanetPath } from "../TigerMessenger/src/world/planetV8/navigationV8.js";

let tested = 0;
for (let seed = 1; seed <= 100; seed++) {
  const world = compilePlanetV8({ seed, subdivision: 1, chartLimit: 2, resolution: 8 });
  assert.equal(world.ok, true, `world seed ${seed}`);
  const nodes = world.navigation.nodes;
  const path = findPlanetPath(world.navigation, nodes[0].id, nodes[nodes.length - 1].id);
  assert.equal(validatePlanetPath(path).ok, true, `path seed ${seed}`);
 assert.ok(path.edges.every((edge) => edge.kind !== "air"));
  assert.equal(world.terrainRoutes.ok, true, `landmark routes seed ${seed}`);
  assert.equal(world.terrainRoutes.routes.length, 3);
  assert.ok(world.terrainRoutes.routes.every((route) => route.points.length >= 2 && route.edges.every((edge) => edge.kind !== "air")));
 tested++;
}
console.log(`✅ Planet V8 navigation: ${tested} seeds pathable, airEdges=0`);
