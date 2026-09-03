// =====================================================================
// 逐对象帧时间普查（2026-09-02）
//
// 为什么不能在循环外手动 renderer.render() 计数：
//   2026-09-02 实测，循环外单次 render 得 440k 三角形 / 3475 call，
//   而同一时刻帧循环内是 50M 三角形 / 4462 call，相差 100 倍。
//   循环外的那一次没有经过 animate() 的逐帧状态更新，量到的不是真实帧。
//
// 本模块一律在 requestAnimationFrame 里量，读的是页面自己那次 render
// 留下的 renderer.info，并对每个对象做 A-B-A：隐藏前后各测一次基线，
// 两次基线漂移过大就判定该行不可信（场景在飘，读数没有意义）。
// =====================================================================

/** 漂移超过这个百分比就认为环境在变，该行读数作废。 */
export const CENSUS_DRIFT_LIMIT = 30;

/**
 * 把一次 A-B-A 三元组折算成一行结论。纯函数，供单测。
 * savedMs > 0 表示隐藏该对象后变快。
 */
export function summarizeTrial(name, a1, b, a2, driftLimit = CENSUS_DRIFT_LIMIT) {
  const base = (a1.ms + a2.ms) / 2;
  const drift = base > 0 ? (Math.abs(a1.ms - a2.ms) / base) * 100 : 0;
  return {
    name,
    baseMs: +base.toFixed(2),
    hiddenMs: +b.ms.toFixed(2),
    savedMs: +(base - b.ms).toFixed(2),
    savedPct: base > 0 ? +(((base - b.ms) / base) * 100).toFixed(1) : 0,
    calls: a1.calls - b.calls,
    triangles: a1.triangles - b.triangles,
    driftPct: +drift.toFixed(1),
    trusted: drift <= driftLimit,
  };
}

/** 按可信行的收益排序；不可信的一律沉底，避免被当成结论读。 */
export function rankTrials(rows) {
  return [...rows].sort((x, y) => {
    if (x.trusted !== y.trusted) return x.trusted ? -1 : 1;
    return y.savedMs - x.savedMs;
  });
}

export function createSceneCensus({ renderer, scene, getCamera }) {
  if (!renderer || !scene) throw new Error("scene census requires renderer and scene");

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  /** 量 frames 帧的平均帧时间；前 warmup 帧丢弃，避开切换后的第一波抖动。 */
  async function sample(frames = 24, warmup = 6) {
    for (let i = 0; i < warmup; i++) await nextFrame();
    const started = performance.now();
    for (let i = 0; i < frames; i++) await nextFrame();
    const info = renderer.info.render;
    return {
      ms: (performance.now() - started) / frames,
      calls: info.calls,
      triangles: info.triangles,
    };
  }

  /**
   * 逐个隐藏子节点并计价。默认查 scene 顶层；传 root 可往下钻一层，
   * 例如把 planet-v9-runtime 摊开看是不是实例化植被吃掉了三角形。
   */
  async function run({ frames = 24, root = null, filter = null, onRow = null } = {}) {
    const parent = typeof root === "string"
      ? scene.getObjectByName(root)
      : (root || scene);
    if (!parent) throw new Error(`找不到节点：${root}`);
    const targets = parent.children.filter((child) =>
      child.visible && (child.name || "") && (!filter || filter(child))
    );
    const rows = [];
    for (const child of targets) {
      const a1 = await sample(frames);
      child.visible = false;
      const b = await sample(frames);
      child.visible = true;
      const a2 = await sample(frames);
      const row = summarizeTrial(child.name, a1, b, a2);
      rows.push(row);
      onRow?.(row);
    }
    return rankTrials(rows);
  }

  /**
   * 泄漏观测：定时采样 geometries/programs/textures。
   * 2026-09-02 观察到一轮会话里 geometries 9953→12471、programs 170→295
   * 单调上升，帧时间同步从 61ms 恶化到 96ms，需要坐实是不是泄漏。
   */
  function watchGrowth({ intervalMs = 10000, samples = 12 } = {}) {
    const log = [];
    const tick = () => {
      const info = renderer.info;
      log.push({
        t: Math.round(performance.now() / 1000),
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? null,
        calls: info.render.calls,
        triangles: info.render.triangles,
      });
      if (log.length >= samples) {
        clearInterval(timer);
        console.table(log);
        const first = log[0];
        const last = log.at(-1);
        console.log(
          `geometries ${first.geometries} → ${last.geometries}`,
          `| programs ${first.programs} → ${last.programs}`,
          last.geometries > first.geometries * 1.05 ? "⚠️ 持续增长，疑似泄漏" : "✅ 稳定"
        );
      }
    };
    const timer = setInterval(tick, intervalMs);
    tick();
    return { stop: () => clearInterval(timer), log };
  }

  return { run, sample, watchGrowth, getCamera };
}
