// =====================================================================
// Procgen Worker protocol（V7-G10）
// Job/result 都是可 structured-clone 的纯数据；mesh typed arrays 单独列出
// transfer list，取消和错误都有稳定 code。
// =====================================================================

import { PROCGEN_ENGINE_SCHEMA_VERSION, WFC_MODEL_SCHEMA_VERSION, FIELD_SCHEMA_VERSION, MC_MESH_SCHEMA_VERSION } from "../core/schema.js";

export const PROCGEN_PROTOCOL_VERSION = 1;
export const JOB_TYPES = Object.freeze(["surface", "wfc", "field", "planet"]);
// 四类 schemaVersion 与 core/schema.js 常量同源：graph（编译图/engine）、module、field、mesh
export const PROCGEN_SCHEMA_KEYS = Object.freeze(["graph", "module", "field", "mesh"]);
export const PROCGEN_SCHEMA_DEFAULTS = Object.freeze({
  graph: PROCGEN_ENGINE_SCHEMA_VERSION,
  module: WFC_MODEL_SCHEMA_VERSION,
  field: FIELD_SCHEMA_VERSION,
  mesh: MC_MESH_SCHEMA_VERSION,
});

export function createProcgenJob({ id, type = "surface", payload, seed, profile = "default", blueprintVersion = 1, schemaVersions = {}, dirty = null } = {}) {
  if (!id || typeof id !== "string") throw new Error("procgen job id required");
  if (!JOB_TYPES.includes(type)) throw new Error(`unknown procgen job type: ${type}`);
  return { protocol: PROCGEN_PROTOCOL_VERSION, id, type, payload, seed: seed >>> 0, profile, blueprintVersion, schemaVersions: Object.fromEntries(PROCGEN_SCHEMA_KEYS.map((key) => [key, schemaVersions[key] ?? PROCGEN_SCHEMA_DEFAULTS[key]])), dirty, createdAt: Date.now() };
}

export function createProcgenResult(job, { ok, payload = null, error = null, stats = null } = {}) {
  return { protocol: PROCGEN_PROTOCOL_VERSION, id: job.id, ok: Boolean(ok), payload, error, stats };
}

export function createCancelledResult(job, reason = "cancelled") {
  return createProcgenResult(job, { ok: false, error: { code: "cancelled", reason } });
}

export function createProgressResult(job, phase, progress, stats = null) {
  return { protocol: PROCGEN_PROTOCOL_VERSION, id: job.id, type: "progress", phase, progress: Math.max(0, Math.min(1, progress)), stats };
}

export function transferablesForMesh(mesh) {
  return [mesh?.positions?.buffer, mesh?.normals?.buffer, mesh?.indices?.buffer, mesh?.semantics?.buffer].filter(Boolean);
}

export function validateProcgenJob(job) {
  const errors = [];
  if (job?.protocol !== PROCGEN_PROTOCOL_VERSION) errors.push("protocol");
  if (!job?.id || typeof job.id !== "string") errors.push("id");
  if (!JOB_TYPES.includes(job.type)) errors.push("type");
  if (!Number.isInteger(job.seed) || job.seed < 0) errors.push("seed");
  if (!Number.isInteger(job.blueprintVersion) || job.blueprintVersion < 1) errors.push("blueprintVersion");
  for (const key of PROCGEN_SCHEMA_KEYS) if (!Number.isInteger(job.schemaVersions?.[key]) || job.schemaVersions[key] < 1) errors.push(`schemaVersion:${key}`);
  if (job.dirty !== null && !Array.isArray(job.dirty) && typeof job.dirty !== "object") errors.push("dirty");
  return { ok: errors.length === 0, errors };
}
