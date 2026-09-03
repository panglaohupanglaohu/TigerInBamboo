// =====================================================================
// 逐对象普查的判读逻辑验收（2026-09-02）。
// 重点是「不可信的行不许排到前面」——之前七次错误结论，全部源于
// 把漂移中的读数当结论。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { summarizeTrial, rankTrials, CENSUS_DRIFT_LIMIT } from
  "../TigerMessenger/src/tools/sceneCensus.js";
import { stripComments } from "./lib/stripComments.mjs";

const s = (ms, calls = 0, triangles = 0) => ({ ms, calls, triangles });

// 1. 干净的一次：A 之间几乎不漂，收益如实算
const clean = summarizeTrial("warships", s(96, 4462, 50_000_000), s(74, 979, 11_000_000), s(97));
assert.equal(clean.baseMs, 96.5);
assert.equal(clean.savedMs, 22.5);
assert.equal(clean.calls, 3483);
assert.equal(clean.triangles, 39_000_000);
assert.ok(clean.driftPct < 2 && clean.trusted);

// 2. A 之间漂移过大 → 判不可信（这一条是整个工具存在的理由）
const drifting = summarizeTrial("phalanx", s(60), s(50), s(95));
assert.ok(drifting.driftPct > CENSUS_DRIFT_LIMIT);
assert.equal(drifting.trusted, false);

// 3. 隐藏后反而更慢：savedMs 允许为负，不许悄悄取绝对值
const worse = summarizeTrial("tram", s(60), s(66), s(61));
assert.ok(worse.savedMs < 0, "变慢必须如实报告为负收益");

// 4. 排序：不可信的一律沉底，哪怕它「收益」最大
const ranked = rankTrials([
  summarizeTrial("small", s(60), s(58), s(60)),   // 可信，省 2
  summarizeTrial("huge", s(60), s(10), s(200)),   // 不可信，省很多
  summarizeTrial("big", s(60), s(45), s(61)),     // 可信，省 15.5
]);
assert.deepEqual(ranked.map((r) => r.name), ["big", "small", "huge"]);
assert.equal(ranked.at(-1).trusted, false);

// 5. 零基线不得除出 NaN/Infinity
const zero = summarizeTrial("empty", s(0), s(0), s(0));
assert.equal(zero.driftPct, 0);
assert.equal(zero.savedPct, 0);

// 6. 接线：必须挂到 __tm 供控制台调用
const mainSrc = fs.readFileSync(
  fileURLToPath(new URL("../TigerMessenger/src/main.js", import.meta.url)), "utf8");
assert.match(mainSrc, /census: createSceneCensus\(/, "main.js 未暴露 __tm.census");

// 7. 普查必须在 rAF 内取样：循环外手动 render 量到的不是真实帧
const censusSrc = fs.readFileSync(
  fileURLToPath(new URL("../TigerMessenger/src/tools/sceneCensus.js", import.meta.url)), "utf8");
assert.match(censusSrc, /requestAnimationFrame/);
assert.doesNotMatch(stripComments(censusSrc), /renderer\.render\(/,
  "普查不得自己调 render，否则又回到 440k / 50M 那个假象");

console.log("✅ test_scene_census");
