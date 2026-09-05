// =====================================================================
// G-17 · 门 K 下半：ASCII ↔ face 迁移
// 零丢失 + 逐字符可逆 + 偏差 P50≤0.50 / P95≤0.85 / max≤1.25
// 用法：node tools/test_grid_migration.mjs
// =====================================================================
import assert from "node:assert/strict";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const gm = await import(new URL("world/citadel/gridMigration.js", SRC).href);
const town = await import(new URL("world/citadelTown.js", SRC).href);

const CASES = [
  ["highland", town.HIGHLAND_TOWNSCAPER_TOWN_SPEC],
  ["canal-junction", town.CANAL_JUNCTION_TOWN_SPEC],
];

const levelsOf = (spec) => {
  const layout = town.normalizeCitadelTerraceLayout(spec, 12);
  return (layout.levels ?? layout.terraces?.[0]?.levels ?? layout).map((rows) => rows.map(String));
};

const GATE = { p50: 0.50, p95: 0.85, max: 1.25 };
const quad = gm.citadelIrregularGrid({});
console.log(`网格：faces=${quad.faceIds.length} hash=${quad.hash}`);

for (const [name, spec] of CASES) {
  const levels = levelsOf(spec);
  const m = gm.migrateAsciiToFaces(levels, quad);
  assert.equal(m.unmapped.length, 0, `${name}: 丢失 ${m.unmapped.length} 格`);
  const back = gm.facesToAscii(m.byFace, quad, { floors: levels.length, legacy: m.legacy });
  assert.deepEqual(back, levels, `${name}: ASCII→face→ASCII 不是逐字符相等`);
  const { p50DeviationCells: p50, p95DeviationCells: p95, maxDeviationCells: max } = m.mapping;
  console.log(
    `[${name}] 列=${m.occupiedColumns} 格=${[...m.byFace.keys()].length} ` +
    `P50=${p50.toFixed(3)} P95=${p95.toFixed(3)} max=${max.toFixed(3)}`
  );
  assert.ok(p50 <= GATE.p50, `${name}: P50 ${p50} > ${GATE.p50}`);
  assert.ok(p95 <= GATE.p95, `${name}: P95 ${p95} > ${GATE.p95}`);
  assert.ok(max <= GATE.max, `${name}: max ${max} > ${GATE.max}`);

  const save = gm.createCitadelLevelsV6({ levels, quad, instanceId: name });
  const roundTrip = gm.readCitadelLevelsV6(JSON.parse(JSON.stringify(save)), quad);
  assert.deepEqual(roundTrip, levels, `${name}: 存档信封往返不一致`);
  assert.throws(
    () => gm.readCitadelLevelsV6({ ...save, gridHash: "deadbeef" }, quad),
    /hash 与当前网格不符/
  );
}

const other = gm.citadelIrregularGrid({ seed: gm.CITADEL_IRREGULAR_GRID_SEED + 1 });
assert.notEqual(other.hash, quad.hash, "换 seed 必须换 hash");
console.log("✅ test_grid_migration");
