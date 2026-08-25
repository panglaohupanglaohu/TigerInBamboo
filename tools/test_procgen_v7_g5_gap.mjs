// V7-G5 缺口专项：楼层高度谓词（TODO 1145）、支撑预约束 ban（1146）、
// 语义 exclusion volume（1147）、楼梯 floor portal 对接（1148）、
// column default/boundary 模板（1149）、六类 3D fixture 全原型覆盖（1150）、
// 封死门/倒置屋顶不可解 fixture（1151）、逐层导出 JSON/SVG（1153）。
import assert from "node:assert/strict";
import { createVoxelGrid3D } from "../TigerMessenger/src/procgen/graph/voxelGrid3d.js";
import {
  createVoxelModuleModel,
  solveVoxelModel,
  validateVoxelAssignment,
  validateFloorPortals,
  validateDoorways,
  validateRoofOrientation,
  structuralBans,
} from "../TigerMessenger/src/procgen/wfc/voxelModel3d.js";
import { validateExclusionVolumes } from "../TigerMessenger/src/procgen/constraints/validators.js";
import { createColumnTemplate, instantiateColumnTemplate, mergeSolutionWithTemplate } from "../TigerMessenger/src/procgen/wfc/columnTemplate.js";
import { exportVoxelLayers, voxelLayersToSvg } from "../TigerMessenger/src/procgen/wfc/layerExport.js";
import {
  STRUCTURE3D_PROTOTYPES,
  STRUCTURE3D_SOLVE,
  SEALED_DOOR_FIXTURE,
  INVERTED_ROOF_FIXTURE,
} from "../TigerMessenger/src/procgen/fixtures/structureFixtures3d.js";

const F = (connector, extra = {}) => ({ connector, parity: "symmetric", ...extra });
const proto = (id, faces, rules = {}) => ({
  id, family: "fx", weight: 1, orientationGroup: "NONE",
  faces: { N: F("solid"), E: F("solid"), S: F("solid"), W: F("solid"), ...faces },
  rules,
});

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

// ---------- 1145：楼层高度/最低最高层 predicate ----------
{
  const protos = [
    proto("f.foundation", { U: F("stack", { support: 2 }), D: F("stack") }, { maxFloor: 0 }),
    proto("f.middle", { U: F("stack", { support: 2 }), D: F("stack") }, { minFloor: 0, maxFloor: 1 }),
    proto("f.roof", { U: F("sky"), D: F("stack") }, { minFloor: 2 }),
  ];
  const model = createVoxelModuleModel({
    prototypes: protos,
    graph: createVoxelGrid3D({ width: 2, height: 3, depth: 1 }),
  });
  for (const seed of [1, 2, 3, 7, 42]) {
    const r = solveVoxelModel({ model, seed });
    assert.equal(r.ok, true, `seed=${seed}`);
    for (let x = 0; x < 2; x++) {
      const y0 = r.assignmentByCellId[`v:${x}:0:0`];
      const y2 = r.assignmentByCellId[`v:${x}:2:0`];
      assert.ok(y0 === "f.foundation@r0" || y0 === "f.middle@r0", "地面层不含屋顶");
      assert.equal(y2, "f.roof@r0", "minFloor:2 + 其它 maxFloor → 顶层只能是屋顶");
      assert.ok(!Object.values(r.assignmentByCellId).some((k) => k === "f.roof@r0" && !k), "占位");
    }
    // 屋顶不出现在 0/1 层
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      assert.notEqual(r.assignmentByCellId[`v:${x}:${y}:0`], "f.roof@r0", "屋顶不在低层");
    }
  }
  ok("1145：minFloor/maxFloor 楼层谓词限制屋顶/地基出现位置");
}

