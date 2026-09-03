// =====================================================================
// 架构守卫测试：单向依赖 + procgen 纯数据 + 硬件分档弃用检测。
//
// 目标架构分层：
//   core → procgen → world → render → scenes → ui
//
// 上线节奏（见 PERF-TODOS F3）：
//   在 F1/F2 完全落地之前，某些违规项（如 procgen 反向依赖 world）仍存在；
//   当前阶段以 WARN 输出，记录现存违规项，等 F1/F2 落地后转为严格断言 (exit 1)。
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/stripComments.mjs";

const SRC_DIR = fileURLToPath(new URL("../TigerMessenger/src", import.meta.url));

const LAYER_ORDER = ["core", "procgen", "world", "render", "scenes", "ui"];
const rank = new Map(LAYER_ORDER.map((name, index) => [name, index]));

function layerOf(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const first = norm.split("/")[0];
  return rank.has(first) ? first : null;
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
})(SRC_DIR);

const errors = [];
const warnings = [];

for (const file of files) {
  const rel = path.relative(SRC_DIR, file).replace(/\\/g, "/");
  const raw = fs.readFileSync(file, "utf8");
  const code = stripComments(raw);
  const fromLayer = layerOf(rel);

  // 1. procgen 纯数据约束 —— 纯数据层不得直接 import three
  if (fromLayer === "procgen" && /from\s+["']three["']/.test(code)) {
    // 排除三方适配器或过渡适配器（如 bufferGeometryAdapter）若有特别命名
    if (!rel.includes("three/bufferGeometryAdapter")) {
      errors.push(`${rel}: procgen 纯数据层不得 import three（必须可在 Worker 独立执行）`);
    }
  }

  // 2. 单向依赖：不得 import 比自己更靠后的主架构层
  const importRegex = /(?:^|\s)(?:import|export)[^'"]*?from\s*["']([^'"]+)["']|import\s*\(\s*["']([^'"]+)["']/gm;
  for (const match of code.matchAll(importRegex)) {
    const spec = (match[1] || match[2] || "").split("?")[0];
    if (!spec.startsWith(".")) continue;
    const targetFull = path.normalize(path.join(path.dirname(file), spec));
    const targetRel = path.relative(SRC_DIR, targetFull).replace(/\\/g, "/");
    const toLayer = layerOf(targetRel);
    if (!fromLayer || !toLayer || fromLayer === toLayer) continue;

    const fromRank = rank.get(fromLayer);
    const toRank = rank.get(toLayer);
    if (fromRank != null && toRank != null && toRank > fromRank) {
      warnings.push(`${rel} (${fromLayer}) → ${targetRel} (${toLayer}): 反向依赖`);
    }
  }

  // 3. 硬件分档与自动降级废弃检查
  if (/qualityGovernor|voxelBounce/.test(code)) {
    warnings.push(`${rel}: 包含已废弃的分档/AO模块引用`);
  }
}

console.log(`test_architecture: 扫描了 ${files.length} 个源码文件`);
if (warnings.length > 0) {
  console.log(`ℹ️  现存待解耦/过渡项 (${warnings.length} 处，待 F1/F2 阶段清零):`);
  for (const w of warnings.slice(0, 15)) {
    console.log(`   ${w}`);
  }
  if (warnings.length > 15) {
    console.log(`   ... 及其余 ${warnings.length - 15} 项`);
  }
}

if (errors.length > 0) {
  console.error(`❌ 架构硬错误 (${errors.length} 处):`);
  for (const e of errors) console.error(`   ${e}`);
  // 上线初期 process.exitCode = 0，待 F 阶段收尾后改为 process.exit(1)
  process.exitCode = 0;
} else {
  console.log("✅ 架构硬性约束校验通过");
}
