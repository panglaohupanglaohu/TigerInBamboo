// V6-G0：台账 JSON 结构 + 开关关时不挂 V4 镇体
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

const LEDGER = fileURLToPath(new URL("./out/v6-capability-ledger.json", import.meta.url));
const data = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
const LEVELS = data.levels;
assert.deepEqual(LEVELS, ["DEFINED", "TESTED", "WIRED", "DEFAULT_ON", "VISUAL_ACCEPTED", "PERF_ACCEPTED"]);
assert.equal(data.facts.combinationSpace, 2450);
assert.equal(data.facts.catalogModules, 47);
assert.equal(data.facts.resolveTown, "domain-wfc-bounded-backtrack");
assert.equal(data.facts.citadelCombatV3ReplacesPhalanx, false);
assert.equal(data.facts.oskLightingPrototype, "harness-sample-not-production-default");
assert.equal(data.defects[0].id, "defect.citadel-range-swamp-canopy");
assert.equal(data.capabilities.length, 12);
for (const cap of data.capabilities) {
  assert.ok(LEVELS.includes(cap.level), cap.id);
  assert.ok(LEVELS.indexOf(cap.level) < LEVELS.indexOf("VISUAL_ACCEPTED"), `${cap.id} must not claim VISUAL_ACCEPTED`);
  assert.ok(Array.isArray(cap.gaps));
}
assert.equal(data.capabilities.find((c) => c.id === "presentation").defaultOn, false);
assert.equal(data.cameras.legacyGpuCount, 25);
// V6-G0 收尾：legacy/v4/v6 三模式 GPU 矩阵已齐（各 25 张，零 pageerror）
assert.equal(data.cameras.v4GpuCount, 25);
assert.equal(data.cameras.v6GpuCount, 25);
assert.ok(data.cameras.v4Gpu && data.cameras.v6Gpu);
console.log("  ✓ ledger JSON 12 项，无 VISUAL_ACCEPTED");

const { isCitadelTownV4, applyUrlOverrides } = await import(new URL("src/core/params.js", BASE).href);
const { syncTownPresentation, restoreLegacyTownPresentation } = await import(
  new URL("src/world/citadel/presentationMesh.js", BASE).href
);
applyUrlOverrides("?citadelTownV4=0");
assert.equal(isCitadelTownV4(), false);
const fake = {
  userData: { townStats: { v4: true }, v4Town: {} },
  getObjectByName: () => null,
  traverse(fn) {
    fn({ name: "town-terrace-0-level-0", visible: false });
  },
};
restoreLegacyTownPresentation(fake);
assert.equal(fake.userData.townStats.v4, false);
assert.equal(syncTownPresentation(fake, { town: { cells: [] } }), fake);
console.log("  ✓ citadelTownV4=0 走 restoreLegacy，不挂 V4 镇体");
console.log("\nV6-G0 台账验收通过");
