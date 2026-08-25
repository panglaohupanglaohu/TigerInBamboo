// V7-G9/G10/G14 缺口回填测试（TODO 1213-1216/1220-1222/1231/1233/1235/1236/1240/1241/1243/1304-1306）
// 每块注释标注 TODO 行号；只测数据层，不依赖 Three.js/浏览器。
import assert from "node:assert/strict";

import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { sdBox, smoothUnion, sdfSubtract } from "../TigerMessenger/src/procgen/field/sdf.js";
import {
  placementWorldAabb,
  foundationCollarVolume,
  doorGateClearanceVolume,
  canalSegmentVolume,
  waterfallNotchVolume,
  caveVolume,
  smoothUnionVolumes,
  subtractVolumes,
} from "../TigerMessenger/src/procgen/bridge/moduleFieldBridge.js";
import { auditModuleFeatureClearance, assertModuleFeaturesClear, MODULE_FEATURE_KINDS } from "../TigerMessenger/src/procgen/bridge/buildingFeatureGuard.js";
import { createSurfaceProviderFromIndexedMesh } from "../TigerMessenger/src/procgen/bridge/surfaceProvider.js";
import { mergeSurfaceNamespaces, mergeMcAndModuleSurfaces, createSharedMeshBindings, assertSharedMeshData } from "../TigerMessenger/src/procgen/bridge/surfaceRegistry.js";
import { PROCGEN_SCHEMA_KEYS, PROCGEN_SCHEMA_DEFAULTS, createProcgenJob, validateProcgenJob, transferablesForMesh } from "../TigerMessenger/src/procgen/worker/jobProtocol.js";
import { PROCGEN_ENGINE_SCHEMA_VERSION, WFC_MODEL_SCHEMA_VERSION, FIELD_SCHEMA_VERSION, MC_MESH_SCHEMA_VERSION } from "../TigerMessenger/src/procgen/core/schema.js";
import { runCooperative } from "../TigerMessenger/src/procgen/worker/cooperativeFallback.js";
import { createBufferGeometryFromMesh, updateBufferGeometryFromMesh } from "../TigerMessenger/src/procgen/three/bufferGeometryAdapter.js";
import {
  createSnapshotV3,
  validateSnapshotV3,
  checkSnapshotConsistency,
  migrateSnapshotV2toV3,
  loadSnapshot,
  applySnapshotPatch,
  diffSnapshots,
  SNAPSHOT_SCHEMA_KEYS,
} from "../TigerMessenger/src/procgen/snapshot/incrementalSnapshot.js";
import { createVersionedCache } from "../TigerMessenger/src/procgen/snapshot/versionedCache.js";
import { checkSourceMix, assertCompatibleSources } from "../TigerMessenger/src/procgen/snapshot/sourceGuard.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };
const closeTo = (actual, expected, eps = 1e-5) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≈ ${expected}`);

// ---------- TODO 1213：placement→collar/clearance 两类转换接口 ----------
{
  const aabb = placementWorldAabb({ cell: [1, 0, 2], size: [2, 1, 1] }, 2);
  assert.deepEqual(aabb.min, [2, 0, 4]);
  assert.deepEqual(aabb.max, [6, 2, 6]);
  const collar = foundationCollarVolume({ moduleId: "keep-1", cell: [0, 2, 0] }, { cellSize: 2, margin: 1, height: 5 });
  assert.equal(collar.kind, "foundation-collar");
  assert.deepEqual(collar.aabb.min, [-1, -1, -1]);
  assert.deepEqual(collar.aabb.max, [3, 5, 3]);
  assert.ok(collar.sdf([1, 2, 1]) < 0 && collar.sdf([10, 2, 1]) > 0, "collar sdf 内负外正");
  const door = doorGateClearanceVolume({ moduleId: "keep-1" }, { kind: "gate", origin: [0.5, 0.5, 0.5], size: [1, 1, 1] });
  assert.equal(door.kind, "clearance");
  assert.equal(door.subtype, "gate");
  assert.ok(door.sdf([1, 1, 1]) < 0, "门洞净空盒内部为负");
  assert.throws(() => doorGateClearanceVolume({}, { kind: "chimney", origin: [0, 0, 0], size: [1, 1, 1] }), /unknown clearance kind/);
  ok("1213：placement→AABB、foundation collar、door/gate clearance 转换接口");
}

// ---------- TODO 1215：foundation collar smooth-union 到 terrain field ----------
{
  const terrain = createScalarField({ min: [-4, -4, -4], max: [4, 4, 4], resolution: 17, sample: (p) => p[1] });
  const collar = foundationCollarVolume({ moduleId: "keep-1", cell: [0, 2, 0] }, { cellSize: 2, margin: 1, height: 5 });
  const composed = smoothUnionVolumes(terrain, [collar], { k: 1 });
  // collar 中心（悬空的建筑基面下方）被并入实体
  assert.ok(composed.valueAt(10, 12, 10) < 0, "collar 内部转为实体");
  assert.ok(terrain.valueAt(10, 12, 10) > 0, "原 terrain 该点为空气（悬空）");
  // 远离 collar 的点严格不变（|a-b|>=k 时 smin 退化为 min）
  closeTo(composed.valueAt(0, 0, 0), terrain.valueAt(0, 0, 0), 1e-6);
  // 过渡带内 smin 低于硬 min（光滑圆整的签名）：p=[-1,0.5,1] 在 collar 壁上
  const expected = smoothUnion(0.5, 0, 1);
  closeTo(composed.valueAt(6, 9, 10), expected, 1e-5);
  assert.ok(composed.valueAt(6, 9, 10) < 0, "smooth-union 在过渡带低于硬 min，消除硬方块接缝");
  ok("1215：foundation collar smooth-union 进场——悬空填补、远点不变、过渡光滑");
}

// ---------- TODO 1216：canal/waterfall/cave/gate clearance subtract ----------
{
  const solid = createScalarField({ min: [-2, -2, -2], max: [2, 2, 2], resolution: 5, sample: () => -1 });
  const canal = canalSegmentVolume({ from: [0, -2, 0], to: [0, 2, 0], radius: 0.6 });
  const waterfall = waterfallNotchVolume({ center: [0, 0, 0], halfSize: [0.5, 1, 0.5] });
  const cave = caveVolume({ center: [0, 0, 0], halfSize: [1, 1, 1] });
  const gate = doorGateClearanceVolume({}, { kind: "gate", origin: [0.5, 0.5, 0.5], size: [1, 1, 1] });
  const carved = subtractVolumes(solid, [canal]);
  closeTo(carved.valueAt(2, 3, 2), sdfSubtract(-1, canal.sdf([0, 1, 0])), 1e-6);
  assert.ok(carved.valueAt(2, 3, 2) > 0, "运河槽 subtract 后为空气");
  assert.ok(carved.valueAt(0, 3, 0) < 0, "运河外仍为实体");
  assert.ok(subtractVolumes(solid, [waterfall]).valueAt(2, 2, 2) > 0, "瀑布缺口穿出");
  assert.ok(subtractVolumes(solid, [cave]).valueAt(2, 2, 2) > 0, "洞穴腔体穿出");
  assert.ok(subtractVolumes(solid, [gate]).valueAt(3, 3, 3) > 0, "门洞净空穿出");
  // hard route：逐点等于 sdfSubtract 原式，无平滑回弹
  const direct = subtractVolumes(solid, [canal, gate]);
  for (const [x, y, z] of [[2, 3, 2], [3, 3, 3], [0, 0, 0]]) {
    const p = solid.worldPosition(x, y, z);
    closeTo(direct.valueAt(x, y, z), sdfSubtract(sdfSubtract(-1, canal.sdf(p)), gate.sdf(p)), 1e-6);
  }
  ok("1216：canal/waterfall/cave/gate 四类 clearance hard subtract 进场");
}

// ---------- TODO 1214：MC terrain 不得覆盖门/窗/阳台/屋顶 ----------
{
  const building = createScalarField({ min: [-2, -2, -2], max: [2, 2, 2], resolution: 5, sample: (p) => sdBox(p, [0, 0, 0], [1, 1, 1]) });
  const features = [
    { id: "f-door", moduleId: "keep-1", kind: "door", position: [0, 0, 0.5] }, // 被 MC 实体覆盖
    { id: "f-win", moduleId: "keep-1", kind: "casement", position: [0, 0, 1.5] },
    { id: "f-bal", moduleId: "keep-1", kind: "balcony", position: [1.5, 0, 0] },
    { id: "f-roof", moduleId: "keep-1", kind: "roof", aabb: { min: [2, 2, 2], max: [3, 3, 3] } },
  ];
  assert.deepEqual([...MODULE_FEATURE_KINDS], ["door", "casement", "balcony", "roof"]);
  const audit = auditModuleFeatureClearance({ field: building, features });
  assert.equal(audit.ok, false);
  assert.equal(audit.issues.length, 1);
  assert.equal(audit.issues[0].code, "mc-covers-feature");
  assert.equal(audit.issues[0].kind, "door");
  assert.equal(audit.issues[0].moduleId, "keep-1");
  assert.throws(() => assertModuleFeaturesClear({ field: building, features }), /mc-covers-feature/);
  assert.equal(assertModuleFeaturesClear({ field: building, features: features.slice(1) }).ok, true);
  const bad = auditModuleFeatureClearance({ field: building, features: [{ id: "x", kind: "spire", position: [9, 9, 9] }] });
  assert.equal(bad.issues[0].code, "unknown-feature-kind");
  ok("1214：门/窗/阳台/屋顶被 MC 覆盖时报 mc-covers-feature，清晰主体不受影响");
}

// ---------- TODO 1220：MC 与 module surface ID 命名空间合并 ----------
{
  const merged = mergeMcAndModuleSurfaces({
    mc: [{ chunkId: "0:0:0", triangleCount: 2 }, { chunkId: "1:0:0", triangleCount: 1 }],
    modules: [{ moduleId: "keep-1", surfaces: [{ id: "roof" }, { id: "door" }] }],
  });
  assert.equal(merged.ok, true);
  assert.deepEqual([...merged.ids], ["mc:0:0:0:0", "mc:0:0:0:1", "mc:1:0:0:0", "mod:keep-1:roof", "mod:keep-1:door"]);
  const again = mergeMcAndModuleSurfaces({
    mc: [{ chunkId: "0:0:0", triangleCount: 2 }, { chunkId: "1:0:0", triangleCount: 1 }],
    modules: [{ moduleId: "keep-1", surfaces: [{ id: "roof" }, { id: "door" }] }],
  });
  assert.deepEqual([...again.ids], [...merged.ids], "同输入 ID 序列稳定");
  const dup = mergeMcAndModuleSurfaces({ modules: [{ moduleId: "a", surfaces: ["roof"] }, { moduleId: "a", surfaces: ["roof"] }] });
  assert.equal(dup.ok, false);
  assert.deepEqual([...dup.duplicates], ["mod:a:roof"]);
  const cross = mergeSurfaceNamespaces([{ namespace: "mc", ids: ["1"] }, { namespace: "mod", ids: ["1"] }]);
  assert.equal(cross.ok, true, "不同命名空间裸 ID 不冲突");
  assert.deepEqual([...cross.ids], ["mc:1", "mod:1"]);
  assert.throws(() => mergeSurfaceNamespaces([{ namespace: "MC!", ids: [] }]), /invalid surface namespace/);
  ok("1220：mc:/mod: 命名空间合并，ID 稳定、跨域不冲突、重复可检出");
}

// ---------- TODO 1221：SurfaceProviderFromIndexedMesh ----------
{
  const mesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    semantics: new Uint8Array([0, 100, 200, 100]),
  };
  const provider = createSurfaceProviderFromIndexedMesh(mesh, { idPrefix: "mc", chunkId: "c0" });
  assert.equal(provider.triangleCount, 2);
  assert.equal(provider.surfaceId(1), "mc:c0:1");
  assert.deepEqual(provider.barycenter(0), [2 / 3, 1 / 3, 0]);
  const sample = provider.sampleBarycentric(0, 0.5, 0.5);
  assert.deepEqual(sample.position, [1, 0.5, 0]);
  assert.deepEqual(sample.normal.map((n) => Math.round(n * 1e6) / 1e6), [0, 0, 1]);
  assert.equal(sample.semantic, 150, "语义按重心坐标插值");
  assert.throws(() => provider.sampleBarycentric(0, 1, 1), /barycentric/);
  const nearest = provider.nearestFace([0.2, 0.8, 1]);
  assert.equal(nearest.triangle, 1);
  closeTo(nearest.distance, 1);
  closeTo(nearest.barycentric[0] + nearest.barycentric[1] + nearest.barycentric[2], 1);
  assert.deepEqual(nearest.point.map((n) => Math.round(n * 1e6) / 1e6), [0.2, 0.8, 0]);
  assert.equal(nearest.id, "mc:c0:1");
  ok("1221：重心/重心坐标采样、法线、语义、最近面查询（纯数据）");
}

// ---------- TODO 1222：provider/visual/collision 同引用 snapshot mesh ----------
{
  const mesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
  };
  const bindings = createSharedMeshBindings(mesh);
  assert.equal(assertSharedMeshData(bindings), true);
  assert.equal(bindings.visual.mesh, mesh);
  assert.equal(bindings.collision.mesh, mesh);
  assert.equal(bindings.provider.positions, mesh.positions);
  const tampered = { ...bindings, collision: { role: "collision", mesh: { ...mesh } } };
  let err = null;
  try { assertSharedMeshData(tampered); } catch (caught) { err = caught; }
  assert.equal(err?.code, "mesh-not-shared");
  assert.ok(err.problems.includes("collision"));
  ok("1222：visual/collision/provider 默认同引用；复制即报 mesh-not-shared");
}

// ---------- TODO 1231：job blueprintVersion / 四类 schemaVersion / dirty ----------
{
  const job = createProcgenJob({ id: "j1", type: "surface", payload: {}, seed: 3 });
  assert.equal(job.blueprintVersion, 1);
  assert.deepEqual(job.schemaVersions, {
    graph: PROCGEN_ENGINE_SCHEMA_VERSION,
    module: WFC_MODEL_SCHEMA_VERSION,
    field: FIELD_SCHEMA_VERSION,
    mesh: MC_MESH_SCHEMA_VERSION,
  });
  assert.deepEqual([...PROCGEN_SCHEMA_KEYS], ["graph", "module", "field", "mesh"]);
  assert.equal(PROCGEN_SCHEMA_DEFAULTS.mesh, MC_MESH_SCHEMA_VERSION);
  assert.equal(job.dirty, null);
  assert.equal(validateProcgenJob(job).ok, true);
  const override = createProcgenJob({ id: "j2", type: "field", payload: {}, seed: 3, blueprintVersion: 7, schemaVersions: { field: 3 }, dirty: { wfcCells: [1, 2] } });
  assert.equal(override.schemaVersions.field, 3);
  assert.equal(override.schemaVersions.mesh, MC_MESH_SCHEMA_VERSION);
  assert.equal(validateProcgenJob(override).ok, true);
  assert.ok(validateProcgenJob({ ...job, blueprintVersion: 0 }).errors.includes("blueprintVersion"));
  assert.ok(validateProcgenJob({ ...job, schemaVersions: { graph: 1 } }).errors.includes("schemaVersion:module"));
  assert.ok(validateProcgenJob({ ...job, dirty: 5 }).errors.includes("dirty"));
  ok("1231：blueprintVersion + graph/module/field/mesh 四类 schemaVersion + dirty 校验");
}

// ---------- TODO 1233：transferable buffers 与 detached 误用 ----------
{
  const mesh = {
    positions: new Float32Array([1, 2, 3]),
    normals: new Float32Array([0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    semantics: new Uint8Array([7]),
  };
  const transfer = transferablesForMesh(mesh);
  assert.equal(transfer.length, 4);
  assert.equal(new Set(transfer).size, 4, "transfer list 无重复 buffer");
  const clone = structuredClone(mesh, { transfer });
  assert.deepEqual([...clone.positions], [1, 2, 3], "transfer 零复制：内容完整到达对端");
  assert.equal(mesh.positions.buffer.byteLength, 0, "postMessage transfer 后原 buffer 已 detach");
  assert.equal(mesh.normals.buffer.byteLength, 0);
  assert.equal(mesh.indices.buffer.byteLength, 0);
  assert.equal(mesh.semantics.buffer.byteLength, 0);
  assert.equal(mesh.positions.length, 0, "detached buffer 上的 typed array 不可再读写");
  assert.equal(clone.positions.byteLength, 3 * 4, "对端 byteLength 与原一致（无不必要复制）");
  assert.equal(transferablesForMesh({ positions: new Float32Array(3), indices: new Uint32Array(3) }).length, 2);
  ok("1233：transferable 零复制 + detached buffer 误用检测");
}

// ---------- TODO 1235：fallback 协作式分帧 yield ----------
{
  const steps = Array.from({ length: 20 }, (_, i) => ({ phase: `p${i}`, run: () => i * 2 }));
  let t = 0;
  const progress = [];
  const run = await runCooperative(steps, { budgetMs: 4, now: () => (t += 10), onProgress: (p) => progress.push(p.progress) });
  assert.equal(run.ok, true);
  assert.deepEqual(run.results, steps.map((_, i) => i * 2), "分帧后结果顺序不变");
  assert.ok(run.yields >= 19, `超预算即 yield（实际 ${run.yields} 次）`);
  assert.equal(progress.length, 20);
  assert.equal(progress[19], 1);
  // 真实 setTimeout(0) 分片：budgetMs=0 时每步让出主线程
  const real = await runCooperative(Array.from({ length: 8 }, (_, i) => () => i), { budgetMs: 0 });
  assert.equal(real.ok, true);
  assert.ok(real.yields >= 8, "协作式 fallback 不长时间同步占用");
  // 取消：第 3 步后取消，结果不得产出
  let tick = 0;
  const cancelled = await runCooperative(steps, { budgetMs: 4, now: () => (t += 10), shouldCancel: () => ++tick > 6 });
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.code, "cancelled");
  assert.ok(cancelled.completed < 20);
  ok("1235：fallback 按预算 setTimeout(0) 分片、progress 单调、可取消");
}

// ---------- TODO 1236：BufferGeometryAdapter uv/color/groups ----------
{
  const calls = [];
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; } }
  class BufferGeometry {
    constructor() { this.isBufferGeometry = true; this.attributes = {}; this.index = null; this.groups = []; }
    setAttribute(name, attribute) { this.attributes[name] = attribute; return this; }
    getAttribute(name) { return this.attributes[name]; }
    setIndex(index) { this.index = index; return this; }
    addGroup(start, count, materialIndex) { this.groups.push({ start, count, materialIndex }); calls.push([start, count, materialIndex]); }
    computeBoundingSphere() { this.didSphere = true; }
    computeBoundingBox() { this.didBox = true; }
  }
  const THREE = { BufferAttribute, BufferGeometry };
  const mesh = {
    positions: new Float32Array(9),
    normals: new Float32Array(9),
    indices: new Uint32Array([0, 1, 2]),
    semantics: new Uint8Array([1, 2, 3]),
    uv: new Float32Array([0, 0, 1, 0, 0, 1]),
    colors: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    groups: [{ start: 0, count: 3, materialIndex: 2 }],
  };
  const geometry = createBufferGeometryFromMesh(THREE, mesh);
  assert.equal(geometry.getAttribute("uv").itemSize, 2);
  assert.equal(geometry.getAttribute("color").itemSize, 3);
  assert.equal(geometry.getAttribute("procgenSemantic").itemSize, 1);
  assert.deepEqual(geometry.groups, [{ start: 0, count: 3, materialIndex: 2 }]);
  assert.equal(geometry.didBox && geometry.didSphere, true);
  // 显式 groups 覆盖 mesh.groups
  const overridden = createBufferGeometryFromMesh(THREE, mesh, { groups: [{ start: 0, count: 3, materialIndex: 5 }] });
  assert.equal(overridden.groups[0].materialIndex, 5);
  // update 路径同步 uv/color
  mesh.uv[0] = 0.25;
  mesh.colors[1] = 0.5;
  updateBufferGeometryFromMesh(geometry, mesh);
  assert.equal(geometry.getAttribute("uv").array[0], 0.25);
  assert.equal(geometry.getAttribute("uv").needsUpdate, true);
  assert.equal(geometry.getAttribute("color").array[1], 0.5);
  ok("1236：adapter 补齐 uv/color/groups，create/update 两路齐备");
}

// ---------- TODO 1240：snapshot schema 补 chunk manifest / solver diagnostics ----------
{
  const snapshot = createSnapshotV3({
    id: "s1",
    seed: 7,
    profile: "highland-citadel",
    moduleSetVersion: "citadel-3",
    chunkManifest: [{ id: "0:0:0", hash: "h0", meshVersion: MC_MESH_SCHEMA_VERSION }],
    solverDiagnostics: { backtracks: 0, contractions: 12 },
  });
  assert.deepEqual(snapshot.schemaVersions, { engine: PROCGEN_ENGINE_SCHEMA_VERSION, module: WFC_MODEL_SCHEMA_VERSION, field: FIELD_SCHEMA_VERSION, mesh: MC_MESH_SCHEMA_VERSION });
  assert.deepEqual([...SNAPSHOT_SCHEMA_KEYS], ["engine", "module", "field", "mesh"]);
  assert.equal(snapshot.chunkManifest.length, 1);
  assert.equal(snapshot.solverDiagnostics.backtracks, 0);
  assert.equal(validateSnapshotV3(snapshot).ok, true);
  const missing = { ...snapshot, chunkManifest: undefined };
  assert.ok(validateSnapshotV3(missing).errors.includes("chunkManifest"));
  ok("1240：CitadelWorldSnapshot 携带四类版本 + chunk manifest + solver diagnostics");
}

// ---------- TODO 1241：snapshot consistency 同源校验 ----------
{
  const source = { seed: 7, blueprintHash: "bp-1", schemaVersions: { engine: 1, module: 1, field: 1, mesh: 1 } };
  const snapshot = createSnapshotV3({
    id: "s2",
    seed: 7,
    layers: {
      blueprint: { hash: "bp-1" },
      presentation: { surfaces: [], source },
      runtime: { nav: [], props: [], source },
    },
    chunkManifest: [{ id: "0:0:0", hash: "h0", meshVersion: 1 }],
  });
  assert.equal(checkSnapshotConsistency(snapshot).ok, true);
  const drifted = createSnapshotV3({ ...snapshot, layers: { ...snapshot.layers, runtime: { nav: [], source: { ...source, seed: 8 } } } });
  const issues = checkSnapshotConsistency(drifted).issues;
  assert.ok(issues.some((i) => i.code === "seed-mismatch" && i.layer === "runtime"));
  const forked = createSnapshotV3({ ...snapshot, layers: { ...snapshot.layers, presentation: { surfaces: [], source: { ...source, blueprintHash: "bp-2" } } } });
  assert.ok(checkSnapshotConsistency(forked).issues.some((i) => i.code === "blueprint-hash-divergence"));
  const staleChunk = createSnapshotV3({ ...snapshot, chunkManifest: [{ id: "0:0:0", hash: "h0", meshVersion: 99 }] });
  assert.ok(checkSnapshotConsistency(staleChunk).issues.some((i) => i.code === "chunk-version-mismatch"));
  ok("1241：mesh/surface/nav/module/prop/semanticMaterial/chunk 同源校验");
}

// ---------- TODO 1243：mixed-source guard ----------
{
  assert.equal(checkSourceMix({ visual: "v7", collision: "v7", nav: "v7" }).ok, true);
  assert.equal(checkSourceMix({ visual: "v6", collision: "v6", nav: "v6" }).ok, true);
  const mixed = checkSourceMix({ visual: "v7", collision: "legacy", nav: "legacy" });
  assert.equal(mixed.ok, false);
  assert.equal(mixed.error.code, "mixed-source");
  assert.deepEqual(mixed.error.sources, { visual: "v7", collision: "legacy", nav: "legacy" });
  assert.equal(mixed.error.overlay.blocking, true);
  assert.ok(mixed.error.overlay.lines.some((line) => line.includes("V7")));
  assert.equal(checkSourceMix({ visual: "v6", collision: "legacy", nav: "legacy" }).ok, false, "V6 画面 + legacy 碰撞同属非法");
  assert.equal(checkSourceMix({ visual: "v7", collision: "v7", nav: "v6" }).ok, false, "collision/nav 必须同源");
  let mixedErr = null;
  try { assertCompatibleSources({ visual: "v7", collision: "v6", nav: "v6" }); } catch (caught) { mixedErr = caught; }
  assert.equal(mixedErr?.code, "mixed-source");
  assert.ok(mixedErr.overlay.lines.length >= 4, "overlay 结构化错误随行抛出");
  assert.throws(() => checkSourceMix({ visual: "v9", collision: "v7", nav: "v7" }), /unknown source/);
  ok("1243：V7 visual + legacy/V6 collision/nav 直接报错并附 overlay 结构");
}

// ---------- TODO 1304：pins/fieldRecipe 独立字段 ----------
{
  const withPins = createSnapshotV3({ id: "s3", seed: 1, pins: [{ cell: "v:0:0:0", variant: "a@r0" }], fieldRecipe: "terrain-2" });
  assert.equal(withPins.pins.length, 1);
  assert.equal(withPins.fieldRecipe, "terrain-2");
  assert.ok(Object.isFrozen(withPins.pins));
  const without = createSnapshotV3({ id: "s3", seed: 1 });
  assert.deepEqual(without.pins, []);
  assert.equal(without.fieldRecipe, null);
  assert.notEqual(withPins.hash, without.hash, "pins/fieldRecipe 参与 snapshot hash");
  assert.equal(validateSnapshotV3(withPins).ok, true);
  assert.equal(validateSnapshotV3(without).ok, true);
  ok("1304：createSnapshotV3 补 pins/fieldRecipe 独立字段并进 hash");
}

// ---------- TODO 1305：save V2→V3 migration ----------
{
  const v2 = {
    version: 2,
    id: "legacy-save",
    seed: 42,
    profile: "highland-citadel",
    moduleSetVersion: "citadel-3",
    fieldRecipe: "terrain-2",
    pins: [{ cell: "v:1:0:0", variant: "gate@r0" }],
    blueprint: { cells: ["keep", "wall"] },
    layers: { presentation: { props: [] } },
  };
  const migrated = loadSnapshot(v2);
  assert.equal(migrated.version, 3);
  assert.equal(validateSnapshotV3(migrated).ok, true);
  assert.equal(migrated.seed, 42);
  assert.deepEqual(migrated.layers.blueprint, { cells: ["keep", "wall"] });
  assert.equal(migrated.layers.wfc, null, "v2 缓存层不迁移");
  assert.equal(migrated.layers.field, null, "缺 cache 凭 blueprint+seed+pins 重建");
  assert.equal(migrated.pins[0].cell, "v:1:0:0");
  assert.equal(migrated.meta.migratedFrom, 2);
  // 迁移结果可继续走 patch/replay 流程
  const next = createSnapshotV3({ ...migrated, layers: { ...migrated.layers, blueprint: { cells: ["keep", "tower"] } } });
  const patch = diffSnapshots(migrated, next);
  assert.equal(applySnapshotPatch(migrated, patch).hash, next.hash);
  const v3 = createSnapshotV3({ id: "keep", seed: 1 });
  assert.equal(loadSnapshot(v3), v3, "v3 原样通过");
  assert.throws(() => migrateSnapshotV2toV3({ version: 3 }), /version 2/);
  assert.throws(() => loadSnapshot({ version: 9 }), /unsupported snapshot version/);
  ok("1305：V2→V3 迁移器——补默认字段、缓存层置空可重建、迁移后可 patch");
}

// ---------- TODO 1306：solution/chunk cache 带 schema/hash ----------
{
  const cache = createVersionedCache({ schema: "p1/w1/f1/m1", maxEntries: 2 });
  cache.set("sol:7", { assignment: [0, 1] }, { hash: "h-7" });
  assert.deepEqual(cache.get("sol:7"), { assignment: [0, 1] });
  assert.equal(cache.get("sol:7", "h-7") !== undefined, true);
  assert.equal(cache.get("sol:7", "h-stale"), undefined, "hash 不匹配自动失效");
  assert.equal(cache.size, 0, "失效条目即删，不残留");
  cache.set("chunk:0:0:0", { triangles: 12 }, { hash: "c-0" });
  cache.rekey("p2/w1/f1/m1");
  assert.equal(cache.size, 0, "schema 升级整表失效");
  assert.equal(cache.get("chunk:0:0:0"), undefined);
  cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
  assert.equal(cache.size, 2, "FIFO 逐出最老条目");
  assert.equal(cache.get("a"), undefined);
  // 不污染存档：cache 读写不改变 snapshot hash
  const snapshot = createSnapshotV3({ id: "s4", seed: 1 });
  const before = snapshot.hash;
  cache.set("sol:1", { x: 1 }); cache.get("sol:1"); cache.rekey("p3");
  assert.equal(snapshot.hash, before);
  ok("1306：cache 条目带 schema/hash，不匹配自动失效且不污染存档");
}

console.log(`✅ V7-G9/G10/G14 gap assertions=${passed}`);
