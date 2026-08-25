import assert from "node:assert/strict";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { createLandmarkManifest, validateLandmarkManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { createTerrainTiles } from "../TigerMessenger/src/procgen/planet/terrainTiles.js";
import { solveSphericalTerrain, terrainAssignmentMap } from "../TigerMessenger/src/procgen/planet/sphericalWfc.js";
import { validatePlanetTopology } from "../TigerMessenger/src/procgen/planet/planetValidatorsV8.js";
import { validatePlanetGlobalConstraints } from "../TigerMessenger/src/procgen/planet/globalConstraints.js";
import { measurePlanetArea } from "../TigerMessenger/src/procgen/planet/globalConstraints.js";
import { validateCanalConsumerManifest } from "../TigerMessenger/src/world/planetV8/canalConsumerManifest.js";
import { triangulateCurvedCap } from "../TigerMessenger/src/world/waterV8/curvedWaterCompiler.js";

assert.equal(validateCanalConsumerManifest().ok, true);
const tiles = createTerrainTiles();
assert.ok(tiles.length >= 40 && tiles.length <= 120, `expanded authored tile catalogue: ${tiles.length}`);
assert.equal(new Set(tiles.map((tile) => tile.key)).size, tiles.length);
assert.ok(tiles.some((tile) => tile.orientation === "rot90"));
assert.ok(tiles.some((tile) => tile.orientation === "mirror"));

let maxRepair = 0;
let maxLandRatio = 0;
let minLandRatio = 1;
for (let seed = 1; seed <= 100; seed++) {
  const manifest = createLandmarkManifest({ seed });
  assert.equal(validateLandmarkManifest(manifest).ok, true);
  const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 2, seed, preserve: manifest.map((entry) => entry.direction) });
  const result = solveSphericalTerrain({ graph: grid.dual, landmarks: manifest, tiles, seed });
  assert.equal(result.ok, true, `WFC seed ${seed}`);
  const assignment = new Map(Object.entries(terrainAssignmentMap(result)));
  const area = measurePlanetArea({ grid, assignment });
  assert.ok(area.oceanFraction >= 0.52, `ocean must remain world主体 at seed ${seed}`);
  const topology = validatePlanetTopology({ grid, assignment, manifest, water: { ocean: { curved: true } }, navigation: { nodes: [] } });
  assert.equal(topology.ok, true, `topology seed ${seed}: ${topology.errors.join(",")}`);
  const basins = manifest
    .filter((entry) => entry.waterNeeds === "closed-lake-basin")
    .map((entry) => triangulateCurvedCap({ direction: entry.direction, radius: 160, angularRadius: entry.angularRadius }));
  const highland = manifest.find((entry) => entry.waterNeeds === "lower-waterfall-basin");
  basins.push(triangulateCurvedCap({ direction: highland.direction, radius: 160, angularRadius: 0.06, semantic: "waterfall-basin" }));
  assert.equal(validatePlanetGlobalConstraints({ grid, assignment, manifest, water: { lakes: basins } }).ok, true);
  assert.equal(Object.keys(result.assignmentByCellId).length, grid.dual.cellCount);
  maxRepair = Math.max(maxRepair, result.report?.repairCount || 0);
  maxLandRatio = Math.max(maxLandRatio, topology.landRatio);
  minLandRatio = Math.min(minLandRatio, topology.landRatio);
}
console.log(`✅ Planet V8 WFC: 100 seeds, tiles=${tiles.length}, landRatio=${minLandRatio.toFixed(3)}..${maxLandRatio.toFixed(3)}, maxRepair=${maxRepair}`);
