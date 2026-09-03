// Deterministic V7/V8 rollout plan.  It describes which flag may be enabled
// at each stage, while keeping every stage reversible.  The plan never flips
// production flags; migrationGate remains the only authority that can do so.
//
// ⚠️ 2026-09-01：下面 stage 数据里的 procgenEngineV1 / wfcCastleV1 /
// marchingTerrainV1 三个 flag 已从 core/params.js 删除（它们从未有过运行时
// 分支，只是名字）。这里保留为历史阶段描述——validateRolloutStage 与
// rollbackFlags 是泛型函数，不查真实 FEATURES，因此行为不受影响。
// WFC 仍是选定方向；重新定义 rollout 阶段时请一并更新这份数据。

export const PROCGEN_ROLLOUT_STAGES = Object.freeze([
  Object.freeze({ id: "graph-debug", enabled: ["procgenEngineV1"], disabled: ["wfcCastleV1", "marchingTerrainV1"], production: false }),
  Object.freeze({ id: "saihoji-sample", enabled: ["procgenEngineV1", "wfcCastleV1"], disabled: ["marchingTerrainV1"], production: false }),
  Object.freeze({ id: "saihoji-l1-mc", enabled: ["procgenEngineV1", "wfcCastleV1", "marchingTerrainV1"], disabled: [], production: false }),
  Object.freeze({ id: "highland-candidate", enabled: ["procgenEngineV1", "wfcCastleV1", "marchingTerrainV1"], disabled: [], production: false }),
  Object.freeze({ id: "ancient-canal-candidate", enabled: ["procgenEngineV1", "wfcCastleV1", "marchingTerrainV1"], disabled: [], production: false }),
]);

export function validateRolloutStage(stage, flags = {}) {
  const expected = new Set(stage?.enabled || []); const errors = [];
  for (const flag of stage?.disabled || []) if (flags[flag] === true) errors.push(`disabled-flag:${flag}`);
  for (const flag of expected) if (flags[flag] !== true) errors.push(`missing-flag:${flag}`);
  if (stage?.production) errors.push("production-stage-requires-explicit-migration");
  return { ok: errors.length === 0, errors, stage: stage?.id || null, rollbackSafe: true };
}

export function rollbackFlags(stage) {
  return Object.fromEntries([...(stage?.enabled || []), ...(stage?.disabled || [])].map((flag) => [flag, false]));
}
