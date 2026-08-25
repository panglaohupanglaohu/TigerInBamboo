// V7-G4 缺口专项：显式 adjacency 输入（TODO 1128）、compatibilityOptions
// 透传（1129）、SimpleTiled+周期网格（1130）、HalfEdgeGraph SimpleTiled
// （1131）、花砖/屋瓦装饰 demo（1135）、non-Wang 禁配 fixture（1136）、
// 模型层 partially observed debug 数据（1138）。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createHalfEdgeGraph } from "../TigerMessenger/src/procgen/graph/halfEdgeGraph.js";
import {
  createSimpleTiledModel,
  solveSimpleTiled,
  pin2D,
  assignmentGrid,
  defaultEdgeClass,
} from "../TigerMessenger/src/procgen/wfc/simpleTiledModel.js";
import {
  createOverlappingModel2D,
  solveOverlapping2D,
  renderOverlappingAssignment,
} from "../TigerMessenger/src/procgen/wfc/overlappingModel2d.js";
import { partialObservation } from "../TigerMessenger/src/procgen/wfc/partialObservation.js";
import { DECOR_STRUCTURE, DECOR_SAMPLE, DECOR_OUTPUT } from "../TigerMessenger/src/procgen/fixtures/decorFixtures.js";
import { EDGE_TRIM_FIXTURE } from "../TigerMessenger/src/procgen/fixtures/edgeTrimFixtures.js";

const BASE = fileURLToPath(new URL("../TigerMessenger/", import.meta.url));
const F = (connector, parity = "symmetric", extra = {}) => ({ connector, parity, ...extra });
const tile = (id, c, weight = 1) => ({
  id, family: "tile", weight, orientationGroup: "NONE",
  faces: { N: F(c), E: F(c), S: F(c), W: F(c) },
});

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

