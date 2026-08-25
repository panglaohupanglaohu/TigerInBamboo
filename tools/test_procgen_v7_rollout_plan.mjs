import assert from "node:assert/strict";
import { PROCGEN_ROLLOUT_STAGES, validateRolloutStage, rollbackFlags } from "../TigerMessenger/src/procgen/migration/rolloutPlan.js";

for (const stage of PROCGEN_ROLLOUT_STAGES) {
  const flags = Object.fromEntries(stage.enabled.map((flag) => [flag, true]));
  assert.equal(validateRolloutStage(stage, flags).ok, true);
  assert.ok(Object.values(rollbackFlags(stage)).every((value) => value === false));
}
assert.equal(validateRolloutStage(PROCGEN_ROLLOUT_STAGES[1], { procgenEngineV1: true, wfcCastleV1: true, marchingTerrainV1: true }).ok, false);
console.log(`✅ V7 rollout plan: ${PROCGEN_ROLLOUT_STAGES.length} ordered stages, independent flags and rollback=false contract passed`);
