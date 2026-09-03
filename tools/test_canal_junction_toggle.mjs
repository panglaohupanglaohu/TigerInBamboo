// =====================================================================
// 运河交汇古堡条件构建验收（B4）：
//   · canalJunctionV1=true 时正常构建古堡与交汇盒；
//   · canalJunctionV1=false 时返回 null，下游 update/mesh 均为 null-safe，不报错；
//   · 可通过 ?canalJunctionV1=0 或 ?canalJunction=0 动态关闭以测量/诊断开销。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubCanvas = () => {
  const el = { width: 64, height: 64, style: {} };
  el.getContext = () => ({
    canvas: el,
    fillRect() {},
    clearRect() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    fillText() {},
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  });
  el.toDataURL = () => "";
  return el;
};

globalThis.document = {
  getElementById: () => null,
  createElement: (tag) => (tag === "canvas" ? stubCanvas() : { style: {}, appendChild() {}, addEventListener() {} }),
  head: { appendChild() {} },
  body: { appendChild() {} },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { loadCanalNetwork } = await import(new URL("src/scenes/messenger/loadTraffic.js", BASE).href);
const { FEATURES, applyUrlOverrides } = await import(new URL("src/core/params.js", BASE).href);

const scene = new THREE.Scene();
const R = 160;

// 1. 默认构建：返回实例
FEATURES.canalJunctionV1 = true;
const resOn = loadCanalNetwork({
  scene,
  R,
  moonLake: { centerWorld: new THREE.Vector3(0, 160, 0), position: new THREE.Vector3(0, 160, 0) },
  bookshop: { position: new THREE.Vector3(50, 150, 0) },
  camp: { landmarks: { anchor: { position: new THREE.Vector3(0, 160, 0) } } },
  odysseyCitadel: { position: new THREE.Vector3(20, 158, 20) },
  citadelRange: { moat: null },
  citySeaLake: { centerDir: new THREE.Vector3(0, 1, 0) },
  canyonDir: new THREE.Vector3(0, 1, 0),
  harbor: { position: new THREE.Vector3(30, 155, 0) },
  harborBuilt: null,
  canalScope: "crystal-city",
  oceanWorldRoutes: false,
});
assert.ok(resOn.canalJunctionCitadel != null, "默认状态应构建运河交汇古堡");
assert.ok(resOn.canalJunctionBox != null, "默认状态应构建交汇盒");

// 2. 关闭构建：返回 null 且不抛错
FEATURES.canalJunctionV1 = false;
const resOff = loadCanalNetwork({
  scene,
  R,
  moonLake: { centerWorld: new THREE.Vector3(0, 160, 0), position: new THREE.Vector3(0, 160, 0) },
  bookshop: { position: new THREE.Vector3(50, 150, 0) },
  camp: { landmarks: { anchor: { position: new THREE.Vector3(0, 160, 0) } } },
  odysseyCitadel: { position: new THREE.Vector3(20, 158, 20) },
  citadelRange: { moat: null },
  citySeaLake: { centerDir: new THREE.Vector3(0, 1, 0) },
  canyonDir: new THREE.Vector3(0, 1, 0),
  harbor: { position: new THREE.Vector3(30, 155, 0) },
  harborBuilt: null,
  canalScope: "crystal-city",
  oceanWorldRoutes: false,
  buildCanalJunction: false,
});
assert.equal(resOff.canalJunctionCitadel, null, "关闭状态 canalJunctionCitadel 必须为 null");
assert.equal(resOff.canalJunctionBox, null, "关闭状态 canalJunctionBox 必须为 null");

// 3. URL override 解析
applyUrlOverrides("?canalJunction=0");
assert.equal(FEATURES.canalJunctionV1, false, "?canalJunction=0 应正确覆盖");
applyUrlOverrides("?canalJunctionV1=1");
assert.equal(FEATURES.canalJunctionV1, true, "?canalJunctionV1=1 应正确覆盖");

// 复位
FEATURES.canalJunctionV1 = true;

console.log("test_canal_junction_toggle: ok");
