/**
 * 建筑管线 · 独立验证（R56，纯数据）。不信任改造 Worker 的中间状态：只拿原始采样 field 和产出 plan 重算。
 *   ① 重构库 validateLayout：足迹不压保护格、不重叠、形状 = prefab、足迹平、门对路、路不悬空、路网接老城（warn）、数量（warn）；
 *   ② 契约生成的检查（R52 contract-verify.js）：本次执行步骤的 preserves 并集 → 已有建筑 / 保护带 / 轨道净空 / 海岸线 / 存档 / 湖上建筑 / 原地形；
 *   ③ 本层自己的：建筑底面不埋进地里（base ≥ 足迹最高处）、计划与采样网格一致。
 */
import { validateLayout, layoutProbeCells } from '../../../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';
import { verifyPreserves, preservesOfSteps } from '../contract-verify.js?v=contract-r1';
import { contractOf } from '../contracts.js?v=contract-r1';
import { BUILDING_CAPABILITIES } from './capabilities.js?v=building-r1';

export function verifyBuilding(field, plan, { steps = [], sceneId = null } = {}) {
  const checks = [], add = (id, name, status, detail, blame) => checks.push({ id, name, status, detail, blame: blame || [] });
  const fin = (extra = {}) => { const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass'; return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' '), ...extra }; };
  const layout = plan?.layout;
  if (!field || !Number.isInteger(field.n) || field.h?.length !== field.n * field.n) { add('field', '采样网格', 'fail', '没有采样网格'); return fin(); }
  if (!layout) { add('layout', '建筑群计划', 'fail', plan?.solve?.reason || '计划里没有建筑群（联合 WFC 没解出来或没执行）', ['building.joint-wfc']); return fin(); }
  if (layout.step !== field.step || !(layout.k >= 1) || layout.W !== Math.floor(field.n / layout.k)) add('grid', '计划与采样网格一致', 'fail', `计划 step ${layout.step} / ${layout.W} 格，采样 step ${field.step} / n ${field.n}`, ['building.joint-wfc']);
  else add('grid', '计划与采样网格一致', 'pass', `${layout.W}×${layout.H} 建筑格，每格 ${layout.cellSize} m`);
  const v = validateLayout(field, layout, { minBuildings: steps.find((s) => s.id === 'building.joint-wfc')?.params?.minBuildings ?? 1 });
  for (const c of v.checks) add('layout.' + c.id, c.name, c.status, c.detail, c.status === 'fail' ? ['building.joint-wfc'] : []);
  // 底面不埋：base ≥ 足迹采样格最高处
  const n = field.n, k = layout.k; let buried = 0, worst = 0;
  for (const p of layout.placements) { let hi = -Infinity; for (const [I, J] of p.cells) for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) { const v2 = field.h[(J * k + b) * n + I * k + a]; if (v2 != null && Number.isFinite(v2)) hi = Math.max(hi, v2); } if (p.base < hi - 0.01) { buried++; worst = Math.max(worst, hi - p.base); } }
  add('base', '建筑底面不埋进地里', buried ? 'fail' : 'pass', buried ? `${buried} 栋底面低于足迹最高处（最多 ${worst.toFixed(2)} m）` : `${layout.placements.length} 栋底面都在足迹最高处之上`, buried ? ['building.joint-wfc'] : []);
  // 契约 → 通用检查
  const contracts = BUILDING_CAPABILITIES.map((c) => contractOf(c.meta, 'building')), ran = steps.length ? steps.map((s) => s.id) : contracts.map((c) => c.id);
  const { preserves, blameOf } = preservesOfSteps(contracts, ran), sp = steps.find((s) => s.id === 'building.sites')?.params || layout.params || {};
  for (const c of verifyPreserves(preserves, { field, after: { footprint: layoutProbeCells(layout, n) }, band: sp.band ?? 4, railBand: sp.railBand ?? 6, sceneId: sceneId || plan.sceneId }, { blameOf })) checks.push(c);
  return fin({ metrics: { ...v.stats, terrain: plan.terrain || 'original', window: layout.window, seed: layout.seed, generated: checks.filter((c) => c.generated).length } });
}
