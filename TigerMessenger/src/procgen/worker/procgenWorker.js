// =====================================================================
// Browser Worker entry（V7-G10）
// 生产接线只在存在 self.postMessage 时启用，Node 单测可安全 import。
// =====================================================================

import { createProcgenResult, createCancelledResult, createProgressResult, validateProcgenJob } from "./jobProtocol.js";

export function createWorkerHandler({ runSurface, runWfc, runField, runPlanet } = {}) {
  const cancelled = new Set();
  const handle = async (job, post = () => {}) => {
    const check = validateProcgenJob(job);
    if (!check.ok) return post(createProcgenResult(job || { id: "invalid" }, { ok: false, error: { code: "invalid-job", details: check.errors } }));
    if (cancelled.has(job.id)) {
      cancelled.delete(job.id); // 消费取消标记：同 id 重新提交（新编辑）不得被旧取消污染
      return post(createCancelledResult(job));
    }
    try {
      const runner = job.type === "surface" ? runSurface : job.type === "wfc" ? runWfc : job.type === "field" ? runField : runPlanet;
      if (typeof runner !== "function") throw new Error(`runner not registered: ${job.type}`);
      const payload = await runner(job.payload, { seed: job.seed, shouldCancel: () => cancelled.has(job.id), progress: (phase, progress, stats) => post(createProgressResult(job, phase, progress, stats)) });
      if (cancelled.has(job.id)) return post(createCancelledResult(job));
      const result = createProcgenResult(job, { ok: true, payload });
      post(result);
      return result;
    } catch (error) {
      const result = createProcgenResult(job, { ok: false, error: { code: "worker-error", message: String(error?.message || error) } });
      post(result);
      return result;
    } finally {
      cancelled.delete(job.id);
    }
  };
  handle.cancel = (id) => cancelled.add(id);
  return handle;
}

export function installProcgenWorker(scope, handler) {
  if (!scope?.addEventListener) return false;
  scope.addEventListener("message", async (event) => {
    const message = event.data;
    if (message?.type === "cancel") return handler.cancel?.(message.id);
    await handler(message, (result) => scope.postMessage(result));
  });
  return true;
}
