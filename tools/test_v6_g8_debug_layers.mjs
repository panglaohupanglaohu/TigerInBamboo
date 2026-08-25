// V6-G8 调试层数据模型测试：稳定 ID / JSON 可序列化 / 快照不改输入 /
// 生产路径零开销 / 重复快照同 hash / JSON+SVG 导出 / 旧 9 层兼容。
// 运行：node tools/test_v6_g8_debug_layers.mjs
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const BASE = fileURLToPath(new URL("../TigerMessenger/", import.meta.url));
const im = (p) => import(new URL(p, "file://" + BASE).href);

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const {
  V6_G8_LAYER_IDS,
  V6_G8_LAYER_VERSION,
  snapshotV6G8Layers,
  snapshotV6G8Layer,
  createG8DebugSession,
  layerHash,
} = await im("src/render/debug/v6G8Layers.js");
const { layerToSvg, exportLayer } = await im("src/render/debug/v6G8Export.js");
const { DEBUG_LAYER_IDS, snapshotDebugLayers } = await im("src/world/citadel/debugLayers.js");
const { createCitadelBlueprint } = await im("src/world/citadelBlueprint.js");
const { CITADEL_TOWN_SPEC } = await im("src/world/citadelTown.js");
const { compileCitadelV4 } = await im("src/world/citadel/pipeline.js");
const { createRectGrid2D } = await im("src/procgen/graph/rectGrid2d.js");
const { compileVariants } = await im("src/procgen/wfc/socketCompiler.js");
const { compileCompatibilityTable } = await im("src/procgen/wfc/compatibilityTable.js");
const { solveWfc } = await im("src/procgen/wfc/solver.js");
const { WaveState } = await im("src/procgen/wfc/waveState.js");
const { createCombatAgent } = await im("src/agents/citadel/combatAgent.js");
const { createLocalLightRegistry } = await im("src/render/lighting/localLightRegistry.js");
const { createVoxelVolume, computeScalarAo, hashVolume } = await im("src/render/ao/voxelVolume.js");

let passed = 0;
const ok = (msg) => {
  passed++;
  console.log(`  ✓ ${msg}`);
};

// ---------- 测试输入：真实 v4 管线 + 真实 v7 WFC + 真实 registry/volume ----------
const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const v4 = compileCitadelV4(bp, 7);

const F = (connector) => ({ connector, parity: "symmetric" });
const all4 = (c) => ({ N: F(c), E: F(c), S: F(c), W: F(c) });
const proto = (id, faces, weight = 1) => ({ id, family: "fixture", weight, orientationGroup: "NONE", faces });
const OPEN3 = [proto("p.open.1", all4("a"), 1), proto("p.open.2", all4("a"), 2), proto("p.open.3", all4("a"), 3)];
const AB2 = [proto("p.iso.a", all4("a")), proto("p.iso.b", all4("b"))];

const grid = createRectGrid2D({ width: 3, height: 3 });
const compiled = compileVariants(OPEN3);
const table = compileCompatibilityTable(compiled);
// 新鲜 wave（未坍缩，熵有限），供 domain/entropy 层
const weights = new Float64Array(compiled.variants.map((v) => v.weight));
const wlw = new Float64Array(compiled.variants.map((v) => v.weight * Math.log(v.weight)));
const freshWave = new WaveState({
  cellCount: grid.cellCount,
  variantCount: compiled.variants.length,
  weights,
  weightLogWeights: wlw,
  cellIds: grid.cells().map((c) => c.id),
});
const solved = solveWfc({ graph: grid, compiled, table, seed: 42, exposeInternals: true });
assert.ok(solved.ok);

// 冲突 fixture：相邻两 cell 分别 pin 到互不兼容的 a/b → unsatisfiable
const abCompiled = compileVariants(AB2);
const abTable = compileCompatibilityTable(abCompiled);
const keyOf = (pid) => abCompiled.variants.find((v) => v.protoId === pid).key;
const nbr = grid.neighborsOf(0)[0];
const failResult = solveWfc({
  graph: grid,
  compiled: abCompiled,
  table: abTable,
  seed: 42,
  pins: [
    { cell: 0, variant: keyOf("p.iso.a") },
    { cell: nbr.to, variant: keyOf("p.iso.b") },
  ],
});
assert.equal(failResult.ok, false);

