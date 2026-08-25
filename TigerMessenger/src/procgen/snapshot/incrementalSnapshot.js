// =====================================================================
// Incremental snapshot / replay（V7-G14）
// Procgen 存档 V3 分层：blueprint、wfc、field、presentation、runtime。
// 脏层只重写对应 payload；replay 通过稳定 JSON 保证同 seed 可复现。
// =====================================================================

import { hashHex } from "../../core/rng.js";
import { PROCGEN_ENGINE_SCHEMA_VERSION, WFC_MODEL_SCHEMA_VERSION, FIELD_SCHEMA_VERSION, MC_MESH_SCHEMA_VERSION } from "../core/schema.js";

export const PROCGEN_SNAPSHOT_VERSION = 3;
export const SNAPSHOT_LAYERS = Object.freeze(["blueprint", "wfc", "field", "presentation", "runtime"]);
// 编辑器粒度与存档层分开：一个 blueprint 改动可以只使局部 WFC/field/
// derived surface 脏，不得因此把整座城堡标记为重编。
export const SNAPSHOT_DIRTY_KINDS = Object.freeze([
  "wfcCells", "fieldChunks", "derivedSurfaces", "nav", "props", "AO", "shadow",
]);
// engine/module/field/mesh 四类版本与 core/schema.js 常量同源（TODO 1240）
export const SNAPSHOT_SCHEMA_KEYS = Object.freeze(["engine", "module", "field", "mesh"]);
export const SNAPSHOT_SCHEMA_DEFAULTS = Object.freeze({
  engine: PROCGEN_ENGINE_SCHEMA_VERSION,
  module: WFC_MODEL_SCHEMA_VERSION,
  field: FIELD_SCHEMA_VERSION,
  mesh: MC_MESH_SCHEMA_VERSION,
});

export class DirtyLayerTracker {
  constructor() { this.dirty = new Set(); this.regions = new Map(); }
  mark(...layers) {
    for (const layer of layers.flat()) if (SNAPSHOT_LAYERS.includes(layer) || SNAPSHOT_DIRTY_KINDS.includes(layer)) this.dirty.add(layer);
    return this;
  }
  markRegion(kind, ids = []) {
    if (!SNAPSHOT_DIRTY_KINDS.includes(kind)) throw new Error(`unknown dirty kind: ${kind}`);
    this.dirty.add(kind);
    const values = this.regions.get(kind) || new Set();
    for (const id of Array.isArray(ids) ? ids : [ids]) if (id != null) values.add(String(id));
    this.regions.set(kind, values);
    return this;
  }
  has(layer) { return this.dirty.has(layer); }
  consume() { const value = [...this.dirty]; this.dirty.clear(); this.regions.clear(); return value; }
  consumeDetailed() {
    const value = { layers: [...this.dirty], regions: Object.fromEntries([...this.regions].map(([kind, ids]) => [kind, [...ids].sort()])) };
    this.dirty.clear(); this.regions.clear();
    return value;
  }
  clear() { this.dirty.clear(); this.regions.clear(); return this; }
  get size() { return this.dirty.size; }
}