// ---------- 1146：支撑不足 variant 预约束 ban（求解前剔除） ----------
{
  const protos = [
    proto("s.weak", { U: F("stack", { support: 1 }), D: F("stack") }),
    proto("s.strong", { U: F("stack", { support: 2 }), D: F("stack") }),
    proto("s.heavy", { U: F("stack", { support: 0 }), D: F("stack") }, { requiresBelow: "bearing>=2" }),
  ];
  const model = createVoxelModuleModel({ prototypes: protos, graph: createVoxelGrid3D({ width: 1, height: 2, depth: 1 }) });
  // 预约束 ban 列表：地面层（无 D 邻居）禁选 s.heavy
  const bans = structuralBans(model);
  const heavyIdx = model.compiled.variantIndex.get("s.heavy@r0");
  assert.ok(
    bans.some((b) => b.cell === "v:0:0:0" && b.variant === heavyIdx && b.reason === "pre-ban:missing-support"),
    "地面层预约束 ban 掉 requiresBelow variant"
  );
  // 兼容表收紧：heavy 的 D 行只剩 strong（bearing>=2）
  const dRow = model.table.compatible["D"][heavyIdx];
  assert.equal(dRow.has(model.compiled.variantIndex.get("s.strong@r0")), true);
  assert.equal(dRow.has(model.compiled.variantIndex.get("s.weak@r0")), false, "support=1 不满足 bearing>=2");
  // pin heavy 到顶层 → 求解前/传播中 weak 被剔除，底层只能是 strong
  for (const seed of [1, 5, 9]) {
    const r = solveVoxelModel({ model, seed, pins: [{ cell: "v:0:1:0", variant: "s.heavy@r0" }] });
    assert.equal(r.ok, true, `seed=${seed}`);
    assert.equal(r.assignmentByCellId["v:0:0:0"], "s.strong@r0", "承重不足者在求解前即被剔除");
    assert.equal(validateVoxelAssignment(model, r).ok, true, "解后校验保留且通过");
  }
  // 地面层 pin heavy → 预约束 ban 直接判不可解（不是解后才发现）
  const bad = solveVoxelModel({ model, seed: 1, pins: [{ cell: "v:0:0:0", variant: "s.heavy@r0" }] });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "unsatisfiable");
  ok("1146：requiresBelow/bearing 预约束 ban + 兼容表收紧（解后校验保留）");
}

// ---------- 1147：门洞/桥洞/楼梯体积/船净空 exclusion volume ----------
{
  const graph = createVoxelGrid3D({ width: STRUCTURE3D_SOLVE.width, height: STRUCTURE3D_SOLVE.height, depth: STRUCTURE3D_SOLVE.depth });
  const model = createVoxelModuleModel({ prototypes: STRUCTURE3D_PROTOTYPES.map((p) => ({ ...p })), graph });
  const r = solveVoxelModel({ model, seed: 13, pins: [...STRUCTURE3D_SOLVE.pins] });
  assert.equal(r.ok, true, JSON.stringify(r.conflict ?? r.reason));
  const variantAt = (i) => model.compiled.variants[r.assignment[i]];
  const volumes = [
    { id: "gate-1", kind: "door-opening", cells: ["v:1:1:0"], allow: (v) => v?.protoId === "v.tower" },
    { id: "arch-1", kind: "bridge-arch", cells: ["v:3:1:0", "v:4:1:0"], allow: (v) => v?.protoId === "v.bridge" },
    { id: "stair-1", kind: "stair-volume", cells: ["v:2:1:0"], allow: (v) => v?.protoId === "v.stairs" },
    { id: "boat-1", kind: "boat-clearance", cells: ["v:0:0:0"], allow: (v) => v?.protoId === "v.foundation" },
  ];
  const good = validateExclusionVolumes({ graph, volumes, variantAt });
  assert.equal(good.ok, true, JSON.stringify(good.issues));
  // 门洞被桥占用 → 违规，issue 带 volume/kind/cell/variant
  const bad = validateExclusionVolumes({
    graph,
    volumes: [{ id: "gate-1", kind: "door-opening", cells: ["v:1:1:0"], allow: (v) => v?.protoId === "v.bridge" }],
    variantAt,
  });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.issues, [
    { code: "exclusion-volume-violated", volume: "gate-1", kind: "door-opening", cell: "v:1:1:0", variant: "v.tower@r0" },
  ]);
  // 未知 cell 如实报告
  const unknown = validateExclusionVolumes({
    graph,
    volumes: [{ id: "ghost", kind: "boat-clearance", cells: ["v:9:9:9"], allow: () => true }],
    variantAt,
  });
  assert.equal(unknown.issues[0].code, "exclusion-volume-unknown-cell");
  ok("1147：门洞/桥洞/楼梯体积/船净空 exclusion volume（语义逐 cell 校验）");
}

