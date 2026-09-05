// =====================================================================
// C10 · 编辑器拾取：世界 XZ → face → (ix,iz)
// 用法：node tools/test_grid_pick.mjs
// =====================================================================
import assert from "node:assert/strict";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const gm = await import(new URL("world/citadel/gridMigration.js", SRC).href);
const town = await import(new URL("world/citadelTown.js", SRC).href);

const GS = 25;
const CS = town.CITADEL_TOWN_SPEC.cellSize;

// 无 quad：与现网 cellAtLocal 同一套四舍五入
for (let iz = 0; iz < GS; iz++) {
  for (let ix = 0; ix < GS; ix++) {
    const c = gm.citadelColumnCenter(ix, iz, { cellSize: CS, gridSize: GS });
    const back = gm.citadelLocalToColumn(c.x, c.z, { cellSize: CS, gridSize: GS });
    assert.equal(back.ix, ix, `fallback ix ${ix},${iz}`);
    assert.equal(back.iz, iz, `fallback iz ${ix},${iz}`);
  }
}
assert.equal(gm.citadelLocalToColumn(99, 99, { cellSize: CS, gridSize: GS }), null);
console.log("✓ 方格回落：25×25 中心点逐格可逆");

const spec = town.HIGHLAND_TOWNSCAPER_TOWN_SPEC;
const layout = town.normalizeCitadelTerraceLayout(spec, 12);
const v6 = gm.createCitadelGridV6(layout, { cellSize: spec.cellSize, gridSize: GS });
assert.equal(v6.mapping.cellToFace.size, GS * GS, "拾取映射应覆盖全表 25×25");
console.log(
  `✓ 全表映射 columns=${v6.mapping.cellToFace.size} ` +
  `P50=${v6.mapping.p50DeviationCells.toFixed(3)} ` +
  `P95=${v6.mapping.p95DeviationCells.toFixed(3)} ` +
  `max=${v6.mapping.maxDeviationCells.toFixed(3)} hash=${v6.gridHash}`
);

let hits = 0;
let miss = 0;
for (const [key, fid] of v6.mapping.cellToFace) {
  const [ix, iz] = key.split(",").map(Number);
  const c = gm.citadelColumnCenter(ix, iz, {
    quad: v6.quad, mapping: v6.mapping, cellSize: spec.cellSize, gridSize: GS,
  });
  assert.ok(c, `列 ${key} 应有 face`);
  const back = gm.citadelLocalToColumn(c.x, c.z, {
    quad: v6.quad, mapping: v6.mapping, cellSize: spec.cellSize, gridSize: GS,
  });
  if (!back || back.ix !== ix || back.iz !== iz) miss++;
  else hits++;
}
assert.equal(miss, 0, `重心反查失败 ${miss}/${hits + miss}`);
console.log(`✓ 重心落在本 face：${hits} 列全中`);

const far = gm.citadelLocalToColumn(80, 80, {
  quad: v6.quad, mapping: v6.mapping, cellSize: spec.cellSize, gridSize: GS,
});
assert.equal(far, null, "网格外不得回落方格");
console.log("✅ test_grid_pick");