// 战斗单位（带黑板威胁读数）
const agents = [
  createCombatAgent({ id: "g8:a", position: { x: 0, y: 0, z: 0 }, surfaceId: "surf:1" }),
  createCombatAgent({ id: "g8:b", role: "torch", position: { x: 1, y: 0, z: 0 }, surfaceId: "surf:1" }),
];
agents[0].blackboard.localThreats = [{ range: 1.5, allyDown: false }];
agents[1].blackboard.localThreats = [{ range: 0.8, allyDown: true }, { range: 3.0, allyDown: false }];

// 局部灯 registry（真实纯逻辑实现）
const registry = createLocalLightRegistry();
registry.register({ id: "torch:1", owner: "keep", intensity: 1, radius: 6, priority: 2, position: [0, 1, 0] });
registry.register({ id: "torch:2", owner: "keep", intensity: 1, radius: 5, priority: 1, position: [2, 1, 0] });
registry.register({ id: "rig:sun", owner: "global", intensity: 1, exception: true });

// AO 体素（真实纯逻辑实现）：中心 2x2x2 实心
const volume = createVoxelVolume({ origin: [0, 0, 0], dims: [4, 4, 4], voxelSize: 1 });
for (const [x, y, z] of [[1, 1, 1], [2, 1, 1], [1, 1, 2], [2, 1, 2], [1, 2, 1], [2, 2, 1], [1, 2, 2], [2, 2, 2]]) {
  volume.occupancy[volume.index(x, y, z)] = 1;
}
volume.solidVoxels = 8;
computeScalarAo(volume, { radius: 2 });

// LightingDirector 只读接口替身（Node 无 three；契约 = getShadowDebugInfo 返回纯数据）
const director = {
  getShadowDebugInfo: () => ({
    mapSize: 2048,
    fit: { span: 40, texel: 0.02, near: 0.1, far: 90, center: [0, 0, 0], sunDirection: [1, -1, 0], reason: "init" },
    lastFitReason: "init",
    focusCount: 2,
    camera: { left: -20, right: 20, top: 20, bottom: -20, near: 0.1, far: 90 },
    shadowType: "paper",
  }),
};

const sources = {
  v4,
  wfc: { wave: freshWave, trail: solved.internals.trail, backtracker: solved.internals.backtracker, result: failResult, stats: solved.stats, solved: v4.town.solver },
  agents,
  lighting: { director, registry },
  ao: { volume },
};
const opts = { camera: { position: [0, 0, -10], forward: [0, 0, 1] }, lightBudget: 1, aoAxis: "z", aoIndex: 1 };

// ---------- 1. 稳定 ID：20 层、冻结、唯一；旧 9 层兼容未动 ----------
{
  assert.equal(V6_G8_LAYER_IDS.length, 20);
  assert.equal(new Set(V6_G8_LAYER_IDS).size, 20);
  assert.ok(Object.isFrozen(V6_G8_LAYER_IDS));
  assert.deepEqual([...DEBUG_LAYER_IDS], [
    "grid-main-dual", "terrain-passes", "uv", "modules", "navigation", "agents", "combat", "performance", "half-edge",
  ]);
  assert.ok(Object.isFrozen(DEBUG_LAYER_IDS));
  // 旧快照函数仍可用
  const old = snapshotDebugLayers(v4, {});
  assert.equal(old.ids, DEBUG_LAYER_IDS);
  ok("20 层稳定 ID 冻结唯一；旧 9 层 ID 原样保留、旧快照函数可用");
}

// ---------- 2. 每层快照：结构 + JSON 可序列化（round-trip 恒等） ----------
{
  const snap = snapshotV6G8Layers(sources, opts);
  assert.deepEqual(Object.keys(snap.layers), [...V6_G8_LAYER_IDS]);
  for (const id of V6_G8_LAYER_IDS) {
    const layer = snap.layers[id];
    assert.equal(layer.id, id);
    assert.equal(layer.version, V6_G8_LAYER_VERSION);
    assert.equal(typeof layer.hash, "string");
    assert.deepEqual(JSON.parse(JSON.stringify(layer)), layer, `${id} JSON round-trip`);
  }
  assert.equal(typeof snap.hash, "string");
  ok("20 层 {id,version,hash,data} 结构齐全，JSON.stringify 往返恒等");
}

