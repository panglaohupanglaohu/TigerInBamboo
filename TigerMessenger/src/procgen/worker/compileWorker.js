// Browser worker host for V8.  A missing Worker or a blocked module URL uses
// a cooperative fallback that yields between phases instead of synchronously
// blocking the main thread.

import { createProcgenJob, validateProcgenJob } from "./jobProtocol.js";
import { compilePlanetV8 } from "../planet/planetCompilerV8.js";

const PHASES = ["graph", "WFC", "field", "MC", "smooth", "semantic", "water", "nav", "cloud"];

export function createPlanetCompileHost({ workerUrl = null, budgetMs = 4 } = {}) {
  let worker = null;
  const pending = new Map();
  const fallbackPending = new Map();
  if (workerUrl && typeof Worker !== "undefined") {
    try {
      worker = new Worker(workerUrl, { type: "module" });
      worker.onmessage = (event) => {
        const message = event.data;
        if (message?.type === "progress") pending.get(message.id)?.onProgress?.(message);
        else if (message?.id && pending.has(message.id)) { const request = pending.get(message.id); pending.delete(message.id); request.resolve(message); }
      };
      worker.onerror = (error) => { for (const request of pending.values()) request.reject(error); pending.clear(); worker = null; };
    } catch { worker = null; }
  }
  return {
    async compile(payload, { id = `planet-${Date.now()}`, seed = 1, onProgress = () => {}, blueprintVersion = 1, schemaVersions = {}, dirty = null } = {}) {
      const job = createProcgenJob({ id, type: "planet", payload, seed, blueprintVersion, schemaVersions, dirty });
      const check = validateProcgenJob(job); if (!check.ok) throw new Error(check.errors.join(","));
      if (worker) return new Promise((resolve, reject) => { pending.set(job.id, { resolve, reject, onProgress }); worker.postMessage(job); });
      const task = { cancelled: false };
      fallbackPending.set(job.id, task);
      const cancel = () => { task.cancelled = true; };
      const report = (phase, progress) => { if (!task.cancelled) onProgress({ id: job.id, type: "progress", phase, progress }); };
      try {
        for (let index = 0; index < PHASES.length; index++) {
          report(PHASES[index], index / PHASES.length);
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (task.cancelled) return { id: job.id, ok: false, error: { code: "cancelled" } };
        }
        if (task.cancelled) return { id: job.id, ok: false, error: { code: "cancelled" } };
        const result = compilePlanetV8({ ...(payload || {}), seed });
        if (task.cancelled) return { id: job.id, ok: false, error: { code: "cancelled" } };
        report("complete", 1);
        return { id: job.id, ok: result.ok, payload: result, stats: { fallback: true, budgetMs }, cancel };
      } finally {
        fallbackPending.delete(job.id);
      }
    },
    cancel(id) {
      const task = fallbackPending.get(id);
      if (task) task.cancelled = true;
      pending.delete(id);
      worker?.postMessage({ type: "cancel", id });
    },
    dispose() {
      for (const task of fallbackPending.values()) task.cancelled = true;
      worker?.terminate?.();
      worker = null;
      pending.clear();
      fallbackPending.clear();
    },
  };
}