// ---------- 1148：楼梯上下端必须接合法 floor portal ----------
{
  const graph = createVoxelGrid3D({ width: STRUCTURE3D_SOLVE.width, height: STRUCTURE3D_SOLVE.height, depth: STRUCTURE3D_SOLVE.depth });
  const model = createVoxelModuleModel({ prototypes: STRUCTURE3D_PROTOTYPES.map((p) => ({ ...p })), graph });
  const r = solveVoxelModel({ model, seed: 13, pins: [...STRUCTURE3D_SOLVE.pins] });
  assert.equal(r.ok, true);
  assert.equal(validateFloorPortals(model, r).ok, true, "fixture 楼梯 portal 链合法");

  // 预约束：stairs 的 U 行只剩 D 面 portal=floor-portal 的 variant（v.roof）
  const stairsIdx = model.compiled.variantIndex.get("v.stairs@r0");
  const uRow = model.table.compatible["U"][stairsIdx];
  const allowed = [];
  model.compiled.variants.forEach((v, i) => { if (uRow.has(i)) allowed.push(v.key); });
  assert.deepEqual(allowed, ["v.roof@r0"], "楼梯上方只接 floor-portal");

  // 解后校验：crafted 楼梯在顶层（无 U 邻居）→ missing-floor-portal
  const g2 = createVoxelGrid3D({ width: 1, height: 2, depth: 1 });
  const m2 = createVoxelModuleModel({ prototypes: STRUCTURE3D_PROTOTYPES.map((p) => ({ ...p })), graph: g2 });
  const idxOf = (k) => m2.compiled.variantIndex.get(k);
  const topStairs = { ok: true, assignment: new Int32Array([idxOf("v.foundation@r0"), idxOf("v.stairs@r0")]) };
  const miss = validateFloorPortals(m2, topStairs);
  assert.equal(miss.ok, false);
  assert.ok(miss.issues.some((i) => i.code === "missing-floor-portal" && i.cell === "v:0:1:0" && i.direction === "U"));
  // 楼梯上方是桥（D 面无 portal）→ wrong-floor-portal
  const aboveBridge = { ok: true, assignment: new Int32Array([idxOf("v.stairs@r0"), idxOf("v.bridge@r0")]) };
  const wrong = validateFloorPortals(m2, aboveBridge);
  assert.ok(wrong.issues.some((i) => i.code === "wrong-floor-portal" && i.direction === "U"));
  // 楼梯下方是桥（U 面无 portal）→ wrong-floor-portal（D 向）
  const belowBridge = { ok: true, assignment: new Int32Array([idxOf("v.bridge@r0"), idxOf("v.stairs@r0")]) };
  assert.ok(validateFloorPortals(m2, belowBridge).issues.some((i) => i.code === "wrong-floor-portal" && i.direction === "D"));
  ok("1148：楼梯上下端 floor portal 对接（预约束兼容表 + 解后校验双闸）");
}

// ---------- 1149：局部 column default/boundary 模板 ----------
{
  const graph = createVoxelGrid3D({ width: 3, height: 2, depth: 1 });
  const template = createColumnTemplate({
    graph,
    defaultColumn: ["v.foundation@r0", "v.roof@r0"],
    columns: { "2,0": ["v.support@r0", null] }, // null = 该层不填模板
  });
  const generated = ["v:0:0:0", "v:0:1:0"]; // 只生成了 x=0 这一列
  const entries = instantiateColumnTemplate(graph, template, generated);
  assert.ok(entries.length > 0);
  for (const e of entries) assert.equal(e.template, true, "模板 cell 必须带 template 标记");
  assert.ok(!entries.some((e) => generated.includes(e.cell)), "模板不覆盖已生成区域");
  assert.ok(!entries.some((e) => e.cell === "v:2:1:0"), "null 层不填模板");
  assert.deepEqual(
    entries.filter((e) => e.cell.startsWith("v:1:")).map((e) => e.variant),
    ["v.foundation@r0", "v.roof@r0"],
    "defaultColumn 逐层填充"
  );
  // 合并：solver 结果权威，模板只补邻域；两者 cell 不重叠
  const fakeResult = { ok: true, assignmentByCellId: { "v:0:0:0": "v.foundation@r0", "v:0:1:0": "v.tower@r0" } };
  const merged = mergeSolutionWithTemplate(fakeResult, entries);
  assert.equal(merged.filter((e) => e.source === "solver").length, 2);
  assert.equal(merged.filter((e) => e.source === "template").length, entries.length);
  assert.ok(merged.every((e) => e.template === (e.source === "template")), "模板与坍缩结果严格可区分");
  // 禁止冒充：模板与 solver 结果重叠即报错
  const overlap = instantiateColumnTemplate(graph, template, []);
  assert.throws(() => mergeSolutionWithTemplate(fakeResult, overlap), /overlaps solver result/);
  ok("1149：column default/boundary 模板——未生成邻域占位且不可冒充坍缩结果");
}

