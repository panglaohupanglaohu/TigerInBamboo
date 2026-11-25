/**
 * 十二门徒地形管线 · 能力库（Worker 安全：纯数据）。R31：把 src/world/apostlesLook.js 的两个实验开关做成可执行能力（地形线）。
 *
 * 输入 site = apostles.look.probe 的实景采样（src/world/rea/apostlesLookProbe.js）：
 *   { scene:'apostles', look:{ id, soft, palette }, masses:[{ id, order, seed, spire, scale, xz[2n], lv[n]（0 = 海）, edges[2m]（陆地相邻边）, colors:{ top, wall } }] }
 * 每个能力挂在学习库的一条能力线上（meta.line）；meta.modules = run() 里真正 import 并调用的 REACodeRefactoring 模块：
 *   apostles.soft     十二门徒软坡    —— terrain/generate.js slopeMask：与游戏里 ?apostlesLook=soft 同一个函数、同一个种子（7300 + 序号 × 101），
 *                                       分出缓坡省 / 陡崖省，数每块岩体「缓坡省里差 1 层」的可融台阶、陡崖省 1 层台阶、≥ 2 层竖崖
 *                                       （诊断结论 3：认可高度场是平顶 + 2 层起跳，软坡只融得掉 1 层——这里把它量出来）
 *   apostles.palette  十二门徒库地形色 —— core/palette.js TERRAIN（库草色 / 岩色）+ core/oklab.js deltaE：现画面顶面 / 崖壁平均色离库色多远
 * 候选 = 一个外观开关组合 plan.look（与网址参数同写法，例如 'soft,palette'）。预览 = 工坊里的游戏 iframe 带 ?apostlesLook= 重载；
 * 不写 localStorage['tm.apostles.look.v1']、不改岩体存档、不改湖上建筑（plan.persist 恒为 false，验证 Worker 会查）。
 * 「采用哪套」要用户点头：docs/PENDING_USER_DECISIONS.md「十二门徒采用哪套」。
 */
import { slopeMask } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/generate.js';
import { TERRAIN } from '../../../../townscaper-web/REACodeRefactoring/src/core/palette.js';
import { hexToOklab, deltaE } from '../../../../townscaper-web/REACodeRefactoring/src/core/oklab.js';

export const APOSTLES_TERRAIN_VERSION = 1;
const LIB = 'townscaper-web/REACodeRefactoring/';
export const LOOK_FLAGS = ['soft', 'palette'];
/** 开关组合 → 网址参数写法（固定顺序）与 APOSTLES_LOOK.id 写法（排序后用 + 连） */
export const lookParam = (flags) => LOOK_FLAGS.filter((f) => flags.includes(f)).join(',') || 'approved';
export const lookId = (flags) => [...new Set(flags)].sort().join('+') || 'approved';

