// =====================================================================
// V7-G16 worker 性能基准（TODO 见 docs/TODO.md V7-G16）
// 真实 node:worker_threads Worker 线程（tools/procgen_worker_entry.mjs），
// 非主线程模拟。三项：
//   1. dirty WFC ≈64 格（10×10 网格 + 外圈 36 pins，内部 8×8=64 为 dirty 区）
//      ≥50 次不同 seed，目标 P95 ≤ 16ms，附阶段分解（序列化/建模/求解/回传）
//   2. MC chunk 24³ ≥30 次，目标 P95 ≤ 20ms；16³/24³/32³ 三档规模各一组
//   3. 取消语义：长任务进行中取消时延（目标 ≤100ms）+ 20 次 rapid-fire 编辑
//      （每新 job 取消前一个），断言只有最后一个 job 产出 ok、无假成功
// 输出：控制台摘要 + tools/out/procgen/v7-worker-bench-<timestamp>.json
// 用法：node tools/bench_procgen_v7_worker.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { createProcgenJob } from "../TigerMessenger/src/procgen/worker/jobProtocol.js";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createSimpleTiledModel, solveSimpleTiled } from "../TigerMessenger/src/procgen/wfc/simpleTiledModel.js";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const WFC_ITERS = 60;
const MC_ITERS = 30;
const MC_SCALES = [16, 24, 32];
const RAPID_EDITS = 20;

// ---- Worker 启动与 job 提交封装 ----
const worker = new Worker(new URL("./procgen_worker_entry.mjs", import.meta.url), { workerData: { mode: "bench" } });
const pending = new Map(); // id → {resolve, onProgress}
worker.on("message", (message) => {
  const entry = pending.get(message?.id);
  if (!entry) return;
  if (message.type === "progress") return entry.onProgress?.(message);
  pending.delete(message.id);
  entry.resolve(message);
});
const ready = new Promise((resolve) => {
  const onMessage = (message) => {
    if (message?.type === "ready") {
      worker.off("message", onMessage);
      resolve();
    }
  };
  worker.on("message", onMessage);
});

function submitJob(job, { onProgress } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    pending.set(job.id, {
      resolve: (result) => resolve({ result, roundTripMs: performance.now() - t0 }),
      onProgress,
    });
    worker.postMessage(job);
  });
}
const cancelJob = (id) => worker.postMessage({ type: "cancel", id });

// ---- 统计 ----
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
const round = (v) => Math.round(v * 1000) / 1000;
const dist = (xs) => ({ n: xs.length, min: round(Math.min(...xs)), p50: round(quantile(xs, 0.5)), p95: round(quantile(xs, 0.95)), max: round(Math.max(...xs)) });
const verdict = (okFlag) => (okFlag ? "PASS" : "FAIL");

// ---- WFC 负载：10×10，外圈 36 格 pin（模拟 dirty 区外已确定的增量重解），内 8×8=64 dirty ----
const F = (connector) => ({ connector, parity: "symmetric" });
const prototypes = [
  { id: "floor-a", family: "floor", weight: 4, orientationGroup: "NONE", faces: { N: F("floor"), E: F("floor"), S: F("floor"), W: F("floor") } },
  { id: "floor-b", family: "floor", weight: 2, orientationGroup: "NONE", faces: { N: F("floor"), E: F("floor"), S: F("floor"), W: F("floor") } },
  { id: "trim-c", family: "trim", weight: 1, orientationGroup: "NONE", faces: { N: F("trim"), E: F("trim"), S: F("trim"), W: F("trim") } },
];
const GRID_W = 10;
const GRID_H = 10;
const DIRTY = 8; // 内圈 8×8
const mainModel = createSimpleTiledModel({ prototypes, graph: createRectGrid2D({ width: GRID_W, height: GRID_H }) });
const isOutsideDirty = (x, y) => x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;

await ready;

// JIT warmup（不计入样本）
for (let i = 0; i < 3; i++) {
  await submitJob(createProcgenJob({ id: `warmup-wfc-${i}`, type: "wfc", payload: { prototypes, width: GRID_W, height: GRID_H, pins: [] }, seed: 500 + i }));
  await submitJob(createProcgenJob({ id: `warmup-mc-${i}`, type: "field", payload: { resolution: 16, returnMesh: true }, seed: 600 + i }));
}

