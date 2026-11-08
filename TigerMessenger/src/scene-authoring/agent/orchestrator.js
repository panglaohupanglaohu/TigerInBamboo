/**
 * orchestrator.js — 场景工坊里的 super agent（浏览器内，确定性，不依赖大模型）。
 *
 *   Router        改造方向 + 选中物件 + 当前管线 → 能力计划（REACodeRefactoring/src/capabilities/registry.js routeGoal）
 *   改造 Worker   transform-worker.js：在场景副本上执行计划 → 候选编码 + 每步报告
 *   验证 Worker   verify-worker.js：范围 / 手工建筑 / 承托 / 通行 / 几何量
 *   Watchdog      每个任务有心跳与超时：卡住就终止该 Worker、重建、重试一次；全程记事件
 *   经验沉淀      每次执行的计划、报告、验证与你的决定（写入 / 草稿 / 放弃）记在本机，按能力汇总
 *
 * 实景只经 bridge 的 cap.* 命令预览；写入工作区必须由你点确认。
 */
import { rea } from './rea.js';
import { Watchdog, WorkerSlot } from './runtime.js';

const EXP_KEY = 'tm.capability.experience.v1';

export function readExperience(storage = localStorage) { try { return JSON.parse(storage.getItem(EXP_KEY) || '[]'); } catch { return []; } }
export function experienceFor(id, rows = readExperience()) {
  const has = (r) => r.steps?.some((s) => s.id === id);
  const runs = rows.filter((r) => r.outcome === 'previewed' && has(r));
  return { runs: runs.length, applied: runs.filter((r) => r.steps.find((s) => s.id === id)?.status === 'applied').length,
    passed: runs.filter((r) => r.verify === 'pass' || r.verify === 'warn').length, failed: runs.filter((r) => r.verify === 'fail').length,
    committed: rows.filter((r) => r.outcome === 'committed' && has(r)).length, lastFailure: [...runs].reverse().find((r) => r.verify === 'fail')?.why || '', lastAt: runs.at(-1)?.at || null };
}

export function createAgent({ request, onEvent = () => {}, storage = localStorage }) {
  const log = [];
  const emit = (e) => { e.at = Date.now(); log.push(e); if (log.length > 200) log.shift(); onEvent(e); };
  const dog = new Watchdog(emit);
  const transform = new WorkerSlot(new URL('./transform-worker.js', import.meta.url), '改造 Worker', dog);
  const verifier = new WorkerSlot(new URL('./verify-worker.js', import.meta.url), '验证 Worker', dog);
  const registry = import(rea('src/capabilities/registry.js'));
  let lastScene = null, current = null;

  async function withRetry(slot, msg, opts) {
    try { return await slot.call(msg, opts); }
    catch (e) { if (!e.timeout) throw e; emit({ type: 'recover', name: slot.name, why: e.message }); return slot.call(msg, opts); }   // Watchdog：超时后重建 Worker，重试一次
  }
  function remember(row) {
    try { const rows = readExperience(storage); rows.push(row); while (rows.length > 300) rows.shift(); storage.setItem(EXP_KEY, JSON.stringify(rows)); emit({ type: 'experience', row }); } catch {}
  }

  return {
    log, watchdog: dog,
    /** 扫描：当前场景每个能力能作用到哪些物件 */
    async scan({ focusCells = null } = {}) {
      emit({ type: 'phase', phase: 'scan' });
      lastScene = await request('cap.state');
      const r = await withRetry(transform, { type: 'match', data: lastScene.data, allowed: lastScene.allowed, focusCells }, { idle: 20000, total: 60000 });
      emit({ type: 'phase', phase: 'scanned', count: r.matches.reduce((a, m) => a + m.count, 0) });
      return r;
    },
    /** Router：改造方向 + 已启用节点 → 建议计划 */
    async route(goal, matches, enabledIds) { const reg = await registry; return reg.routeGoal(goal, matches, { selected: enabledIds }); },
    /** 改造 + 验证 + 实景预览 */
    async generate({ steps, goal = '', focusCells = null }) {
      if (!steps.length) throw new Error('计划里没有可执行的能力节点');
      if (current) { await request('cap.revert').catch(() => {}); current = null; }
      emit({ type: 'phase', phase: 'transform', steps: steps.map((s) => s.id) });
      const scene = await request('cap.state');
      const run = await withRetry(transform, { type: 'run', data: scene.data, allowed: scene.allowed, steps, focusCells }, { idle: 20000, total: 90000 });
      const touchesBuilt = steps.some((s) => s.id.startsWith('build.'));
      const changed = run.data !== scene.data;
      emit({ type: 'phase', phase: 'verify' });
      const verification = changed ? await withRetry(verifier, { before: scene.data, after: run.data, allowed: scene.allowed, touchesBuilt }, { idle: 20000, total: 60000 })
        : { status: 'pass', summary: '没有改动体素（只加显示层）', checks: [{ id: 'geometry', name: '体素', status: 'pass', detail: '未改动' }], changedCells: [] };
      const layers = [...new Set(run.report.filter((r) => r.layer3d && (r.status === 'layer' || r.status === 'applied')).map((r) => r.layer3d))];
      const focus = [...new Set([...run.report.flatMap((r) => r.focus || []), ...verification.changedCells.slice(0, 200)])];
      emit({ type: 'phase', phase: 'preview' });
      await request('open').catch(() => {});   // 进入编辑取景（隐藏游玩界面），实景对照才看得清
      const preview = await request('cap.preview', { data: run.data, layers, focus });
      current = { id: 'cand-' + Date.now().toString(36), goal, steps, baseline: scene.data, data: run.data, report: run.report, verification, layers, focus, preview };
      remember({ at: Date.now(), id: current.id, goal, steps: run.report.map((r) => ({ id: r.id, status: r.status, applied: r.applied?.length || 0 })), verify: verification.status, why: verification.checks.filter((c) => c.status === 'fail').map((c) => c.name + '：' + c.detail).join('；'), outcome: 'previewed' });
      emit({ type: 'phase', phase: 'review', status: verification.status });
      return current;
    },
    current: () => current,
    async show(which) { return request('cap.show', { which }); },
    async highlight(cells) { return request('cap.highlight', { cells }); },
    async discard() { if (!current) return; await request('cap.revert'); remember({ at: Date.now(), id: current.id, steps: current.report.map((r) => ({ id: r.id, status: r.status })), verify: current.verification.status, outcome: 'discarded' }); current = null; emit({ type: 'phase', phase: 'idle' }); },
    async commit() {
      if (!current) throw new Error('当前没有候选');
      if (current.verification.status === 'fail') throw new Error('验证未通过的候选不能写入；可继续改或放弃');
      const r = await request('cap.commit');
      remember({ at: Date.now(), id: current.id, steps: current.report.map((x) => ({ id: x.id, status: x.status })), verify: current.verification.status, outcome: 'committed' });
      const done = current; current = null; emit({ type: 'phase', phase: 'committed' });
      return { ...r, candidate: done };
    },
    noteOutcome(outcome) { if (current) remember({ at: Date.now(), id: current.id, steps: current.report.map((x) => ({ id: x.id, status: x.status })), verify: current.verification.status, outcome }); },
  };
}
