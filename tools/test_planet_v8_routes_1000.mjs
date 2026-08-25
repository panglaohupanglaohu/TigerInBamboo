import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";

const routeStats = { seeds: 0, highlandPoints: 0, bookshopPoints: 0, canyonPoints: 0, portalRoutes: 0 };
for (let seed = 1; seed <= 1000; seed++) {
  const world = compilePlanetV8({ seed, subdivision: 1, chartLimit: 2, resolution: 5 });
  assert.equal(world.ok, true, `compile failed at seed ${seed}: ${world.stage}`);
  assert.equal(world.terrainRoutes.ok, true, `terrain routes failed at seed ${seed}`);
  for (const route of world.terrainRoutes.routes) {
    assert.ok(route.points.length >= 2, `${route.id} has no points at seed ${seed}`);
    assert.ok(route.edges.every((edge) => edge.kind !== "air"), `${route.id} has air edge at seed ${seed}`);
    if (route.id === "route:highland-triple-gate") {
      assert.equal(route.mode, "walk-stairs");
      assert.ok(route.portalCount >= 1, `highland route lacks a stair portal at seed ${seed}`);
      routeStats.highlandPoints += route.points.length;
      routeStats.portalRoutes++;
    } else if (route.id === "route:bookshop-saihoji") {
      assert.equal(route.mode, "walk-tram");
      routeStats.bookshopPoints += route.points.length;
    } else if (route.id === "route:crystal-canyon-triple-gate") {
      assert.equal(route.mode, "walk-tram");
      routeStats.canyonPoints += route.points.length;
    }
  }
  assert.equal(world.combatSurface.zones.length, 2);
  routeStats.seeds++;
}

assert.equal(routeStats.seeds, 1000);
assert.equal(routeStats.portalRoutes, 1000);
console.log(`✅ Planet V8 routes: ${routeStats.seeds} seeds, highland stair portal routes=${routeStats.portalRoutes}, points=${routeStats.highlandPoints}/${routeStats.bookshopPoints}/${routeStats.canyonPoints}`);
