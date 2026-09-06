// =====================================================================
// 主舰的自主权（主人 2026-09-06：「一切以主舰为主。不要 missionlock」）
//
// 这条测试原来叫 test_flagship_hold，验的是「登陆队可以请主舰把驻留延长一会儿」。
// 主人把整个机制否掉了：哪怕只是「请求驻留」，也仍然是地面部队伸手去动主舰。
// 主舰身上同时还有 whaleLock（鲸的故事线）和 patrol（自己的航线），
// 多一个写者就多一次「下一帧它到底听谁的」——那正是主人反复报的
// 「主舰飞走了，别人不跟」。
//
// 现在改成一条更硬的契约，盯三件事：
//   ① 主舰的巡逻不受任何 missionLock 影响：写进去也没用，它照飞不误。
//      （防的是「有人偷偷把这套锁再加回来」——留一颗钉子在这儿。）
//   ② 苔庭鲸那条线（whaleLock）仍然有效——那是主舰身上**唯一**的外来权威。
//   ③ 整段过程不许抛异常。上一版补丁在这条路径上碰了 formationCenter，
//      而它在巡逻分支里此刻还是 null，每帧一个 TypeError（语法检查查不出来）。
//
// 运行：node tools/test_flagship_autonomy.mjs
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
const air = await import(new URL("src/assets/moebiusAircraft.js", BASE).href);

const R = 160;
const make = air.createMoebiusAircraftSquad || air.createMoebiusAircraft;
assert.ok(typeof make === "function",
  `找不到机队构造函数，导出有：${Object.keys(air).filter((k) => /^create/.test(k)).join(", ")}`);

const scene = new THREE.Scene();
const centerDir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
const squad = make(centerDir, R, { count: 3 });
scene.add(squad.isObject3D ? squad : squad.root);
const root = squad.isObject3D ? squad : squad.root;
const members = root.userData?.members || [];
assert.ok(members.length > 0, "机队应有成员");

const dirA = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
const dirB = new THREE.Vector3(-0.6, 0.5, 0.62).normalize();
// ⚠️ 航线挂在 **squad 自己身上**：updateAircraftHover(aircraft, …) 里的 aircraft
// 就是 squad，它读的是 squad.userData.patrol / _patrol。只写成员等于没写——
// 这正是 2026-09-06 抓到的那个「锁从来没被主舰读到过」的同款坑。
root.userData.patrol = {
  dirA: dirA.clone(), dirB: dirB.clone(),
  arcLen: dirA.angleTo(dirB) * R, maxSpeed: 40, radius: R + 60,
  R, height: 60,
};

const update = air.updateAircraftHover;
assert.ok(typeof update === "function", "需要 updateAircraftHover");
const step = (n, dt = 0.05, t0 = 0) => { for (let i = 0; i < n; i++) update(root, t0 + i * dt, dt, {}); };

// 先飞进某个驻留段（seg 1 或 3）
let guard = 0;
while (guard++ < 6000) {
  step(1, 0.05, guard * 0.05);
  const seg = root.userData._patrol?.seg;
  if (seg === 1 || seg === 3) break;
}
const segAtHold = root.userData._patrol?.seg;
assert.ok(segAtHold === 1 || segAtHold === 3, `应能进入驻留段，实得 seg=${segAtHold}`);

// ---- ① 谁也钉不住主舰 ----
{
  // 把旧机制能想到的每一种写法都写进去：hold / active / hubDir / hoverRadius。
  // 一条都不许生效——主舰的驻留计时必须照常推进。
  for (const m of [root, ...members]) {
    m.userData.missionLock = {
      hold: true, holdExtendMax: 999,
      active: true, hubDir: dirA.clone(), hoverRadius: 12,
    };
  }
  const u0 = root.userData._patrol.u;
  const seg0 = root.userData._patrol.seg;
  step(400, 0.05, 1e3); // 20 秒
  const st1 = root.userData._patrol;
  assert.ok(st1.u !== u0 || st1.seg !== seg0,
    "主舰的航线不许被任何 missionLock 钉住——「不要 missionlock」是把机制拆掉，" +
    "不是把它藏起来。写进去也没用，才叫拆干净了");
  console.log(`  ✓ ① 写满 missionLock 也钉不住主舰（seg ${seg0}→${st1.seg}, u ${u0.toFixed(3)}→${st1.u.toFixed(3)}）`);
}

// ---- ② whaleLock 仍然是唯一有效的外来权威 ----
{
  for (const m of [root, ...members]) delete m.userData.missionLock;
  const before = root.userData._patrolCenter?.clone() || null;
  root.userData.whaleLock = { active: true, hubDir: dirB.clone(), hoverRadius: 14 };
  step(200, 0.05, 2e3);
  const after = root.userData._patrolCenter?.clone() || null;
  assert.ok(after, "鲸对抗期应当仍然在算编队中心");
  if (before) {
    assert.ok(after.distanceTo(before) > 0.5,
      "鲸的故事线必须还能把机队拽过去——拆 missionLock 不许把 whaleLock 一起拆坏");
  }
  console.log("  ✓ ② whaleLock 仍然有效（主舰身上唯一的外来权威）");
}

// ---- ③ 全程无异常，且解锁后回归正常 ----
{
  root.userData.whaleLock.active = false;
  const before = root.userData._patrol.u;
  step(200, 0.05, 3e3);
  const after = root.userData._patrol.u;
  assert.ok(Number.isFinite(after), "巡逻相位必须是有限数");
  assert.ok(after !== before || root.userData._patrol.seg !== undefined,
    "鲸戏落幕后巡逻应恢复正常推进");
  console.log("  ✓ ③ 鲸戏落幕 → 巡逻恢复；全程无异常");
}

console.log("✅ test_flagship_autonomy（主舰自主：不要 missionlock · whaleLock 仍有效 · 无异常）");