/** 一块岩体的台阶统计（缓坡省 = slopeMask < 0.5）。cells 必须是这块岩体的全部格子（与游戏里 world.cells 一致，分位数才一致）。 */
export function softSteps(mass) {
  const n = mass.lv.length, cells = new Array(n);
  for (let i = 0; i < n; i++) cells[i] = { cx: mass.xz[2 * i], cz: mass.xz[2 * i + 1] };
  const mask = slopeMask(cells, mass.seed);
  let land = 0, softLand = 0; for (let i = 0; i < n; i++) if (mass.lv[i] > 0) { land++; if (mask[i] < 0.5) softLand++; }
  let flat = 0, soft1 = 0, sharp1 = 0, cliff2 = 0;
  for (let k = 0; k < mass.edges.length; k += 2) {
    const a = mass.edges[k], b = mass.edges[k + 1], d = Math.abs(mass.lv[a] - mass.lv[b]);
    if (!d) flat++; else if (d === 1) { if (mask[a] < 0.5 && mask[b] < 0.5) soft1++; else sharp1++; } else cliff2++;
  }
  const steps = soft1 + sharp1 + cliff2;
  return { id: mass.id, land, softShare: land ? +(softLand / land).toFixed(4) : 0, flat, soft1, sharp1, cliff2, meltable: steps ? +(soft1 / steps).toFixed(4) : 0 };
}
export function sumSteps(rows) {
  const t = { land: 0, flat: 0, soft1: 0, sharp1: 0, cliff2: 0 }; for (const r of rows) for (const k of Object.keys(t)) t[k] += r[k];
  const steps = t.soft1 + t.sharp1 + t.cliff2; return { ...t, meltable: steps ? +(t.soft1 / steps).toFixed(4) : 0 };
}
/** 一块岩体的配色差（deltaE 是 OKLab 距离 × 100）。 */
export function paletteShift(mass) {
  const c = mass.colors || {}; const d = (a, b) => a && /^#[0-9a-f]{6}$/i.test(a) ? +deltaE(hexToOklab(a), hexToOklab(b)).toFixed(3) : null;
  return { id: mass.id, top: c.top || null, wall: c.wall || null, dTop: d(c.top, TERRAIN.grass), dWall: d(c.wall, TERRAIN.rock) };
}
export const meanShift = (rows) => { const v = rows.flatMap((r) => [r.dTop, r.dWall]).filter((x) => x != null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : null; };
const usable = (site) => (site?.masses || []).filter((m) => !m.missing && Array.isArray(m.lv) && Array.isArray(m.xz) && Array.isArray(m.edges));
const plan = (site) => (site.plan ||= { flags: [], look: 'approved', lookId: 'approved', persist: false, metrics: {} });

export const apostlesSoft = {
  meta: { id: 'apostles.soft', name: '十二门徒软坡', domain: 'apostles-terrain', line: 'terrain', requires: [],
    does: '把十二门徒换成最新能力库并打开「缓坡省 + 连续软坡顶面」（等同 ?apostlesLook=soft）；执行时先用库的 slopeMask 数出每块岩体有多少台阶真能融成缓坡。',
    keywords: ['软坡', '缓坡', '柔和', '台阶', '十二门徒', '岩体', 'soft'], params: {},
    modules: ['src/terrain/generate.js'], sources: [LIB + 'src/terrain/generate.js'], ideas: [LIB + 'src/terrain/soft-tops.js', 'src/world/apostlesTerrain.js'], learn: ['1447488323845509121'] },
  match(site) { return usable(site).filter((m) => m.lv.some((v) => v > 0)).map((m) => ({ id: m.id, count: 1, reason: `${m.id}：${m.lv.filter((v) => v > 0).length} 个陆地格` })); },
  run(site) {
    const rows = usable(site).map(softSteps), total = sumSteps(rows), p = plan(site);
    if (!p.flags.includes('soft')) p.flags.push('soft'); p.metrics.soft = { masses: rows, total };
    return { applied: ['look:soft'], changed: [`可融台阶（缓坡省差 1 层）${total.soft1} 条 · 陡崖省 1 层台阶 ${total.sharp1} · ≥2 层竖崖 ${total.cliff2}；可融占台阶 ${(total.meltable * 100).toFixed(1)}%（当前画面：${site.look?.id || '未知'}）`] };
  },
};
export const apostlesPalette = {
  meta: { id: 'apostles.palette', name: '十二门徒库地形色', domain: 'apostles-terrain', line: 'terrain', requires: [],
    does: '十二门徒的地形改用能力库的地形色（等同 ?apostlesLook=palette），不再用自己的石灰岩主题色；执行时先算现画面顶面 / 崖壁色离库色多远。',
    keywords: ['配色', '地形色', '颜色', '草色', '岩色', 'Townscaper', '十二门徒', 'palette'], params: {},
    modules: ['src/core/palette.js', 'src/core/oklab.js'], sources: [LIB + 'src/core/palette.js', LIB + 'src/core/oklab.js'], ideas: ['src/world/apostlesReacode.js'] },
  match(site) { return usable(site).filter((m) => m.colors?.top || m.colors?.wall).map((m) => ({ id: m.id, count: 1, reason: `${m.id}：顶面 ${m.colors.top || '—'} · 崖壁 ${m.colors.wall || '—'}` })); },
  run(site) {
    const rows = (site.masses || []).filter((m) => m.colors).map(paletteShift), mean = meanShift(rows), p = plan(site);
    if (!p.flags.includes('palette')) p.flags.push('palette'); p.metrics.palette = { library: { grass: TERRAIN.grass, rock: TERRAIN.rock }, masses: rows, mean };
    return { applied: ['look:palette'], changed: [`顶面 / 崖壁平均色离库地形色（草 ${TERRAIN.grass} · 岩 ${TERRAIN.rock}）平均 ΔE ${mean ?? '—'}`] };
  },
};

export const APOSTLES_TERRAIN_CAPABILITIES = [apostlesSoft, apostlesPalette];
const byId = new Map(APOSTLES_TERRAIN_CAPABILITIES.map((c) => [c.meta.id, c]));
export const FLAG_OF = { 'apostles.soft': 'soft', 'apostles.palette': 'palette' };
export function describeApostlesTerrainCapabilities() { return APOSTLES_TERRAIN_CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true })); }
export function matchAll(site) {
  return APOSTLES_TERRAIN_CAPABILITIES.map((cap) => { let rows = []; try { rows = cap.match(site); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; } return { id: cap.meta.id, count: rows.length, targets: rows }; });
}
/** 执行：固定顺序（软坡 → 配色），在私有副本上算出外观开关组合；不碰任何岩体数据。 */
export function runPlan(site, steps, onStep = () => {}) {
  const report = []; site.plan = { flags: [], look: 'approved', lookId: 'approved', persist: false, metrics: {} };
  const order = APOSTLES_TERRAIN_CAPABILITIES.map((c) => c.meta.id), sorted = [...steps].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const step of sorted) {
    const cap = byId.get(step.id); if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    onStep(step.id); const t0 = Date.now(), out = cap.run(site, { params: {} });
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params: {} });
  }
  site.plan.look = lookParam(site.plan.flags); site.plan.lookId = lookId(site.plan.flags);
  // 报告按调用方给的步骤顺序（PipeLineEngine 要求报告与声明的管线一一对应）
  const pos = new Map(steps.map((s, i) => [s.id, i])); report.sort((a, b) => (pos.get(a.id) ?? 99) - (pos.get(b.id) ?? 99));
  return report;
}
