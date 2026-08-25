// 旧港战斗触发回归：红缨战斗单位进入 old-harbor-scene 后立即交战。
import assert from "node:assert/strict";

const BASE = new URL("../TigerMessenger/", import.meta.url);
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  }),
});
globalThis.document = {
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildOldHarborScene, createHarborPatrolSoldier, paintSoldierHelm } = await import(
  new URL("src/assets/harbor.js", BASE).href
);
const { createSaihojiPhalanxBattle } = await import(
  new URL("src/world/saihojiPhalanx.js", BASE).href
);

const scene = new THREE.Scene();
const harborBuilt = buildOldHarborScene({ seed: 8844 });
const harbor = harborBuilt.group;
// 测试桩仍使用真实港口本地 combatZone，只把它放到一处不与其它场景重合的世界位置。
harbor.position.set(100, 20, 0);
scene.add(harbor);
harbor.updateMatrixWorld(true);

const zone = harbor.userData.combatZone;
const localToWorld = (x, z) => harbor.localToWorld(new THREE.Vector3(x, 0.35, z));
const red = createHarborPatrolSoldier();
red.name = "old-harbor-red-combatant";
red.userData.uid = 901;
paintSoldierHelm(red, "red");
red.position.copy(localToWorld(zone.centerX - 0.55, zone.centerZ));
scene.add(red);

const blue = createHarborPatrolSoldier();
blue.name = "old-harbor-blue-combatant";
blue.userData.uid = 902;
paintSoldierHelm(blue, "blue");
blue.position.copy(localToWorld(zone.centerX + 0.55, zone.centerZ));
scene.add(blue);

const battle = createSaihojiPhalanxBattle({
  scene,
  oldHarbor: harborBuilt,
  isWhaleRisen: () => false,
  getSquad: () => null,
  getTram: () => null,
});

battle.update(0.1, 0.1);
const state = battle.root.userData.oldHarborCombat.getState();
assert.equal(state.active, true, "红缨战斗单位进入旧港后应激活战斗区");
assert.equal(state.redEntered, 1, "应记录红缨战斗单位进入旧港");
assert(state.engagements >= 1, "进入旧港后应立即产生至少一次交战");
assert.equal(red.userData.harborCombat, true, "红缨士兵应切换为 harborCombat");
assert.equal(red.userData.combatTargetUid, blue.userData.uid, "红缨士兵应锁定港内蓝缨目标");
assert.equal(blue.userData.downed, true, "港内蓝缨目标应受到红缨近战攻击");

red.position.set(0, 0, 0);
battle.update(0.1, 0.2);
assert.equal(red.userData.harborCombat, false, "红缨离开旧港后应解除港内战斗状态");
assert.equal(battle.root.userData.oldHarborCombat.getState().active, false, "港内无红缨时战斗区应关闭");

console.log("✓ 旧港红缨战斗触发：进入即锁定目标并交战，离港解除战斗状态");
