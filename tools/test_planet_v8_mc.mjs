import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { marchingCubes } from "../TigerMessenger/src/procgen/field/marchingCubes.js";
import { hierarchicalSmoothPositions, classifyHardLevels } from "../TigerMessenger/src/procgen/planet/hierarchicalSmoothing.js";
import { validateChartSeams, exportChartDebug } from "../TigerMessenger/src/procgen/planet/chartSeamValidator.js";
import { sdTorusXZ, sdCave } from "../TigerMessenger/src/procgen/field/sdf.js";

function radialFixture(radius = 2, resolution = 18) {
  const index = (x, y, z) => (z * resolution + y) * resolution + x;
  const spacing = [4 / (resolution - 1), 4 / (resolution - 1), 4 / (resolution - 1)];
  return {
    resolution: { x: resolution, y: resolution, z: resolution },
    spacing,
    valueAt(x, y, z) {
      const p = [-2 + x * spacing[0], -2 + y * spacing[1], -2 + z * spacing[2]];
      return Math.hypot(...p) - radius;
    },
    worldPosition(x, y, z) { return [-2 + x * spacing[0], -2 + y * spacing[1], -2 + z * spacing[2]]; },
    sampleWorld(p) { return Math.hypot(...p) - radius; },
    index,
  };
}

function sdfFixture(sdf, resolution = 18) {
  const spacing = [4 / (resolution - 1), 4 / (resolution - 1), 4 / (resolution - 1)];
  return {
    resolution: { x: resolution, y: resolution, z: resolution }, spacing,
    valueAt(x, y, z) { return sdf([-2 + x * spacing[0], -2 + y * spacing[1], -2 + z * spacing[2]]); },
    worldPosition(x, y, z) { return [-2 + x * spacing[0], -2 + y * spacing[1], -2 + z * spacing[2]]; },
    sampleWorld(p) { return sdf(p); },
  };
}

const sphere = marchingCubes(radialFixture(), { isoLevel: 0, normalMode: "gradient" });
assert.ok(sphere.stats.triangleCount > 0);
assert.equal(sphere.stats.degenerateTriangles, 0);
assert.ok(sphere.positions.every(Number.isFinite));
assert.ok(sphere.normals.every(Number.isFinite));
for (const fixture of [
  sdfFixture((p) => sdTorusXZ(p, [0, 0, 0], 0.85, 0.25)),
  sdfFixture((p) => sdCave(p, [0, 0, 0], [1.2, 1.1, 1.2], 0.55)),
]) {
  const mesh = marchingCubes(fixture, { isoLevel: 0, normalMode: "gradient" });
  assert.ok(mesh.stats.triangleCount > 0);
  assert.equal(mesh.stats.degenerateTriangles, 0);
  assert.ok(mesh.positions.every(Number.isFinite));
}

const levels = classifyHardLevels({ count: 5, hard: [0, 4], transition: [1, 3] });
const before = sphere.positions.length ? [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]] : [];
const neighbors = [[1, 2], [0, 2, 3], [0, 1, 4], [1, 4], [2, 3]];
const after = hierarchicalSmoothPositions(before, neighbors, { levels, passes: 2, reproject: (p) => p });
assert.deepEqual(after[0], before[0]);
assert.deepEqual(after[4], before[4]);
assert.ok(after.some((point, index) => point.some((value, axis) => value !== before[index][axis])));

// 生产运行时（world/planetV8/runtime.js）使用 landformChain: true + subdivision 1；
// 旧 legacy 非链模式已不再是受支持配置（seed 7 下书店-苔庭路线穿 ocean.shelf），
// 本测试改用生产参数，MC chart 断言意图不变。
const compiled = compilePlanetV8({ seed: 7, subdivision: 1, chartLimit: 3, resolution: 14, landformChain: true });
assert.equal(compiled.ok, true, compiled.report);
assert.equal(compiled.charts.length, 3);
for (const chart of compiled.charts) {
  assert.ok(chart.mesh.stats.triangleCount > 0);
  assert.equal(chart.mesh.stats.degenerateTriangles, 0);
}
const sameCharts = compiled.charts.map((chart) => ({ positions: chart.mesh.positions, normals: chart.mesh.normals, semantics: chart.mesh.semantics }));
assert.equal(validateChartSeams(sameCharts).ok, true);
assert.ok(exportChartDebug(sameCharts).charts.length === 3);
console.log(`✅ Planet V8 MC: fixtureTriangles=${sphere.stats.triangleCount}, charts=${compiled.charts.length}, seams=ok`);
