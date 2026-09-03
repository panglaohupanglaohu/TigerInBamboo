// =====================================================================
// 守卫：禁止日历驱动的行为差异，禁止季相触碰渲染管线开关。
//
// 2026-09-01 事故：params.js 的 seasonWorldVersion() 用真实月份决定
// 渲染管线版本（秋→V9），代码一行没改，仅仅因为翻到 9 月 1 日就把
// 从未联调过的重型管线整体点燃。本测试是防止该类事故重演的最后一道闸。
//
// 提交前必跑。
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/stripComments.mjs";

const SRC = fileURLToPath(new URL("../TigerMessenger/src", import.meta.url));

const CLOCK = /new Date\(|Date\.now\(|\.getMonth\(|\.getFullYear\(/;
const PIPELINE = /FEATURES|worldVersion|planetPresentationVersion|WORLD_VERSION_PRESETS/;

/** 只有【配置层】与【季相层】受时钟禁令约束；玩法逻辑用时间是正常的。 */
const CLOCK_GUARDED = /(^|\/)params\.js$|(^|\/)worldConfig\.js$|(^|\/)season[^/]*\.js$/i;
/** 季相文件额外禁止触碰管线开关。 */
const SEASON_ONLY = /(^|\/)season[^/]*\.js$/i;

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
})(SRC);

const offenders = [];
for (const file of files) {
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  const code = stripComments(fs.readFileSync(file, "utf8"));

  if (CLOCK_GUARDED.test(rel) && CLOCK.test(code)) {
    offenders.push(`${rel}: 配置/季相层出现日历调用 —— 行为不得随真实时间漂移`);
  }
  if (SEASON_ONLY.test(rel) && PIPELINE.test(code)) {
    offenders.push(`${rel}: 季相不得触碰渲染管线开关 —— 季节是美术属性，不是工程属性`);
  }
}

if (offenders.length) {
  console.error("❌ 日历/管线耦合守卫失败：");
  for (const o of offenders) console.error("  " + o);
  process.exit(1);
}
console.log(`test_no_calendar_coupling: ok (扫描 ${files.length} 个文件)`);
