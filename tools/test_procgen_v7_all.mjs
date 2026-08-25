// V7 Procgen 总测试入口（V7-G0）
// 阶段门：代码、HTTP 模块图、视觉数值、性能代理和回滚契约均脚本化，不依赖人工签收。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const run = (script) => {
  const r = spawnSync(process.execPath, [path.join(TOOLS, script)], { stdio: "inherit" });
  return r.status;
};

const results = [];
const stage = (name, script, status) => {
  const ok = status === 0;
  results.push({ name, script, status });
  console.log(`${ok ? "✅" : "❌"} ${name}（${script}）exit=${status}`);
};

console.log("=== V7 Procgen 测试总入口 ===\n");

// G1：Core（BitSet / RNG / heap / trail / 图适配器 / 静态扫描）
stage("V7-G1 core", "test_procgen_core.mjs", run("test_procgen_core.mjs"));
// G2：模块 schema / 方向群 / socket 编译 / 兼容表 / 47 模块迁移
stage("V7-G2 module compiler", "test_procgen_module_compiler.mjs", run("test_procgen_module_compiler.mjs"));

// 已具备独立测试的阶段直接运行；原 G18 浏览器/GPU/主人门禁由统一矩阵脚本验证。
stage("V7-G3 wfc-solver", "test_procgen_v7_g3.mjs", run("test_procgen_v7_g3.mjs"));
stage("V7-G4 wfc-2d-models", "test_procgen_v7_g4.mjs", run("test_procgen_v7_g4.mjs"));
stage("V7-G5/G6 model-validators", "test_procgen_v7_g5_g6.mjs", run("test_procgen_v7_g5_g6.mjs"));
stage("V7-G6 hard-route-planner", "test_hard_route_planner.mjs", run("test_hard_route_planner.mjs"));
// G4/G5 缺口专项：显式 adjacency、周期网格、half-edge 模型、结构预约束、fixtures、导出
stage("V7-G4 gap", "test_procgen_v7_g4_gap.mjs", run("test_procgen_v7_g4_gap.mjs"));
stage("V7-G5 gap", "test_procgen_v7_g5_gap.mjs", run("test_procgen_v7_g5_gap.mjs"));
stage("V7-G7 scalar-field", "test_procgen_v7_g7.mjs", run("test_procgen_v7_g7.mjs"));
stage("V7-G8 marching-cubes", "test_procgen_v7_g8.mjs", run("test_procgen_v7_g8.mjs"));
stage("V7-G9 bridge-surface", "test_procgen_v7_g9.mjs", run("test_procgen_v7_g9.mjs"));
stage("V7-G10 worker-three", "test_procgen_v7_g10.mjs", run("test_procgen_v7_g10.mjs"));
stage("V7-G11..G13 castle-profiles", "test_procgen_v7_g11_g13.mjs", run("test_procgen_v7_g11_g13.mjs"));
stage("V7-G11..G13 profile-planners", "test_procgen_profiles_hard_routes.mjs", run("test_procgen_profiles_hard_routes.mjs"));
stage("V7-G11..G13 2D/3D/MC compiler", "test_procgen_v7_castle_module_compiler.mjs", run("test_procgen_v7_castle_module_compiler.mjs"));
stage("V7-G14 incremental-save", "test_procgen_v7_g14.mjs", run("test_procgen_v7_g14.mjs"));
stage("V7-G15 inspector", "test_procgen_v7_g15.mjs", run("test_procgen_v7_g15.mjs"));
stage("V7-G16 full-test-matrix", "test_procgen_v7_matrix.mjs", run("test_procgen_v7_matrix.mjs"));
stage("V7-G17 migration-gate", "test_procgen_v7_g17.mjs", run("test_procgen_v7_g17.mjs"));
stage("V7-G17 rollout-plan", "test_procgen_v7_rollout_plan.mjs", run("test_procgen_v7_rollout_plan.mjs"));
// 补充审计：覆盖冒烟测试未断言、但实现已具备的 TODO 条目（逐条注释标注 TODO 行号）
stage("V7-audit supplementary", "test_procgen_v7_audit.mjs", run("test_procgen_v7_audit.mjs"));
// G7/G8 缺口回填：复合 primitive、命名语义、flow 通道、切片导出、flat/split、基准常量
stage("V7-G7/G8 gap-closure", "test_procgen_v7_g7g8_gap.mjs", run("test_procgen_v7_g7g8_gap.mjs"));
// G9/G10/G14 缺口回填：collar/clearance、surface provider、worker 协议、fallback 分帧、adapter uv/color/groups、snapshot V3 扩展
stage("V7-G9/G10/G14 gap-closure", "test_procgen_v7_g9g10_gap.mjs", run("test_procgen_v7_g9g10_gap.mjs"));
stage("V7-G18 automated acceptance", "test_grok_acceptance_matrix.mjs", run("test_grok_acceptance_matrix.mjs"));

// 三开关默认 false（读源码静态校验，避免 import params.js 触发顶层 localStorage 副作用）
const paramsSrc = fs.readFileSync(
  path.join(path.dirname(TOOLS), "TigerMessenger", "src", "core", "params.js"),
  "utf8"
);
for (const flag of ["procgenEngineV1", "wfcCastleV1", "marchingTerrainV1"]) {
  const re = new RegExp(`${flag}\\s*:\\s*false`);
  if (!re.test(paramsSrc)) {
    console.error(`❌ V7 开关 ${flag} 必须默认 false`);
    process.exit(1);
  }
}
console.log("✅ V7 三开关（procgenEngineV1/wfcCastleV1/marchingTerrainV1）默认 false");

// ledger 检查
const ledger = JSON.parse(fs.readFileSync(path.join(TOOLS, "out", "procgen-v7-ledger.json"), "utf8"));
const testedCount = ledger.capabilities.filter((c) => c.level === "TESTED").length;
const definedCount = ledger.capabilities.filter((c) => c.level === "DEFINED").length;
const noVisual = ledger.capabilities.every((c) => !["VISUAL_ACCEPTED", "PERF_ACCEPTED", "DEFAULT_ON"].includes(c.level));
if (!noVisual) {
  console.error("❌ ledger 不得有 VISUAL_ACCEPTED/PERF_ACCEPTED/DEFAULT_ON");
  process.exit(1);
}
console.log(`✅ ledger：${ledger.capabilities.length} 项能力（${testedCount} TESTED / ${definedCount} DEFINED），无越级标记`);

// 汇总
const failed = results.filter((r) => r.status !== 0);
console.log(`\n=== 汇总：${results.length} 个已实现阶段，${failed.length} 失败 ===`);
if (failed.length > 0) {
  console.error(failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log("✅ V7-G0/G1/G2/G3…G18 自动门通过；无截图/人工签收阻塞。硬件 FPS 不由 Node 代理冒充");
