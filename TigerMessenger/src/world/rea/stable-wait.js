/**
 * stable-wait.js — R29：修「场景重建间隙读不到状态」的检测竞态（纯逻辑：Node 单元测试、浏览器端到端、工坊三处共用）。
 *
 * 现象（Guide §13「实景状态读取竞态」）：十二门徒重建场景时 morrisViewer.scene 会被整个换掉，换的那一刻遍历网格
 * 得到 0 个 userData.apostleMass；旧脚本「> 0 就读」会读到旧场景里的一半，或在 0 的那一帧下「没有岩体」的结论。
 *
 * 规则：一次采样 = { sceneKey（场景对象的 uuid）, count（apostleMass 网格数）, look（当前候选 id，可选） }。
 *   连续 need 次采样都满足「sceneKey 相同 + count 相同 + look 相同 + count ≥ min」才算稳定，稳定后才读状态。
 *   采样失败（返回 null、抛错、页面正在导航、count 不是数）只把连续计数清零，不当成「0 个网格」的结论。
 *   超时返回 ok:false 和最后一次采样，由调用方报 BLOCKED / 失败，不编数。
 */
export function sampleKey(s) { return `${s.sceneKey}|${s.count}|${s.look ?? ''}`; }

export function createStableTracker({ need = 3, min = 1, key = sampleKey } = {}) {
  if (!Number.isInteger(need) || need < 1) throw new RangeError('need 必须是 ≥ 1 的整数');
  let streak = 0, lastKey = null, last = null, samples = 0, resets = 0;
  const clear = () => { if (streak) resets++; streak = 0; lastKey = null; };
  return {
    /** 喂一次采样，返回这次之后是否已经稳定。 */
    observe(sample) {
      samples++; last = sample ?? null;
      if (!sample || typeof sample !== 'object' || !Number.isFinite(sample.count) || sample.count < min || sample.sceneKey == null || sample.sceneKey === '') { clear(); return false; }
      const k = key(sample);
      if (k === lastKey) streak++;
      else { if (streak) resets++; streak = 1; lastKey = k; }
      return streak >= need;
    },
    reset() { clear(); },
    get stable() { return streak >= need; },
    get streak() { return streak; },
    get last() { return last; },
    get samples() { return samples; },
    get resets() { return resets; },
  };
}

/**
 * 反复调用 sample() 直到稳定或超时。sleep / now 可注入（单元测试用假时钟）。
 * 返回 { ok, sample, samples, resets, ms, history[{t, key|null, error?}] }，history 最多留 60 条。
 */
export async function waitForStable(sample, { need = 3, min = 1, interval = 1000, timeout = 300000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), onSample } = {}) {
  const tracker = createStableTracker({ need, min }), t0 = now(), history = [];
  for (;;) {
    let s = null, error = null;
    try { s = await sample(); } catch (e) { error = e?.message || String(e); }
    const ok = tracker.observe(error ? null : s);
    history.push({ t: now() - t0, key: !error && s && Number.isFinite(s.count) ? sampleKey(s) : null, ...(error ? { error: error.slice(0, 160) } : {}) });
    if (history.length > 60) history.shift();
    onSample?.({ sample: s, error, streak: tracker.streak, ok });
    if (ok) return { ok: true, sample: s, samples: tracker.samples, resets: tracker.resets, ms: now() - t0, history };
    if (now() - t0 >= timeout) return { ok: false, reason: `等了 ${Math.round((now() - t0) / 1000)} 秒，十二门徒岩体网格没有连续 ${need} 次稳定出现`, sample: tracker.last, samples: tracker.samples, resets: tracker.resets, ms: now() - t0, history };
    await sleep(interval);
  }
}

/** 浏览器端：在游戏页面里对 Three.js 场景做一次采样（只读）。scene 由调用方给（morrisViewer.scene 或 __tm.scene）。 */
export function sampleApostleScene(scene, look = null) {
  if (!scene || typeof scene.traverse !== 'function') return null;
  let count = 0; const ids = [];
  scene.traverse((o) => { if (o.isMesh && o.userData?.apostleMass) { count++; ids.push(String(o.userData.apostleMass)); } });
  return { sceneKey: scene.uuid ?? null, count, look, massIds: ids.sort() };
}