// ================= 基准 1：dirty WFC ≈64 格 =================
console.log(`\n=== 基准 1：dirty WFC（${GRID_W}×${GRID_H} 网格，dirty ${DIRTY}×${DIRTY}=${DIRTY * DIRTY} 格，${GRID_W * GRID_H - DIRTY * DIRTY} 个 outside pins，${WFC_ITERS} 次）===`);
const wfc = { serializeMs: [], modelBuildMs: [], solveMs: [], returnMs: [], roundTripMs: [], samples: [] };
let wfcFailures = 0;
for (let i = 0; i < WFC_ITERS; i++) {
  // 主线程先做一次全量求解（不计时），取 dirty 区外圈变体作为 pins——
  // pins 形状与 solverPinsFromHardLocks 输出一致 {cell, variant, source}
  const prior = solveSimpleTiled({ model: mainModel, seed: 10000 + i });
  assert.equal(prior.ok, true, `prior solve failed seed=${10000 + i}`);
  const pins = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (!isOutsideDirty(x, y)) continue;
      const cell = `r:${x}:${y}`;
      pins.push({ cell, variant: prior.assignmentByCellId[cell], source: "outside-dirty" });
    }
  }
  const job = createProcgenJob({ id: `wfc-dirty-${i}`, type: "wfc", payload: { prototypes, width: GRID_W, height: GRID_H, pins }, seed: 20000 + i, dirty: { cells: DIRTY * DIRTY } });
  const tSer = performance.now();
  structuredClone(job); // postMessage 序列化成本代理（V8 serialize）
  const serializeMs = performance.now() - tSer;
  const { result, roundTripMs } = await submitJob(job);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  if (!result.payload.ok) wfcFailures++;
  const bench = result.payload._bench;
  const returnMs = roundTripMs - bench.workerMs; // 回传（worker→main clone + 线程调度）
  wfc.serializeMs.push(serializeMs);
  wfc.modelBuildMs.push(bench.modelBuildMs);
  wfc.solveMs.push(bench.solveMs);
  wfc.returnMs.push(returnMs);
  wfc.roundTripMs.push(roundTripMs);
  wfc.samples.push({ seed: job.seed, serializeMs: round(serializeMs), modelBuildMs: round(bench.modelBuildMs), solveMs: round(bench.solveMs), returnMs: round(returnMs), roundTripMs: round(roundTripMs), solveOk: result.payload.ok, backtracks: result.payload.backtracks });
}
const wfcSummary = {
  serialize: dist(wfc.serializeMs),
  modelBuild: dist(wfc.modelBuildMs),
  solve: dist(wfc.solveMs),
  returnTransfer: dist(wfc.returnMs),
  roundTrip: dist(wfc.roundTripMs),
};
const wfcPass = wfcSummary.roundTrip.p95 <= 16 && wfcFailures === 0;
console.log(`  阶段分解 ms（P50/P95）：serialize ${wfcSummary.serialize.p50}/${wfcSummary.serialize.p95} | modelBuild ${wfcSummary.modelBuild.p50}/${wfcSummary.modelBuild.p95} | solve ${wfcSummary.solve.p50}/${wfcSummary.solve.p95} | return ${wfcSummary.returnTransfer.p50}/${wfcSummary.returnTransfer.p95}`);
console.log(`  roundTrip P50=${wfcSummary.roundTrip.p50}ms P95=${wfcSummary.roundTrip.p95}ms（目标 P95≤16ms）→ ${verdict(wfcPass)}${wfcFailures ? `；${wfcFailures} 次求解未收敛` : ""}`);

