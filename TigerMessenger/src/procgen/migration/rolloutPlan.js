// Deterministic V7/V8 rollout plan.  It describes which flag may be enabled
// at each stage, while keeping every stage reversible.  The plan never flips
// production flags; migrationGate remains the only authority that can do so.

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