// ---------- 1128：显式 tiles/adjacency/boundary 输入 ----------
{
  // 显式 tile + adjacency（不经 socket 编译）
  const graph = createRectGrid2D({ width: 2, height: 1 });
  const model = createSimpleTiledModel({
    tiles: [{ id: "A", weight: 2 }, { id: "B" }],
    adjacency: [{ a: "A", direction: "E", b: "B" }],
    graph,
  });
  assert.equal(model.compiled.variants.length, 2);
  const r = solveSimpleTiled({ model, seed: 1, pins: [pin2D(model, 0, 0, "A@r0")] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.assignmentByCellId["r:1:0"], "B@r0", "显式 adjacency 约束传播");

  // 显式 adjacency 与 socket 派生并存 → 显式整行覆盖（stone 的 E 行只剩 brick）
  const socketModel = createSimpleTiledModel({
    prototypes: [tile("stone", "x"), tile("brick", "x")], // socket 派生：全互联
    adjacency: [{ a: "stone", direction: "E", b: "brick" }],
    graph,
  });
  const stoneIdx = socketModel.compiled.variantIndex.get("stone@r0");
  const brickIdx = socketModel.compiled.variantIndex.get("brick@r0");
  assert.equal(socketModel.table.isCompatible(stoneIdx, "E", brickIdx), true);
  assert.equal(socketModel.table.isCompatible(stoneIdx, "E", stoneIdx), false, "显式行替换优先于 socket 派生");
  assert.equal(socketModel.table.isCompatible(brickIdx, "W", stoneIdx), true, "反向自动补齐");
  const rs = solveSimpleTiled({ model: socketModel, seed: 2, pins: [pin2D(socketModel, 0, 0, "stone@r0")] });
  assert.equal(rs.assignmentByCellId["r:1:0"], "brick@r0");

  // allow:false 显式禁配（双向清除，优先于 allow）
  const banModel = createSimpleTiledModel({
    prototypes: [tile("stone", "x"), tile("brick", "x")],
    adjacency: [{ a: "stone", direction: "E", b: "brick", allow: false }],
    graph,
  });
  const rb = solveSimpleTiled({
    model: banModel,
    seed: 3,
    pins: [pin2D(banModel, 0, 0, "stone@r0"), pin2D(banModel, 1, 0, "brick@r0")],
  });
  assert.equal(rb.ok, false, "显式禁配后 stone|brick 相邻不可解");

  // boundary：北行只允许 meadow
  const bModel = createSimpleTiledModel({
    tiles: [{ id: "meadow" }, { id: "pond" }],
    adjacency: [
      { a: "meadow", direction: "E", b: "meadow" },
      { a: "meadow", direction: "E", b: "pond" },
      { a: "pond", direction: "E", b: "meadow" },
      { a: "pond", direction: "E", b: "pond" },
      { a: "meadow", direction: "N", b: "meadow" },
      { a: "meadow", direction: "N", b: "pond" },
      { a: "pond", direction: "N", b: "meadow" },
      { a: "pond", direction: "N", b: "pond" },
    ],
    boundary: { N: ["meadow"] },
    graph: createRectGrid2D({ width: 3, height: 2 }),
  });
  const br = solveSimpleTiled({ model: bModel, seed: 5 });
  assert.equal(br.ok, true, JSON.stringify(br));
  for (let x = 0; x < 3; x++) assert.equal(br.assignmentByCellId[`r:${x}:0`], "meadow@r0", "N 边界行只允许 meadow");
  ok("1128：显式 tiles/adjacency/boundary 输入；显式 adjacency 优先于 socket 派生");
}

// ---------- 1129：compatibilityOptions / excludedNeighbors 透传 ----------
{
  // 面级 excludedNeighbors：connector 相同也禁配
  const p1 = tile("p.keeper", "k");
  p1.faces = { N: F("k", "symmetric", { excludedNeighbors: ["p.shunned"] }), E: F("k", "symmetric", { excludedNeighbors: ["p.shunned"] }), S: F("k", "symmetric", { excludedNeighbors: ["p.shunned"] }), W: F("k", "symmetric", { excludedNeighbors: ["p.shunned"] }) };
  const model = createSimpleTiledModel({
    prototypes: [p1, tile("p.shunned", "k"), tile("p.other", "k")],
    graph: createRectGrid2D({ width: 2, height: 1 }),
  });
  const iK = model.compiled.variantIndex.get("p.keeper@r0");
  const iS = model.compiled.variantIndex.get("p.shunned@r0");
  const iO = model.compiled.variantIndex.get("p.other@r0");
  assert.equal(model.table.isCompatible(iK, "E", iS), false, "connector 相同但被 excludedNeighbors 禁配");
  assert.equal(model.table.isCompatible(iK, "E", iO), true);
  const r = solveSimpleTiled({ model, seed: 1, pins: [pin2D(model, 0, 0, "p.keeper@r0")] });
  assert.equal(r.assignmentByCellId["r:1:0"], "p.other@r0");

  // rules.excludes（variant 级）同样透传
  const excl = tile("p.x", "k");
  excl.rules = { excludes: ["p.shunned"] };
  const m2 = createSimpleTiledModel({
    prototypes: [excl, tile("p.shunned", "k"), tile("p.other", "k")],
    graph: createRectGrid2D({ width: 2, height: 1 }),
  });
  assert.equal(m2.table.isCompatible(m2.compiled.variantIndex.get("p.x@r0"), "E", m2.compiled.variantIndex.get("p.shunned@r0")), false);

  // compatibilityOptions.onDeadVariant 透传：默认 throw，report 收集
  // （normal parity + 独占 connector → 任何方向都无邻居，包括自身）
  const deadProto = {
    id: "p.iso", family: "tile", weight: 1, orientationGroup: "NONE",
    faces: { N: F("isolated", "normal"), E: F("isolated", "normal"), S: F("isolated", "normal"), W: F("isolated", "normal") },
  };
  assert.throws(
    () => createSimpleTiledModel({ prototypes: [tile("p.a", "k"), tile("p.b", "k"), deadProto], graph: createRectGrid2D({ width: 1, height: 1 }) }),
    /dead variants/
  );
  const m3 = createSimpleTiledModel({
    prototypes: [tile("p.a", "k"), tile("p.b", "k"), deadProto],
    graph: createRectGrid2D({ width: 1, height: 1 }),
    compatibilityOptions: { onDeadVariant: "report" },
  });
  assert.deepEqual(m3.table.deadVariants.map((d) => d.key), ["p.iso@r0"]);
  ok("1129：SimpleTiled 层 excludedNeighbors / rules.excludes / onDeadVariant 透传");
}

// ---------- 1130：SimpleTiled + 周期网格组合 ----------
{
  // 严格交替（parity 互补）：A 全 normal，B 全 flipped
  const alt = (id, parity) => ({
    id, family: "tile", weight: 1, orientationGroup: "NONE",
    faces: { N: F("x", parity), E: F("x", parity), S: F("x", parity), W: F("x", parity) },
  });
  const protos = [alt("alt.a", "normal"), alt("alt.b", "flipped")];

  // 2×1 periodic-x：cell0 的 E/W 都绕到 cell1，交替可解且两格必不同
  const p2 = createSimpleTiledModel({ prototypes: protos, graph: createRectGrid2D({ width: 2, height: 1, boundary: "periodic-x" }) });
  const r2 = solveSimpleTiled({ model: p2, seed: 7 });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.notEqual(r2.assignmentByCellId["r:0:0"], r2.assignmentByCellId["r:1:0"], "回绕边参与传播：相邻必交替");

  // 3×1 periodic-x：奇环严格交替不可解；同尺寸非周期可解 —— 证明周期边生效
  const p3 = createSimpleTiledModel({ prototypes: protos, graph: createRectGrid2D({ width: 3, height: 1, boundary: "periodic-x" }) });
  assert.equal(solveSimpleTiled({ model: p3, seed: 7 }).ok, false, "奇环周期网格不可解");
  const n3 = createSimpleTiledModel({ prototypes: protos, graph: createRectGrid2D({ width: 3, height: 1 }) });
  assert.equal(solveSimpleTiled({ model: n3, seed: 7 }).ok, true, "同尺寸非周期可解");

  // 4×4 periodic-both 可解，回绕对侧（x=0 与 x=3）满足交替
  const p4 = createSimpleTiledModel({ prototypes: protos, graph: createRectGrid2D({ width: 4, height: 4, boundary: "periodic-both" }) });
  const r4 = solveSimpleTiled({ model: p4, seed: 9 });
  assert.equal(r4.ok, true, JSON.stringify(r4));
  for (let y = 0; y < 4; y++) {
    assert.notEqual(r4.assignmentByCellId[`r:0:${y}`], r4.assignmentByCellId[`r:3:${y}`], "x 轴回绕交替");
    assert.notEqual(r4.assignmentByCellId[`r:${y}:0`], r4.assignmentByCellId[`r:${y}:3`], "y 轴回绕交替");
  }
  ok("1130：SimpleTiled + 周期网格（periodic-x 奇环不可解 / periodic-both 回绕交替）");
}

// ---------- 1131：HalfEdgeGraph SimpleTiled（方向 token = 边朝向/长度类别） ----------
{
  // 2×2 quad 网格（4 面），单位格点
  const faces = [
    ["a", "b", "e", "d"],
    ["b", "c", "f", "e"],
    ["d", "e", "h", "g"],
    ["e", "f", "i", "h"],
  ];
  const positions = { a: [0, 0], b: [1, 0], c: [2, 0], d: [0, 1], e: [1, 1], f: [2, 1], g: [0, 2], h: [1, 2], i: [2, 2] };
  const graph = createHalfEdgeGraph({ faces, positions });
  assert.equal(defaultEdgeClass({ dx: 1, dy: 0, length: 1 }), "he:o0:l2", "水平单位边 → o0:l2");
  assert.equal(defaultEdgeClass({ dx: 0, dy: 1, length: 1 }), "he:o2:l2", "竖直单位边 → o2:l2");

  const heProto = (id, parity) => ({
    id,
    weight: 1,
    faces: {
      "he:o0:l2": { connector: "x", parity },
      "he:o2:l2": { connector: "x", parity },
    },
  });
  const protos = [heProto("he.a", "normal"), heProto("he.b", "flipped")];
  const model = createSimpleTiledModel({ prototypes: protos, graph });
  assert.equal(model.kind, "simple-tiled-2d");
  assert.equal(model.graphKind, "half-edge-graph");
  assert.deepEqual(Object.keys(model.edgeClasses).sort(), ["he:o0:l2", "he:o2:l2"], "方向 token 表达边朝向/长度类别");
  const r = solveSimpleTiled({ model, seed: 11 });
  assert.equal(r.ok, true, JSON.stringify(r));
  // 相邻面必交替（parity 互补约束经 token 表传播）
  for (const { index } of graph.cells()) {
    for (const e of graph.neighborsOf(index)) {
      if (e.to > index) assert.notEqual(r.assignment[index], r.assignment[e.to], "共享边两侧交替");
    }
  }

  // 视觉位置变形（不改变边类别）→ 解 hash 不变
  const posB = { a: [0.1, -0.1], b: [1.1, 0.05], c: [2.05, -0.1], d: [-0.1, 1.1], e: [1.05, 0.95], f: [2.1, 1.05], g: [0.05, 2.1], h: [1.1, 1.95], i: [2.05, 2.1] };
  const graphB = createHalfEdgeGraph({ faces, positions: posB });
  const modelB = createSimpleTiledModel({ prototypes: protos, graph: graphB });
  const rB = solveSimpleTiled({ model: modelB, seed: 11 });
  assert.equal(rB.ok, true);
  assert.equal(r.solutionHash, rB.solutionHash, "类别内位置变形不改变逻辑解 hash");

  // 自定义分类器：长度类别（长/短共享边）
  const longShort = (geo) => (geo.length > 1.5 ? "long" : "short");
  const rectFaces = [
    ["a", "b", "c", "d"], // 左 1×1 quad
    ["b", "e", "f", "c"], // 右 2×1 quad（与左共享短边 b-c）
    ["c", "f", "g"], // 上 triangle（与右共享长边 c-f，长度 2）
  ];
  const rectPos = { a: [0, 0], b: [1, 0], c: [1, 1], d: [0, 1], e: [3, 0], f: [3, 1], g: [3, 3] };
  const rectGraph = createHalfEdgeGraph({ faces: rectFaces, positions: rectPos });
  const lsProto = (id) => ({ id, weight: 1, faces: { short: { connector: "s", parity: "symmetric" }, long: { connector: "s", parity: "symmetric" } } });
  const lsModel = createSimpleTiledModel({ prototypes: [lsProto("ls.a"), lsProto("ls.b")], graph: rectGraph, classifyEdge: longShort });
  assert.deepEqual(Object.keys(lsModel.edgeClasses).sort(), ["long", "short"], "自定义分类器区分边长度类别");
  assert.ok(lsModel.edgeClasses.short.length >= 1 && lsModel.edgeClasses.long.length >= 1);
  assert.equal(solveSimpleTiled({ model: lsModel, seed: 3 }).ok, true);
  ok("1131：HalfEdgeGraph SimpleTiled——朝向/长度类别 token、变形同 hash、自定义分类器");
}

// ---------- 1135：花砖/屋瓦装饰 demo（overlapping 只影响装饰层） ----------
{
  const sg = createRectGrid2D({ width: DECOR_STRUCTURE.width, height: DECOR_STRUCTURE.height });
  const sModel = createSimpleTiledModel({ prototypes: DECOR_STRUCTURE.prototypes.map((p) => ({ ...p })), graph: sg });
  const pins = DECOR_STRUCTURE.pins.map((p) => pin2D(sModel, p.x, p.y, p.variant, p.source));
  const before = solveSimpleTiled({ model: sModel, seed: 21, pins });
  assert.equal(before.ok, true, JSON.stringify(before));

  // 装饰层：overlapping 从项目自有花砖/屋瓦样例学习，输出同 footprint
  const decor = createOverlappingModel2D({
    sample: DECOR_SAMPLE.sample.map((row) => [...row]),
    N: DECOR_SAMPLE.N,
    outWidth: DECOR_OUTPUT.width,
    outHeight: DECOR_OUTPUT.height,
    augmentSymmetry: true,
  });
  const decorResult = solveOverlapping2D({ model: decor, seed: 22 });
  assert.equal(decorResult.ok, true, JSON.stringify(decorResult));
  const rendered = renderOverlappingAssignment(decor, decorResult);
  const palette = new Set(DECOR_SAMPLE.labels);
  for (const row of rendered) for (const v of row) assert.ok(palette.has(v), "装饰层只含花砖/屋瓦色板标签");

  // 装饰求解之后重解结构层：门/支撑/玩法路径原样、solutionHash 不变
  const after = solveSimpleTiled({ model: sModel, seed: 21, pins });
  assert.equal(after.solutionHash, before.solutionHash, "overlapping 不影响结构层解");
  for (const p of DECOR_STRUCTURE.pins) {
    assert.equal(after.assignmentByCellId[`r:${p.x}:${p.y}`], p.variant, `${p.source} 保持 pinned`);
  }
  const structuralIds = new Set(DECOR_STRUCTURE.prototypes.map((p) => p.id));
  for (const label of palette) assert.ok(!structuralIds.has(label), "装饰标签与结构模块命名空间隔离");
  ok("1135：花砖/屋瓦装饰 demo——overlapping 只做装饰，不改门/支撑/玩法路径");
}

// ---------- 1136：城墙转角/屋顶边/阳台边 fixture（non-Wang 显式禁配） ----------
{
  const model = createSimpleTiledModel({
    prototypes: EDGE_TRIM_FIXTURE.prototypes.map((p) => ({ ...p })),
    graph: createRectGrid2D({ width: 3, height: 1 }),
  });
  const idx = (k) => model.compiled.variantIndex.get(k);
  // socket 层面 connector 全为 "trim"（Wang 判据下兼容），显式禁配必须生效
  assert.equal(model.table.isCompatible(idx("roof.edge@r0"), "E", idx("balcony.edge@r0")), false, "roof.edge×balcony.edge 显式禁配");
  assert.equal(model.table.isCompatible(idx("balcony.edge@r0"), "E", idx("roof.edge@r0")), false, "禁配双向");
  assert.equal(model.table.isCompatible(idx("roof.edge@r0"), "E", idx("roof.edge@r0")), true, "自配不受禁配影响");
  assert.equal(model.table.isCompatible(idx("wall.corner@r0"), "E", idx("roof.edge@r0")), true, "城墙转角可与屋顶边相邻");

  for (const seed of [1, 2, 3, 4, 5]) {
    const r = solveSimpleTiled({ model, seed });
    assert.equal(r.ok, true, `seed=${seed}`);
    const grid = assignmentGrid(model, r)[0];
    for (let x = 0; x < 2; x++) {
      const pair = [grid[x], grid[x + 1]].sort().join("|");
      assert.notEqual(pair, ["balcony.edge@r0", "roof.edge@r0"].sort().join("|"), "解中屋顶边与阳台边永不相邻");
    }
  }
  // 禁配真的起作用：pin 屋顶边后，阳台边被排除出邻格
  const pinned = solveSimpleTiled({ model, seed: 1, pins: [pin2D(model, 0, 0, "roof.edge@r0")] });
  assert.equal(pinned.ok, true);
  assert.notEqual(pinned.assignmentByCellId["r:1:0"], "balcony.edge@r0");
  // pin 屋顶边+阳台边相邻 → 不可解
  const conflict = solveSimpleTiled({
    model,
    seed: 1,
    pins: [pin2D(model, 0, 0, "roof.edge@r0"), pin2D(model, 1, 0, "balcony.edge@r0")],
  });
  assert.equal(conflict.ok, false, "禁配对 pin 冲突不可解");
  ok("1136：城墙转角/屋顶边/阳台边 fixture——non-Wang 显式禁配覆盖");
}

// ---------- 1138：模型层 partially observed debug 数据 ----------
{
  const model = createSimpleTiledModel({
    prototypes: [tile("t.a", "a"), tile("t.b", "b")],
    graph: createRectGrid2D({ width: 3, height: 1 }),
  });
  // 无 pin：每格 domainSize=2、候选投票 share 合计 1、等权熵 = ln2
  const full = partialObservation({ model });
  assert.equal(full.kind, "partial-observation");
  assert.equal(full.ok, true);
  for (const cell of full.cells) {
    assert.equal(cell.domainSize, 2);
    assert.equal(cell.collapsed, false);
    assert.ok(Math.abs(cell.entropy - Math.log(2)) < 1e-12, "Shannon 熵 = ln2");
    const share = cell.candidates.reduce((s, c) => s + c.share, 0);
    assert.ok(Math.abs(share - 1) < 1e-12, "候选投票 share 合计 1");
    assert.deepEqual(cell.candidates.map((c) => c.variant).sort(), ["t.a@r0", "t.b@r0"]);
  }
  // pin 后部分观察：pinned 格坍缩，邻居经 AC 传播收敛（connector 互斥 → 整行坍缩）
  const partial = partialObservation({ model, pins: [pin2D(model, 0, 0, "t.a@r0")] });
  assert.equal(partial.ok, true);
  assert.equal(partial.cells[0].domainSize, 1);
  assert.equal(partial.cells[0].collapsed, true);
  assert.equal(partial.cells[0].entropy, 0, "坍缩格熵为 0");
  assert.equal(partial.cells[1].domainSize, 1, "AC 传播后邻居收敛到唯一兼容候选");
  assert.equal(partial.cells[1].candidates[0].variant, "t.a@r0");
  // pin 冲突：输出 contradiction，不抛异常
  const contra = partialObservation({ model, pins: [pin2D(model, 0, 0, "t.a@r0"), pin2D(model, 1, 0, "t.b@r0")] });
  assert.equal(contra.ok, false);
  assert.equal(typeof contra.contradiction, "string");
  // 纯数据：不依赖 Three/DOM
  const src = fs.readFileSync(path.join(BASE, "src/procgen/wfc/partialObservation.js"), "utf8");
  assert.ok(!/\bfrom\s+["']three["']|\bwindow\b|\bdocument\b/.test(src));
  ok("1138：partially observed debug 数据——候选投票 / domain size / Shannon 熵，纯数据");
}

console.log(`✅ V7-G4 gap assertions=${passed}`);
