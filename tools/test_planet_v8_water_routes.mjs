import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { compileWaterRouteLogistics, validateWaterRouteLogistics } from "../TigerMessenger/src/world/waterV8/waterRouteLogistics.js";
import { migrateSaveV3ToV8 } from "../TigerMessenger/src/world/planetV8/saveMigrationV8.js";

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 });
  assert.equal(world.ok, true);
  const logistics = compileWaterRouteLogistics({ routes: world.water.routes, ports: [{ id: "old-harbor", direction: [1, 0, 0], routeId: world.water.routes[0]?.id }] });
  assert.equal(validateWaterRouteLogistics(logistics).ok, true);
  if (world.water.routes.length) {
    const boat = { id: "boat", draft: 0.2 };
    assert.equal(logistics.assignBoat(boat, { portId: "old-harbor" }).ok, true);
    const targetDirection = logistics.directionToTarget(boat, world.water.routes[0].points.at(-1));
    assert.equal(targetDirection.length, 3);
    assert.ok(targetDirection.every(Number.isFinite));
    assert.equal(boat.logisticsSurfaceId, "curved-ocean-shell-v8");
    const migrated = migrateSaveV3ToV8({ version: 3, boats: [{ id: "legacy-boat", routeIndex: 0 }] }, { project: () => ({ surfaceId: "planet-land", position: [0, 0, 160], normal: [0, 0, 1], height: 0 }) }, world.water.routes);
    assert.ok(migrated.migrationToasts.some((toast) => toast.kind === "boat-route"));
  }
}
console.log("✅ Planet V8 water logistics: curved route/port/draft/target direction contract passed for 4 golden seeds");
