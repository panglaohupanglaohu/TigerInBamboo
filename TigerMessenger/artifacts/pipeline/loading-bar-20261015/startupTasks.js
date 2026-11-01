// Yield a real browser task between construction stages. Promise.resolve()
// only yields a microtask and cannot let Chromium service its responsiveness ping.
export const yieldStartupTask = () => new Promise(resolve => setTimeout(resolve, 16));

export function finishStartupSteps(steps) {
  let next;
  do { next = steps.next(); } while (!next.done);
  return next.value;
}

export async function runStartupSteps(steps, checkpoint = yieldStartupTask) {
  try {
    let next = steps.next();
    while (!next.done) {
      await checkpoint(next.value);
      next = steps.next();
    }
    return next.value;
  } catch (error) {
    // Inject checkpoint failures into the transaction so its catch can roll
    // back owned geometry and borrowed scene references before closing it.
    try { steps.throw?.(error); } catch { /* Rethrow the original failure below. */ }
    steps.return?.();
    throw error;
  }
}

export function createStartupProgress({document: doc = globalThis.document, storage = globalThis.sessionStorage,
  now = () => performance.now(), yieldTask = yieldStartupTask} = {}) {
  const report = {version: 1, status: 'loading', stages: [], current: null};
  const key = 'tm.startup.last-stage.v1';
  let started = now();
  function publish() {
    const text = doc?.getElementById('startup-progress-label');
    if (text) text.textContent = report.current || '正在准备世界…';
    try { storage?.setItem(key, JSON.stringify(report)); } catch { /* Storage is optional. */ }
  }
  function finishStage() {
    if (report.current) report.stages.push({label: report.current, milliseconds: now() - started});
  }
  return {
    report,
    async checkpoint(label = '正在准备世界…') {
      finishStage(); report.current = label; publish();
      await yieldTask(); started = now();
    },
    finish() {
      finishStage(); report.status = 'ready'; report.current = null; publish();
      const panel = doc?.getElementById('startup-progress');
      if (panel) panel.hidden = true;
    },
  };
}