// ---------- 1150：六类 3D fixture，所有原型至少被选中一次 ----------
{
  const graph = createVoxelGrid3D({ width: STRUCTURE3D_SOLVE.width, height: STRUCTURE3D_SOLVE.height, depth: STRUCTURE3D_SOLVE.depth });
  const model = createVoxelModuleModel({ prototypes: STRUCTURE3D_PROTOTYPES.map((p) => ({ ...p })), graph });
  const r = solveVoxelModel({ model, seed: 13, pins: [...STRUCTURE3D_SOLVE.pins] });
  assert.equal(r.ok, true, JSON.stringify(r.conflict ?? r.reason));
  const chosen = new Set(Object.values(r.assignmentByCellId).map((k) => k.split("@")[0]));
  for (const p of STRUCTURE3D_PROTOTYPES) {
    assert.ok(chosen.has(p.id), `原型 ${p.id} 至少被选中一次`);
  }
  assert.equal(chosen.size, 6, "六类原型全部出现");
  // 结构双闸全过
  assert.equal(validateVoxelAssignment(model, r).ok, true);
  assert.equal(validateFloorPortals(model, r).ok, true);
  assert.equal(validateRoofOrientation(model, r).ok, true);
  // 确定性：同 seed 重解同 hash
  const r2 = solveVoxelModel({ model, seed: 13, pins: [...STRUCTURE3D_SOLVE.pins] });
  assert.equal(r2.solutionHash, r.solutionHash);
  ok("1150：tower/foundation/roof/stairs/bridge/support 六类 fixture 全原型覆盖");
}

// ---------- 1151：封死门 / 倒置屋顶不可解 fixture + 原因码 ----------
{
  // 封死门：门 E 面 doorway 被 foundation 封死 → solver 不可解 + 解后 door-blocked
  const sg = SEALED_DOOR_FIXTURE.graph;
  const graph = createVoxelGrid3D({ width: sg.width, height: sg.height, depth: sg.depth });
  const model = createVoxelModuleModel({ prototypes: SEALED_DOOR_FIXTURE.prototypes.map((p) => ({ ...p })), graph });
  const r = solveVoxelModel({ model, seed: 1, pins: [...SEALED_DOOR_FIXTURE.pins] });
  assert.equal(r.ok, false, "封死门 solver 不可解");
  assert.equal(r.hardLocks.length, 3, "pins 保留在 failure 中");
  const idxOf = (k) => model.compiled.variantIndex.get(k);
  const crafted = { ok: true, assignment: new Int32Array([idxOf("v.foundation@r0"), idxOf("v.door@r0"), idxOf("v.foundation@r0")]) };
  const doors = validateDoorways(model, crafted);
  assert.deepEqual(doors.issues, [
    { code: "door-blocked", cell: "v:1:0:0", variant: "v.door@r0", direction: "E" },
  ]);

  // 倒置屋顶：U 面承重、D 面朝天 → solver 不可解 + 解后 inverted-roof
  const ig = INVERTED_ROOF_FIXTURE.graph;
  const igraph = createVoxelGrid3D({ width: ig.width, height: ig.height, depth: ig.depth });
  const imodel = createVoxelModuleModel({ prototypes: INVERTED_ROOF_FIXTURE.prototypes.map((p) => ({ ...p })), graph: igraph });
  const ir = solveVoxelModel({ model: imodel, seed: 1, pins: [{ cell: "v:0:0:0", variant: "v.foundation@r0" }] });
  assert.equal(ir.ok, false, "倒置屋顶无法合法堆叠（D 面 sky 与 stack 不兼容）");
  const iIdx = (k) => imodel.compiled.variantIndex.get(k);
  const iCrafted = { ok: true, assignment: new Int32Array([iIdx("v.foundation@r0"), iIdx("v.roof-inverted@r0")]) };
  const roofs = validateRoofOrientation(imodel, iCrafted);
  assert.deepEqual(roofs.issues, [
    { code: "inverted-roof", cell: "v:0:1:0", variant: "v.roof-inverted@r0", up: "stack", down: "sky" },
  ]);
  // 正向屋顶不误报
  const upGraph = createVoxelGrid3D({ width: 1, height: 2, depth: 1 });
  const upModel = createVoxelModuleModel({ prototypes: STRUCTURE3D_PROTOTYPES.map((p) => ({ ...p })), graph: upGraph });
  const upIdx = (k) => upModel.compiled.variantIndex.get(k);
  const upOk = validateRoofOrientation(upModel, { ok: true, assignment: new Int32Array([upIdx("v.foundation@r0"), upIdx("v.roof@r0")]) });
  assert.equal(upOk.ok, true);
  ok("1151：封死门 door-blocked / 倒置屋顶 inverted-roof 原因码");
}

