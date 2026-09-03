// =====================================================================
// stripComments 自身的验收（2026-09-02）。
// 起因：旧实现「先正则删块注释」，被一个写在行注释里的块注释起始符骗到，
// 在 main.js 上一口吞掉 15KB 真代码，使多个守卫测试在被绞碎的文件上通过。
// 守卫工具自己没有守卫，是最危险的一种情况。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/stripComments.mjs";

// 1. 行注释整行丢弃，代码保留
assert.equal(stripComments("const a = 1; // 不许用 new Date()").trim(), "const a = 1;");

// 2. 真块注释按范围删除
assert.equal(stripComments("a /* x */ b").replace(/\s+/g, " ").trim(), "a b");

// 3. 核心回归：行注释里出现块注释起始符，不得吞掉后续真代码
const trap = [
  "// 说明：模块按需加载 /* 这不是块注释 */",
  "const kept = P.nightBloomV1;",
  "/** 真文档注释 */",
  "const alsoKept = 2;",
].join("\n");
const stripped = stripComments(trap);
assert.match(stripped, /const kept = P\.nightBloomV1;/, "行注释里的块符号吞掉了真代码");
assert.match(stripped, /const alsoKept = 2;/);

// 4. 字符串里的注释符号不得被当成注释
assert.match(stripComments('const url = "https://a.com//b";'), /https:\/\/a\.com\/\/b/);
assert.match(stripComments("const s = '/* not a comment */';"), /not a comment/);

// 5. 跨行块注释仍然正确闭合
assert.doesNotMatch(stripComments("/*\n禁用词 new Date()\n*/\nconst ok = 1;"), /new Date/);
assert.match(stripComments("/*\n禁用词\n*/\nconst ok = 1;"), /const ok = 1;/);

// 6. 真实文件回归：剥离后不得丢失可观比例的代码
const main = fs.readFileSync(
  fileURLToPath(new URL("../TigerMessenger/src/main.js", import.meta.url)), "utf8");
const strippedMain = stripComments(main);
assert.ok(
  strippedMain.includes("P.nightBloomV1"),
  "main.js 剥离后丢失了真代码——旧 bug 复发"
);
// 行数必须守恒（逐行处理），否则说明又出现了跨行吞噬
assert.equal(strippedMain.split("\n").length, main.split("\n").length, "行数不守恒");

console.log("✅ test_strip_comments");
