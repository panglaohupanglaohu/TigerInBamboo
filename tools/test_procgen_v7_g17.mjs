// V7-G17：迁移阶段门不能凭代码存在自动 default-on
import assert from "node:assert/strict";
import { canPromote, evaluateMigrationGate } from "../TigerMessenger/src/procgen/migration/migrationGate.js";

assert.equal(canPromote("DEFINED", "TESTED"), true);
assert.equal(canPromote("DEFAULT_ON", "DEFINED"), false);
const blocked = evaluateMigrationGate({ capabilities: [{ id: "wfc", level: "TESTED" }], requestedFlags: { wfcCastleV1: "wfc" } });
assert.equal(blocked.ok, false);
assert.equal(blocked.flags.wfcCastleV1, false);
const accepted = evaluateMigrationGate({ capabilities: [{ id: "wfc", level: "DEFAULT_ON" }], requestedFlags: { wfcCastleV1: "wfc" }, visualAccepted: true, perfAccepted: true });
assert.equal(accepted.ok, true);
console.log("  ✓ migration gate：TESTED/WIRED 不得越级打开默认开关；视觉和性能双签后才可放行");
console.log("✅ V7-G17 assertions=3");
