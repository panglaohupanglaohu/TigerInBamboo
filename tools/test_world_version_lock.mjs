// 世界档锁定验收（2026-09-01 卡顿事故后重写）：
//   主页永远是 custom/legacy，绝不随日历漂移；只有显式 ?worldVersion= 才切实验管线。
//
// 本文件前身是 test_world_seasons.mjs，验收「按月份自动换管线」。该机制在
// 2026-09-01 引发事故：代码一行未改，仅因翻到 9 月 1 日就自动点燃了从未联调
// 过的 V9 重型管线。机制已删除，季节改由地理纬度驱动（world/seasonBands.js）。
//
// 运行：node tools/test_world_version_lock.mjs
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
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const params = await import(new URL("src/core/params.js", BASE).href);
const { applyUrlOverrides, FEATURES, resolveActiveWorldVersion } = params;

let pass = 0;
const ok = (message) => { pass += 1; console.log(`  \u2713 ${message}`); };

// --- 1. 日历耦合已根除 ---------------------------------------------------
assert.equal(params.seasonWorldVersion, undefined, "seasonWorldVersion 必须已删除");
assert.equal(FEATURES.seasonWorldV1, undefined, "seasonWorldV1 flag 必须已删除");
ok("日历耦合已根除：seasonWorldVersion / seasonWorldV1 都不存在");

// --- 2. 默认入口永远 custom（与月份无关） --------------------------------
applyUrlOverrides("");
assert.equal(FEATURES.worldVersion, "custom", "默认 worldVersion=custom");
assert.equal(FEATURES.planetPresentationVersion, "legacy", "默认表演层=legacy");
assert.equal(resolveActiveWorldVersion({ search: "" }), "custom", "默认解析为 custom");
ok("默认入口 = custom/legacy");

// --- 3. 反复调用不漂移（幂等） -------------------------------------------
for (let i = 0; i < 12; i++) applyUrlOverrides("");
assert.equal(FEATURES.worldVersion, "custom", "反复调用仍为 custom");
assert.equal(resolveActiveWorldVersion({ search: "" }), "custom");
ok("幂等：反复调用 12 次仍锁在 custom（模拟跨月不漂移）");

// --- 4. URL 显式切档仍然可用（开发验收入口保留） -------------------------
applyUrlOverrides("?worldVersion=v8");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v8" }), "v8", "显式 v8 生效");
assert.equal(FEATURES.curvedWaterV1, true, "v8 预设已套用");
applyUrlOverrides("?worldVersion=v9");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v9" }), "v9", "显式 v9 生效");
ok("URL 显式 ?worldVersion= 仍可进 v8/v9（手动验收入口保留）");

// --- 5. 切过实验档后，无参数调用必须切回 custom -------------------------
applyUrlOverrides("");
assert.equal(FEATURES.worldVersion, "custom", "无参数必须回落 custom");
assert.equal(FEATURES.planetPresentationVersion, "legacy", "表演层回落 legacy");
ok("无参数调用总是回落 custom —— 实验档不会粘住");

console.log(`\n\u2705 世界档已锁定 custom：无日历耦合、幂等、URL 手动切档仍可用`);
console.log(`全部通过：${pass} 组断言`);
