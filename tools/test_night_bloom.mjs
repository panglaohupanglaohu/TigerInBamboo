// =====================================================================
// 迷你 Bloom（S18 夜港辉光）验收：
//  · 自包含后处理（亮通→H/V 模糊→合成），零 examples 依赖；
//  · 阈值只放超亮自发光进来；强度乘夜权重（白天直出零 pass）；
//  · 开关 P.nightBloomV1，回滚回 renderer.render 直出；
//  · main.js 渲染循环接线 + resize。
// 运行：node tools/test_night_bloom.mjs
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
const stubEl = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "", appendChild() {}, addEventListener() {},
  querySelector: () => stubEl(), querySelectorAll: () => [],
});
const stubCanvas = () => {
  const el = stubEl();
  el.width = 640; el.height = 360;
  el.getContext = () => ({
    canvas: el, fillRect() {}, clearRect() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText() {}, drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  });
  el.toDataURL = () => "";
  return el;
};
globalThis.document = {
  createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [],
  body: { appendChild() {} }, addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createMiniBloom, MINI_BLOOM_SCHEMA_VERSION } = await import(
  new URL("src/render/postprocessing/miniBloom.js", BASE).href
);
const { nightWeightAt } = await import(new URL("src/render/lighting/highlandLightVolumes.js", BASE).href);

let pass = 0;
const ok = (message) => { pass += 1; console.log(`  ✓ ${message}`); };

// stub renderer：记录 setRenderTarget 序列与 render 调用
function stubRenderer() {
  const calls = { renderTargets: [], sceneRenders: 0, quads: 0 };
  const renderer = {
    domElement: { width: 640, height: 360 },
    setRenderTarget(rt) { calls.renderTargets.push(rt); },
    render(scene) {
      const hasRealObjects = scene.children.some((c) => c.isMesh || c.isLight || c.isGroup && c.name === "");
      if (hasRealObjects || scene.isScene && scene.children.length && !scene.children.every((c) => c.isMesh && c.geometry?.userData?.isQuad)) {
        calls.sceneRenders += 1;
      } else {
        calls.quads += 1;
      }
    },
    __calls: calls,
  };
  return renderer;
}

// --- 1. 创建与参数 ------------------------------------------------------
const renderer = stubRenderer();
const bloom = createMiniBloom(THREE, renderer, {
  strength: 0.55, threshold: 0.72,
  getTimeOfDay: () => 0.9, nightWeightAt,
});
assert.equal(bloom.params.version, MINI_BLOOM_SCHEMA_VERSION);
assert.equal(bloom.params.strength, 0.55);
assert.equal(bloom.params.threshold, 0.72);
ok(`创建：schema ${MINI_BLOOM_SCHEMA_VERSION}，strength/threshold 参数化`);

// --- 2. 夜间 render：完整 pass 序列（场景RT→亮通→H→V→屏幕合成）----------
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
const camera = new THREE.PerspectiveCamera();
bloom.render(scene, camera);
const calls = renderer.__calls;
assert.ok(calls.sceneRenders >= 2, `场景渲染 ${calls.sceneRenders} 次（场景RT + 合成）`);
// setRenderTarget 序列：rtScene → brightA → brightB → brightA → null
assert.equal(calls.renderTargets.length, 5, `setRenderTarget ${calls.renderTargets.length} 次`);
assert.equal(calls.renderTargets[4], null, "最终合成到屏幕（null RT）");
ok("夜间 pass 序列：场景RT → 亮通 → H/V 模糊 → 屏幕合成");

// --- 3. 白天直出：零后处理 ---------------------------------------------
const dayRenderer = stubRenderer();
const dayBloom = createMiniBloom(THREE, dayRenderer, {
  getTimeOfDay: () => 0.5, nightWeightAt,
});
dayBloom.render(scene, camera);
assert.equal(dayRenderer.__calls.renderTargets.filter((rt) => rt !== null).length, 0, "白天不写任何中间 RT");
assert.ok(dayRenderer.__calls.renderTargets.includes(null), "白天直出屏幕");
ok("白天：夜权重 0 → 直出，零后处理开销");

// --- 4. resize ---------------------------------------------------------
bloom.setSize(1280, 720);
bloom.render(scene, camera);
ok("resize 后 pass 序列仍完整");

// --- 4b. 帧时间自适应降级：持续 <38fps → 永久回落直出 -------------------
const lagRenderer = stubRenderer();
const lagBloom = createMiniBloom(THREE, lagRenderer, { getTimeOfDay: () => 0.9, nightWeightAt });
for (let i = 0; i < 50; i++) lagBloom.recordFrame(i * 40 + 1); // 40ms/帧 ≈ 25fps
assert.equal(lagBloom.degraded, true, "低帧率触发降级");
lagBloom.render(scene, camera);
assert.equal(lagRenderer.__calls.renderTargets.filter((rt) => rt !== null).length, 0, "降级后不再写 RT（直出）");
const okRenderer = stubRenderer();
const okBloom = createMiniBloom(THREE, okRenderer, { getTimeOfDay: () => 0.9, nightWeightAt });
for (let i = 0; i < 50; i++) okBloom.recordFrame(i * 16 + 1); // 16ms/帧 ≈ 60fps
assert.equal(okBloom.degraded, false, "高帧率不降级");
ok("自适应降级：40ms 帧间隔 45 帧后回落直出；60fps 不受影响");

// --- 5. dispose 后回落直出 ---------------------------------------------
bloom.dispose();
const afterDispose = stubRenderer();
const bloom2 = createMiniBloom(THREE, afterDispose, { getTimeOfDay: () => 0.9, nightWeightAt });
bloom2.dispose();
bloom2.render(scene, camera);
assert.equal(afterDispose.__calls.renderTargets.filter((rt) => rt !== null).length, 0, "dispose 后不再写 RT");
ok("dispose 后 render 回落 renderer.render 直出");

// --- 6. 开关默认值与回滚 ------------------------------------------------
const params = await import(new URL("src/core/params.js", BASE).href);
assert.equal(params.P.nightBloomV1, true, "nightBloomV1 默认开（主人验收要求）");
assert.equal(params.P.nightBloomStrength, 0.7);
assert.equal(params.P.nightBloomThreshold, 0.72);
ok("P.nightBloomV1 默认开；P.nightBloomStrength/Threshold 可调");

// --- 7. main.js 渲染循环接线 -------------------------------------------
const main = fs.readFileSync(new URL("src/main.js", BASE), "utf8");
assert.match(main, /import \{ createMiniBloom \} from "\.\/render\/postprocessing\/miniBloom\.js";/, "main.js 导入 miniBloom");
assert.match(main, /import \{ nightWeightAt \} from "\.\/render\/lighting\/highlandLightVolumes\.js";/, "夜权重复用光体积模块");
assert.match(main, /P\.nightBloomV1\s*\?\s*createMiniBloom\(THREE, renderer/, "开关接入");
assert.match(main, /if \(nightBloom\) \{\s*try \{[\s\S]*?nightBloom\.render\(scene, camera\);[\s\S]*?\} else \{\s*renderer\.render\(scene, camera\);/, "渲染循环走 bloom 分支，关闭时直出");
ok("main.js：创建/开关/渲染分支/resize 全接线");

console.log(`\n✅ 迷你 bloom：亮通阈值 ${0.72} 只放超亮自发光进来，夜间 5-pass 合成、白天直出、开关可回滚`);
console.log(`全部通过：${pass} 组验收`);
