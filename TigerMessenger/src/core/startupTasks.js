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

// Loading bar (2026-10-15): progress is weighted by how long each stage took on the last
// successful load (kept in localStorage). Between checkpoints the main thread is busy building,
// so the fill eases towards the expected end of the current stage with a CSS transform
// transition, which the compositor keeps animating while scripts run.
const PROFILE_KEY = 'tm.startup.profile.v1', FALLBACK_STAGES = 118, CAP = .985;
export function createStartupProgress({document: doc = globalThis.document, storage = globalThis.sessionStorage,
  profileStorage = globalThis.localStorage, now = () => performance.now(), yieldTask = yieldStartupTask} = {}) {
  const report = {version: 1, status: 'loading', stages: [], current: null};
  const key = 'tm.startup.last-stage.v1';
  let started = now(), shown = 0;
  let profile = null;
  try { profile = JSON.parse(profileStorage?.getItem(PROFILE_KEY) || 'null'); } catch { profile = null; }
  const durations = Array.isArray(profile?.stages) && profile.stages.length > 4 ? profile.stages.map(ms => Math.max(1, +ms || 1)) : null;
  const total = durations ? durations.reduce((a, b) => a + b, 0) : FALLBACK_STAGES;
  // Fraction of the whole load at the start of stage i, and the expected length of stage i.
  const at = i => {
    if (!durations) return [Math.min(i, FALLBACK_STAGES) / total, i < FALLBACK_STAGES ? 1 / total : 0, 400];
    let before = 0; for (let k = 0; k < Math.min(i, durations.length); k++) before += durations[k];
    const ms = i < durations.length ? durations[i] : 0;
    return [before / total, ms / total, ms];
  };
  const el = id => doc?.getElementById?.(id);
  function paint(fraction, target = fraction, ms = 0) {
    shown = Math.max(shown, Math.min(CAP, fraction));
    const goal = Math.max(shown, Math.min(CAP, target));
    const fill = el('startup-progress-fill'), pct = el('startup-progress-percent');
    if (fill?.style) {
      // jump to the stage start, then ease to the expected stage end on the compositor
      fill.style.transition = 'none'; fill.style.transform = `scaleX(${shown})`;
      void fill.offsetWidth;
      if (goal > shown && ms > 0) { fill.style.transition = `transform ${Math.round(ms)}ms cubic-bezier(.2,.6,.35,1)`; fill.style.transform = `scaleX(${goal})`; }
    }
    if (pct) pct.textContent = `${Math.floor(shown * 100)}%`;
    el('startup-progress')?.setAttribute?.('aria-valuenow', String(Math.floor(shown * 100)));
  }
  function publish() {
    const text = el('startup-progress-label');
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
      const [start, span, ms] = at(report.stages.length);
      paint(start, start + span * .92, ms);
      await yieldTask(); started = now();
    },
    finish() {
      finishStage(); report.status = 'ready'; report.current = null; publish();
      try { profileStorage?.setItem(PROFILE_KEY, JSON.stringify({version: 1, savedAt: Date.now(), stages: report.stages.map(s => Math.round(s.milliseconds))})); } catch { /* optional */ }
      const fill = el('startup-progress-fill'), pct = el('startup-progress-percent');
      if (fill?.style) { fill.style.transition = 'transform 180ms ease-out'; fill.style.transform = 'scaleX(1)'; }
      if (pct) pct.textContent = '100%';
      const panel = el('startup-progress');
      if (panel) panel.hidden = true;
    },
  };
}
