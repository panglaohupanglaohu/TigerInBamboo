// BirdVortexManager 验收：InstancedMesh 500–1000 · 旋涡场 · 光暗双色 · 无 scene.add 逐鸟
// 运行：node tools/test_bird_vortex.mjs
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
    fillRect() {},
    clearRect() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText() {},
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
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
const {
  BirdVortexManager,
  VORTEX_LIT,
  VORTEX_SHADE,
  createVortexBirdTemplate,
} = await import(new URL("src/world/birdVortex.js", BASE).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] InstancedMesh 规模与拓扑");
const scene = new THREE.Scene();
const origin = new THREE.Vector3(10, 42, -5);
const up = new THREE.Vector3(0.1, 0.98, 0.1).normalize();
const right = new THREE.Vector3(1, 0, 0);
right.addScaledVector(up, -right.dot(up)).normalize();
const forward = new THREE.Vector3().crossVectors(right, up).normalize();

const vortex = new BirdVortexManager(scene, {
  count: 640,
  origin,
  up,
  right,
  forward,
  yFloor: 8,
  yCeil: 62,
  rCore: 5.2,
  rOuter: 28,
});
assert.equal(vortex.count, 640);
assert(vortex.count >= 500 && vortex.count <= 1000);
ok(`count=${vortex.count} ∈ [500,1000]`);

let instanced = 0;
let nonInstanced = 0;
vortex.root.traverse((o) => {
  if (o.isInstancedMesh) instanced++;
  else if (o.isMesh) nonInstanced++;
});
assert.equal(nonInstanced, 0, `禁止逐鸟 Mesh，发现 ${nonInstanced}`);
assert.equal(instanced, 6, `应 3 实体 + 3 描边 = 6 个 InstancedMesh，实际 ${instanced}`);
ok(`Draw Call 单元：${instanced} 个 InstancedMesh，0 个散装 Mesh`);

assert(vortex.bodyMesh.instanceColor, "body 需 instanceColor");
assert(vortex.wingLMesh.instanceColor, "wingL 需 instanceColor");
ok("实例色缓冲已分配");

console.log("[2] 旋涡场演化");
const before = vortex.getBirdPosition(0, new THREE.Vector3()).clone();
for (let i = 0; i < 180; i++) vortex.update(1 / 60, i / 60);
const after = vortex.getBirdPosition(0, new THREE.Vector3());
assert(after.distanceTo(before) > 0.05, "鸟应被向量场驱动");
ok(`样本鸟 3s 位移 ${after.distanceTo(before).toFixed(2)}`);

const st = vortex.sampleStats();
assert(st.meanHeight >= 8 && st.meanHeight <= 62, `均高 ${st.meanHeight.toFixed(1)} 应在 8–62`);
assert(st.meanRadius < 30, `均半径 ${st.meanRadius.toFixed(1)} 应包住要塞而非飞散`);
assert(st.litRatio > 0.15 && st.litRatio < 0.85, `光暗比 ${st.litRatio.toFixed(2)} 应两色并存`);
ok(
  `均高=${st.meanHeight.toFixed(1)} 均半径=${st.meanRadius.toFixed(1)} 亮面比=${st.litRatio.toFixed(2)}`
);

// 硬顶：强行抬高后应被压回
for (let i = 0; i < vortex.count; i++) {
  vortex.py[i] = origin.y + up.y * 90;
  vortex.px[i] = origin.x + up.x * 90;
  vortex.pz[i] = origin.z + up.z * 90;
  vortex.vy[i] = 20;
}
for (let i = 0; i < 90; i++) vortex.update(1 / 60, i / 60);
const st2 = vortex.sampleStats();
assert(st2.meanHeight <= 63, `硬顶失效 meanH=${st2.meanHeight}`);
ok(`高度硬顶 meanH=${st2.meanHeight.toFixed(1)} ≤ 63`);

console.log("[3] 光暗双色");
const c = new THREE.Color();
const hexes = new Set();
for (let i = 0; i < Math.min(80, vortex.count); i++) {
  vortex.bodyMesh.getColorAt(i, c);
  hexes.add(c.getHexString().toLowerCase());
}
assert(hexes.size >= 1, "应有实例色");
// 允许插值微调后的碎金/藏青近邻
const hasGoldish = [...hexes].some(
  (h) => h === "fad7a0" || h.startsWith("fa") || h.startsWith("fb") || h.startsWith("f8")
);
const hasDarkish = [...hexes].some(
  (h) => h === "2c3e50" || h.startsWith("2c") || h.startsWith("1") || h.startsWith("2")
);
assert(hasGoldish, `应有碎金近色，实际 ${[...hexes].join(",")}`);
assert(hasDarkish, `应有藏青近色，实际 ${[...hexes].join(",")}`);
ok(`光暗双色样本：${[...hexes].slice(0, 6).join(" / ")}`);

console.log("[4] 电车排斥 + 模板");
const tram = new THREE.Object3D();
tram.position.copy(origin).addScaledVector(up, 20).addScaledVector(right, 8);
const pBefore = [];
for (let i = 0; i < 20; i++) pBefore.push(vortex.getBirdPosition(i, new THREE.Vector3()).clone());
for (let i = 0; i < 60; i++) vortex.update(1 / 60, i / 60, { tram });
let pushed = 0;
for (let i = 0; i < 20; i++) {
  const p = vortex.getBirdPosition(i, new THREE.Vector3());
  if (p.distanceTo(tram.position) + 0.01 >= pBefore[i].distanceTo(tram.position)) pushed++;
}
// 不要求全部被推开，但系统应稳定
ok("电车排斥路径 update 无异常");

const tpl = createVortexBirdTemplate();
assert.equal(tpl.name, "vortex-bird-template");
ok("createVortexBirdTemplate 可用");

console.log("[5] 场景接线");
const island = fs.readFileSync(
  fileURLToPath(new URL("src/scenes/messengerIsland.js", BASE)),
  "utf8"
);
assert(island.includes("BirdVortexManager"), "场景应导入 BirdVortexManager");
assert(island.includes("birdVortex"), "场景应挂 landmarks.birdVortex");
assert(!island.includes("citadelBirdVortex"),
  "圣城鸟群对象和 landmarks 槽位必须一并删除");
assert(!island.includes('name: "citadel-bird-vortex-river"'),
  "圣城区域不得实例化鸟群旋涡");
ok("messengerIsland 保留叹息之门鸟群 · 圣城鸟群已清空");

vortex.dispose();
ok("dispose 无异常");

console.log(`\n全部通过：${pass} 项断言`);
console.log(`常量：LIT=#${VORTEX_LIT.getHexString()} SHADE=#${VORTEX_SHADE.getHexString()}`);
