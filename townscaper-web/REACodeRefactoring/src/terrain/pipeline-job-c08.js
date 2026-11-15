// r56 C08 · 1670064751181791233「mimic Thread.Sleep() in Burst! Just store time in a static unsafe
// NativeArray! Then you can write to it from the main thread and read from it inside a job!」
// 浏览器里的同构：生成管线跑在真正的 Worker 线程（= job）里；主线程把「时间倍率 / 暂停」写进一块
// SharedArrayBuffer（= static NativeArray），job 内的 sleep() 每片 ≤16ms 都重新读这块共享内存并用
// Atomics.wait 阻塞（= Thread.Sleep）。页面没开 cross-origin isolation 时退回 ArrayBuffer + 忙等
// （倍率只在启动时读一次），并如实标出 mode。
// 片子节奏（review 逐帧记录，22.83 s 一轮）：清空 0.21 → 三角化 7.07 → 抬起 0.2 → 灰模停 4.0 → 剪影 0.4 → 上色 6.0 → 静止 4.95（片尾 4.2 + 片头上一轮尾巴 0.72）
import { islandPoints, liftHeights } from './pipeline-stages.js';
import { TriGraph } from '../core/trigraph.js';

export const CLIP_RHYTHM = Object.freeze({ clear: 210, triangulate: 7070, lift: 200, clay: 4000, silhouette: 400, color: 6000, hold: 4950 });
export const JOB_STAGES = Object.freeze(['clear', 'triangulate', 'lift', 'clay', 'silhouette', 'color', 'hold']);
export const CTL = Object.freeze({ SCALE: 0, PAUSED: 1, ROUND: 2, PARK: 3 });   // Int32 slots; SCALE is ×1000

/** job 主体（Worker 与 node 测试共用）：post(msg) 发进度，sleep(ms) 由宿主注入 */
export function runJob({ post, sleep, rounds = 4, count = 160, rhythm = CLIP_RHYTHM, seed0 = 7 }) {
  if (!(rounds >= 1 && rounds <= 64) || typeof post !== 'function' || typeof sleep !== 'function') throw new RangeError('runJob options');
  for (const k of JOB_STAGES) if (!(rhythm[k] >= 0)) throw new RangeError('rhythm.' + k);
  for (let r = 0; r < rounds; r++) {
    const seed = seed0 + r;
    post({ round: r, stage: 'clear' }); sleep(rhythm.clear);
    const pts = islandPoints({ count, seed }), g = new TriGraph(40);
    const per = rhythm.triangulate / pts.length;
    for (let i = 0; i < pts.length; i++) {
      g.add(pts[i].x, pts[i].z);
      post({ round: r, stage: 'triangulate', i: i + 1, n: pts.length, pts: i === 0 ? pts.map((p) => [p.x, p.z]) : undefined, tris: g.triangles() });
      sleep(per);
    }
    const H = liftHeights(pts, { seed });
    for (const stage of ['lift', 'clay', 'silhouette', 'color', 'hold']) { post({ round: r, stage, H: stage === 'lift' ? H : undefined }); sleep(rhythm[stage]); }
  }
  post({ stage: 'done' });
}

/** 主线程侧的共享控制块（= static NativeArray） */
export function createJobControl({ scale = 1 } = {}) {
  const shared = typeof SharedArrayBuffer === 'function' && (typeof crossOriginIsolated === 'undefined' || crossOriginIsolated);
  const buf = shared ? new SharedArrayBuffer(16) : new ArrayBuffer(16), ctl = new Int32Array(buf);
  const api = {
    mode: shared ? 'shared-atomics' : 'copied-busywait', buf, ctl,
    setScale(s) { if (!(s >= 0 && s <= 1000)) throw new RangeError('scale'); Atomics.store(ctl, CTL.SCALE, Math.round(s * 1000)); return api; },
    pause() { Atomics.store(ctl, CTL.PAUSED, 1); return api; },
    resume() { Atomics.store(ctl, CTL.PAUSED, 0); if (shared) Atomics.notify(ctl, CTL.PAUSED); return api; },
    get scale() { return Atomics.load(ctl, CTL.SCALE) / 1000; },
  };
  return api.setScale(scale);
}

/** job 侧 sleep：每片 ≤16ms 重新读共享倍率与暂停位（Atomics.wait 阻塞 = Thread.Sleep）；无共享内存时忙等 */
export function makeJobSleep(ctl, { shared, now = () => performance.now() }) {
  return (ms) => {
    let left = ms;
    while (left > 1e-9) {
      if (shared) while (Atomics.load(ctl, CTL.PAUSED)) Atomics.wait(ctl, CTL.PAUSED, 1, 100);
      const slice = Math.min(16, left), real = slice * Atomics.load(ctl, CTL.SCALE) / 1000;
      if (real > 0) { if (shared) Atomics.wait(ctl, CTL.PARK, 0, real); else { const end = now() + real; while (now() < end) { /* spin */ } } }
      left -= slice;
    }
  };
}

/** 启动真 Worker（模块 worker）；onMessage 收进度；返回 {worker, control, timeline} */
export function startJob({ rounds = 4, scale = 1, count = 160, onMessage = () => {} } = {}) {
  const control = createJobControl({ scale }), timeline = [], t0 = performance.now();
  const worker = new Worker(new URL('./pipeline-job-worker-c08.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const m = e.data; if (m.stage !== timelineLast(timeline) || m.round !== timeline.at(-1)?.round) timeline.push({ stage: m.stage, round: m.round, t: performance.now() - t0 }); onMessage(m); };
  worker.onerror = (e) => onMessage({ stage: 'error', message: e.message });
  worker.postMessage({ buf: control.buf, shared: control.mode === 'shared-atomics', rounds, count });
  return { worker, control, timeline };
}
function timelineLast(t) { return t.length ? t[t.length - 1].stage : null; }

/** 时间线 → 每阶段实际时长（ms，按轮平均），用来对照 CLIP_RHYTHM */
export function stageDurations(timeline) {
  const acc = {}, cnt = {};
  for (let i = 0; i + 1 < timeline.length; i++) { const s = timeline[i].stage; acc[s] = (acc[s] || 0) + timeline[i + 1].t - timeline[i].t; cnt[s] = (cnt[s] || 0) + 1; }
  return Object.fromEntries(Object.keys(acc).map((k) => [k, acc[k] / cnt[k]]));
}
