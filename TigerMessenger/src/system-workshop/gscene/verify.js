import {hexToOklab,deltaE} from '../../../../townscaper-web/REACodeRefactoring/src/core/oklab.js';
/** 通用场景管线 · 验证：数值、改动量、明度预算、对比度（明暗层次）保留、颜色不过度坍缩。 */
import { helpers } from './capabilities.js?v=contract-r2';
const { hex2rgb, rgb2hsl } = helpers;
export function verifyGscene(M, colors, {steps=[]}={}) {
  const checks = [], add = (id, name, status, detail) => checks.push({ id, name, status, detail });
  const bad = Object.entries(colors).filter(([id, c]) => !M.some((m) => m.id === id) || !/^#[0-9a-f]{6}$/i.test(c));
  add('values', '数值', bad.length ? 'fail' : 'pass', bad.length ? `${bad.length} 个颜色无效` : `${Object.keys(colors).length} 种材质改色`);
  const manual=Object.keys(colors).filter(id=>M.some(m=>m.id===id&&m.locked&&m.color.toLowerCase()!==String(colors[id]).toLowerCase()));
  const allowEdited=steps.some(s=>s.params?.includeEdited===true);
  add('manual','人工调色保留',manual.length&&!allowEdited?'fail':'pass',manual.length?`${manual.length} 种已保存材质${allowEdited?'获明确允许改动':'被改变'}`:'已保存材质未改变');
  if(bad.length)return{status:'fail',checks,summary:'无效材质或颜色，停止验证'};
  if(steps.length&&steps.every(s=>Number.isFinite(s.params?.maxDelta))){const budget=steps.reduce((sum,s)=>sum+s.params.maxDelta,0),excess=Object.entries(colors).filter(([id,c])=>deltaE(hexToOklab(M.find(m=>m.id===id).color),hexToOklab(c))>budget+1e-5);add('delta','感知色差预算',excess.length?'fail':'pass',`总预算 ${budget}，超限 ${excess.length} 种材质`);}
  if(!M.length)return{status:'pass',checks,summary:'当前无可编辑材质'};
  const after = M.map((m) => ({ ...m, color: colors[m.id] || m.color }));
  const L = (x) => rgb2hsl(hex2rgb(x.color))[2];
  const w = (x) => Math.max(1, x.uses), W = M.reduce((a, x) => a + w(x), 0);
  const meanL0 = M.reduce((a, x) => a + L(x) * w(x), 0) / W, meanL1 = after.reduce((a, x) => a + L(x) * w(x), 0) / W;
  add('light', '整体明度', Math.abs(meanL1 - meanL0) > 0.25 ? 'fail' : Math.abs(meanL1 - meanL0) > 0.12 ? 'warn' : 'pass', `${meanL0.toFixed(2)} → ${meanL1.toFixed(2)}（上限变化 0.25）`);
  const sd = (arr) => { const m = arr.reduce((a, x) => a + L(x) * w(x), 0) / W; return Math.sqrt(arr.reduce((a, x) => a + (L(x) - m) ** 2 * w(x), 0) / W); };
  const c0 = sd(M), c1 = sd(after);
  add('contrast', '明暗层次', c1 < c0 * 0.5 ? 'fail' : c1 < c0 * 0.75 ? 'warn' : 'pass', `明度标准差 ${c0.toFixed(3)} → ${c1.toFixed(3)}（低于一半判失败：画面会糊成一片）`);
  const n0 = new Set(M.map((m) => m.color)).size, n1 = new Set(after.map((m) => m.color)).size;
  add('variety', '颜色数', n1 < Math.min(3, n0) ? 'fail' : 'pass', `${n0} → ${n1} 种`);
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' ') };
}
