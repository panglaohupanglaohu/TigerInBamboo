// =====================================================================
// 探针：角柱选件的自由度有多大（C9 待办 #7 的决策依据，只读不改）
// 用法：node tools/probe_corner_choice.mjs
//
// 现状是 `cornerAllowedProtoIds(mask)[0]`——永远取允许集第一件。
// corner-eval §1 说 196/256 个 mask 只允许 1 件、自由度集中在 15 个顶面 mask。
// 但那是**按 mask 数**统计的；实际画面上要看的是**按节点数**：
// 高山布局里到底有多少根柱子有得选、这些柱子分布在什么形态上。
// =====================================================================
const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const { HIGHLAND_TOWNSCAPER_TOWN_SPEC, levelsToGrid, CITADEL_GRID_SIZE } =
  await import(new URL("world/citadelTown.js", SRC).href);
const { cornerMaskAt, createCornerGraph } =
  await import(new URL("world/citadel/cornerGraphAdapter.js", SRC).href);
const { cornerAllowedProtoIds, cornerShapeOf } =
  await import(new URL("world/citadel/cornerPrototypes.js", SRC).href);

const grid = levelsToGrid(HIGHLAND_TOWNSCAPER_TOWN_SPEC.levels);
const floors = HIGHLAND_TOWNSCAPER_TOWN_SPEC.floors ?? 12;
const graph = createCornerGraph(grid, {
  cols: CITADEL_GRID_SIZE,
  rows: CITADEL_GRID_SIZE,
  floors,
});

// 与 assembleCornerBody 同源：主循环 graph.cells() + 补的一圈 iy=-1
const nodes = [];
for (const { index } of graph.cells()) {
  const { gx, gz, iy } = graph.coordOf(index);
  nodes.push({ gx, gz, iy, mask: graph.maskOf(index) });
}
for (let gz = 0; gz <= CITADEL_GRID_SIZE; gz++) {
  for (let gx = 0; gx <= CITADEL_GRID_SIZE; gx++) {
    const mask = cornerMaskAt(grid, gx, gz, -1);
    if (mask) nodes.push({ gx, gz, iy: -1, mask });
  }
}

let multi = 0;
const byShape = new Map(); // shape -> {nodes, multiNodes}
const optionSets = new Map(); // "a|b|c" -> count
const firstPick = new Map(); // protoId -> count（现状：取 [0]）
for (const n of nodes) {
  const allowed = cornerAllowedProtoIds(n.mask);
  const shape = cornerShapeOf(n.mask);
  const s = byShape.get(shape) ?? { nodes: 0, multiNodes: 0 };
  s.nodes++;
  if (allowed.length > 1) {
    multi++;
    s.multiNodes++;
    const key = allowed.join(" | ");
    optionSets.set(key, (optionSets.get(key) ?? 0) + 1);
  }
  byShape.set(shape, s);
  const pick = allowed[0];
  if (pick) firstPick.set(pick, (firstPick.get(pick) ?? 0) + 1);
}

console.log(`节点总数=${nodes.length}（含补的 iy=-1 一圈）`);
console.log(`有多件可选的节点=${multi}  占 ${((multi / nodes.length) * 100).toFixed(1)}%`);

console.log("\n按形态：");
for (const [shape, s] of [...byShape.entries()].sort((a, b) => b[1].nodes - a[1].nodes)) {
  const pct = s.nodes ? ((s.multiNodes / s.nodes) * 100).toFixed(1) : "0.0";
  console.log(`  ${shape.padEnd(10)} 节点 ${String(s.nodes).padStart(5)}  其中有得选 ${String(s.multiNodes).padStart(5)}  (${pct}%)`);
}

console.log("\n可选集（按出现节点数排序，前 12 组）：");
for (const [key, count] of [...optionSets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  const opts = key.split(" | ");
  console.log(`  ×${String(count).padStart(4)}  取[0]=${opts[0]}`);
  console.log(`           被浪费的 ${opts.length - 1} 件：${opts.slice(1).join(", ")}`);
}

console.log("\n现状（永远取 [0]）实际用到的件：");
for (const [id, c] of [...firstPick.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(22)} ${String(c).padStart(5)}`);
}
console.log(`\n用到 ${firstPick.size} 种件；目录共 28 件 / 编译 78 变体（corner-eval §1）`);
