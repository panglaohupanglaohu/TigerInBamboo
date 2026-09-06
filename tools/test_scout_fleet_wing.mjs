// =====================================================================
// 侦察机的舰队分队（主人 2026-09-06 定的舰队阵容里 scoutDefense 是一员）
//
//   「scoutDefense：前出侦查，环绕战场飞行的侦察机
//     a）前出侦查，环绕战场飞行
//     b）曳光弹 指示 需要攻击 物体」
//   「scoutDefense + gatePodCraft + gateHaulerCraft 所有成员全部随动」
//
// 改之前它跟舰队一点关系都没有：5 架驻守水晶城母塔与子塔之间，在「城 / 门」
// 两个区之间每 18 秒换一次岗，猎中型灰鸟；曳光弹是直接击杀弹，不是指示。
//
// 按主人选的方案：抽 3 架编入舰队，水晶城留 2 架守原岗；分工制——侦察机只
// 标记，标出来的东西交给舰队其它成员（泡机麻醉 / 重甲兵射击格斗 / 登陆艇撞飞）。
//
// 运行：node tools/test_scout_fleet_wing.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createScoutDefenseSquad } = await import(new URL("src/world/scoutDefense.js", BASE).href);

const R = 160;
const scene = new THREE.Scene();

/** 单位到某个球面方向的地表距离（米） */
const distTo = (unit, dir) =>
  unit.group.position.clone().normalize().distanceTo(dir) * R;

let anchorDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
const designated = [];

const prey = new THREE.Group();
prey.name = "designate-me";
prey.userData = { uid: 77 };
prey.position.copy(anchorDir).multiplyScalar(R + 10);
scene.add(prey);

const squad = createScoutDefenseSquad({
  scene,
  radius: R,
  moebius: null,
  abandonedGate: null,
  getCityBirdFlocks: () => null,
  getGateBirdVortex: () => null,
  count: 5,
  fleetCount: 3,
  getFleetAnchor: () => anchorDir,
  getFleetTargets: () => [prey],
  onDesignate: (o) => designated.push(o),
});

// ---- ① 编成：3 架编入舰队，2 架留守水晶城 ----
{
  assert.equal(squad.getStatus().fleetCount, 3, "应有 3 架编入舰队");
  assert.equal(squad.fleetUnits().length, 3, "fleetUnits 应返回这 3 架");
  assert.equal(squad.units.length, 5, "总数仍是 5 架");
  console.log("  ✓ ① 编成：3 架编入舰队 · 2 架留守水晶城");
}

// ---- ② 前出侦查：编入舰队的机聚到战场上空盘旋 ----
{
  for (let i = 0; i < 1600; i++) squad.update(0.05, i * 0.05);
  const fleetUnits = squad.fleetUnits();
  for (const u of fleetUnits) {
    const d = distTo(u, anchorDir);
    assert.ok(d < 110, `编入舰队的机应在战场上空，实测离战场中心 ${d.toFixed(0)} 米`);
    assert.ok(u.group.position.length() > R + 10,
      "应在空中盘旋，不是趴在地面上");
  }
  // 「环绕」而不是「悬停」：三架相位均分，彼此拉得开
  const gaps = [];
  for (let i = 0; i < fleetUnits.length; i++) {
    for (let j = i + 1; j < fleetUnits.length; j++) {
      gaps.push(fleetUnits[i].group.position.distanceTo(fleetUnits[j].group.position));
    }
  }
  assert.ok(Math.max(...gaps) > 6,
    `三架应在圈上散开（最大间距 ${Math.max(...gaps).toFixed(1)}），挤成一个点就不是环绕飞行`);
  console.log(`  ✓ ② 前出侦查：3 架在战场上空环绕（最大间距 ${Math.max(...gaps).toFixed(1)} 米）`);
}

// ---- ③ 曳光指示：只标记，不击杀（分工制） ----
{
  assert.ok(designated.length > 0, "曳光弹必须把目标指示给舰队");
  assert.ok(designated.includes(prey), "指示的应当就是战场上那个目标");
  assert.equal(prey.userData.dead, undefined,
    "分工制：侦察机只标记，击杀交给舰队其它成员（泡机麻醉 / 重甲兵 / 登陆艇撞）");
  assert.ok(prey.userData.scoutDesignated, "被指示过的目标要留痕，供舰队取用");
  console.log(`  ✓ ③ 曳光指示 ${designated.length} 次 · 目标未被侦察机击杀（分工制）`);
}

