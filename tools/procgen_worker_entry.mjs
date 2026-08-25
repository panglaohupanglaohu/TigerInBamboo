// =====================================================================
// Procgen worker entry（V7-G16 基准专用，node:worker_threads）
// 生产浏览器入口在 TigerMessenger/src/procgen/worker/procgenWorker.js；
// 本文件只做 Node 侧 parentPort 接线 + runner 注册，不改 src。
//
// 取消语义（如实记录）：
//   · createWorkerHandler 只在 job 边界检查取消（开始前/结束后）；
//   · 中途取消靠 runner 协作：WFC 把 shouldCancel 透传给 solveWfc
//     （传播每 256 ops 检查一次，见 wfc/solver.js）；field runner 在
//     MC chunk/repeat 边界检查。marchingCubes 单次调用内部不可抢占。
// =====================================================================
import { parentPort, workerData } from "node:worker_threads";
import { createWorkerHandler } from "../TigerMessenger/src/procgen/worker/procgenWorker.js";
import { transferablesForMesh } from "../TigerMessenger/src/procgen/worker/jobProtocol.js";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createSimpleTiledModel, solveSimpleTiled } from "../TigerMessenger/src/procgen/wfc/simpleTiledModel.js";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { marchingCubes } from "../TigerMessenger/src/procgen/field/marchingCubes.js";

const yieldTurn = () => new Promise((resolve) => setImmediate(resolve));

const SAMPLERS = {
  // 单位球 SDF，与 tools/test_procgen_v7_matrix.mjs 的采样同形
  sphere: (p) => Math.hypot(p[0], p[1], p[2]) - 0.5,
};

// WFC dirty 重解：payload 携带可 structured-clone 的模型描述 + outside pins
// （pins 形状与 hardRoutePlanner.solverPinsFromHardLocks 输出一致：{cell, variant, source}）
async function runWfc(payload, { seed, shouldCancel } = {}) {
  const t0 = performance.now();
  const model = createSimpleTiledModel({
    prototypes: payload.prototypes,
    graph: createRectGrid2D({ width: payload.width, height: payload.height }),
  });
  const t1 = performance.now();
  const result = solveSimpleTiled({
    model,
    seed,
    pins: payload.pins ?? [],
    shouldCancel, // 接线：solver 传播循环每 256 ops 检查一次
  });
  const t2 = performance.now();
  return {
    ok: result.ok,
    reason: result.reason ?? null,
    solutionHash: result.solutionHash,
    cells: model.graph.cellCount,
    pins: (payload.pins ?? []).length,
    backtracks: result.stats?.backtracks ?? null,
    _bench: { modelBuildMs: t1 - t0, solveMs: t2 - t1, workerMs: t2 - t0 },
  };
}

// Field/MC chunk：payload {resolution, sampler, repeat, yieldEvery, progressEvery, returnMesh}
// repeat>1 用于取消基准：每次 repeat 边界检查 shouldCancel 并让出事件循环
async function runField(payload, { seed, shouldCancel, progress } = {}) {
  const resolution = payload.resolution ?? 24;
  const sample = SAMPLERS[payload.sampler ?? "sphere"];
  const repeat = payload.repeat ?? 1;
  const yieldEvery = payload.yieldEvery ?? 1;
  const progressEvery = payload.progressEvery ?? 0;
  void seed;
  const t0 = performance.now();
  const field = createScalarField({ min: [-1, -1, -1], max: [1, 1, 1], resolution, sample });
  const t1 = performance.now();
  let mesh = null;
  let meshMs = 0;
  for (let r = 0; r < repeat; r++) {
    mesh = marchingCubes(field);
    meshMs += mesh.stats.timings.meshMs + mesh.stats.timings.normalMs + mesh.stats.timings.groupMs;
    if (progressEvery && (r + 1) % progressEvery === 0) progress("marching-cubes", (r + 1) / repeat);
    if (r + 1 < repeat || repeat > 1) {
      if (shouldCancel?.()) return { cancelled: true, completedRepeats: r + 1, _bench: { sampleMs: t1 - t0, meshMs, workerMs: performance.now() - t0 } };
      if ((r + 1) % yieldEvery === 0) await yieldTurn();
    }
  }
  const t2 = performance.now();
  const bench = { sampleMs: t1 - t0, meshMs, workerMs: t2 - t0, resolution, repeat };
  if (payload.returnMesh === false) {
    return {
      cancelled: false,
      vertices: mesh.stats.vertexCount,
      triangles: mesh.stats.triangleCount,
      degenerateTriangles: mesh.stats.degenerateTriangles,
      _bench: bench,
    };
  }
  mesh._bench = bench;
  return mesh;
}

const handler = createWorkerHandler({ runWfc, runField });

parentPort.on("message", async (message) => {
  if (message?.type === "cancel") {
    handler.cancel(message.id);
    return;
  }
  await handler(message, (result) => {
    // mesh payload 的 typed array buffer 走 transfer list（零拷贝回传）
    const transfer = result?.ok && result.payload?.positions ? transferablesForMesh(result.payload) : [];
    parentPort.postMessage(result, transfer);
  });
});

parentPort.postMessage({ type: "ready", mode: workerData?.mode ?? "bench" });