// ================= 基准 2：MC chunk 三档规模 =================
console.log(`\n=== 基准 2：MC chunk（每档 ${MC_ITERS} 次，worker 内 createScalarField + marchingCubes）===`);
const mc = {};
for (const resolution of MC_SCALES) {
  const bucket = { sampleMs: [], meshMs: [], workerMs: [], roundTripMs: [], samples: [] };
  let triangles = 0;
  for (let i = 0; i < MC_ITERS; i++) {
    const job = createProcgenJob({ id: `mc-${resolution}-${i}`, type: "field", payload: { resolution, sampler: "sphere", returnMesh: true }, seed: 30000 + i });
    const { result, roundTripMs } = await submitJob(job);
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.ok(result.payload.stats.triangleCount > 0);
    const bench = result.payload._bench;
    triangles = result.payload.stats.triangleCount;
    bucket.sampleMs.push(bench.sampleMs);
    bucket.meshMs.push(bench.meshMs);
    bucket.workerMs.push(bench.workerMs);
    bucket.roundTripMs.push(roundTripMs);
    bucket.samples.push({ seed: job.seed, sampleMs: round(bench.sampleMs), meshMs: round(bench.meshMs), workerMs: round(bench.workerMs), roundTripMs: round(roundTripMs), triangles });
  }
  mc[`${resolution}^3`] = { sample: dist(bucket.sampleMs), mesh: dist(bucket.meshMs), workerTotal: dist(bucket.workerMs), roundTrip: dist(bucket.roundTripMs), triangles, samples: bucket.samples };
  const m = mc[`${resolution}^3`];
  const pass = resolution === 24 ? m.workerTotal.p95 <= 20 : null;
  console.log(`  ${resolution}³：sample P50/P95=${m.sample.p50}/${m.sample.p95}ms | mesh ${m.mesh.p50}/${m.mesh.p95}ms | worker ${m.workerTotal.p50}/${m.workerTotal.p95}ms | roundTrip ${m.roundTrip.p50}/${m.roundTrip.p95}ms | 三角形=${triangles}${pass !== null ? `（目标 24³ worker P95≤20ms）→ ${verdict(pass)}` : ""}`);
}
const mcPass = mc["24^3"].workerTotal.p95 <= 20;

// ================= 基准 3：取消语义 =================
console.log(`\n=== 基准 3：取消语义 ===`);
// 3a. 长任务进行中取消：repeat 循环模拟多个连续 MC chunk，取消在 repeat 边界生效
//     （handler 本身只在 job 边界检查取消；中途取消靠 runner 协作检查 shouldCancel）
const longJob = createProcgenJob({ id: "cancel-long", type: "field", payload: { resolution: 24, repeat: 400, yieldEvery: 1, progressEvery: 10, returnMesh: false }, seed: 77 });
let sawProgress;
const firstProgress = new Promise((resolve) => (sawProgress = resolve));
const longPromise = submitJob(longJob, { onProgress: () => sawProgress() });
await firstProgress; // 确认任务已在 worker 中运行
const tCancel = performance.now();
cancelJob(longJob.id);
const { result: longResult } = await longPromise;
const cancelLatencyMs = performance.now() - tCancel;
assert.equal(longResult.ok, false, "长任务取消后不应产出 ok 结果");
assert.equal(longResult.error?.code, "cancelled", JSON.stringify(longResult));
const cancelPass = cancelLatencyMs <= 100;
console.log(`  3a. 进行中取消：时延=${round(cancelLatencyMs)}ms（目标 ≤100ms）→ ${verdict(cancelPass)}；结果 code=${longResult.error.code}（repeat 边界取消，无抢占）`);

// 3b. rapid-fire 20 次编辑：每个新 job 取消前一个，断言只有最后一个产出 ok
const rapidPromises = [];
for (let i = 1; i <= RAPID_EDITS; i++) {
  const id = `edit-${i}`;
  if (i > 1) cancelJob(`edit-${i - 1}`);
  rapidPromises.push(submitJob(createProcgenJob({ id, type: "field", payload: { resolution: 16, repeat: 30, yieldEvery: 1, returnMesh: false }, seed: 40000 + i })));
}
const rapidResults = (await Promise.all(rapidPromises)).map((r) => r.result);
assert.equal(rapidResults.length, RAPID_EDITS);
const okResults = rapidResults.filter((r) => r.ok);
const cancelledResults = rapidResults.filter((r) => !r.ok && r.error?.code === "cancelled");
const otherResults = rapidResults.filter((r) => !r.ok && r.error?.code !== "cancelled");
assert.equal(okResults.length, 1, `应只有最后一个 job 产出 ok，实际 ${okResults.length}: ${okResults.map((r) => r.id)}`);
assert.equal(okResults[0].id, `edit-${RAPID_EDITS}`);
assert.equal(cancelledResults.length, RAPID_EDITS - 1, `其余 ${RAPID_EDITS - 1} 个应为 cancelled，实际 ${cancelledResults.length}`);
assert.equal(otherResults.length, 0, `不应有其它错误结果: ${JSON.stringify(otherResults)}`);
console.log(`  3b. rapid-fire ${RAPID_EDITS} 次编辑：仅 edit-${RAPID_EDITS} 产出 ok，${cancelledResults.length} 个 cancelled，无假成功 → PASS`);

