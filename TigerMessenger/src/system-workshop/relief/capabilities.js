/**
 * 地貌管线 · 能力库（R46，Worker 安全：纯数据）。一条管线做出「软坡 + 硬崖 + 河谷 + 悬垂 + 薄台攀爬 + 三遍等高线」的完整山体。
 *
 * 输入 site = 方格高度采样（擂台岛 terrain/arena-generic.js arenaSite()，或游戏里 relief.probe 采的实景，src/world/rea/reliefCandidate.js）：
 *   { ok, scene, label, n, cell（格宽米）, h:[n²]（离海面米，海 / 场外 = NaN 或 null）, cls:[n²]（0 可改地形 1 建筑 2 轨道 / 保护）, seed, source }
 * 每个能力 meta 带 §5.3 的 id / name / domain / line / requires / modules；modules = run() 里真正 import 并调用的 REACodeRefactoring 模块：
 *   relief.soft     软坡     overhang-terrain.js sharpMaskFor + softenField   缓坡省几轮邻域平均，陡崖省不动，交界按掩码渐变（1447488323845509121）
 *   relief.cliff    硬崖     overhang-terrain.js mixSoftSharp                 陡崖省按 step 米取整成台阶（原版 heightField 的 mix 公式）
 *   relief.valley   河谷     river-valley.js carveValleys（core/river-network.js planRiverNetwork + core/depression-fill.js） 开河 + V 形两岸 + 填洼成湖
 *   relief.overhang 悬垂     overhang-terrain.js cliffLips / lipStats          陡崖边伸出岩檐，檐下是空的（1671808851895627776）
 *   relief.ledge    薄台攀爬 terrace-ladder.js fieldLadders / thinLedges / climbShare  崖边放梯子（梯长 √(H²+run²)），薄岩檐记为薄台（781957658597269506，补学 #7）
 *   relief.passes   三遍     island-passes.js contourSegs / traceRings / rowsOf 等高线 = 层界格边（1669315384619540487）
 * 保护：cls ≠ 0 的格及其外扩 1 圈（protectRing）不改；海陆不变（陆地最低 0.3 m）；plan.persist 恒为 false（不写存档、不改默认）。
 * 验证在 verify.js（独立复算）；擂台在 arena.js；预览在游戏侧 reliefCandidate.js（候选，不设默认）。
 */
import { sharpMaskFor, softenField, mixSoftSharp, cliffLips, lipStats, protectRing } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js';
import { carveValleys } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/river-valley.js';
import { fieldLadders, thinLedges, climbShare } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/terrace-ladder.js';
import { contourSegs, traceRings, rowsOf } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/island-passes.js';

export const RELIEF_VERSION = 1;
export const RELIEF_LAYER = 1.5;   // 一层多少米（河床 / 岸坡 / 等高线默认层高）
const LIB = 'townscaper-web/REACodeRefactoring/';
const ORIG = 'townscaper-web/REACode/';
export const RELIEF_ORDER = Object.freeze(['relief.soft', 'relief.cliff', 'relief.valley', 'relief.overhang', 'relief.ledge', 'relief.passes']);

const land = (v) => Number.isFinite(v) && v > 0;
const num = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const usable = (site) => !!site && site.ok !== false && Number.isInteger(site.n) && site.n >= 8 && Array.isArray(site.h) && site.h.length === site.n * site.n;
const freeLand = (site) => { let c = 0; for (let k = 0; k < site.h.length; k++) if (land(site.h[k]) && !(site.cls?.[k])) c++; return c; };
export function lockOf(site) {
  const n = site.n, p = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) if (site.cls?.[k]) p[k] = 1;
  return protectRing(n, p, 1);
}
export function freshPlan(site) {
  return { version: RELIEF_VERSION, scene: site.scene || null, n: site.n, cell: site.cell || 3, layer: RELIEF_LAYER, step: null, seed: Number.isFinite(site.seed) ? site.seed : 7,
    base: site.h.map((v) => (land(v) ? +v : null)), h: site.h.map((v) => (land(v) ? +v : null)), sharp: null, lips: [], valley: null, ladders: [], ledges: [], contours: null,
    applied: [], persist: false, metrics: {} };
}
const plan = (site) => (site.plan ||= freshPlan(site));
const H = (p) => p.h.map((v) => (v == null ? NaN : v));
const back = (arr) => Array.from(arr, (v) => (land(v) ? +v : null));   // 不取整：河谷 / 湖面的排水判定靠精确的大小关系
const sharpOf = (site, p) => (p.sharp ||= Array.from(sharpMaskFor(p.n, p.seed, { h: H(p) }), (v) => +v.toFixed(5)));
function changed(before, after) { let c = 0, s = 0, mx = 0; for (let k = 0; k < after.length; k++) { if (before[k] == null || after[k] == null) continue; const d = Math.abs(after[k] - before[k]); if (d > 1e-6) { c++; s += d; mx = Math.max(mx, d); } } return { cells: c, mean: c ? +(s / c).toFixed(3) : 0, max: +mx.toFixed(3) }; }
const matchLand = (site, why) => { if (!usable(site)) return []; const c = freeLand(site); return c ? [{ id: site.scene || 'site', count: c, reason: `${site.label || site.scene || '采样'}：可改陆地 ${c} 格 · ${why}` }] : []; };

