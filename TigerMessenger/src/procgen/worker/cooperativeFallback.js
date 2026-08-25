// =====================================================================
// 协作式 fallback（V7-G10，TODO 1235）
// Worker 不可用时的主线程编译路径：step 之间按单帧预算 yield
// （setTimeout(0) 分片），不得长时间同步卡死；每步前后检查取消。
// =====================================================================

const defaultYield = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * steps: [{ phase, run }] 或 [function]；每个 step 是一次不可再分的同步小任务。
 * 超过 budgetMs 即让出主线程；shouldCancel() 为真时立即以 cancelled 收尾。
 * now/yieldControl 可注入，便于单测确定性驱动。
 */
export async function runCooperative(steps, { budgetMs = 4, shouldCancel = () => false, onProgress = () => {}, yieldControl = defaultYield, now = () => Date.now() } = {}) {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error("cooperative steps required");
  if (!(budgetMs >= 0)) throw new Error("budgetMs must be >= 0");
  const results = new Array(steps.length);
  let yields = 0;
  let frameStart = now();
  for (let i = 0; i < steps.length; i++) {
    if (shouldCancel()) return { ok: false, error: { code: "cancelled" }, completed: i, yields };
    if (now() - frameStart >= budgetMs) {
      await yieldControl();
      yields++;
      frameStart = now();
      if (shouldCancel()) return { ok: false, error: { code: "cancelled" }, completed: i, yields };
    }
    const step = steps[i];
    results[i] = await (typeof step === "function" ? step() : step.run());
    onProgress({ index: i, total: steps.length, phase: step?.phase ?? null, progress: (i + 1) / steps.length });
  }
  return { ok: true, results, yields };
}
