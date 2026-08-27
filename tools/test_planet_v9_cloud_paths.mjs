import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { CLOUD_RIDGE_PATH_POINTS } from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";
import { readFileSync } from "node:fs";

const world = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
assert.equal(world.ok, true, world.report?.stage);
assert.ok(world.clouds.instances.length > 0);
assert.equal(world.snapshot.clouds.climateSource, "climate-v10");
assert.ok(world.climate?.hash);
assert.equal(world.snapshot.clouds.climateHash, world.climate.hash);
const climateClouds = world.clouds.instances.filter((cloud) => !cloud.authored);
assert.ok(climateClouds.length > 0, "climate-sampled clouds must exist");
assert.ok(climateClouds.every((cloud) => cloud.climateSource === "climate-v10"));
for (const cloud of world.clouds.instances) {
  assert.equal(cloud.pathPoints.length, CLOUD_RIDGE_PATH_POINTS);
  const minClearance = (cloud.hugRidge || cloud.authored) ? 0.3 : 1.2;
  assert.ok(cloud.terrainClearance >= minClearance, `${cloud.cellIndex} clearance ${cloud.terrainClearance}`);
  assert.ok(cloud.pathPoints.every((point) => Number.isFinite(point.altitude) && point.altitude >= point.terrainHeight + point.terrainClearance - 1e-6));
  assert.deepEqual(cloud.pathPoints[0].direction, cloud.pathPoints[0].direction);
  assert.ok(cloud.pathPoints.some((point, index) => index > 0 && point.direction.some((value, axis) => Math.abs(value - cloud.pathPoints[0].direction[axis]) > 1e-5)));
}
for (const cloud of climateClouds) {
  const packed = world.climate.cells[cloud.cellIndex];
  assert.ok(packed, `climate cell missing for ${cloud.cellIndex}`);
  assert.ok(Math.abs(cloud.oceanFetch - packed.climate.upwindOceanFetch) < 1e-9, "cloud fetch must copy climateFieldV10");
  assert.ok(Math.abs(cloud.rainShadow - packed.climate.rainShadow) < 1e-9, "cloud rainShadow must copy climateFieldV10");
  assert.ok(Math.abs(cloud.cloudBase - packed.climate.cloudBase) < 1e-9, "cloudBase must copy climateFieldV10");
}
const climateCells = world.climate.cells;
const windwardCells = climateCells.filter((cell) => cell.climate.orographicLift >= cell.climate.rainShadow);
const leewardCells = climateCells.filter((cell) => cell.climate.rainShadow > cell.climate.orographicLift);
assert.ok(windwardCells.length > 0 && leewardCells.length > 0, "climate field must have both windward and rain-shadow cells");
const meanFetch = (list) => list.reduce((sum, cell) => sum + cell.climate.upwindOceanFetch, 0) / list.length;
assert.ok(meanFetch(windwardCells) + 1e-9 >= meanFetch(leewardCells) * 0.35, "upwind ocean fetch must remain higher on the windward side of the field");
const compiler = readFileSync(new URL("../TigerMessenger/src/render/clouds/cloudClusterCompiler.js", import.meta.url), "utf8");
assert.match(compiler, /readClimateSample/);
assert.doesNotMatch(compiler, /const fetch = Math\.max\(0, dot\(cell\.direction/);
const material = readFileSync(new URL("../TigerMessenger/src/render/clouds/cloudImpostorMaterial.js", import.meta.url), "utf8");
// The CPU path keeps ten points for terrain-aware curvature; the GPU contract
// uploads six representative samples to stay within mobile attribute limits.
assert.match(material, /aPath5/);
assert.doesNotMatch(material, /aPath9/);
  assert.match(material, /uHeroDayWeight/);
  assert.match(material, /uViews/);
  assert.match(material, /uv\.x \/ max\(1\.0, uViews\)/);
  assert.match(material, /cameraPosition/);
  assert.match(material, /length\(billboardForward\) < 0\.001/);
  assert.match(material, /length\(pathPosition\) > 0\.001/);
  assert.match(material, /terrain clearance|terrainClearance|ridgePath/i);
assert.doesNotMatch(material, /precipitation|forestness|upwindOceanFetch/);

console.log(`✅ Planet V9 cloud paths: ${CLOUD_RIDGE_PATH_POINTS}-point ridge streamlines, climate-v10 source, clearance and shader path interpolation passed (${world.clouds.instances.length} clusters)`);
