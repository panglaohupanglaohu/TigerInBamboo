// =====================================================================
// G-13 · 角柱图适配器
// 验收：validate().ok；高山角柱节点数；bans 后每节点域非空。
// 用法：node tools/test_corner_graph.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const { HIGHLAND_TOWNSCAPER_TOWN_SPEC, levelsToGrid, CITADEL_GRID_SIZE } =
  await import(new URL("world/citadelTown.js", SRC).href);
const { CORNER_PROTOTYPES, cornerBuildAllowedClasses, cornerAllowedProtoIds } =
  await import(new URL("world/citadel/cornerPrototypes.js", SRC).href);
const { createCornerGraph, cornerBans } =
  await import(new URL("world/citadel/cornerGraphAdapter.js", SRC).href);
const { compileVariants } = await import(new URL("procgen/wfc/socketCompiler.js", SRC).href);

const tablePath = new URL("./out/corner_mask_table.json", import.meta.url);
assert.ok(fs.existsSync(tablePath), "先跑 node tools/gen_corner_mask_table.mjs");
const maskTable = JSON.parse(fs.readFileSync(tablePath, "utf8"));

const grid = levelsToGrid(HIGHLAND_TOWNSCAPER_TOWN_SPEC.levels);
const floors = HIGHLAND_TOWNSCAPER_TOWN_SPEC.floors ?? 12;
const graph = createCornerGraph(grid, { cols: CITADEL_GRID_SIZE, rows: CITADEL_GRID_SIZE, floors });
const v = graph.validate();
assert.ok(v.ok, `角柱图 validate 失败: ${v.errors.slice(0, 8).join(",")}`);
console.log(`highland cells=${grid.size} cornerNodes=${graph.cellCount} floors=${floors}`);

const compiled = compileVariants(CORNER_PROTOTYPES);
const byProto = cornerBuildAllowedClasses(maskTable.table);
const allowedOf = (variant) => byProto.get(variant.protoId) ?? new Set();
const bans = cornerBans(graph, compiled, maskTable, allowedOf);

const banned = new Map();
for (const b of bans) {
  let set = banned.get(b.cell);
  if (!set) banned.set(b.cell, (set = new Set()));
  set.add(b.variant);
}
const n = compiled.variants.length;
const empty = [];
let domain1 = 0;
for (const { index } of graph.cells()) {
  const left = n - (banned.get(index)?.size ?? 0);
  if (left <= 0) {
    const mask = graph.maskOf(index);
    empty.push({
      id: graph.cellId(index),
      mask,
      classId: maskTable.table[mask]?.classId,
      allowed: cornerAllowedProtoIds(mask),
    });
  } else if (left === 1) domain1++;
}
if (empty.length) {
  console.log("空域节点（目录缺件，报回 Claude）：");
  for (const e of empty.slice(0, 20)) {
    console.log(`  ${e.id} mask=${e.mask} classId=${e.classId} allowed=[${e.allowed}]`);
  }
}
assert.equal(empty.length, 0, `${empty.length} 个角柱 bans 后域为空`);
console.log(`variants=${n} bans=${bans.length} domain1=${domain1}/${graph.cellCount}`);
console.log("✅ test_corner_graph");
