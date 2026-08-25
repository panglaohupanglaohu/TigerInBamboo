// V7-G11~G13：三类城堡 profile contract
import assert from "node:assert/strict";
import { createCastleProfile, createHighlandProfile, createAncientProfile, createCanalProfile, validateCastleProfile } from "../TigerMessenger/src/procgen/profiles/castleProfiles.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

const highland = createHighlandProfile({ floors: 3, skipOuterTerrain: true });
const ancient = createAncientProfile();
const canal = createCanalProfile();
for (const profile of [highland, ancient, canal]) {
  assert.equal(validateCastleProfile(profile).ok, true);
  assert.ok(profile.moduleSet);
  assert.ok(profile.fixtureHash || profile.blueprintHash);
}
assert.equal(highland.id, "highland-citadel");
assert.equal(highland.routePolicy.waterfallSide, "right-of-first-waterfall");
assert.equal(ancient.routePolicy.patrolLoopRequired, true);
assert.equal(canal.routePolicy.bridgesHaveClearance, true);
ok("高山/古堡/运河 profile：共用 solver/terrain contract，路线政策各自显式化");

assert.equal(createCastleProfile("ancient-fortress").id, ancient.id);
assert.throws(() => createCastleProfile("unknown"), /unknown castle profile/);
assert.equal(validateCastleProfile({ version: 99 }).ok, false);
ok("profile factory：稳定 ID、未知类型拒绝、版本校验");

console.log(`✅ V7-G11~G13 assertions=${passed}`);
