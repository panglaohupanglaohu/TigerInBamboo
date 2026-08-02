/**
 * Image-to-3D generation helpers (extracted from wall-workspace).
 * Progress-aware task API + limited concurrency + sculpt route.
 */

/** Run async workers over items with a concurrency limit. */
export async function runWithConcurrency(items, limit, worker) {
  const queue = items.slice();
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * POST /api/trellis2/generate in async task mode and stream progress via SSE.
 * Falls back to legacy binary GLB response when worker returns model/gltf-binary.
 *
 * @param {object} body generate request body
 * @param {(stage: string, pct: number) => void} [onStage]
 * @returns {Promise<ArrayBuffer>}
 */
export async function requestGenerateWithProgress(body, onStage) {
  const response = await fetch("/api/trellis2/generate?async=1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, model/gltf-binary" },
    body: JSON.stringify({ ...body, async: true }),
  });
  if (!response.ok) {
    let message = `图生 3D ${response.status}`;
    try {
      const detail = (await response.json()).detail;
      if (detail) message = typeof detail === "string" ? detail : JSON.stringify(detail);
    } catch (_) {
      /* ignore */
    }
    throw new Error(message);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("model/gltf") || contentType.includes("octet-stream")) {
    onStage?.("done", 100);
    return response.arrayBuffer();
  }
  const meta = await response.json();
  const taskId = meta.task_id;
  if (!taskId) {
    throw new Error("生成服务未返回 task_id");
  }
  if (meta.cached) onStage?.("cache", 100);

  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/trellis2/generate/stream/${taskId}`);
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      try {
        es.close();
      } catch (_) {
        /* ignore */
      }
      fn(value);
    };
    es.onmessage = async (ev) => {
      let t;
      try {
        t = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      if (t.error && !t.done) {
        finish(reject, new Error(t.error));
        return;
      }
      onStage?.(t.stage || "running", Number(t.pct) || 0);
      if (t.done) {
        if (t.error) {
          finish(reject, new Error(t.error));
          return;
        }
        try {
          const result = await fetch(`/api/trellis2/generate/result/${taskId}`);
          if (!result.ok) {
            let message = `result ${result.status}`;
            try {
              message = (await result.json()).detail || message;
            } catch (_) {
              /* ignore */
            }
            finish(reject, new Error(message));
            return;
          }
          finish(resolve, await result.arrayBuffer());
        } catch (err) {
          finish(reject, err);
        }
      }
    };
    es.onerror = () => {
      // EventSource errors on normal close too
    };
    setTimeout(() => {
      if (!settled) finish(reject, new Error("生成超时（15 分钟）"));
    }, 15 * 60 * 1000);
  });
}

/** Cancel an in-flight generate task (best-effort). */
export async function cancelGenerateTask(taskId) {
  if (!taskId) return;
  try {
    await fetch(`/api/trellis2/generate/cancel/${taskId}`, { method: "POST" });
  } catch (_) {
    /* ignore */
  }
}

/**
 * Request SculptSpec from sculpt worker via backend proxy.
 * @returns {Promise<object>}
 */
export async function requestSculptFromCrop(body) {
  const response = await fetch("/api/sculpt/from-crop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `塑形 ${response.status}`;
    try {
      const detail = (await response.json()).detail;
      if (detail) message = typeof detail === "string" ? detail : JSON.stringify(detail);
    } catch (_) {
      /* ignore */
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Decide generation route for a confirmed review layer.
 * @returns {"sculpt"|"gaussian-splat"|"procedural"|"mesh-generate"}
 */
export function resolveGenerationRoute(layer, {
  scope,
  subject,
  profile,
  environmentModel,
  biologyModel,
  hasProceduralBuilder,
  hasSculptTemplate,
}) {
  if (layer?.userRouteOverride) return layer.userRouteOverride;

  // Legacy alias: procedural → sculpt when builder exists
  const canSculpt = Boolean(hasProceduralBuilder || hasSculptTemplate);

  if (scope === "environment") {
    const mode = environmentModel || "sculpt";
    if (mode === "pointcloud") return "gaussian-splat";
    if (mode === "mesh") return "mesh-generate";
    if (mode === "auto") {
      return canSculpt ? "sculpt" : "mesh-generate";
    }
    // sculpt (default)
    return "sculpt";
  }

  // biology
  const bioMode = biologyModel || "sculpt";
  if (bioMode === "mesh") return "mesh-generate";
  if (bioMode === "procedural") return canSculpt ? "sculpt" : "mesh-generate";
  return "sculpt";
}

/** Fire-and-forget route hit counter for backend metrics. */
export function trackRouteHit(route) {
  const name = `route.${route || "unknown"}`;
  try {
    fetch("/api/metrics/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, n: 1 }),
    }).catch(() => {});
  } catch (_) {
    /* ignore */
  }
}
