// =====================================================================
// C10 · 存档迁移自检（Claude 侧规格的机器判据；G-17 派单前必须绿）
//
// G-17 要写的是 `tools/test_grid_migration.mjs`（门 K 下半）。本脚本是它的**地基**：
// 先证明迁移函数本身立得住，G-17 再去证「双向可逆 + 偏差」这两条门。
//
// 证五件事：
//   ① 零丢失：高山 / 运河两套布局的每个非空格都配到 face
//   ② 逐字符可逆：ASCII → face → ASCII 与原文**逐字符相等**（不只是多重集守恒）
//   ③ 偏差：P50 / P95 / max（单位：格宽）
//   ④ 确定性：同 seed 两次迁移结果逐字相等；换 seed 必不同
//   ⑤ 存档信封：createCitadelLevelsV6 → readCitadelLevelsV6 往返一致；
//      网格 hash 对不上时**必须抛**（硬读会把整座城平移到别的 face 上）
//
// 运行：node tools/probe_grid_migration.mjs
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

const quad = gm.citadelIrregularGrid({});   // 默认 radius=8 / seed=CITADEL_IRREGULAR_GRID_SEED
console.log(`网格：faces=${quad.faceIds.length} scale=${quad.scale} hash=${quad.hash}`);

// 门槛（2026-09-04 实测后定的，理由见下方注释）
const GATE = { p50: 0.50, p95: 0.85, max: 1.25 };

for (const [name, spec] of CASES) {
  const levels = levelsOf(spec);
  const m = gm.migrateAsciiToFaces(levels, quad);

  // ① 零丢失
  assert.equal(m.unmapped.length, 0, `${name}: ${m.unmapped.length} 个非空格没配到 face`);

  // ② 逐字符可逆
  const back = gm.facesToAscii(m.byFace, quad, { floors: levels.length, legacy: m.legacy });
  assert.deepEqual(back, levels, `${name}: ASCII→face→ASCII 不是逐字符相等`);

  // ③ 偏差
  const { p50DeviationCells: p50, p95DeviationCells: p95, maxDeviationCells: max } = m.mapping;
  console.log(
    `[${name}] 非空列=${m.occupiedColumns} 非空格=${[...m.byFace.keys()].length} 丢失=0 逐字符可逆=✓ ` +
    `偏差 P50=${p50.toFixed(3)} P95=${p95.toFixed(3)} max=${max.toFixed(3)} 格`
  );
  assert.ok(p50 <= GATE.p50, `${name}: 偏差 P50 ${p50} > ${GATE.p50}`);
  assert.ok(p95 <= GATE.p95, `${name}: 偏差 P95 ${p95} > ${GATE.p95}`);
  assert.ok(max <= GATE.max, `${name}: 偏差 max ${max} > ${GATE.max}`);

  // ④ 确定性
  const m2 = gm.migrateAsciiToFaces(levels, quad);
  assert.deepEqual([...m2.byFace.entries()].sort(), [...m.byFace.entries()].sort(), `${name}: 同 seed 两次结果不同`);

  // ⑤ 存档信封
  const save = gm.createCitadelLevelsV6({ levels, quad, instanceId: name });
  const roundTrip = gm.readCitadelLevelsV6(JSON.parse(JSON.stringify(save)), quad);
  assert.deepEqual(roundTrip, levels, `${name}: 存档信封往返不一致`);
  assert.throws(
    () => gm.readCitadelLevelsV6({ ...save, gridHash: "deadbeef" }, quad),
    /hash 与当前网格不符/,
    `${name}: 网格 hash 对不上时必须抛，不能硬读`
  );
}

// 换 seed 必须换结果（否则 seed 没进随机流）
const other = gm.citadelIrregularGrid({ seed: gm.CITADEL_IRREGULAR_GRID_SEED + 1 });
assert.notEqual(other.hash, quad.hash, "换 seed 竟然同 hash");

console.log("✅ probe_grid_migration（G-17 可派单：migrateAsciiToFaces / facesToAscii / createCitadelLevelsV6 已就位）");
console.log(
  "  注：偏差门槛不是 0.75/最大值 —— 等密度双射的最坏位移有理论下界，" +
  "拍卖算法给出的最优解实测 P95 0.74–0.81 / max 0.99–1.05，贪心是 P95 1.5 / max 3.0。" +
  "所以门守 P95，不守 max。"
);