const meta = (o) => ({ domain: 'relief', line: 'terrain', keywords: [], params: {}, ...o });

export const reliefSoft = {
  meta: meta({ id: 'relief.soft', name: '软坡（缓坡省连续）', requires: [],
    does: '按低频「陡崖省」掩码把地形分成缓坡省 / 陡崖省；缓坡省做几轮邻域平均成连续软坡，陡崖省原样，交界按掩码渐变，没有直线缝。',
    keywords: ['软坡', '缓坡', '平滑', '柔和', 'soft', 'slope'], params: { passes: { min: 0, max: 6, step: 1, default: 3, label: '平滑轮数' } },
    modules: ['src/terrain/overhang-terrain.js'], sources: [LIB + 'src/terrain/overhang-terrain.js'], ideas: [ORIG + 'src/overhangterrain.js'], learn: ['1447488323845509121'],
    reads: ['heightfield', 'buildingMask', 'railMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'originalTerrain'] }),
  match: (site) => matchLand(site, '缓坡省平滑'),
  run(site, { params = {} } = {}) {
    const p = plan(site), passes = Math.round(num(params.passes, 3, 0, 6)), before = p.h.slice();
    p.h = back(softenField(H(p), p.n, sharpOf(site, p), { passes, protect: lockOf(site) }));
    const ch = changed(before, p.h); p.metrics.soft = { passes, ...ch };
    return { applied: ['soft'], changed: [`缓坡省平滑 ${passes} 轮：改了 ${ch.cells} 格，平均 ${ch.mean} m、最多 ${ch.max} m`] };
  },
};
export const reliefCliff = {
  meta: meta({ id: 'relief.cliff', name: '硬崖（陡崖省台阶）', requires: [],
    does: '陡崖省按层高取整成台阶，台面平、台阶之间是近乎竖直的崖；缓坡省保留连续值（原版 overhangterrain heightField 的混合公式）。',
    keywords: ['硬崖', '陡崖', '台地', '台阶', 'cliff', 'terrace'], params: { step: { min: 3, max: 12, step: 0.5, default: 6, label: '台阶高（米）' } },
    modules: ['src/terrain/overhang-terrain.js'], sources: [LIB + 'src/terrain/overhang-terrain.js'], ideas: [ORIG + 'src/overhangterrain.js', ORIG + 'src/terracecliff.js'], learn: ['1447488323845509121'],
    reads: ['heightfield', 'buildingMask', 'railMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'originalTerrain'] }),
  match: (site) => matchLand(site, '陡崖省取整'),
  run(site, { params = {} } = {}) {
    const p = plan(site), step = num(params.step, 6, 3, 12), before = p.h.slice();
    p.h = back(mixSoftSharp(H(p), sharpOf(site, p), step, { protect: lockOf(site) })); p.step = step;
    const ch = changed(before, p.h); p.metrics.cliff = { step, ...ch };
    return { applied: ['cliff'], changed: [`陡崖省按 ${step} m 取整：改了 ${ch.cells} 格（平均 ${ch.mean} m）`] };
  },
};
export const reliefValley = {
  meta: meta({ id: 'relief.valley', name: '河谷（开河 + 填洼）', requires: [],
    does: '汇流累积到阈值的格成河（无环出口树），河床比溢出面低一层，两岸按离河距离削成 V 形河谷，排不出去的洼地按溢出面填成湖；处处能排到海。',
    keywords: ['河', '河谷', '河流', '排水', '湖', '填洼', 'river', 'valley', 'drainage'], params: { threshold: { min: 6, max: 120, step: 1, default: 24, label: '成河汇流格数' }, depth: { min: 0, max: 3, step: 1, default: 1, label: '河床下切（层）' }, bank: { min: 0.5, max: 3, step: 0.5, default: 1, label: '岸坡（层 / 格）' } },
    modules: ['src/terrain/river-valley.js', 'src/core/river-network.js', 'src/core/depression-fill.js'],
    sources: [LIB + 'src/terrain/river-valley.js', LIB + 'src/core/river-network.js', LIB + 'src/core/depression-fill.js'], ideas: [ORIG + 'engine/rivers.js', ORIG + 'src/depfill.js'], learn: ['1769691526924292506', '1447488323845509121'],
    reads: ['heightfield', 'buildingMask', 'railMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'originalTerrain'] }),
  match: (site) => matchLand(site, '汇流成河'),
  run(site, { params = {} } = {}) {
    const p = plan(site), threshold = Math.round(num(params.threshold, 24, 6, 120)), depth = Math.round(num(params.depth, 1, 0, 3)), bank = num(params.bank, 1, 0.5, 3);
    const r = carveValleys(H(p), p.n, { layer: p.layer, threshold, depth, bank, rings: 2, protect: lockOf(site) });
    p.h = back(r.h); p.valley = { threshold, depth, bank, river: r.river, lakes: r.lakes, outlets: r.outlets, lowered: r.lowered, raised: r.raised, maxArea: r.maxArea };
    p.metrics.valley = { river: r.river.length, lakes: r.lakes.length, outlets: r.outlets.length, lowered: r.lowered, raised: r.raised };
    return { applied: ['valley'], changed: [`河格 ${r.river.length}（出口 ${r.outlets.length}）· 湖格 ${r.lakes.length} · 削低 ${r.lowered} 格`] };
  },
};
export const reliefOverhang = {
  meta: meta({ id: 'relief.overhang', name: '悬垂（崖顶岩檐）', requires: ['relief.cliff'],
    does: '陡崖省里落差够大的崖边伸出一块岩檐：顶上还有实心、檐下是空的——高度场画不出来的东西，单独给出几何（游戏里画成带暗色底面的檐板）。',
    keywords: ['悬垂', '岩檐', '崖檐', '海蚀洞', 'overhang', 'ledge', 'soffit'], params: { maxLips: { min: 0, max: 160, step: 4, default: 48, label: '岩檐上限' }, minDrop: { min: 3, max: 15, step: 0.5, default: 4, label: '最小落差（米）' } },
    modules: ['src/terrain/overhang-terrain.js'], sources: [LIB + 'src/terrain/overhang-terrain.js'], ideas: [ORIG + 'src/overhangterrain.js'], learn: ['1671808851895627776'],
    reads: ['heightfield', 'buildingMask', 'railMask'], writes: ['terrainMesh'], preserves: ['buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'originalTerrain'] }),
  match: (site) => matchLand(site, '崖边岩檐'),
  run(site, { params = {} } = {}) {
    const p = plan(site), maxLips = Math.round(num(params.maxLips, 48, 0, 160)), minDrop = num(params.minDrop, 4, 3, 15);
    p.lips = cliffLips(H(p), p.n, sharpOf(site, p), { minDrop, thick: 1.5, reach: 0.45, clear: 1.5, maxLips, protect: lockOf(site), seed: p.seed });
    const st = lipStats(p.lips, { cell: p.cell }); p.metrics.overhang = { maxLips, minDrop, ...st };
    return { applied: ['overhang'], changed: [`岩檐 ${st.lips} 块 · 檐下面积 ${st.soffitArea} m² · 平均净空 ${st.meanClear} m · 薄檐 ${st.thinLedges}`] };
  },
};
export const reliefLedge = {
  meta: meta({ id: 'relief.ledge', name: '薄台与攀爬（崖边梯子）', requires: ['relief.cliff'],
    does: '2–9 m 的崖边，下面 6 步以内走不上去时放一把梯子：梯脚踩下层台面、梯顶搭上层台沿，梯长 √(H²+run²)；岩檐里 ≤ 2 m 厚的记为薄台。看崖边攀爬率涨没涨。',
    keywords: ['梯子', '攀爬', '薄台', '平台', 'ladder', 'climb', 'platform'], params: { maxLadders: { min: 0, max: 48, step: 1, default: 16, label: '梯子上限' } },
    modules: ['src/terrain/terrace-ladder.js'], sources: [LIB + 'src/terrain/terrace-ladder.js'], ideas: [ORIG + 'src/terraceladder.js'], learn: ['781957658597269506'],
    reads: ['heightfield', 'buildingMask', 'railMask'], writes: ['ornament'], preserves: ['buildingBuffer', 'railClearance', 'coastline', 'userSaves', 'originalTerrain'] }),
  match: (site) => matchLand(site, '崖边梯子'),
  run(site, { params = {} } = {}) {
    const p = plan(site), maxLadders = Math.round(num(params.maxLadders, 16, 0, 48)), h = H(p), blocked = Uint8Array.from(site.cls || [], (c) => (c ? 1 : 0));
    const before = climbShare(h, p.n, { cell: p.cell, walkSlope: 35, blocked });
    p.ladders = fieldLadders(h, p.n, { cell: p.cell, walkSlope: 35, minDrop: 2, maxDrop: 9, runFrac: 0.35, maxLadders, blocked, sharp: sharpOf(site, p), seed: p.seed });
    p.ledges = thinLedges(p.lips, { maxThick: 2 });
    const after = climbShare(h, p.n, { cell: p.cell, walkSlope: 35, blocked, links: p.ladders.map((l) => [l.a, l.b]) });
    p.metrics.ledge = { ladders: p.ladders.length, ledges: p.ledges.length, cliffPairs: before.pairs, climbBefore: +before.share.toFixed(4), climbAfter: +after.share.toFixed(4) };
    return { applied: ['ledge'], changed: [`梯子 ${p.ladders.length} 把 · 薄台 ${p.ledges.length} 块 · 崖边 6 步内上得去 ${(before.share * 100).toFixed(1)}% → ${(after.share * 100).toFixed(1)}%（${before.pairs} 对崖边）`] };
  },
};
export const reliefPasses = {
  meta: meta({ id: 'relief.passes', name: '三遍（等高线 = 层界格边）', requires: [],
    does: '同一份高度场过三遍：等高线（相邻两格层号不同时它们共享的格边）、线框、成图。等高线贴在层界上是构造保证，不是插值曲线；游戏预览里可以叠一层等高线看层界。',
    keywords: ['等高线', '层界', '线框', '轮廓', 'contour', 'passes'], params: {},
    modules: ['src/terrain/island-passes.js'], sources: [LIB + 'src/terrain/island-passes.js'], ideas: [ORIG + 'src/islandpasses.js'], learn: ['1669315384619540487'],
    reads: ['heightfield'], writes: ['ornament'], preserves: ['userSaves', 'originalTerrain'] }),
  match: (site) => matchLand(site, '等高线'),
  run(site) {
    const p = plan(site), step = p.step || p.layer * 2, cfg = { WATER: 0, STEP: step };
    const segs = contourSegs(rowsOf(H(p), p.n, 0), cfg), rings = traceRings(segs);
    const onGrid = segs.filter((s) => s.a.every(Number.isInteger) && s.b.every(Number.isInteger)).length;
    p.contours = { step, segs: segs.map((s) => [s.a[0], s.a[1], s.b[0], s.b[1], s.k]), rings: rings.length, closed: rings.filter((r) => r.closed).length, onGrid: segs.length ? +(onGrid / segs.length).toFixed(4) : 1 };
    p.metrics.passes = { segs: segs.length, rings: p.contours.rings, closed: p.contours.closed, onGrid: p.contours.onGrid };
    return { applied: ['passes'], changed: [`等高线（层高 ${step} m）${segs.length} 段 · ${p.contours.rings} 个环（闭合 ${p.contours.closed}）· 在格边上 ${(p.contours.onGrid * 100).toFixed(1)}%`] };
  },
};

export const RELIEF_CAPABILITIES = [reliefSoft, reliefCliff, reliefValley, reliefOverhang, reliefLedge, reliefPasses];
const byId = new Map(RELIEF_CAPABILITIES.map((c) => [c.meta.id, c]));
export function describeReliefCapabilities() { return RELIEF_CAPABILITIES.map(({ meta: m }) => ({ ...m, params: m.params || {}, executable: true })); }
export function matchAll(site) {
  return RELIEF_CAPABILITIES.map((cap) => { let rows = []; try { rows = cap.match(site); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; } return { id: cap.meta.id, count: rows.length, targets: rows }; });
}
/** 默认参数（params 的 default） */
export const defaultParams = (id) => Object.fromEntries(Object.entries(byId.get(id)?.meta.params || {}).map(([k, v]) => [k, v.default]));

/** 执行：按 RELIEF_ORDER 固定顺序在 site 的私有计划上算；requires 没满足的步骤跳过并写原因。报告按调用方步骤顺序。 */
export function runPlan(site, steps, onStep = () => {}) {
  const report = [];
  if (!usable(site)) throw Error('地貌管线：采样不可用（' + (site?.reason || '缺 n / h') + '）');
  site.plan = freshPlan(site);
  const sorted = [...steps].sort((a, b) => RELIEF_ORDER.indexOf(a.id) - RELIEF_ORDER.indexOf(b.id)), have = new Set(sorted.map((s) => s.id));
  for (const step of sorted) {
    const cap = byId.get(step.id); if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const miss = cap.meta.requires.filter((r) => !have.has(r));
    if (miss.length) { report.push({ id: step.id, line: cap.meta.line, status: 'no-target', applied: [], changed: ['缺前置能力：' + miss.join('、')], params: step.params || {} }); continue; }
    onStep(step.id); const t0 = Date.now(), params = { ...defaultParams(step.id), ...(step.params || {}) }, out = cap.run(site, { params });
    site.plan.applied.push(step.id);
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params });
  }
  const pos = new Map(steps.map((s, i) => [s.id, i])); report.sort((a, b) => (pos.get(a.id) ?? 99) - (pos.get(b.id) ?? 99));
  return report;
}
