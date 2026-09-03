// =====================================================================
// 性能探针的卡顿统计验收（2026-09-02）。
// perfProbe 依赖 DOM，Node 里跑不起来，因此做源码级守卫。
// 起因：均值过滤会丢弃 >250ms 的帧，而那恰恰是玩家唯一有感的「卡顿」，
// 旧实现等于把要治的病从仪表上抹掉了。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/stripComments.mjs";

const src = stripComments(fs.readFileSync(
  fileURLToPath(new URL("../TigerMessenger/src/tools/perfProbe.js", import.meta.url)), "utf8"));

assert.match(src, /hitches\+\+/, "缺少卡顿计数");
assert.match(src, /worstMs/, "缺少最差帧记录");

// 顺序是关键：卡顿必须在 <250ms 的均值过滤【之前】统计
assert.ok(
  src.indexOf("hitches++") < src.indexOf("frames.push(interval)"),
  "卡顿统计被排在均值过滤之后，>250ms 的帧会再次丢失"
);

// 上限存在，避免把切后台的几秒空档算成卡顿
assert.match(src, /interval < 2000/, "缺少切后台上限，长挂起会被误报为卡顿");

// reset() 必须一并清零，否则 A/B 对照会带着上一段的卡顿数
const resetBody = src.slice(src.indexOf("reset()"), src.indexOf("reset()") + 220);
assert.match(resetBody, /hitches = 0/, "reset 未清零卡顿计数");
assert.match(resetBody, /worstMs = 0/, "reset 未清零最差帧");

// 快照与 HUD 都要暴露，否则测了也看不见
assert.match(src, /hitches,/, "snapshot 未导出 hitches");
assert.match(src, /hitch\s+\$\{s\.hitches\}/, "HUD 未显示卡顿");

console.log("✅ test_perf_probe_hitch");
