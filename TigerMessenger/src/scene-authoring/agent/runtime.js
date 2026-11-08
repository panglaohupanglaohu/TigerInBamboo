/**
 * runtime.js — super agent 的公共运行时，三层工坊（球系统 / 场景 / 物件）共用：
 *   Watchdog    每个任务有心跳与超时；卡住就终止 Worker、重建、由调用方重试一次
 *   WorkerSlot  一个模块 Worker 的调用槽：job 编号、心跳转发给 Watchdog、崩溃自动重建
 *   withRetry   超时后重建并重试一次
 *   experience  按层分别记在本机（tm.<层>.experience.v1），按能力汇总
 */
export class Watchdog {
  constructor(onEvent) { this.onEvent = onEvent; this.jobs = new Map(); }
  start(id, { name, idle = 15000, total = 60000, onTimeout }) {
    const job = { id, name, startedAt: Date.now(), last: Date.now(), stage: '排队', onTimeout };
    job.timer = setInterval(() => {
      const now = Date.now();
      if (now - job.last > idle || now - job.startedAt > total) { this.stop(id, 'timeout'); onTimeout?.(now - job.last > idle ? `${name} ${Math.round(idle / 1000)} 秒无心跳` : `${name} 超过 ${Math.round(total / 1000)} 秒`); }
    }, 500);
    this.jobs.set(id, job); this.onEvent({ type: 'job', id, name, state: 'running' });
    return job;
  }
  beat(id, stage) { const j = this.jobs.get(id); if (!j) return; j.last = Date.now(); j.stage = stage; this.onEvent({ type: 'beat', id, name: j.name, stage }); }
  stop(id, state = 'done') { const j = this.jobs.get(id); if (!j) return; clearInterval(j.timer); this.jobs.delete(id); this.onEvent({ type: 'job', id, name: j.name, state, ms: Date.now() - j.startedAt }); }
  active() { return [...this.jobs.values()].map(({ id, name, stage, startedAt }) => ({ id, name, stage, ms: Date.now() - startedAt })); }
}

export class WorkerSlot {
  constructor(file, name, dog) { this.file = file; this.name = name; this.dog = dog; this.seq = 0; this.waiting = new Map(); this.spawn(); }
  spawn() {
    this.w?.terminate();
    this.w = new Worker(this.file, { type: 'module', name: this.name });
    this.w.onmessage = ({ data }) => {
      const p = this.waiting.get(data.job); if (!p) return;
      if (data.heartbeat) { this.dog.beat(p.id, data.stage); return; }
      this.waiting.delete(data.job); this.dog.stop(p.id, data.ok ? 'done' : 'failed');
      data.ok ? p.resolve(data.result) : p.reject(new Error(data.error));
    };
    this.w.onerror = (e) => { e.preventDefault?.(); for (const [k, p] of this.waiting) { this.dog.stop(p.id, 'crashed'); p.reject(new Error(this.name + ' 崩溃：' + (e.message || '脚本错误'))); this.waiting.delete(k); } this.spawn(); };
  }
  call(msg, opts = {}) {
    const job = ++this.seq, id = this.name + '#' + job;
    return new Promise((resolve, reject) => {
      this.waiting.set(job, { id, resolve, reject });
      this.dog.start(id, { name: this.name, ...opts, onTimeout: (why) => { this.waiting.delete(job); this.spawn(); reject(Object.assign(new Error(why), { timeout: true })); } });
      this.w.postMessage({ ...msg, job });
    });
  }
}

export async function withRetry(slot, msg, opts, emit) {
  try { return await slot.call(msg, opts); }
  catch (e) { if (!e.timeout) throw e; emit?.({ type: 'recover', name: slot.name, why: e.message }); return slot.call(msg, opts); }
}
export function experienceStore(key, storage = globalThis.localStorage) {
  const read = () => { try { return JSON.parse(storage.getItem(key) || '[]'); } catch { return []; } };
  return {
    read,
    add(row) { try { const rows = read(); rows.push(row); while (rows.length > 300) rows.shift(); storage.setItem(key, JSON.stringify(rows)); } catch {} return row; },
    summary(id, rows = read()) {
      const has = (r) => r.steps?.some((s) => s.id === id);
      const runs = rows.filter((r) => r.outcome === 'previewed' && has(r));
      return { runs: runs.length, passed: runs.filter((r) => r.verify !== 'fail').length, failed: runs.filter((r) => r.verify === 'fail').length,
        committed: rows.filter((r) => r.outcome === 'committed' && has(r)).length, lastFailure: [...runs].reverse().find((r) => r.verify === 'fail')?.why || '' };
    },
  };
}