// ---------- 3. TODO 五类层的内容抽查（真实数据，非 null 占位处） ----------
{
  const L = snapshotV6G8Layers(sources, opts).layers;
  // (1) WFC
  assert.equal(L["wfc-domain"].data.cells.length, 9);
  assert.equal(L["wfc-domain"].data.totals.collapsed, 0); // 新鲜 wave 全未坍缩
  const ent = L["wfc-entropy"].data;
  assert.equal(ent.cells.length, 9);
  assert.ok(ent.cells.every((c) => Number.isFinite(c.entropy)));
  assert.ok(Math.abs(ent.min - ent.max) < 1e-12); // 全域同分布同熵
  assert.ok(Array.isArray(L["wfc-propagation"].data.edges));
  assert.equal(L["wfc-propagation"].data.stats.bans, solved.stats.bans);
  assert.equal(L["wfc-backtrack"].data.backtrackCount, solved.internals.backtracker.backtrackCount);
  const cf = L["wfc-conflict"].data;
  assert.equal(cf.ok, false);
  assert.equal(cf.reason, "unsatisfiable");
  assert.ok(cf.conflict && cf.suggestedRelaxations.length > 0);
  // (2) 模块 / prop
  const mf = L["module-family"].data;
  assert.equal(Object.values(mf.counts).reduce((a, b) => a + b, 0), mf.total);
  assert.ok(mf.total > 0);
  assert.ok(Object.keys(L["module-variant"].data.variants).length > 0);
  assert.ok(L["prop-slots"].data.totals.slots >= L["prop-slots"].data.totals.placed);
  // clearance/occluded：v4 slot 带这两个字段，与手工统计对账
  const co = L["clearance-occlusion"].data;
  assert.equal(co.evaluated, true);
  const manualBlockedC = v4.town.props.slots.filter((s) => s.clearance < 0.18).length;
  const manualBlockedO = v4.town.props.slots.filter((s) => s.occluded === true).length;
  assert.equal(co.blockedByClearance, manualBlockedC);
  assert.equal(co.blockedByOcclusion, manualBlockedO);
  // (3) 地形
  assert.ok(L["terrain-flow"].data.total > 0);
  assert.ok(L["terrain-flow"].data.vectors.every((v) => Number.isFinite(v.height)));
  assert.ok(Array.isArray(L["terrain-minima"].data.localMinima));
  assert.ok(L["terrain-minima"].data.pools.length > 0);
  assert.ok(L["hard-route"].data.routeCells.length > 0);
  assert.equal(L["hard-route"].data.validation.ok, true);
  assert.ok(L["uv-seam"].data.total > 0);
  assert.equal(L["uv-seam"].data.nonFinite, 0);
  assert.ok(Number.isFinite(L["texel-density"].data.mean));
  assert.ok(L["texel-density"].data.perChart.every((c) => c.density === null)); // 缺口占位
  // (4) 表面 / 单位
  assert.ok(L["nav-portal"].data.portals.length > 0);
  assert.ok(L["nav-portal"].data.byType["waterfall-climb"] >= 1);
  const tm = L["threat-map"].data;
  assert.equal(tm.totals.threats, 3);
  assert.equal(tm.totals.allyDown, 1);
  assert.equal(tm.perSurface[0].minRange, 0.8);
  const ai = L["agent-intent"].data.agents;
  assert.equal(ai.length, 2);
  assert.equal(ai[0].intent, "idle");
  assert.equal(ai[0].targetId, null); // 缺口占位
  assert.equal(ai[0].repathReason, null); // 缺口占位
  // (5) 光照
  const sf = L["shadow-frustum"].data;
  assert.equal(sf.mapSize, 2048);
  assert.equal(sf.fit.texel, 0.02);
  const ao = L["ao-slice"].data;
  assert.deepEqual(ao.dims, [4, 4, 4]);
  assert.equal(ao.volumeHash, hashVolume(volume));
  assert.ok(ao.slice.occupancy.includes(1));
  const lb = L["local-light-budget"].data;
  assert.equal(lb.entries.length, 3);
  assert.equal(lb.budget, 1);
  assert.equal(lb.active.length, 1);
  assert.equal(lb.active[0].lightId, "torch:1"); // 高优先级入选
  assert.equal(lb.overBudget, 1); // 2 个竞争灯 - 预算 1
  ok("五类层内容抽查：WFC/模块/地形/单位/光照均为真实取数，缺口字段为 null");
}

