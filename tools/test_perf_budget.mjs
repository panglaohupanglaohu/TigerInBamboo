// =====================================================================
// 性能硬预算守卫测试（基于 perfProbe.snapshot() 数据结构）
//
// 预算指标：
//   calls     <= 1200
//   triangles <= 1,500,000
//   programs  <= 120
//   bootMs    <= 2000
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";

export const PERF_BUDGET = Object.freeze({
  maxDrawCalls: 1200,
  maxTriangles: 1_500_000,
  maxPrograms: 120,
  maxBootMs: 2000,
  minFps: 40,
});

/**
 * 校验性能快照是否在预算内
 * @param {object} snapshot 来自 perfProbe.snapshot()
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function evaluatePerfBudget(snapshot, budget = PERF_BUDGET) {
  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, violations: ["快照数据为空或非法"] };
  }
  const violations = [];
  if (snapshot.calls != null && snapshot.calls > budget.maxDrawCalls) {
    violations.push(`draw calls 超标: ${snapshot.calls} > ${budget.maxDrawCalls}`);
  }
  if (snapshot.triangles != null && snapshot.triangles > budget.maxTriangles) {
    violations.push(`triangles 超标: ${snapshot.triangles} > ${budget.maxTriangles}`);
  }
  if (snapshot.programs != null && snapshot.programs > budget.maxPrograms) {
    violations.push(`programs 超标: ${snapshot.programs} > ${budget.maxPrograms}`);
  }
  if (snapshot.bootMs != null && snapshot.bootMs > budget.maxBootMs) {
    violations.push(`bootMs 超标: ${snapshot.bootMs}ms > ${budget.maxBootMs}ms`);
  }
  if (snapshot.fps != null && snapshot.fps < budget.minFps) {
    violations.push(`fps 未达标: ${snapshot.fps} < ${budget.minFps}`);
  }
  return { ok: violations.length === 0, violations };
}

// 1. 单元测试：预算评估逻辑
const passSample = {
  fps: 55.4,
  frameMs: 18.05,
  calls: 950,
  triangles: 420_000,
  programs: 48,
  geometries: 1200,
  textures: 18,
  bootMs: 1450,
};
const resPass = evaluatePerfBudget(passSample);
assert.equal(resPass.ok, true, "合规样本应通过预算校验");

const failSample = {
  fps: 12.0,
  frameMs: 83.33,
  calls: 3800,
  triangles: 2_100_000,
  programs: 165,
  bootMs: 5800,
};
const resFail = evaluatePerfBudget(failSample);
assert.equal(resFail.ok, false, "超标样本应捕获所有违规项");
assert.equal(resFail.violations.length, 5, "应捕获 5 项超标");

// 2. 如果 CLI 传入了快照 JSON 路径，则评估实际文件
const argPath = process.argv[2];
if (argPath && fs.existsSync(argPath)) {
  const fileData = JSON.parse(fs.readFileSync(argPath, "utf8"));
  const report = evaluatePerfBudget(fileData);
  console.log(`性能快照评估 (${argPath}):`, report.ok ? "✅ 通过" : "⚠️ 未达标");
  for (const v of report.violations) {
    console.log(`   - ${v}`);
  }
}

console.log("test_perf_budget: ok");
