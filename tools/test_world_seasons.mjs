// 四季世界档验收（主人验收 2026-08-28）：
// 主页无显式 ?worldVersion 时按月份选管线——春夏 A·V7 / 秋 C·V9 / 冬 B·V8；
// URL 显式 worldVersion 永远优先；?seasonWorldV1=0 可整体关掉。
// 运行：node tools/test_world_seasons.mjs
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

const { seasonWorldVersion, applyUrlOverrides, FEATURES, resolveActiveWorldVersion } = await import(
  new URL("src/core/params.js", BASE).href
);

let pass = 0;
const ok = (message) => { pass += 1; console.log(`  ✓ ${message}`); };

// --- 1. 月份映射（纯函数，注入月份） ------------------------------------
// 2026-08-28 修订：A·V7 预设 = 旧运河世界（无海面），与主人认可的夜港
// 不一致 → 春/夏保持 custom 海面世界，秋=v9、冬=v8。
assert.equal(seasonWorldVersion(2), "custom", "3月=春 custom 海面");
assert.equal(seasonWorldVersion(4), "custom", "5月=春 custom 海面");
assert.equal(seasonWorldVersion(5), "custom", "6月=夏 custom 海面");
assert.equal(seasonWorldVersion(7), "custom", "8月=夏 custom 海面");
assert.equal(seasonWorldVersion(8), "v9", "9月=秋 v9");
assert.equal(seasonWorldVersion(10), "v9", "11月=秋 v9");
assert.equal(seasonWorldVersion(11), "v8", "12月=冬 v8");
assert.equal(seasonWorldVersion(0), "v8", "1月=冬 v8");
assert.equal(seasonWorldVersion(1), "v8", "2月=冬 v8");
ok("月份映射：春(2-4)夏(5-7)=custom 海面夜港，秋(8-10)=v9，冬(11,0,1)=v8");

// --- 2. applyUrlOverrides 集成：注入月份逐季验证 ------------------------
FEATURES.seasonWorldV1 = true;
// 夏（7月）：custom 海面
applyUrlOverrides("", { month: 7 });
assert.equal(FEATURES.worldVersion, "custom", "夏=custom");
assert.equal(FEATURES.planetPresentationVersion, "legacy", "夏=legacy 表演层");
assert.equal(resolveActiveWorldVersion({ search: "" }), "custom", "夏解析为 custom");
// 秋（9月）：C·V9
applyUrlOverrides("", { month: 9 });
assert.equal(FEATURES.worldVersion, "v9", "秋=v9");
assert.equal(FEATURES.curvedWaterV1, true, "秋=曲率海");
assert.equal(resolveActiveWorldVersion({ search: "" }), "v9", "秋解析为 v9");
// 冬（0月）：B·V8
applyUrlOverrides("", { month: 0 });
assert.equal(FEATURES.worldVersion, "v8", "冬=v8");
assert.equal(resolveActiveWorldVersion({ search: "" }), "v8", "冬解析为 v8");
// 回到当前真实月份
applyUrlOverrides("", {});
ok("集成：夏=custom 海面 / 秋=v9 / 冬=v8（注入月份逐季验证）");

// --- 3. URL 显式 worldVersion 优先 -------------------------------------
applyUrlOverrides("?worldVersion=v8");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v8" }), "v8", "URL v8 优先于季节");
applyUrlOverrides("?worldVersion=v9");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v9" }), "v9", "URL v9 优先于季节");
ok("URL 显式 worldVersion 永远优先于季节档");

// --- 4. ?seasonWorldV1=0 关闭：回落 custom ------------------------------
FEATURES.seasonWorldV1 = true; // 复位
FEATURES.worldVersion = "custom";
FEATURES.planetPresentationVersion = "legacy";
FEATURES.planetTerrainV1 = false;
FEATURES.procgenEngineV1 = false;
FEATURES.wfcCastleV1 = false;
FEATURES.marchingTerrainV1 = false;
applyUrlOverrides("?seasonWorldV1=0");
assert.equal(FEATURES.seasonWorldV1, false, "开关已写入");
assert.equal(resolveActiveWorldVersion({ search: "" }), "custom", "关闭后主页回落 custom（O3 契约）");
ok("?seasonWorldV1=0：整体关闭，回落 custom/legacy（默认入口契约不破坏）");

// --- 5. O3 契约不回退：resolveActiveWorldVersion("") 空关组合 = custom ---
FEATURES.seasonWorldV1 = false;
FEATURES.worldVersion = "custom";
FEATURES.planetPresentationVersion = "legacy";
assert.equal(resolveActiveWorldVersion({ search: "" }), "custom");
FEATURES.seasonWorldV1 = true;
ok("O3 契约：季节关闭 + 空开关组合仍解析为 custom");

console.log(`\n✅ 四季世界档：春夏 custom 海面夜港 / 秋 C·V9 / 冬 B·V8，URL 优先、可关、契约不破`);
console.log(`全部通过：${pass + 5} 组断言`);