// ---- ④ 随主舰移动：主舰飞走，这 3 架必须跟过去 ----
{
  const fleetUnits = squad.fleetUnits();
  const homeUnits = squad.units.filter((u) => u.index >= 3);
  const homeBefore = homeUnits.map((u) => u.group.position.clone());

  anchorDir = new THREE.Vector3(-0.62, 0.48, 0.62).normalize();
  prey.position.copy(anchorDir).multiplyScalar(R + 10);
  for (let i = 0; i < 1500; i++) squad.update(0.05, 1e3 + i * 0.05);

  for (const u of fleetUnits) {
    const d = distTo(u, anchorDir);
    assert.ok(d < 130,
      `主舰飞走后侦察机必须跟过去（离新战场 ${d.toFixed(0)} 米）——` +
      "原地不动就是主人反复报的「主舰移动，其他舰艇不跟随」");
  }
  // 留守的两架不跟：水晶城那条故事线要保住
  const moved = homeUnits.map((u, k) => u.group.position.distanceTo(homeBefore[k]));
  assert.ok(Math.min(...moved) < 60,
    "留守水晶城的 2 架不该被战场拽走（它们守的是母塔与子塔）");
  console.log("  ✓ ④ 随主舰移动：3 架跟到新战场 · 留守 2 架不动");
}

// ---- ⑤ 舰队不在场时退回旧行为（水晶城守卫这条线不许被改坏） ----
{
  anchorDir = null;
  const before = squad.fleetUnits().map((u) => u.group.position.clone());
  for (let i = 0; i < 400; i++) squad.update(0.05, 2e3 + i * 0.05);
  const after = squad.fleetUnits().map((u) => u.group.position.clone());
  const moved = after.map((p, k) => p.distanceTo(before[k]));
  assert.ok(Math.max(...moved) > 1,
    "舰队不在场时这 3 架应回水晶城归队，而不是僵在战场上空");
  assert.equal(squad.getStatus().fleetTargets, 0, "舰队不在场就不该有战场目标");
  console.log("  ✓ ⑤ 舰队不在场 → 退回水晶城守卫的旧行为");
}

// ---- ⑥ 飞行姿态：不许贴地、不许贴脸、机头要跟着速度走 ----
{
  // 主人 2026-09-06 截屏：三架侦察机贴着地面、夹在红盔堆里、机身水平。
  // 那是武装直升机扫射的姿态。业界侦察机三条常识：standoff、保持高度、
  // 机头跟速度矢量（协调转弯）。这一块把三条各钉一颗钉子。
  anchorDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  prey.position.copy(anchorDir).multiplyScalar(R + 0.4); // 目标趴在地面上
  for (let i = 0; i < 400; i++) squad.update(0.05, 3e3 + i * 0.05);

  let minAlt = Infinity;
  let minStandoff = Infinity;
  let maxPitch = 0;
  let sawBank = false;
  for (let i = 0; i < 600; i++) {
    squad.update(0.05, 4e3 + i * 0.05);
    for (const u of squad.fleetUnits()) {
      minAlt = Math.min(minAlt, u.group.position.length() - R);
      minStandoff = Math.min(minStandoff, u.group.position.distanceTo(prey.position));
      // 机体 +Z 是机头，+Y 是机背（orientAircraft 的 makeBasis 顺序）
      const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(u.group.quaternion);
      const back = new THREE.Vector3(0, 1, 0).applyQuaternion(u.group.quaternion);
      const up = u.group.position.clone().normalize();
      maxPitch = Math.max(maxPitch, Math.abs(Math.asin(THREE.MathUtils.clamp(nose.dot(up), -1, 1))));
      if (Math.abs(back.dot(up)) < 0.985) sawBank = true; // 机背偏离天顶 = 压坡度
    }
  }

  // ① 保持高度：绝不下到地面
  assert.ok(minAlt > 25,
    `侦察机全程不许掉到地面高度，实测最低 ${minAlt.toFixed(1)} 米——` +
    "贴地悬停在敌群里是截屏里那张，不是侦察机");
  // ② standoff：不进入目标近距
  assert.ok(minStandoff > 30,
    `必须保持 standoff，实测最近曾到 ${minStandoff.toFixed(1)} 米——` +
    "侦察机靠射程指示，不靠飞到目标头上");
  // ③ 姿态：转弯压坡度；俯仰有，但被限幅（不做垂直机动）
  assert.ok(sawBank, "盘旋转弯必须压坡度，机身永远水平就是在地面上滑行");
  assert.ok(maxPitch < 0.45,
    `俯仰要限幅（≈23°），实测 ${(maxPitch * 180 / Math.PI).toFixed(0)}°——侦察机不做垂直机动`);
  console.log(
    `  ✓ ⑥ 飞行姿态：最低 ${minAlt.toFixed(0)} 米 · standoff ≥ ${minStandoff.toFixed(0)} 米 · ` +
    `压坡度 · 俯仰 ≤ ${(maxPitch * 180 / Math.PI).toFixed(0)}°`);
}

console.log("✅ test_scout_fleet_wing（3 架编入舰队 · 环绕战场 · 曳光只指示 · 随主舰移动 · 留守 2 架 · 飞行姿态）");
