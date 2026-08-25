// PLAN V4 G0：开关、固定步长、rng fork、蓝图 canonical hash、29 组基线、同 seed 三跑一致
// 运行：node tools/test_citadel_v4_g0.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

import { FEATURES, applyUrlOverrides, isCitadelTownV4, isCitadelTerrainUvV2, isCitadelCombatV3 } from "../TigerMessenger/src/core/params.js";
import { createRng, hashHex, stableShuffle } from "../TigerMessenger/src/core/rng.js";
import { createFixedStepClock, FIXED_STEP } from "../TigerMessenger/src/core/fixedStep.js";
import { createEventBus } from "../TigerMessenger/src/core/eventBus.js";
import { debugCount, debugSnapshot, debugReset } from "../TigerMessenger/src/core/debugHub.js";
import { createCombatEventLog } from "../TigerMessenger/src/world/combatEvents.js";
import {
  createCitadelBlueprint,
  citadelBlueprintCanonicalHash,
  migrateCitadelBlueprint,
  CITADEL_BLUEPRINT_VERSION,
} from "../TigerMessenger/src/world/citadelBlueprint.js";
import { CITADEL_V4_BASELINES, CITADEL_V4_SEEDS } from "../TigerMessenger/src/world/citadel/baselineSpec.js";
import { CITADEL_TOWN_SPEC } from "../TigerMessenger/src/world/citadelTown.js";

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 三个 V4 开关默认关闭（旧系统）");
{
  assert.equal(FEATURES.citadelTownV4, false);
  assert.equal(FEATURES.citadelTerrainUvV2, false);
  assert.equal(FEATURES.citadelCombatV3, false);
  assert.equal(isCitadelTownV4(), false);
  assert.equal(isCitadelTerrainUvV2(), false);
  assert.equal(isCitadelCombatV3(), false);
  applyUrlOverrides("?citadelTownV4=1&citadelTerrainUvV2=1&citadelCombatV3=1&seed=42&townSeed=9&terrainSeed=11");
  assert.equal(FEATURES.citadelTownV4, true);
  assert.equal(FEATURES.citadelTerrainUvV2, true);
  assert.equal(FEATURES.citadelCombatV3, true);
  assert.equal(FEATURES.combatSeed, 42);
  assert.equal(FEATURES.townSeed, 9);
  assert.equal(FEATURES.terrainSeed, 11);
  applyUrlOverrides("?citadelTownV4=0&citadelTerrainUvV2=0&citadelCombatV3=0");
  assert.equal(isCitadelTownV4(), false);
  assert.equal(isCitadelTerrainUvV2(), false);
  assert.equal(isCitadelCombatV3(), false);
  ok("默认关 · URL 可开可关 · 互不绑定");
}

console.log("[2] rng fork / 稳定洗牌 / 固定步长");
{
  const a = createRng(7).fork(3).next();
  const b = createRng(7).fork(3).next();
  const c = createRng(7).fork(4).next();
  assert.equal(a, b, "同 seed+tick fork 必须相同");
  assert.notEqual(a, c, "不同 tick 必须分歧");
  const s1 = createRng(7).shuffle([0, 1, 2, 3, 4, 5]);
  const s2 = createRng(7).shuffle([0, 1, 2, 3, 4, 5]);
  assert.deepEqual(s1, s2);
  assert.deepEqual(stableShuffle([1, 2, 3], createRng(1)), stableShuffle([1, 2, 3], createRng(1)));
  const clock = createFixedStepClock();
  const ticks = [];
  clock.advance(FIXED_STEP * 2.4, (_dt, t) => ticks.push(t));
  assert.deepEqual(ticks, [0, 1]);
  assert.ok(clock.alpha > 0 && clock.alpha < 1);
  ok("fork/shuffle/fixedStep 可复现");
}

console.log("[3] 事件总线稳定顺序 + canonical hash");
{
  const bus = createEventBus();
  const seen = [];
  bus.on("x", () => seen.push("b"), "b");
  bus.on("x", () => seen.push("a"), "a");
  bus.emit("x");
  assert.deepEqual(seen, ["a", "b"], "监听器按 id 排序，不按插入顺序");
  const log = createCombatEventLog({ seed: 7, scenario: "g0" });
  log.record(0.1, "phase", { from: "a", to: "b" });
  log.command(0.2, "whaleReturned");
  const h1 = log.canonicalHash();
  const log2 = createCombatEventLog({ seed: 7, scenario: "g0" });
  log2.record(0.1, "phase", { from: "a", to: "b" });
  log2.command(0.2, "whaleReturned");
  assert.equal(log2.canonicalHash(), h1);
  assert.equal(hashHex("x").length, 8);
  ok("eventBus 稳定 · canonicalHash 一致");
}

console.log("[4] 蓝图 schema / 迁移 / canonical hash ×3");
{
  const hashes = [0, 1, 2].map(() =>
    citadelBlueprintCanonicalHash(createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" }))
  );
  assert.equal(hashes[1], hashes[0]);
  assert.equal(hashes[2], hashes[0]);
  const migrated = migrateCitadelBlueprint({ floors: 5, instanceId: "highland" });
  assert.equal(migrated.version, CITADEL_BLUEPRINT_VERSION);
  assert.throws(() => migrateCitadelBlueprint({ version: 99 }));
  ok(`蓝图 hash ${hashes[0]} ×3 一致`);
}

console.log("[5] 29 组基线目录");
{
  assert.equal(CITADEL_V4_BASELINES.length, 29);
  const ids = new Set(CITADEL_V4_BASELINES.map((b) => b.id));
  assert.equal(ids.size, 29, "id 不得重复");
  assert.ok(CITADEL_V4_BASELINES.some((b) => b.id === "clear/citadel-overview"));
  assert.ok(CITADEL_V4_BASELINES.some((b) => b.id === "night/trojan-infil"));
  assert.ok(CITADEL_V4_BASELINES.some((b) => b.id === "waterfall-l1-close"));
  assert.ok(CITADEL_V4_BASELINES.some((b) => b.id === "single-cell-edit"));
  assert.ok(CITADEL_V4_BASELINES.some((b) => b.id === "harbor-siege"));
  assert.ok(CITADEL_V4_BASELINES.some((b) => b.id === "night-horse"));
  assert.equal(CITADEL_V4_SEEDS.combat, 7);
  ok("5×5 镜头 + 瀑布近景 + 单格编辑 + 港口攻城 + 深夜木马 = 29");
}

console.log("[6] debugHub");
{
  debugReset();
  debugCount("fallback", 2);
  const snap = debugSnapshot();
  assert.equal(snap.counters.fallback, 2);
  ok("计数器可快照");
}

console.log(`\nG0 单元验收通过 ${pass} 项`);
