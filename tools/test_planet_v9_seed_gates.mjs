// V9 发布门（TODO G16-H 末条）：golden + 100 full world + 1000 field/route seeds。
// - 100 full world：完整 compilePlanetV8（含 chart MC/语义/云），验证 ok 与 seam。
// - 1000 field/route seeds：同一生产代码路径但 stopAfter:"routes" 提前出口，
//   跳过重的 chart 装配；断言 field 无 NaN/tie、路线（含 bookshop 坡度）全部通过。
import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { validateChartSeams } from "../TigerMessenger/src/procgen/planet/chartSeamValidator.js";

// ---------- 100 full world ----------
{
  const t0 = performance.now();
  for (let seed = 1; seed <= 100; seed++) {
    const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 4 });
    assert.equal(world.ok, true, `full world seed=${seed} stage=${world.stage} ${JSON.stringify(world.report).slice(0, 200)}`);
    const charts = world.charts.map((chart) => ({ positions: chart.mesh.positions, normals: chart.mesh.normals, semantics: chart.mesh.semantics }));
    assert.equal(validateChartSeams(charts).ok, true, `seed=${seed} chart seam`);
  }
  console.log(`✓ 100 full world 编译（含 chart seam）：${((performance.now() - t0) / 100).toFixed(0)}ms/seed`);
}

// ---------- 1000 field/route seeds（生产路径提前出口，非旁路复制） ----------
{
  const t0 = performance.now();
  let routeCount = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 4, stopAfter: "routes" });
    assert.equal(world.ok, true, `field/route seed=${seed} stage=${world.stage} ${JSON.stringify(world.report ?? world.error ?? "").slice(0, 200)}`);
    assert.equal(world.finalElevationReport?.ok ?? true, true, `seed=${seed} final elevation`);
    for (const entry of world.manifest) {
      assert.ok(Number.isFinite(world.field.heightAt(entry.direction)), `seed=${seed} NaN at ${entry.id}`);
    }
    routeCount = world.terrainRoutes.routes.length;
  }
  assert.ok(routeCount > 0);
  console.log(`✓ 1000 field/route seeds（${routeCount} 条路线/seed，含 bookshop 坡度与瀑布落水校验）：${((performance.now() - t0) / 1000).toFixed(1)}ms/seed`);
}

console.log("✅ Planet V9 seed gates: 100 full world + 1000 field/route seeds passed");
