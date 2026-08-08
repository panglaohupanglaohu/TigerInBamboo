// 阿狸尾随上电车、卧在送信人旁 验收
// 运行：node tools/test_fox_tram_ride.mjs
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
    JSON.stringify(
      {
        name: "three",
        version: "0.172.0-local-bridge",
        type: "module",
        main: "../../vendor/three.module.js",
      },
      null,
      2
    )
  );
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (cb) => setTimeout(() => cb(0), 0),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  textContent: "",
  innerHTML: "",
  hidden: true,
  dataset: {},
  value: "",
  appendChild() {},
  append(...a) { for (const x of a) this.appendChild?.(x); },
  addEventListener() {},
  removeEventListener() {},
  focus() {},
  blur() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  scrollTop: 0,
  scrollHeight: 0,
});
globalThis.document = {
  body: { appendChild() {} },
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {},
};
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createLowPolyFox } = await import(new URL("src/assets/fox.js", BASE).href);
const { createFoxNpc } = await import(new URL("src/world/foxNpc.js", BASE).href);
const { FOX_TRAM_SEAT_LOCAL } = await import(new URL("src/player/tramRide.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] companionRest API");
const fox = createLowPolyFox({ scale: 0.52 });
assert.equal(typeof fox.setCompanionRest, "function");
fox.switchState("FOLLOWING");
assert.equal(fox.getState(), "FOLLOWING");
fox.setCompanionRest(true);
assert.equal(fox.getState(), "FOLLOWING", "卧姿不改 FOLLOWING 状态");
assert.equal(fox.userData.companionResting, true);
assert.equal(fox.userData.parts.sleepG.visible, true);
assert.equal(fox.userData.parts.walkRoot.visible, false);
ok("setCompanionRest(true)：仍 FOLLOWING，显示睡姿层");
fox.setCompanionRest(false);
assert.equal(fox.userData.parts.sleepG.visible, false);
assert.equal(fox.userData.parts.walkRoot.visible, true);
ok("setCompanionRest(false)：站起恢复行走层");

console.log("[2] 尾随上车 / 下车");
const scene = new THREE.Scene();
const camp = new THREE.Group();
camp.name = "starting-camp";
scene.add(camp);
camp.add(fox);
fox.position.set(0, 40, 5);

// 轻量电车桩：只需 Object3D 父节点与位姿（不跑完整 tram 网格）
const tram = new THREE.Group();
tram.name = "heritage-tram-test";
tram.position.set(2, 40, 6);
tram.quaternion.identity();
scene.add(tram);

const player = {
  position: new THREE.Vector3(2.2, 40.8, 6.2),
  forward: new THREE.Vector3(0, 0, 1),
  facing: new THREE.Vector3(0, 0, 1),
  velocity: new THREE.Vector3(),
  riding: false,
};

let riding = false;
const foxNpc = createFoxNpc({
  player,
  fox,
  camera: new THREE.PerspectiveCamera(),
  isGameStarted: () => true,
  planetRadius: 40,
  isPlayerOnTram: () => riding,
  getActiveTram: () => (riding ? tram : null),
  getFoxTramSeatLocal: () => FOX_TRAM_SEAT_LOCAL.clone(),
});

fox.switchState("FOLLOWING");
// 触发跟随尾随一次
foxNpc.update(1 / 60, 0);
assert.equal(foxNpc.isFollowing(), true);
ok("初始 FOLLOWING");

// 玩家上车
riding = true;
player.riding = true;
foxNpc.update(1 / 60, 0.1);
assert.equal(foxNpc.isOnTram(), true, "应标记在车上");
assert.equal(fox.parent, tram, "阿狸应挂到电车");
assert.ok(
  fox.position.distanceTo(FOX_TRAM_SEAT_LOCAL) < 1e-6,
  `卧位 local 应对齐 FOX_TRAM_SEAT_LOCAL，实际 ${fox.position.toArray()}`
);
assert.equal(fox.userData.companionResting, true);
assert.equal(fox.userData.parts.sleepG.visible, true);
ok("上车：挂到电车 + 卧姿 + 座位 local 对齐");

// 电车移动：阿狸应跟着（世界坐标变化）
const before = new THREE.Vector3();
fox.getWorldPosition(before);
tram.position.x += 3;
tram.updateMatrixWorld(true);
foxNpc.update(1 / 60, 0.2);
const after = new THREE.Vector3();
fox.getWorldPosition(after);
assert.ok(after.distanceTo(before) > 2.5, "电车移动后阿狸世界坐标应跟随");
ok(`电车移动后阿狸跟随（Δ=${after.distanceTo(before).toFixed(2)}）`);

// 玩家下车
riding = false;
player.riding = false;
player.position.set(tram.position.x + 1.5, 40.2, tram.position.z + 1.2);
foxNpc.update(1 / 60, 0.3);
assert.equal(foxNpc.isOnTram(), false);
assert.notEqual(fox.parent, tram, "下车后不应仍挂在电车");
assert.equal(fox.getState(), "FOLLOWING");
assert.equal(fox.userData.parts.walkRoot.visible, true);
ok("下车：恢复站立跟随，离开电车父节点");

// 未跟随则不上车
fox.switchState("SLEEPING");
riding = true;
foxNpc.update(1 / 60, 0.4);
assert.equal(foxNpc.isOnTram(), false);
assert.notEqual(fox.parent, tram);
ok("未跟随（SLEEPING）时不上车");

console.log(`\n全部通过：${pass} 项断言`);
