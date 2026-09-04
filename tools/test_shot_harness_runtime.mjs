import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveActiveWorldVersion } from "../TigerMessenger/src/core/params.js";

const main = readFileSync(new URL("../TigerMessenger/src/main.js", import.meta.url), "utf8");
const panel = readFileSync(new URL("../TigerMessenger/src/ui/shotHarnessPanel.js", import.meta.url), "utf8");
const devPanel = readFileSync(new URL("../TigerMessenger/src/core/devPanel.js", import.meta.url), "utf8");
const params = readFileSync(new URL("../TigerMessenger/src/core/params.js", import.meta.url), "utf8");
const planetRuntime = readFileSync(new URL("../TigerMessenger/src/world/planetV8/runtime.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../TigerMessenger/index.html", import.meta.url), "utf8");
const citadelImporters = [
  "src/main.js",
  "src/world/citadelBlueprint.js",
  "src/world/highlandCitadelDesign.js",
  "src/world/odysseyCitadel.js",
  "src/ui/citadelEditorPanel.js",
  "src/ui/citadelSceneEdit.js",
  "src/scenes/messenger/loadTraffic.js",
  "src/scenes/messenger/loadCitadel.js",
].map((path) => readFileSync(new URL(`../TigerMessenger/${path}`, import.meta.url), "utf8"));

assert.match(main, /createShotHarnessPanel/);
assert.match(main, /onOpenShotHarness/);
assert.match(main, /planetOskarV9/);
assert.match(main, /shotHarness: shotHarnessPanel/);
assert.match(main, /shotLab/);
assert.match(devPanel, /dev-open-shot-harness/);
assert.match(panel, /data-shot-mode="legacy"/);
assert.match(panel, /data-shot-phase="noon"/);
assert.match(panel, /data-shot-phase="sunset"/);
assert.match(panel, /data-shot-phase="night"/);
assert.match(panel, /download current screenshot|下载当前截图/);
assert.match(panel, /setFocus/);
assert.match(panel, /setEnabled\(true\)/);
assert.match(panel, /setEnabled\(false\)/);
assert.match(panel, /P\.daySpeed = 0/);
assert.match(panel, /shot-harness-preset/);
assert.match(panel, /setLightingPresetOverrides/);
assert.match(panel, /validateLightingPreset/);
assert.match(panel, /legacy-incode/);
assert.match(panel, /landform-palette-v9\.json/);
assert.match(panel, /data-world-version="\$\{version\}"/);
assert.match(panel, /A · V7/);
assert.match(panel, /B · V8/);
assert.match(panel, /C · V9/);
assert.match(panel, /switchWorldVersion/);
assert.match(panel, /worldVersion/);
assert.match(params, /WORLD_VERSION_PRESETS/);
assert.match(params, /applyWorldVersionPreset/);
assert.match(params, /planetPresentationVersion:\s*"legacy"/);
assert.match(params, /worldVersion:\s*"custom"/);
assert.match(params, /resolveActiveWorldVersion/);
assert.match(panel, /resolveActiveWorldVersion/);
assert.match(planetRuntime, /landformChain: isV9/);
assert.match(planetRuntime, /if \(isV9\)/);
assert.match(planetRuntime, /planet-sphere-baseline-v8/);
assert.match(planetRuntime, /oskar-continuous-chain-v9/);
// 现役入口必须随 main.js 改动一起换戳，否则浏览器读旧缓存、改动看似没生效。
// 守的是「带戳」与「所有城堡入口共用同一个戳」这两条契约，不写死具体戳——
// 写死会让每次正常 bump 都把这条测试打红，久而久之被当噪声忽略。
assert.match(indexHtml, /main\.js\?v=[\w.-]+/, "index.html 的 main.js 入口必须带 ?v= 缓存戳");
const citadelTags = new Set();
for (const source of citadelImporters) {
  const tag = source.match(/citadelTown\.js\?v=([\w.-]+)/)?.[1];
  assert.ok(tag, "现役城堡入口必须给 citadelTown.js 带 ?v= 缓存戳");
  citadelTags.add(tag);
}
assert.equal(citadelTags.size, 1,
  `所有现役城堡入口必须请求同一个 citadelTown 版本，避免浏览器混用旧导出缓存；实际有 ${citadelTags.size} 个：${[...citadelTags].join(" / ")}`);

assert.equal(resolveActiveWorldVersion({ search: "" }), "custom");
// v7 预设已删（2026-09-01）：未知版本必须回落 custom，不得报错或粘住
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v7" }), "custom");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v9" }), "v9");
assert.equal(resolveActiveWorldVersion({
  search: "",
  features: { worldVersion: "custom", planetTerrainV1: true, planetPresentationVersion: "legacy" },
}), "v8", "enabling terrain without C must not land on V9");

console.log("✅ Runtime shot harness: B/C 两档、live focus、lighting A/B、cache-coherent citadel modules and capture contract passed");
