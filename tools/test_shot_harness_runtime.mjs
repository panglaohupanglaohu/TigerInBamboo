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
// 现役入口必须随高山水平厚地台一起换戳，防止浏览器混用逐格曲率旧模块。
assert.match(indexHtml, /main\.js\?v=20260826-oskar-default-grass-v1/);
for (const source of citadelImporters) {
  assert.match(source, /citadelTown\.js\?v=20260825-highland-obelisk-stone-v3/,
    "所有现役城堡入口必须请求同一个 citadelTown 版本，避免浏览器混用旧导出缓存");
}

assert.equal(resolveActiveWorldVersion({ search: "" }), "custom");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v7" }), "v7");
assert.equal(resolveActiveWorldVersion({ search: "?worldVersion=v9" }), "v9");
assert.equal(resolveActiveWorldVersion({
  search: "",
  features: { worldVersion: "custom", planetTerrainV1: true, planetPresentationVersion: "legacy" },
}), "v8", "enabling terrain without C must not land on V9");

console.log("✅ Runtime shot harness: V7/V8/V9 A/B/C, live focus, lighting A/B, cache-coherent citadel modules and capture contract passed");
