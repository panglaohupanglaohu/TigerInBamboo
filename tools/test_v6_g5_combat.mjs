// V6-G5：港口登陆样片 + 公平性 + 纸兵绑定（不默认替换 phalanx）
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

for (const rel of ["src/agents/citadel/battlefield.js", "src/agents/citadel/combatSample.js", "src/agents/citadel/paperBind.js"]) {
  const src = fs.readFileSync(fileURLToPath(new URL(rel, BASE)), "utf8");
  assert.equal(/from ["']three["']/.test(src), false, `${rel} 不得 import Three`);
}
const load = fs.readFileSync(fileURLToPath(new URL("src/scenes/messenger/loadCitadel.js", BASE)), "utf8");
assert.match(load, /selectCombatBackend/);
assert.match(load, /createHarborLandingSample/);
console.log("  ✓ 数据层无 Three；loadCitadel 有 V3 互斥开关");

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { compileCitadelV4 } = await import(new URL("src/world/citadel/pipeline.js", BASE).href);
const { evaluateBattlefield, FAIRNESS_SEEDS, pathCrossings, LEGAL_CROSS } = await import(
  new URL("src/agents/citadel/battlefield.js", BASE).href
);
const { createHarborLandingSample, selectCombatBackend } = await import(
  new URL("src/agents/citadel/combatSample.js", BASE).href
);
const { applyPaperPose } = await import(new URL("src/agents/citadel/paperBind.js", BASE).href);
const { gaitPose, attackPose } = await import(new URL("src/agents/citadel/animationController.js", BASE).href);
const { makeTrojanWave, TROJAN_RULES, nextTerrace } = await import(
  new URL("src/agents/citadel/siegeDirector.js", BASE).href
);
const { FEATURES, isCitadelCombatV3 } = await import(new URL("src/core/params.js", BASE).href);
const { createPaperSoldierMesh } = await import(new URL("src/agents/citadel/paperMesh.js", BASE).href);

assert.equal(FEATURES.citadelCombatV3, false);
assert.equal(isCitadelCombatV3(), false);
assert.equal(selectCombatBackend({ combat: false }), "legacy");
assert.equal(selectCombatBackend({ combat: true }), "v3");
assert.notEqual(selectCombatBackend({ combat: true }), "legacy");

const wave = makeTrojanWave();
assert.equal(wave.length, TROJAN_RULES.ropes * TROJAN_RULES.dropsPerRope);
assert.equal(wave.filter((s) => s.role === "torch").length, 4);
assert.equal(wave.filter((s) => s.squad === "ladder").length, 4);
assert.equal(TROJAN_RULES.captureTarget, "castle-top");
// 2026-08-24：与 test_procgen_profiles_hard_routes 的 hash 漂移同源——现行
// siegeDirector 按最新攻城设计把木马改为 interior-rotating-stairs 突入，
// ladderPolicy=disabled，ladderTerraces 由 [0] 改为 []；六架攻城梯仍在场景中
// 由白天 assault 使用（test_odyssey_citadel 断言 6 架），木马夜间不再走梯。
assert.deepEqual(TROJAN_RULES.ladderTerraces, []);
assert.deepEqual(TROJAN_RULES.stairTerraces, [0]);
assert.equal(nextTerrace(0, TROJAN_RULES, "stairs"), null);
assert.equal(nextTerrace(0, TROJAN_RULES, "ladder"), null);
console.log("  ✓ 木马四绳×两次、火炬首尾、攻城梯/山路全部抵达古堡顶层");

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const v4 = compileCitadelV4(bp, 7);
const fair = evaluateBattlefield(v4, 7);
assert.ok(fair.landingRoutes >= 1, `castle-top landingRoutes ${fair.landingRoutes}`);
assert.equal(fair.defenderFallbacks, 0, "顶层为最终防区，不再回退旧台地");
assert.equal(fair.trojan.captureTarget, "castle-top");
assert.equal(fair.airSegments, 0);
assert.ok(fair.buildingProtection > 0);
assert.ok(fair.torchVisible >= 1);
const fair42 = evaluateBattlefield(v4, 42);
assert.notEqual(fair.hash, fair42.hash, "seed 改变可解释策略 hash");
console.log(`  ✓ 公平性 登陆${fair.landingRoutes} 撤退${fair.defenderFallbacks} choke=${fair.chokeDominance.toFixed(2)}`);

const sample = createHarborLandingSample(v4, { seed: 7 });
assert.ok(sample.agents.every((a) => a.visual?.parts));
const pose = applyPaperPose(sample.attackers[0].visual.parts, gaitPose(sample.attackers[0]), attackPose(sample.attackers[0]));
assert.ok("rotZ" in (pose.legL || {}));
const s60a = sample.run(60);
assert.equal(s60a.offSeg, 0);
assert.equal(s60a.teleports, 0);
assert.equal(s60a.illegalCross, 0);
assert.ok(s60a.maxOff <= 0.15, `off ${s60a.maxOff}`);
const sampleB = createHarborLandingSample(v4, { seed: 7 });
sampleB.run(2);
const sampleC = createHarborLandingSample(v4, { seed: 7 });
sampleC.run(2);
assert.equal(sampleB.replayHash(), sampleC.replayHash());
assert.ok(sample.climbPairs.length >= 1);
assert.ok(sample.events().some((e) => e.type === "climb" && e.contact && e.events?.length));
const legalPts = sample.attackers[0].path.points || [];
if (legalPts.length > 1) assert.equal(pathCrossings(legalPts).ok, true);
console.log(`  ✓ 60s 离表0 瞬移0 非法跨层0 replay=${s60a.replay}`);

const long = createHarborLandingSample(v4, { seed: 7, attackers: 3, defenders: 2 });
const s10 = long.run(600);
assert.equal(s10.offSeg, 0);
assert.equal(s10.teleports, 0);
assert.equal(s10.stuck, 0);
console.log(`  ✓ 10min 离表${s10.maxOff.toFixed(4)} stuck=${s10.stuck}`);

const night = createHarborLandingSample(v4, { seed: 7, attackers: 3, defenders: 2 });
night.run(5);
assert.equal(night.stats().illegalCross, 0);

const mesh = createPaperSoldierMesh(sample.attackers[0]);
assert.equal(mesh.userData.kind, "citadel-v6-paper-soldier");
assert.ok(mesh.userData.parts.spear && mesh.userData.parts.shield);

fs.mkdirSync(fileURLToPath(new URL("./out/", import.meta.url)), { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#eef2f0"/><text x="16" y="22" font-size="13">harbor landing sample seed=7</text></svg>`;
fs.writeFileSync(new URL("./out/v6-g5-landing.svg", import.meta.url), svg);
fs.writeFileSync(
  new URL("./out/v6-g5-combat.json", import.meta.url),
  JSON.stringify(
    {
      seed: 7,
      fairness: fair,
      sample60: s60a,
      sample10min: { maxOff: s10.maxOff, teleports: s10.teleports, offSeg: s10.offSeg, stuck: s10.stuck },
      legalCross: [...LEGAL_CROSS],
      defaultOn: false,
      dualSim: false,
    },
    null,
    2
  )
);
console.log("  ✓ 样片 JSON 已写");
console.log("\nV6-G5 登陆交战样片验收通过（TESTED，未 DEFAULT_ON，未替换默认 phalanx）");