export function createDirtyRegionPlan({ wfcCells = [], fieldChunks = [], derivedSurfaces = [], nav = [], props = [], AO = [], shadow = [] } = {}) {
  const tracker = new DirtyLayerTracker();
  for (const [kind, ids] of Object.entries({ wfcCells, fieldChunks, derivedSurfaces, nav, props, AO, shadow })) tracker.markRegion(kind, ids);
  return tracker.consumeDetailed();
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

export function stableSnapshotString(value) { return JSON.stringify(canonical(value)); }

export function createSnapshotV3({ id = "snapshot", seed = 0, profile, moduleSetVersion, fieldRecipe = null, pins = [], layers = {}, meta = {}, schemaVersions = {}, chunkManifest = [], solverDiagnostics = null } = {}) {
  const payload = Object.fromEntries(SNAPSHOT_LAYERS.map((layer) => [layer, layers[layer] ?? null]));
  const snapshot = {
    version: PROCGEN_SNAPSHOT_VERSION,
    id,
    seed: seed >>> 0,
    profile,
    moduleSetVersion,
    fieldRecipe, // 独立字段（TODO 1304）：不依赖缓存即可重建 field
    pins: Object.freeze([...pins]), // 独立字段（TODO 1304）：用户显式 pin
    schemaVersions: Object.freeze(Object.fromEntries(SNAPSHOT_SCHEMA_KEYS.map((key) => [key, schemaVersions[key] ?? SNAPSHOT_SCHEMA_DEFAULTS[key]]))),
    chunkManifest: Object.freeze(chunkManifest.map((chunk) => Object.freeze({ ...chunk }))), // TODO 1240
    solverDiagnostics, // TODO 1240
    layers: payload,
    meta,
  };
  return Object.freeze({ ...snapshot, hash: hashHex(stableSnapshotString(snapshot)) });
}

export function diffSnapshots(previous, next, tracker = new DirtyLayerTracker()) {
  const changes = {};
  for (const layer of SNAPSHOT_LAYERS) {
    if (stableSnapshotString(previous?.layers?.[layer]) !== stableSnapshotString(next?.layers?.[layer])) {
      tracker.mark(layer); changes[layer] = next.layers[layer];
    }
  }
  return { dirtyLayers: tracker.consume(), changes };
}

export function applySnapshotPatch(base, patch) {
  const layers = { ...(base.layers || {}) };
  for (const layer of SNAPSHOT_LAYERS) if (Object.prototype.hasOwnProperty.call(patch?.changes || {}, layer)) layers[layer] = patch.changes[layer];
  return createSnapshotV3({ ...base, layers });
}

export function replaySnapshot(base, patches = []) { return patches.reduce((snapshot, patch) => applySnapshotPatch(snapshot, patch), base); }

export function validateSnapshotV3(snapshot) {
  const errors = [];
  if (snapshot?.version !== PROCGEN_SNAPSHOT_VERSION) errors.push("version");
  if (!snapshot?.id) errors.push("id");
  if (!Number.isInteger(snapshot?.seed)) errors.push("seed");
  if (!Array.isArray(snapshot?.pins)) errors.push("pins");
  if (!Object.prototype.hasOwnProperty.call(snapshot || {}, "fieldRecipe")) errors.push("fieldRecipe");
  for (const key of SNAPSHOT_SCHEMA_KEYS) if (!Number.isInteger(snapshot?.schemaVersions?.[key]) || snapshot.schemaVersions[key] < 1) errors.push(`schemaVersion:${key}`);
  if (!Array.isArray(snapshot?.chunkManifest)) errors.push("chunkManifest");
  for (const layer of SNAPSHOT_LAYERS) if (!Object.prototype.hasOwnProperty.call(snapshot?.layers || {}, layer)) errors.push(`layer:${layer}`);
  return { ok: errors.length === 0, errors };
}

/**
 * snapshot consistency（TODO 1241）：mesh/surface/nav/module/prop/
 * semanticMaterial/chunk 必须与 snapshot 同源。层 payload 可携带
 * source = { seed, blueprintHash, schemaVersions }；携带者全部校验，
 * 蓝图 hash 跨层不得分叉，chunk manifest 的 meshVersion 不得漂移。
 */
export function checkSnapshotConsistency(snapshot) {
  const issues = [];
  for (const error of validateSnapshotV3(snapshot).errors) issues.push({ code: "invalid-snapshot", detail: error });
  if (issues.length) return { ok: false, issues };
  const blueprintHashes = new Set();
  for (const layer of SNAPSHOT_LAYERS) {
    const source = snapshot.layers[layer]?.source;
    if (!source) continue;
    if (source.seed !== undefined && source.seed !== snapshot.seed) issues.push({ code: "seed-mismatch", layer, detail: source.seed });
    for (const key of SNAPSHOT_SCHEMA_KEYS) {
      if (source.schemaVersions?.[key] !== undefined && source.schemaVersions[key] !== snapshot.schemaVersions[key]) {
        issues.push({ code: "schema-mismatch", layer, detail: `${key}:${source.schemaVersions[key]}!=${snapshot.schemaVersions[key]}` });
      }
    }
    if (source.blueprintHash !== undefined) blueprintHashes.add(source.blueprintHash);
  }
  if (blueprintHashes.size > 1) issues.push({ code: "blueprint-hash-divergence", detail: [...blueprintHashes] });
  for (const chunk of snapshot.chunkManifest) {
    if (chunk?.meshVersion !== undefined && chunk.meshVersion !== snapshot.schemaVersions.mesh) {
      issues.push({ code: "chunk-version-mismatch", layer: "field", detail: `${chunk.id}:${chunk.meshVersion}` });
    }
  }
  return { ok: issues.length === 0, issues };
}

/**
 * save V2→V3 migration（TODO 1305）：v2 输入补默认字段升 v3；
 * wfc/field 缓存层不迁移（置 null）——缺 cache 时凭 blueprint+seed+pins
 * 仍可完整重建。
 */
export function migrateSnapshotV2toV3(raw) {
  if (raw?.version !== 2) throw new Error("migrateSnapshotV2toV3 requires version 2 input");
  return createSnapshotV3({
    id: raw.id ?? "migrated-v2",
    seed: raw.seed ?? 0,
    profile: raw.profile,
    moduleSetVersion: raw.moduleSetVersion,
    fieldRecipe: raw.fieldRecipe ?? null,
    pins: raw.pins ?? [],
    layers: {
      blueprint: raw.layers?.blueprint ?? raw.blueprint ?? null,
      wfc: null,
      field: null,
      presentation: raw.layers?.presentation ?? null,
      runtime: null,
    },
    meta: { ...(raw.meta || {}), migratedFrom: 2 },
  });
}

/** 统一入口：v3 校验通过原样返回；v2 走迁移器；其余拒绝。 */
export function loadSnapshot(raw) {
  if (raw?.version === PROCGEN_SNAPSHOT_VERSION) {
    const check = validateSnapshotV3(raw);
    if (!check.ok) throw new Error(`invalid snapshot v3: ${check.errors.join(",")}`);
    return raw;
  }
  if (raw?.version === 2) return migrateSnapshotV2toV3(raw);
  throw new Error(`unsupported snapshot version: ${raw?.version}`);
}
