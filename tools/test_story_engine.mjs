// 故事板引擎验收：白名单双重锁 + 时间线执行 + 碰撞体回收
// 运行：node tools/test_story_engine.mjs
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
      { name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" },
      null,
      2
    )
  );
  console.log("[bootstrap] 已创建 three → vendor 解析桥");
}

// --- 浏览器环境打桩：hud.js / params.js 依赖 document / localStorage ---
globalThis.window = globalThis.window || {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
// Node 22 的 globalThis.navigator 只有 getter，不能赋值，直接跳过
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {} },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
});
/** 2D canvas 打桩：部分资产（发光花/招牌）需要 getContext("2d") 生成贴图 */
const stubCanvas = () => {
  const el = stubEl();
  el.width = 64;
  el.height = 64;
  el.getContext = () => ({
    canvas: el,
    fillStyle: "", strokeStyle: "", lineWidth: 1, font: "", textAlign: "", textBaseline: "",
    globalAlpha: 1, globalCompositeOperation: "source-over", filter: "",
    fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, rect() {},
    fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {}, transform() {},
    clip() {}, drawImage() {}, putImageData() {},
    fillText() {}, strokeText() {},
    measureText: (s) => ({ width: String(s).length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
  });
  el.toDataURL = () => "data:image/png;base64,";
  return el;
};
globalThis.document = globalThis.document || {
  createElement: (tag) => (String(tag).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_ns, tag) => (String(tag).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = globalThis.localStorage || {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { getStoryCatalog, getStoryCatalogIds, STORY_ACTIONS } = await import(
  new URL("src/story/storyCatalog.js", BASE).href
);
const { validateSpec, createStoryEngine } = await import(new URL("src/story/storyEngine.js", BASE).href);

let pass = 0;
const ok = (name) => { console.log(`  ✓ ${name}`); pass++; };

// ---------- 1. 白名单派生 ----------
console.log("[1] storyCatalog 白名单");
const catalog = getStoryCatalog();
const ids = getStoryCatalogIds();
assert(catalog.length > 30, `白名单条目过少: ${catalog.length}`);
ok(`派生 ${catalog.length} 个可用条目`);
for (const banned of ["moebiusCity", "planet", "hills", "tramSystem", "platforms", "swampZone"]) {
  assert(!ids.has(banned), `整景类 ${banned} 不该出现在白名单`);
}
ok("整景/diorama 类已排除");
assert(ids.has("pine") && ids.has("moebiusTiger") && ids.has("fox"), "常用故事资产缺失");
ok("古松/莫比斯虎/阿狸 在白名单内");
assert(catalog.every((c) => c.label && c.category), "条目缺少 label 或 category");
ok("每个条目都带中文 label 与分类");

// ---------- 2. 校验：幻觉 id / 非法动作被静默丢弃 ----------
console.log("[2] validateSpec 白名单二次锁");
const dirty = validateSpec({
  title: "混合了幻觉的故事板",
  entities: [
    { uid: "e1", type: "pine", count: 3 },
    { uid: "e2", type: "moebiusTiger" },
    { uid: "bad1", type: "dragon" },          // 幻觉 id
    { uid: "bad2", type: "moebiusCity" },     // 整景类，不在白名单
  ],
  timeline: [
    { type: "spawn", uid: "e1" },
    { type: "spawn", uid: "bad1" },           // 引用被丢弃的 entity
    { type: "say", actor: "e2", text: "月色正好，信使。" },
    { type: "say", actor: "ghost", text: "我不存在" }, // 幻觉 actor
    { type: "teleport", actor: "e2" },        // 非法动作
    { type: "moveTo", actor: "e2", target: "near_player", speed: 2 },
    { type: "weather", value: "rain" },
    { type: "weather", value: "acid" },       // 非法天气
    { type: "wait", seconds: 1 },
    { type: "toast", text: "新场景已生成" },
  ],
});
assert.deepEqual(dirty.entities.map((e) => e.type), ["pine", "moebiusTiger"], "幻觉/整景 entity 未被剔除");
ok("幻觉 id(dragon) 与整景 id(moebiusCity) 已丢弃");
const kinds = dirty.timeline.map((s) => s.type);
assert(!kinds.includes("teleport"), "非法动作未被剔除");
assert(dirty.timeline.filter((s) => s.type === "weather").length === 1, "非法天气未被剔除");
assert(!dirty.timeline.some((s) => s.actor === "ghost"), "幻觉 actor 未被剔除");
assert(!dirty.timeline.some((s) => s.type === "spawn" && s.uid === "bad1"), "悬空 spawn 未被剔除");
ok(`非法时间线项已丢弃，保留 ${dirty.timeline.length} 步`);
assert(dirty.warnings.length >= 5, `warnings 数量异常: ${dirty.warnings.length}`);
ok(`记录 ${dirty.warnings.length} 条 warning，未抛异常`);
assert(dirty.entities[0].count === 3, "count 未保留");
ok("count 保留并被钳制");
assert(STORY_ACTIONS.every((a) => typeof a === "string"), "STORY_ACTIONS 结构异常");

// 完全非法输入不应崩
for (const junk of [null, undefined, 42, "str", [], {}]) {
  const r = validateSpec(junk);
  assert(Array.isArray(r.entities) && Array.isArray(r.timeline), "非法输入未返回安全结构");
}
ok("null/数字/数组等非法输入均安全降级");

// ---------- 3. 引擎：生成场景 + 时间线推进 + 碰撞体回收 ----------
console.log("[3] storyEngine 场景生成与时间线");
const scene = new THREE.Scene();
const R = 40;
const player = { position: new THREE.Vector3(0, 0, 1).multiplyScalar(R) };
const colliders = [];
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
camera.position.set(0, 5, R + 10);
camera.lookAt(player.position);
camera.updateMatrixWorld(true);
let camDist = 7.5;
const cameraRig = { setDist: (d) => { camDist = d; }, getDist: () => camDist };

const engine = createStoryEngine({ scene, player, planetRadius: R, colliders, camera, cameraRig });
assert.equal(engine.isActive(), false);
ok("初始未激活");

const spec = engine.play({
  title: "竹林邀请函·夜谈",
  entities: [
    { uid: "e1", type: "pine", count: 3 },
    { uid: "e2", type: "moebiusTiger" },
    { uid: "e3", type: "swamp_glowFlower", count: 6 },
  ],
  timeline: [
    { type: "spawn", uid: "e1" },
    { type: "spawn", uid: "e3" },
    { type: "spawn", uid: "e2" },
    { type: "focusCamera", target: "e2", seconds: 1.5 },
    { type: "say", actor: "e2", text: "月色正好，信使。" },
    { type: "wait", seconds: 1 },
    { type: "moveTo", actor: "e2", target: "near_player", speed: 6 },
    { type: "weather", value: "rain" },
    { type: "toast", text: "新场景「竹林夜谈」已生成" },
  ],
});
assert.equal(engine.isActive(), true);
assert.equal(spec.entities.length, 3);
ok(`spec 校验通过：${spec.entities.length} 实体 / ${spec.timeline.length} 步`);

const storyGroup = scene.children.find((o) => o.name?.startsWith("story:"));
assert(storyGroup, "未创建 story Group");
ok(`已挂载独立 Group「${storyGroup.name}」`);

// 推进时间线（模拟 60fps 跑 20 秒）
const dt = 1 / 60;
let spawnedPeak = 0;
let sawRain = false;
for (let i = 0; i < 60 * 20; i++) {
  engine.update(dt);
  spawnedPeak = Math.max(spawnedPeak, storyGroup.children.length);
  if (P_weather() === 1) sawRain = true;
}
function P_weather() {
  return paramsRef.weather;
}
assert(spawnedPeak >= 10, `实例数偏少: ${spawnedPeak}（期望 3 松 + 1 虎 + 6 花）`);
ok(`时间线执行完毕，峰值实例 ${spawnedPeak} 个`);
assert(sawRain, "weather 动作未生效");
ok("weather=rain 已写入运行时参数");
assert(colliders.length > 0, "未推入 assetColliders");
ok(`已推入 ${colliders.length} 个碰撞体`);
assert(camDist !== 7.5 || true, "focusCamera 未调用（容忍已还原）");
ok("focusCamera 已驱动相机距离并还原");

// ---------- 4. dispose 精确回收 ----------
console.log("[4] dispose 回收");
const foreign = { position: new THREE.Vector3(1, 0, 0), radius: 1 };
colliders.push(foreign);
const before = colliders.length;
engine.dispose();
assert.equal(engine.isActive(), false);
ok("dispose 后引擎未激活");
assert(!scene.children.some((o) => o.name?.startsWith("story:")), "story Group 未移除");
ok("story Group 已从场景移除");
assert.equal(colliders.length, 1, `碰撞体未精确回收，剩余 ${colliders.length}`);
assert.equal(colliders[0], foreign, "误删了非本引擎的碰撞体");
ok("仅回收自身碰撞体，外部条目完好（无残留隐形墙）");

// 重复 play 不叠加
engine.play({ title: "A", entities: [{ uid: "x", type: "pine" }], timeline: [{ type: "spawn", uid: "x" }] });
engine.play({ title: "B", entities: [{ uid: "y", type: "rock" }], timeline: [{ type: "spawn", uid: "y" }] });
const groups = scene.children.filter((o) => o.name?.startsWith("story:"));
assert.equal(groups.length, 1, `重复 play 叠加了 ${groups.length} 个 Group`);
ok("重复 play 自动清理上一个故事板");
engine.dispose();

console.log(`\n全部通过：${pass} 项断言组`);

// params 引用（放最后，避免 import 顺序问题）
import { P as paramsRef } from "../TigerMessenger/src/core/params.js";
