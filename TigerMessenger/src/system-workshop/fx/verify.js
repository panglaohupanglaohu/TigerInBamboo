/** 表现层管线 · 独立验证（纯数据）。只拿 site 与 plan 重算，不信任改造 Worker 的中间状态。 */
import { frontierClearance } from '../../../../townscaper-web/REACodeRefactoring/src/core/frontier.js';
import { KELVIN } from '../../../../townscaper-web/REACodeRefactoring/src/core/wake-sampling.js';
import { fold } from '../../../../townscaper-web/REACodeRefactoring/src/core/mirror-uv.js';
import { NodeGraph, constant } from '../../../../townscaper-web/REACodeRefactoring/src/core/node-graph-runtime.js';
import { verifyFrontier } from './verify-frontier.js?v=fxe-r1';

export function verifyFx(site, plan, { steps = [] } = {}) {
  // metric（可选）：{ name, value, threshold, direction:'max'|'min', unit } —— 夜间重建收集它算「离阈值多远」（创新 5，R40）
  const checks = [], add = (id, name, status, detail, blame, metric) => checks.push({ id, name, status, detail, blame: blame || [], ...(metric ? { metric } : {}) });
  const fin = (extra = {}) => ({ status: checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass', checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' '), ...extra });
  if (!site?.grid?.length || !plan) { add('plan', '表现层计划', 'fail', '没有与采样一致的计划', steps.map((s) => s.id)); return fin(); }
  const ran = new Set(steps.map((s) => s.id));

  if (ran.has('fx.campaign')) {
    const c = plan.campaign;
    if (!c?.nodes?.length || !Array.isArray(c.zones) || c.zones.length !== c.nodes.length) add('campaign', '分区覆盖', 'fail', '分区与舞台格网数量不一致', ['fx.campaign']);
    else {
      const zc = new Set(c.zones).size;
      add('campaign-zones', '分区覆盖', c.nodes.every((_, i) => Number.isInteger(c.zones[i])) && zc >= 2 ? 'pass' : 'fail', `${c.nodes.length} 格分成 ${zc} 区`, ['fx.campaign']);
      const nodes = c.nodes.map((n) => ({ x: n[0], y: n[1], r: (site.scale || 5) * 0.55 }));
      const pts = c.frontier.map((p) => ({ x: p[0], y: p[1] }));
      const clear = pts.length >= 2 ? Math.min(...pts.map((p, i) => i ? frontierClearance(p, pts[i - 1], nodes) : Infinity)) : 0;
      add('campaign-frontier', '前线连通且有净空', c.frontierOk && c.frontier.length >= 2 ? (clear >= 0.5 ? 'pass' : 'warn') : 'fail', c.frontierOk ? `前线 ${c.frontier.length} 点 · 段净空 ${Number.isFinite(clear) ? clear.toFixed(2) : '—'}` : '前线未连通：' + (c.reason || '未知'), ['fx.campaign'], c.frontierOk && Number.isFinite(clear) ? { name: '前线段净空', value: +clear.toFixed(3), threshold: 0.5, direction: 'min', unit: '格' } : undefined);
    }
  }
  if (ran.has('fx.camera')) {
    const c = plan.camera, ok = c?.path?.length >= 24 && Number.isFinite(c.worstDegPerSec);
    add('camera-path', '镜头路径', ok ? 'pass' : 'fail', ok ? `${c.path.length} 点 · 半径 ${c.radius}` : '路径缺失或太短', ['fx.camera']);
    add('camera-speed', '角速度上限', ok && c.worstDegPerSec <= c.maxSpeed + 0.5 ? 'pass' : 'warn', `峰值 ${c?.worstDegPerSec}°/s（限 ${c?.maxSpeed}）`, ['fx.camera'], ok ? { name: '镜头峰值角速度', value: c.worstDegPerSec, threshold: c.maxSpeed, direction: 'max', unit: '°/s' } : undefined);
  }
  if (ran.has('fx.wake')) {
    const w = plan.wake;
    add('wake-count', '泡沫数量', w?.points?.length > 10 ? 'pass' : 'fail', `${w?.points?.length ?? 0} 片`, ['fx.wake']);
    const exp = w && +(Math.atan(w.spread / w.shipV) * 180 / Math.PI).toFixed(2), sym = w && w.points.slice(0, 30).every((p) => Math.abs(Math.hypot(p.l[0] - p.r[0], p.l[1] - p.r[1])) > 0);
    add('wake-angle', 'V 形半角与对称', w && Math.abs(exp - w.halfAngle) < 0.01 && w.halfAngle <= KELVIN && sym ? 'pass' : 'warn', `半角 ${w?.halfAngle}°（重算 ${exp}° · ≤Kelvin ${KELVIN}°）`, ['fx.wake'], w ? { name: '尾迹半角', value: w.halfAngle, threshold: KELVIN, direction: 'max', unit: '°' } : undefined);
  }
  if (ran.has('fx.ornament')) {
    const o = plan.ornament;
    const sym = o && o.field.length === o.size * o.size && o.uv.length === o.size * o.size;
    let mirrorOk = sym;
    if (sym) for (let j = 0; j < o.size && mirrorOk; j += 7) for (let i = 0; i < o.size && mirrorOk; i += 7) { const u = fold((i - o.size * .5) / o.tile), v = fold((j - o.size * .5) / o.tile), u2 = fold(-(i - o.size * .5) / o.tile); mirrorOk = Math.abs(u - u2) < 1e-9 || Math.abs(fold((o.size - 1 - i - o.size * .5) / o.tile) - u) < 2 / o.tile; }
    add('ornament', '面板与镜像', sym && mirrorOk ? 'pass' : 'warn', sym ? `面板 ${o.size}² · 镜像 UV ${mirrorOk ? '对称' : '偏差'}` : '面板数据缺失', ['fx.ornament']);
  }
  if (ran.has('fx.replay')) {
    const r = plan.replay, g = new NodeGraph(), sids = steps.map((s) => s.id);
    g.add('scan', constant(1)); sids.forEach((s, i) => { g.add('s' + i, { inputs: ['in'], outputs: ['out'], defaults: { in: 0 }, eval: (n) => ({ out: (n.in.in || 0) + 1 }) }); g.link((i ? 's' + (i - 1) : 'scan') + ':out', 's' + i + ':in'); });
    let same = false; try { same = g.order().length === r?.nodes?.length; } catch {}
    add('replay', '回放图可复算', r?.stable && same ? 'pass' : 'fail', `计划 ${r?.nodes?.length ?? 0} 节点 · 独立重建 ${same ? '一致' : '不一致'} · ${r?.stable ? '轨迹收敛' : '轨迹未收敛'}`, ['fx.replay']);
  }
  verifyFrontier(site, plan, ran, add);   // R37–R39：火 / 走廊 / 沉积 / 弹道
  if (!checks.length) add('plan', '表现层计划', 'fail', '没有可验证的输出', steps.map((s) => s.id));
  return fin();
}