// ---------- 1153：逐层 occupancy/variant/socket/support heatmap 导出 JSON/SVG ----------
{
  const graph = createVoxelGrid3D({ width: STRUCTURE3D_SOLVE.width, height: STRUCTURE3D_SOLVE.height, depth: STRUCTURE3D_SOLVE.depth });
  const model = createVoxelModuleModel({ prototypes: STRUCTURE3D_PROTOTYPES.map((p) => ({ ...p })), graph });
  const r = solveVoxelModel({ model, seed: 13, pins: [...STRUCTURE3D_SOLVE.pins] });
  assert.equal(r.ok, true);
  const exported = exportVoxelLayers(model, r);
  assert.equal(exported.kind, "voxel-layer-export");
  assert.deepEqual([exported.width, exported.depth, exported.height], [6, 1, 3]);
  assert.equal(exported.layers.length, 3);
  for (const layer of exported.layers) {
    assert.equal(layer.occupancy.length, 6);
    assert.equal(layer.variants.length, 6);
    assert.equal(layer.sockets.length, 6);
    assert.equal(layer.support.length, 6);
    for (const s of layer.sockets) assert.deepEqual(Object.keys(s).sort(), ["D", "E", "N", "S", "U", "W"]);
  }
  // 内容抽查：col0 = foundation/support/tower，support heatmap = U 面 support
  assert.deepEqual(exported.layers[0].variants, Array(6).fill("v.foundation@r0").map((v, i) => (i === 4 ? "v.support@r0" : v)));
  assert.deepEqual(exported.layers[0].occupancy, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(exported.layers[0].support, [2, 2, 2, 2, 2, 2], "foundation/support 的 U 面 support=2");
  assert.equal(exported.layers[0].sockets[0].U, "stack");
  assert.equal(exported.layers[2].sockets[2].U, "sky", "屋顶 U 面 socket 朝天");
  // JSON 可序列化
  const roundTrip = JSON.parse(JSON.stringify(exported));
  assert.equal(roundTrip.layers.length, 3);
  // SVG：每层一张，每 cell 一个 rect，viewBox 尺寸正确
  const svgs = voxelLayersToSvg(exported, 24);
  assert.equal(svgs.length, 3);
  for (const [i, svg] of svgs.entries()) {
    assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));
    assert.equal((svg.match(/<rect /g) || []).length, 6, `layer ${i} 每 cell 一个 rect`);
    assert.ok(svg.includes(`layer y=${i}`));
  }
  ok("1153：逐层 occupancy/variant/socket/support heatmap 导出 JSON + SVG");
}

console.log(`✅ V7-G5 gap assertions=${passed}`);
