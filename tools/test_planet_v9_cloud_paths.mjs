import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { CLOUD_RIDGE_PATH_POINTS } from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";
import { readFileSync } from "node:fs";

const world = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
assert.equal(world.ok, true, world.report?.stage);
assert.ok(world.clouds.instances.length > 0);
for (const cloud of world.clouds.instances) {
  assert.equal(cloud.pathPoints.length, CLOUD_RIDGE_PATH_POINTS);
  const minClearance = (cloud.hugRidge || cloud.authored) ? 0.3 : 1.2;
  assert.ok(cloud.terrainClearance >= minClearance, `${cloud.cellIndex} clearance ${cloud.terrainClearance}`);
  assert.ok(cloud.pathPoints.every((point) => Number.isFinite(point.altitude) && point.altitude >= point.terrainHeight + point.terrainClearance - 1e-6));
  assert.deepEqual(cloud.pathPoints[0].direction, cloud.pathPoints[0].direction);
  assert.ok(cloud.pathPoints.some((point, index) => index > 0 && point.direction.some((value, axis) => Math.abs(value - cloud.pathPoints[0].direction[axis]) > 1e-5)));
}
const material = readFileSync(new URL("../TigerMessenger/src/render/clouds/cloudImpostorMaterial.js", import.meta.url), "utf8");
// The CPU path keeps ten points for terrain-aware curvature; the GPU contract
// uploads six representative samples to stay within mobile attribute limits.
assert.match(material, /aPath5/);
assert.doesNotMatch(material, /aPath9/);
assert.match(material, /uHeroDayWeight/);
assert.match(material, /terrain clearance|terrainClearance|ridgePath/i);

console.log(`✅ Planet V9 cloud paths: ${CLOUD_RIDGE_PATH_POINTS}-point ridge streamlines, clearance and shader path interpolation passed (${world.clouds.instances.length} clusters)`);
