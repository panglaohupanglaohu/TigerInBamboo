// 叹息之门鸟群迁移验收：峡谷 Boids + 城巡鸟迁到门顶；花厅忽聚忽散保留
// 运行：node tools/test_gate_bird_migrate.mjs
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
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
});
const stubCanvas = () => {
  const el = stubEl();
  el.width = 64;
  el.height = 64;
  el.getContext = () => ({
    canvas: el,
    fillStyle: "",
    fillRect() {},
    clearRect() {},
    beginPath() {},
    fill() {},
    stroke() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText() {},
    drawImage() {},
  });
  el.toDataURL = () => "";
  return el;
};
globalThis.document = {
  createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { FlockManager } = await import(new URL("src/world/flock.js", BASE).href);
const { BirdVortexManager } = await import(new URL("src/world/birdVortex.js", BASE).href);
const { GATE } = await import(new URL("src/world/abandonedGate.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 门廊走廊：穿三重门、不进云墙");
const scene = new THREE.Scene();
const canyonDir = new THREE.Vector3(0, -1, 0.2).normalize();
const flock = new FlockManager(scene, {
  count: 10,
  planetRadius: 40,
  centerDir: canyonDir,
  altMin: 35,
  altMax: 45,
});
const gateDir = new THREE.Vector3(0.4, 0.2, 0.9).normalize();
const origin = gateDir.clone().multiplyScalar(40);
const up = gateDir.clone();
const right = new THREE.Vector3(0, 1, 0).cross(up).normalize();
const forward = new THREE.Vector3().crossVectors(up, right).normalize();
const passApex = GATE.spring + GATE.passHalf;
const corridor = {
  origin,
  right,
  up,
  forward,
  halfWidth: GATE.passHalf + 1.1,
  halfLength: 20,
  yMin: 2.6,
  yMax: passApex - 1.2,
  cloudCeilY: GATE.wallTop - 6,
};
flock.setHome(gateDir, {
  altMin: corridor.yMin,
  altMax: corridor.yMax,
  windDir: forward,
  corridor,
  respawn: true,
});
assert(flock.corridor, "应启用走廊");
ok("走廊已启用");

for (const b of flock.birds) {
  const rel = b.group.position.clone().sub(origin);
  const ly = rel.dot(up);
  const lx = rel.dot(right);
  assert(ly < corridor.cloudCeilY - 0.5, `出生高度 ${ly.toFixed(1)} 不得接近云墙 ${corridor.cloudCeilY}`);
  assert(ly <= corridor.yMax + 0.6, `出生应在券洞高度带，ly=${ly.toFixed(1)}`);
  assert(Math.abs(lx) <= corridor.halfWidth + 0.5, `横向应在夹道内，lx=${lx.toFixed(1)}`);
}
ok("出生：夹道内、券洞高度、远离云墙");

// 强行推向云墙，update 应压回
for (const b of flock.birds) {
  b.group.position.copy(origin).addScaledVector(up, GATE.wallTop + 8);
  b.vel.copy(up).multiplyScalar(4);
}
for (let i = 0; i < 90; i++) flock.update(1 / 60, i / 60);
let maxY = -Infinity;
for (const b of flock.birds) {
  const ly = b.group.position.clone().sub(origin).dot(up);
  maxY = Math.max(maxY, ly);
}
assert(maxY < corridor.cloudCeilY, `云墙硬顶失效：maxY=${maxY.toFixed(1)} ≥ ${corridor.cloudCeilY}`);
ok(`云墙硬顶生效 maxY=${maxY.toFixed(1)} < ${corridor.cloudCeilY}`);

// 横向越界压回
for (const b of flock.birds) {
  b.group.position
    .copy(origin)
    .addScaledVector(up, 7)
    .addScaledVector(right, 12);
}
for (let i = 0; i < 60; i++) flock.update(1 / 60, i / 60);
let maxLat = 0;
for (const b of flock.birds) {
  maxLat = Math.max(maxLat, Math.abs(b.group.position.clone().sub(origin).dot(right)));
}
assert(maxLat <= corridor.halfWidth + 0.15, `横向硬夹失效 maxLat=${maxLat.toFixed(2)}`);
ok(`双子夹道硬夹 maxLat=${maxLat.toFixed(2)} ≤ ${corridor.halfWidth}`);

console.log("[2] 鸟群门体迁移与场景接线");
const gate = new THREE.Group();
const seatRoot = new THREE.Group();
gate.userData.seatRoot = seatRoot;
gate.add(seatRoot);
scene.add(gate);
const vortex = new BirdVortexManager(scene, {
  count: 500,
  origin: new THREE.Vector3(0, 40, 0),
  up: new THREE.Vector3(0, 1, 0),
  right: new THREE.Vector3(1, 0, 0),
  forward: new THREE.Vector3(0, 0, 1),
});
gate.position.set(18, 42, -7);
gate.rotation.y = Math.PI * 0.35;
assert(vortex.syncToGate(gate), "鸟群应能从迁移后的门体读取 frame");
assert(vortex.origin.distanceTo(gate.position) < 1e-6, "鸟群 origin 应跟随门体世界位置");
const bird = vortex.getBirdPosition(0, new THREE.Vector3());
assert(bird.distanceTo(vortex.origin) > 1, "重锚后鸟实例应在新门位周围生成");
assert.equal(vortex.root.frustumCulled, false, "旋涡根节点不得被视锥剔除");
for (const mesh of [vortex.bodyMesh, vortex.wingLMesh, vortex.wingRMesh]) {
  assert.equal(mesh.frustumCulled, false, "鸟群实例网格不得被视锥剔除");
}
ok("BirdVortex.syncToGate：门体迁移后 origin/实例矩阵已重锚且保持可见");

const island = [
  "src/scenes/messengerIsland.js",
  "src/scenes/messenger/loadTraffic.js",
].map((f) => fs.readFileSync(fileURLToPath(new URL(f, BASE)), "utf8")).join("\n");
assert(island.includes("BirdVortexManager"), "场景应创建 BirdVortexManager");
assert(island.includes("landmarks: messengerLandmarks") || island.includes("landmarks: {"),
  "场景应暴露 landmarks");
assert(island.includes("birdVortex"), "场景应挂 landmarks.birdVortex");
const main = fs.readFileSync(fileURLToPath(new URL("src/main.js", BASE)), "utf8");
assert(main.includes("syncToGate"), "门体迁移入口应同步 BirdVortex");
assert(main.includes("moveGateAndCloudsTo"), "启动/面板应共用门体迁移入口");
ok("main.js + messengerIsland：鸟群创建、暴露与门体迁移同步已接线");

const city = fs.readFileSync(
  fileURLToPath(new URL("src/world/moebiusCity.js", BASE)),
  "utf8"
);
assert(city.includes("migratePatrolHome") || city.includes("corridor"), "城市巡逻迁移接口应保留");
ok("moebiusCity 迁移支持");

console.log(`\n全部通过：${pass} 项断言`);
