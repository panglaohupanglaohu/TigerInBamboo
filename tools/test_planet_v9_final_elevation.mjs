import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { createContinuousLandformManifest, DEFAULT_LANDMARK_MANIFEST } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { createTerrainTiles } from "../TigerMessenger/src/procgen/planet/terrainTiles.js";
import { solveSphericalTerrain, terrainAssignmentMap } from "../TigerMessenger/src/procgen/planet/sphericalWfc.js";
import { createPlanetFieldRecipe } from "../TigerMessenger/src/procgen/planet/planetFieldComposer.js";
import { buildTransitionCollars, validateFinalElevationNarrative } from "../TigerMessenger/src/procgen/planet/landformChainV8.js";

const golden = [1, 7, 42, 884];
for (const seed of golden) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 4 });
  assert.equal(world.ok, true, `seed=${seed} stage=${world.stage}`);
  assert.equal(world.finalElevationReport.ok, true, `seed=${seed} final elevation`);
  assert.ok(world.finalElevationReport.probeCount >= 8192 + 6 * 256);
  assert.ok(world.finalElevationReport.highlandMargin >= 0.35);
  assert.ok(world.finalElevationReport.prominentPeaks >= 3);
}
console.log(`✓ ${golden.length} golden seeds 全量编译 + 8192 全球探针/每 landmark 256 局部探针`);

// 1000 seed 纯 field 门（TODO G16-B 末条）：不做 chart 编译（MC seam/degenerate 由 golden 全量覆盖），
// 每 seed 重建 manifest→grid→WFC→field，断言——无 NaN、无中心等高 tie、峰主始终 highland-citadel、
// margin≥0.35、prominent peaks≥3。约 38ms/seed。
{
  const t0 = performance.now();
  let minMargin = Infinity;
  let minPeaks = Infinity;
  for (let seed = 1; seed <= 1000; seed++) {
    const manifest = createContinuousLandformManifest({ entries: DEFAULT_LANDMARK_MANIFEST, seed });
    const chain = manifest.filter((entry) => entry.chainOrder != null);
    const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 1, seed, preserve: manifest.map((entry) => entry.direction) });
    const wfc = solveSphericalTerrain({ graph: grid.dual, landmarks: chain, tiles: createTerrainTiles(), seed, maxBacktrack: 64 });
    assert.equal(wfc.ok, true, `seed=${seed} wfc`);
    const assignment = new Map(Object.entries(terrainAssignmentMap(wfc)));
    const field = createPlanetFieldRecipe({
      radius: 160,
      grid,
      landmarks: manifest,
      assignment,
      transitionCollars: buildTransitionCollars(chain, { radius: 160 }),
    });
    // NaN 探针：全部 landmark 中心 + 全球稀疏点
    for (const entry of chain) assert.ok(Number.isFinite(field.heightAt(entry.direction)), `seed=${seed} NaN at ${entry.id}`);
    const report = validateFinalElevationNarrative({ field, chain, globalProbeCount: 512, localProbeCount: 32 });
    assert.equal(report.ok, true, `seed=${seed}: ${report.errors.join(",")}`);
    minMargin = Math.min(minMargin, report.highlandMargin);
    minPeaks = Math.min(minPeaks, report.prominentPeaks);
  }
  console.log(`✓ 1000 seed field 门：minMargin=${minMargin.toFixed(2)} minPeaks=${minPeaks}，${((performance.now() - t0) / 1000).toFixed(1)}ms/seed`);
}
console.log(`✅ Planet V9 final elevation: 4 golden seeds, Fibonacci global probes, local landmark probes, three highland peaks and 1000-seed field gate passed`);
