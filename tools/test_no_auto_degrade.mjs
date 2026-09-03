// =====================================================================
// 「不做自动降级」守卫（2026-09-02）
//
// 主人定的架构原则：靠 low-poly 便宜，不靠硬件分档 / GPU 探测 / 自动降级。
// 被删掉的 governBloomByFps 是典型反例：持续 <26fps 就永久关掉 bloom，
// 注释声称会在帧率回升后恢复，代码里根本没有那条路径；更糟的是它会在
// A/B 对照过程中悄悄改变渲染配置，把性能读数搅浑。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/stripComments.mjs";

const read = (p) => stripComments(fs.readFileSync(
  fileURLToPath(new URL(`../TigerMessenger/${p}`, import.meta.url)), "utf8"));

const main = read("src/main.js");
const params = read("src/core/params.js");

// 1. 降级器本体不得复活
for (const banned of ["governBloomByFps", "bloomDisabled", "bloomFpsSamples"]) {
  assert.doesNotMatch(main, new RegExp(banned), `main.js 仍有自动降级残留：${banned}`);
}

// 2. 不许再出现「按帧率改渲染配置」的新写法
assert.doesNotMatch(main, /fps\s*<\s*\d+/, "main.js 出现按 fps 阈值分支，疑似新的自动降级");

// 3. bloom 仍是一个纯开关，且仍被真正使用
assert.match(params, /nightBloomV1: true/, "bloom 开关丢失");
assert.match(main, /P\.nightBloomV1/, "main.js 不再读 bloom 开关");
assert.match(main, /nightBloom\.render\(scene, camera\)/, "bloom 渲染路径丢失");

// 4. 已删模块不得留下孤儿 URL 解析（underseaCull 早已整体回滚）
assert.doesNotMatch(params, /underseaCullV1/,
  "params.js 仍在解析 underseaCullV1，但该模块已删除");

console.log("✅ test_no_auto_degrade");
