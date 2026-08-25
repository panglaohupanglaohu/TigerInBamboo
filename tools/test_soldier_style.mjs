// 纸士兵模型验收：Bad North 风格低多边轮廓、装备可读性与旧调用契约。
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
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

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  createNightInfiltrationSoldier,
  createTieSoldier,
  createHarborPatrolSoldier,
  createLongbowSoldier,
  createCitadelMeleeSoldier,
  createGladiusSoldier,
} = await import(new URL("src/assets/harbor.js", BASE).href);
const { applyUrlOverrides, isCitadelCombatV3 } = await import(new URL("src/core/params.js", BASE).href);

const meshes = (root) => {
  const result = [];
  root.traverse((object) => {
    if (object.isMesh) result.push(object);
  });
  return result;
};

console.log("[1] 夜潜盾枪兵：Bad North 低多边角色骨架");
const infantry = createNightInfiltrationSoldier();
assert.equal(infantry.userData.modelStyle, "bad-north-lowpoly-paper");
assert.equal(infantry.userData.unitClass, "spear-shield-infantry");
assert(infantry.userData.parts.body, "必须保留髋枢轴躯干");
assert(infantry.userData.parts.armL && infantry.userData.parts.armR, "必须保留双臂动画节点");
assert(infantry.userData.parts.legL && infantry.userData.parts.legR, "必须保留双腿动画节点");
assert(infantry.userData.parts.body.children[0].geometry.type === "DodecahedronGeometry" ||
  infantry.userData.parts.body.children[0].geometry.attributes.position.count > 24,
"躯干必须由块面低多边几何组成");
assert(infantry.getObjectByName("left-hand-shield"), "普通士兵必须左手持盾");
assert(infantry.getObjectByName("shield-boss"), "盾牌必须有盾脐");
assert(infantry.getObjectByName("shield-sigil"), "盾牌必须有简化徽记");
assert(infantry.getObjectByName("right-hand-long-spear"), "普通士兵必须右手持长枪");
assert(infantry.getObjectByName("long-spear-head"), "长枪必须有清晰枪头");
assert.equal(infantry.getObjectByName("right-hand-gladius"), undefined, "不得回退为短剑");
assert.equal(infantry.getObjectByName("soldier-crest").material.color.getHex(), 0xd94d5d,
  "默认羽冠应使用高辨识度红色");

console.log("[2] 火炬兵与日间系绳兵：装备/标记契约");
const torch = createNightInfiltrationSoldier({ torchLeft: true });
assert.equal(torch.userData.torchBearer, true);
assert.equal(torch.userData.unitClass, "torch-scout");
assert(torch.getObjectByName("left-hand-torch"), "火炬兵左手必须持火炬");
assert(torch.getObjectByName("infiltration-torch-light"), "火炬必须有局部光源");
assert.equal(torch.getObjectByName("left-hand-shield"), undefined, "火炬兵左手不得同时出现盾牌");
const tied = createTieSoldier();
assert.equal(tied.userData.kind, "tieSoldier");
assert(tied.getObjectByName("left-hand-shield"), "系绳兵仍必须有左手盾牌");
assert(tied.getObjectByName("right-hand-long-spear"), "系绳兵仍必须有右手长枪");

console.log("[3] 既有兵种工厂：巡查/远射/船员不回退");
const patrol = createHarborPatrolSoldier();
assert.equal(patrol.userData.phalanxRole, "spear");
assert(patrol.getObjectByName("right-hand-long-spear"));
const bow = createLongbowSoldier();
assert.equal(bow.userData.phalanxRole, "longbow");
assert(bow.getObjectByName("english-longbow"));
assert.equal(bow.getObjectByName("left-hand-shield")?.visible, false,
  "长弓兵应隐藏盾牌而不是破坏共享装备节点");
assert(meshes(infantry).length >= 16, "角色仍需包含身体、装备和描边部件");

console.log("[4] 方向契约：长枪默认沿局部 +X，动画可继续绕 Z 摆动");
const spear = infantry.userData.equipment.spear;
assert(spear.position.x > 0.2, "长枪应位于角色前方");
assert(Math.abs(spear.rotation.z + Math.PI / 2 + 0.08) < 1e-6,
  "长枪应保持横向前指姿态");
assert.equal(typeof THREE.Vector3, "function");

console.log("[5] V3 近战主武器：默认短剑，开关开时长枪");
{
  applyUrlOverrides("?citadelCombatV3=0");
  const meleeOff = createCitadelMeleeSoldier();
  assert.equal(isCitadelCombatV3(), false);
  assert(meleeOff.getObjectByName("right-hand-gladius"), "默认近战仍是短剑盾");
  applyUrlOverrides("?citadelCombatV3=1");
  const meleeOn = createCitadelMeleeSoldier();
  assert.equal(isCitadelCombatV3(), true);
  assert(meleeOn.getObjectByName("right-hand-long-spear"), "V3 近战必须长枪");
  assert.equal(meleeOn.getObjectByName("right-hand-gladius"), undefined);
  assert.equal(meleeOn.userData.phalanxRole, "spear");
  const gladius = createGladiusSoldier();
  assert(gladius.getObjectByName("right-hand-gladius"), "短剑工厂仍可用");
  applyUrlOverrides("?citadelCombatV3=0");
}

console.log("纸士兵 Bad North 风格模型验收通过 ✅");