// ---------- 4. 快照不 mutation 输入 ----------
{
  const before = {
    wave: freshWave.waveHash(),
    trailLen: solved.internals.trail.length,
    trailLevel: solved.internals.trail.level,
    backtracks: solved.internals.backtracker.backtrackCount,
    stack: solved.internals.backtracker.stack.length,
    agents: JSON.stringify(agents, (k, v) => (typeof v === "function" ? undefined : v)),
    volume: hashVolume(volume),
    regTick: registry.tick(),
    regCount: registry.list().length,
    townHash: v4.town.hash,
    uvCorners: v4.uv.corners.length,
  };
  snapshotV6G8Layers(sources, opts);
  snapshotV6G8Layers(sources, opts);
  const after = {
    wave: freshWave.waveHash(),
    trailLen: solved.internals.trail.length,
    trailLevel: solved.internals.trail.level,
    backtracks: solved.internals.backtracker.backtrackCount,
    stack: solved.internals.backtracker.stack.length,
    agents: JSON.stringify(agents, (k, v) => (typeof v === "function" ? undefined : v)),
    volume: hashVolume(volume),
    regTick: registry.tick(),
    regCount: registry.list().length,
    townHash: v4.town.hash,
    uvCorners: v4.uv.corners.length,
  };
  assert.deepEqual(after, before);
  ok("快照后 wave hash / trail / backtracker / agents / volume / registry / v4 全部不变");
}

// ---------- 5. 重复快照同输入同 hash；缺源时 null 占位 ----------
{
  const a = snapshotV6G8Layers(sources, opts);
  const b = snapshotV6G8Layers(sources, opts);
  assert.equal(a.hash, b.hash);
  for (const id of V6_G8_LAYER_IDS) assert.equal(a.layers[id].hash, b.layers[id].hash);
  assert.equal(layerHash({ b: 1, a: [2] }), layerHash({ a: [2], b: 1 })); // key 序无关
  const empty = snapshotV6G8Layers({}, {});
  assert.equal(empty.layers["wfc-entropy"].data.cells, null);
  assert.equal(empty.layers["shadow-frustum"].data.mapSize, null);
  assert.equal(empty.layers["ao-slice"].data.volumeHash, null);
  assert.equal(empty.layers["local-light-budget"].data.entries, null);
  ok("重复快照同 hash；canonical hash 与 key 序无关；缺源字段 null 占位");
}

// ---------- 6. 生产路径零开销：关闭时不解引用任何输入 ----------
{
  const session = createG8DebugSession(); // 默认关闭
  assert.equal(session.enabled, false);
  const bomb = new Proxy(
    {},
    {
      get() {
        throw new Error("生产路径不得解引用 sources");
      },
      has() {
        throw new Error("生产路径不得探测 sources");
      },
    }
  );
  assert.equal(session.snapshot(bomb), null);
  assert.equal(session.snapshotLayer("wfc-domain", bomb), null);
  const on = createG8DebugSession({ enabled: true });
  assert.ok(on.snapshot(sources, opts).hash);
  ok("enabled=false 时 snapshot 直接返回 null（Proxy 雷区不炸）；开启后正常");
}

// ---------- 7. 导出：JSON / SVG / PNG 预留 ----------
{
  const snap = snapshotV6G8Layers(sources, opts);
  for (const id of V6_G8_LAYER_IDS) {
    const layer = snap.layers[id];
    const json = exportLayer(layer, "json");
    assert.deepEqual(JSON.parse(json.text).data, layer.data);
    const svg = exportLayer(layer, "svg");
    assert.ok(svg.text.startsWith("<svg") && svg.text.endsWith("</svg>"), `${id} SVG 合法`);
    const png = exportLayer(layer, "png");
    assert.equal(png.data, null);
    assert.ok(png.reason.includes("预留"));
  }
  // 直接 layerToSvg 与 exportLayer 一致
  assert.equal(layerToSvg(snap.layers["wfc-entropy"]), exportLayer(snap.layers["wfc-entropy"], "svg").text);
  assert.throws(() => exportLayer(snap.layers["wfc-domain"], "bmp"));
  assert.throws(() => snapshotV6G8Layer("not-a-layer", sources));
  ok("20 层 JSON/SVG 导出合法；PNG 接口预留返回 reason；非法格式/层 ID 抛错");
}

