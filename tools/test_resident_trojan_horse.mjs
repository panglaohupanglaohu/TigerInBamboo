// =====================================================================
// 木马常驻验收（2026-09-02）：存档只能改木马位置，不能把它挤掉。
// 起因：编辑器里摆一棵古树存档后，旧的「存档非空即以存档为准」规则
// 让城堡前的木马整个消失（主人实测）。
// =====================================================================
import assert from "node:assert/strict";
import { withResidentTrojanHorse, DEFAULT_TROJAN_HORSE } from
  "../TigerMessenger/src/world/citadelBlueprint.js";

// 1. 空存档 / 无存档：补一匹默认木马
assert.equal(withResidentTrojanHorse([]).length, 1);
assert.equal(withResidentTrojanHorse(undefined)[0].type, "trojanHorse");
assert.deepEqual(withResidentTrojanHorse([])[0], { ...DEFAULT_TROJAN_HORSE });

// 2. 存档里只有别的对象：木马补回，原对象保留（这就是主人遇到的那一例）
const savedTree = {
  id: "elderTree-3-7", type: "elderTree", terraceIndex: 3,
  x: 16.095, z: 17.655, yaw: 0, scale: 0.45, grounded: true,
};
const merged = withResidentTrojanHorse([savedTree]);
assert.equal(merged.length, 2);
assert.deepEqual(merged[0], savedTree, "既有对象不得被改写");
assert.equal(merged[1].type, "trojanHorse");

// 3. 存档已带木马：以存档为准，位置不被默认值覆盖
const movedHorse = { ...DEFAULT_TROJAN_HORSE, id: "horse-a", x: 12, z: -3, yaw: 2.1 };
const kept = withResidentTrojanHorse([movedHorse, savedTree]);
assert.equal(kept.filter((o) => o.type === "trojanHorse").length, 1, "不得出现两匹");
assert.deepEqual(kept[0], movedHorse, "存档里的位置/角度必须保留");

// 4. 不修改入参
const input = [savedTree];
withResidentTrojanHorse(input);
assert.equal(input.length, 1, "不得就地改写调用方数组");

// 5. 装载路径必须走这个合并，编辑器不得真的删掉木马
import fs from "node:fs";
const loadCitadel = fs.readFileSync(
  new URL("../TigerMessenger/src/scenes/messenger/loadCitadel.js", import.meta.url), "utf8");
assert.match(loadCitadel, /withResidentTrojanHorse\(citadelTerrainObjects\)/);
const editor = fs.readFileSync(
  new URL("../TigerMessenger/src/ui/citadelEditorPanel.js", import.meta.url), "utf8");
assert.match(editor, /\?\.type === "trojanHorse"[\s\S]{0,200}return false;/,
  "编辑器删除入口必须拒绝木马，否则 UI 显示已删、刷新又回来");

console.log("✅ test_resident_trojan_horse");
