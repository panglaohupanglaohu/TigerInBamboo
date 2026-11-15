import {executionContext,assertEngineContext,assertExecutionScope,assertEngineCommit,validateEngineOutput} from '../pipeline-engine/PipeLineEngine.js';
/**
 * tier-agent.js — 三层工坊共用的 super agent 框架（球系统 / 物件；场景层沿用 scene-authoring/agent/orchestrator.js，
 * 共享同一个 runtime：Watchdog + WorkerSlot + 重建重试 + 经验沉淀）。
 *
 *   Router        改造方向关键词 × 扫描结果（只推荐真能作用的能力）
 *   改造 Worker   在副本上执行能力计划 → 候选
 *   验证 Worker   独立检查候选；fail 的候选不能写入
 *   Watchdog      心跳 / 空闲超时 / 总超时 → 终止并重建 Worker，重试一次；事件进时间线
 *   经验沉淀      每次预览 / 写入 / 放弃记在本机 tm.<层>.experience.v1，按能力汇总
 * 层的差异只在 hooks：输入是什么、怎么预览、写入到哪里。
 */
import { Watchdog, WorkerSlot, withRetry, experienceStore } from '../scene-authoring/agent/runtime.js?v=sys-r15';

export function routeByKeywords(goal, capabilities, matches, selected = []) {
  const g = (goal || '').toLowerCase(), out = [];
  for (const cap of capabilities) {
    const m = matches.find((x) => x.id === cap.id); if (!m?.count) continue;
    const why = (m.targets || []).slice(0, 3).map((t) => t.reason).join('；');
    const hits = (cap.keywords || []).filter((k) => g.includes(k.toLowerCase()));
    if (hits.length || selected.includes(cap.id)) out.push({ id: cap.id, matches: m.count, score: hits.length, why: (hits.length ? `改造方向含「${hits.join('、')}」；` : '已在管线；') + why });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function createTierAgent({ tier, transformUrl, verifyUrl, capabilities, hooks, onEvent = () => {}, timeouts = {}, experienceKey }) {
  const log = [], emit = (e) => { e.at = Date.now(); e.tier = tier; log.push(e); if (log.length > 200) log.shift(); onEvent(e); };
  const dog = new Watchdog(emit);
  const NAME = { planet: '球系统', object: '物件', scene: '场景' }[tier] || tier;
  const transform = new WorkerSlot(transformUrl, NAME + ' · 改造 Worker', dog);
  const verifier = new WorkerSlot(verifyUrl, NAME + ' · 验证 Worker', dog);
  const exp = experienceStore(`tm.${experienceKey || tier}.experience.v1`);
  const T = { scan: { idle: 20000, total: 60000 }, run: { idle: 20000, total: 90000 }, verify: { idle: 20000, total: 60000 }, ...timeouts };
  let input = null, scan = null, current = null, generating = false;
  const context=()=>executionContext(tier,hooks.sceneId?.()??globalThis.__tmCurrentScene);const scanInputs=new WeakMap();
  const remember = (row) => { exp.add(row); emit({ type: 'experience', row }); };
  const rowOf = (c, outcome) => ({ blame: [...new Set(c.verification.checks.filter((x) => x.status === 'fail').flatMap((x) => x.blame || []))], at: Date.now(), id: c.id, goal: c.goal, steps: c.report.map((r) => ({ id: r.id, status: r.status })), verify: c.verification.status, why: c.verification.checks.filter((x) => x.status === 'fail').map((x) => x.name + '：' + x.detail).join('；'), outcome });

  return {
    log, watchdog: dog, experience: exp,
    async scan() {
      emit({ type: 'phase', phase: 'scan' });
      const scope=context(),localInput=await hooks.input();assertEngineContext(scope,context());
      const localScan = await withRetry(transform, { type: 'scan', ...hooks.scanMsg(localInput), context:scope }, T.scan, emit);
      assertEngineContext(scope,context());input=localInput;scan=localScan;scanInputs.set(localScan,localInput);emit({ type: 'phase', phase: 'scanned', count: scan.matches.reduce((a, m) => a + m.count, 0) });
      return scan;
    },
    route: (goal, selected) => routeByKeywords(goal, capabilities, scan?.matches || [], selected),
    lastScan: () => scan,
    async generate({ steps, goal = '' }) {
      if(generating)throw Error('PipeLineEngine正在生成候选');generating=true;try{
      if (!steps.length) throw new Error('管线里没有启用的可执行能力节点');
      if (current) await this.discard();
      const scope=context(),baselineScan=await this.scan();assertEngineContext(scope,context());const baseline=scanInputs.get(baselineScan);
      emit({ type: 'phase', phase: 'transform', steps: steps.map((s) => s.id) });
      const run = await withRetry(transform, { type: 'run', ...hooks.runMsg(baseline, steps), context:scope }, T.run, emit);
      await validateEngineOutput(run);emit({ type: 'phase', phase: 'verify' });
      const verification = await withRetry(verifier, hooks.verifyMsg(baseline, baselineScan, run, steps), T.verify, emit);
      assertExecutionScope(run.engine,context());current = { id: tier + '-' + Date.now().toString(36), goal, steps:run.engine.steps, input:baseline, run, engine:run.engine, report: run.report, verification };
      emit({ type: 'phase', phase: 'preview' });
      current.preview = await hooks.preview(current);current.previewed=true;
      remember(rowOf(current, 'previewed'));
      emit({ type: 'phase', phase: 'review', status: verification.status });
      return current;
      }finally{generating=false;}
    },
    current: () => current,
    engineInfo:()=>current?.run.engine||scan?.engine||null,
    compare: (on) => {if(!current)return;assertExecutionScope(current.run.engine,context());return hooks.compare?.(current,on);},
    async discard() { if (!current) return; assertExecutionScope(current.run.engine,context());await hooks.revert(current); remember(rowOf(current, 'discarded')); current = null; emit({ type: 'phase', phase: 'idle' }); },
    async commit(extra) {
      if (!current) throw new Error('当前没有候选');
      assertEngineCommit(current,context());await validateEngineOutput(current.run);assertExecutionScope(current.run.engine,context());
      const r = await hooks.commit(current, extra);
      remember(rowOf(current, 'committed'));
      const done = current; current = null; scan = null; emit({ type: 'phase', phase: 'committed' });
      return { ...r, candidate: done };
    },
    async draft() { if (!current) throw new Error('当前没有候选');assertExecutionScope(current.run.engine,context()); const r = await hooks.draft?.(current); remember(rowOf(current, 'drafted')); return r; },
  };
}