// ================= 汇总输出 =================
const notes = [
  "取消语义实测：createWorkerHandler 只在 job 边界检查取消（开始前/结束后），无抢占式取消；",
  "  本基准的中途取消由 worker entry 的 runner 协作完成——field runner 在每次 MC repeat 边界检查 shouldCancel，",
  "  WFC runner 将 shouldCancel 透传给 solveWfc（传播每 256 ops 检查一次，见 wfc/solver.js）；marchingCubes 单次调用内部不可取消。",
  "  3a 的时延因此是『边界取消时延』≈ 一个 repeat 时长 + 消息往返，非任意指令点抢占。",
  "WFC dirty 负载：pins 取 dirty 区外圈的先验解变体（solverPinsFromHardLocks 同形 {cell, variant, source}），solveSimpleTiled 原生支持 pins，已传入。",
  "serialize 阶段为主线程 structuredClone(job) 代理测量；return = roundTrip - workerMs（含 mesh buffer transfer/clone 与线程调度）。",
];
const report = {
  benchmark: "procgen-v7-g16-worker",
  date: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  config: { wfcIters: WFC_ITERS, wfcGrid: `${GRID_W}x${GRID_H}`, wfcDirtyCells: DIRTY * DIRTY, wfcPins: GRID_W * GRID_H - DIRTY * DIRTY, mcIters: MC_ITERS, mcScales: MC_SCALES, rapidEdits: RAPID_EDITS },
  targets: {
    wfcDirtyP95Ms: { target: 16, measured: wfcSummary.roundTrip.p95, measuredSolveOnly: wfcSummary.solve.p95, pass: wfcPass },
    mc24P95Ms: { target: 20, measured: mc["24^3"].workerTotal.p95, measuredRoundTrip: mc["24^3"].roundTrip.p95, pass: mcPass },
    cancelLatencyMs: { target: 100, measured: round(cancelLatencyMs), pass: cancelPass },
  },
  wfc: { ...wfcSummary, failures: wfcFailures, samples: wfc.samples },
  mc,
  cancel: {
    longJobLatencyMs: round(cancelLatencyMs),
    longJobResult: { ok: longResult.ok, code: longResult.error?.code },
    rapidFire: { edits: RAPID_EDITS, okCount: okResults.length, okId: okResults[0].id, cancelledCount: cancelledResults.length, results: rapidResults.map((r) => ({ id: r.id, ok: r.ok, code: r.error?.code ?? null })) },
  },
  notes,
};

const outDir = path.join(TOOLS, "out", "procgen");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `v7-worker-bench-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\n=== 汇总 ===`);
console.log(`  dirty WFC 64 格  roundTrip P50=${wfcSummary.roundTrip.p50}ms P95=${wfcSummary.roundTrip.p95}ms → ${verdict(wfcPass)}（目标 P95≤16ms）`);
console.log(`  MC 24³ chunk     worker P50=${mc["24^3"].workerTotal.p50}ms P95=${mc["24^3"].workerTotal.p95}ms → ${verdict(mcPass)}（目标 P95≤20ms）`);
console.log(`  取消时延         ${round(cancelLatencyMs)}ms → ${verdict(cancelPass)}（目标 ≤100ms）；rapid-fire 无假成功 → PASS`);
console.log(`  JSON → ${path.relative(process.cwd(), outPath)}`);
for (const note of notes) console.log(`  注：${note}`);

await worker.terminate();
console.log(wfcPass && mcPass && cancelPass ? "✅ V7-G16 worker 基准完成，三项目标全部达标" : "⚠️ V7-G16 worker 基准完成，但存在未达标项（见上）");
