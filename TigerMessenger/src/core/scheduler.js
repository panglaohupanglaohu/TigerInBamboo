// =====================================================================
//  分层调度：动画 60Hz、决策 8Hz、远景 2–4Hz；contact tick 不可跳过（G10）
// =====================================================================

export function createScheduler() {
  return {
    shouldDecide(tick, far) {
      const every = far ? 20 : 8; // 60/8=7.5Hz near, 3Hz far
      return tick % every === 0;
    },
    shouldRepath(tick) {
      return tick % 30 === 0; // 2 Hz
    },
    shouldAnimate() {
      return true;
    },
    mustResolveContact(attackPhase) {
      return attackPhase === "contact";
    },
    runBudgeted(jobs, budgetMs, now = () => (typeof performance !== "undefined" ? performance.now() : Date.now())) {
      const deadline = now() + budgetMs;
      const done = [];
      const queue = jobs.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
      while (queue.length && now() < deadline) {
        const job = queue.shift();
        job.run();
        done.push(job.id);
      }
      return { done, remaining: queue.map((j) => j.id) };
    },
  };
}