// ---------- 8. 单文件行数硬约束 ----------
{
  const here = fileURLToPath(new URL(".", import.meta.url));
  for (const f of [
    "../TigerMessenger/src/render/debug/v6G8Layers.js",
    "../TigerMessenger/src/render/debug/v6G8Export.js",
    "../TigerMessenger/src/render/debug/g8Overlay.js",
  ]) {
    const lines = fs.readFileSync(new URL(f, import.meta.url), "utf8").split("\n").length;
    assert.ok(lines <= 601, `${f} ${lines} 行`); // split("\n") 比 wc -l 多 1（尾换行）
  }
  ok("v6G8Layers.js / v6G8Export.js / g8Overlay.js 均 ≤600 行");
}

// ---------- 9. G8 叠图纯逻辑（g8Overlay.js 不 import three 的半区） ----------
{
  const {
    G8_OVERLAY_SUPPORTED,
    heatColor,
    townCellLocal,
    planLayerGeometry,
    buildRuntimeWfcSource,
  } = await im("src/render/debug/g8Overlay.js");

  // heatColor：端点与钳制（浮点近似比较）
  const approxArr = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(approxArr(heatColor(0), [0, 0.2, 1]));
  assert.ok(approxArr(heatColor(1), [1, 0.15, 0.05]));
  assert.deepEqual(heatColor(-5), heatColor(0));
  assert.deepEqual(heatColor(NaN), heatColor(0));

  // townCellLocal：topo 角点均值优先，缺角点走 grid+baseYs 兜底，非法 id → null
  const ctx = {
    cornerOf: (id) => (id === "cell:0:1:0:1" ? { x: 2, y: 4, z: 6 } : null),
    grid: { size: 5, cellSize: 2, cellHeight: 2 },
    baseYs: [10],
  };
  assert.deepEqual(townCellLocal("cell:0:1:0:1", ctx), { x: 2, y: 4.42, z: 6 });
  const fb = townCellLocal("cell:0:3:1:2", ctx);
  assert.deepEqual(fb, { x: (3 - 2) * 2, y: 10 + 1.5 * 2 + 0.42, z: (2 - 2) * 2 });
  assert.equal(townCellLocal("not-a-cell", ctx), null);
  assert.equal(townCellLocal("cell:0:1:0:1", {}), null); // 无角点且无 grid → null

  // wfc-entropy：有限熵 cell → points（citadel 局部空间 + 顶点色）；无 cells → empty+note
  const entPlan = planLayerGeometry("wfc-entropy", {
    cells: [
      { id: "cell:0:1:0:1", domainSize: 3, entropy: 0.5 },
      { id: "cell:0:2:0:1", domainSize: 1, entropy: null }, // 已坍缩不参赛
    ],
    min: 0.5,
    max: 0.5,
  }, ctx);
  assert.equal(entPlan.kind, "points");
  assert.equal(entPlan.space, "citadel");
  assert.equal(entPlan.positions.length, 3);
  assert.equal(entPlan.colors.length, 3);
  const entEmpty = planLayerGeometry("wfc-entropy", { cells: null, min: null, max: null }, ctx);
  assert.equal(entEmpty.kind, "empty");
  assert.ok(entEmpty.note.includes("无 cells"));

  // hard-route：相邻路线格连成段（E/S 去重）；互不相邻 → empty+note
  const hrPlan = planLayerGeometry("hard-route", {
    routeCells: ["cell:0:1:0:1", "cell:0:2:0:1", "cell:0:2:0:2"],
    lockedRoutes: ["cell:0:1:0:1"],
    validation: { ok: true, routes: 1 },
  }, ctx);
  assert.equal(hrPlan.kind, "segments");
  assert.equal(hrPlan.positions.length / 6, 2); // (1,1)-(2,1) 与 (2,1)-(2,2) 两条边
  assert.equal(planLayerGeometry("hard-route", { routeCells: null, lockedRoutes: null }, ctx).kind, "empty");

  // shadow-frustum：camera+fit → 12 边线框（72 个坐标）；缺 camera → empty+note
  const sfPlan = planLayerGeometry("shadow-frustum", {
    mapSize: 2048,
    fit: { span: 40, texel: 0.02, near: 1, far: 9, center: [10, 20, 30], sunDirection: [0, 0, 1], reason: "init" },
    camera: { left: -2, right: 2, top: 3, bottom: -3, near: 1, far: 9 },
  });
  assert.equal(sfPlan.kind, "segments");
  assert.equal(sfPlan.space, "world");
  assert.equal(sfPlan.positions.length, 12 * 2 * 3);
  // 光轴朝 +z 时：近/远平面环 z 跨度 = far-near，且以 center 居中（dist=(near+far)/2）
  const zs = [];
  for (let i = 2; i < sfPlan.positions.length; i += 3) zs.push(sfPlan.positions[i]);
  assert.ok(Math.abs(Math.max(...zs) - 34) < 1e-9); // center 30 + (5-1)
  assert.ok(Math.abs(Math.min(...zs) - 26) < 1e-9); // center 30 - (9-5)
  assert.equal(planLayerGeometry("shadow-frustum", { camera: null }, {}).kind, "empty");

  // local-light-budget：active 暖橙 / inactive 冷灰蓝；active=null 全冷色 + note
  const lbPlan = planLayerGeometry("local-light-budget", {
    entries: [
      { lightId: "a", position: [1, 2, 3] },
      { lightId: "b", position: [4, 5, 6] },
    ],
    active: [{ lightId: "a", score: 1 }],
    budget: 1,
  });
  assert.equal(lbPlan.kind, "points");
  assert.equal(lbPlan.space, "world");
  assert.deepEqual(lbPlan.colors.slice(0, 3), [1, 0.62, 0.2]); // active
  assert.deepEqual(lbPlan.colors.slice(3, 6), [0.35, 0.5, 0.7]); // inactive
  const lbNoActive = planLayerGeometry("local-light-budget", {
    entries: [{ lightId: "a", position: [0, 0, 0] }],
    active: null,
    budget: null,
  });
  assert.equal(lbNoActive.kind, "points");
  assert.ok(lbNoActive.note.includes("active=null"));

  // 未支持几何的层：empty + note（不伪造）
  const unsup = planLayerGeometry("ao-slice", { dims: [4, 4, 4] });
  assert.equal(unsup.kind, "empty");
  assert.ok(unsup.note.includes("暂无几何可视化"));
  assert.deepEqual([...G8_OVERLAY_SUPPORTED], ["wfc-entropy", "hard-route", "shadow-frustum", "local-light-budget"]);

  // buildRuntimeWfcSource：真实 v4 管线 → pin+传播闭包，wave/trail 真实可用
  const wfcSrc = buildRuntimeWfcSource(v4);
  assert.ok(wfcSrc && wfcSrc.wave && wfcSrc.trail);
  assert.ok(wfcSrc.wave.cellCount > 0);
  assert.ok(wfcSrc.trail.records.length > 0); // 至少有 locked-route pin 记录
  assert.ok(wfcSrc.trail.records.some((r) => r.reason === "pin:locked-route"));
  // 接进数据层：wfc-entropy 快照拿到真实有限熵场
  const entLayer = snapshotV6G8Layer("wfc-entropy", { v4, wfc: wfcSrc });
  const finiteCells = entLayer.data.cells.filter((c) => Number.isFinite(c.entropy));
  assert.ok(finiteCells.length > 0);
  assert.ok(Number.isFinite(entLayer.data.min) && Number.isFinite(entLayer.data.max));
  // 叠图计划接得上：熵场 → points（ctx 无 topo 时走 grid 兜底需要 blueprint 不在此，直接给 grid）
  const plan = planLayerGeometry("wfc-entropy", entLayer.data, {
    grid: { size: 25, cellSize: 2, cellHeight: 2 },
    baseYs: [0, 2, 4, 6, 8],
  });
  assert.equal(plan.kind, "points");
  assert.ok(plan.positions.length >= finiteCells.length * 3 - 3);
  assert.equal(buildRuntimeWfcSource(null), null);
  ok("g8Overlay 纯逻辑：热力色/cell 定位/四层图元计划/运行时 WFC 源（真实 pin+传播）");
}

console.log(`\nV6-G8 调试层全部通过（${passed} 组断言）`);
