/**
 * 表现层 · 解锁前沿四条线（R37–R39，Guide §9 E 组）：火 / 建筑纹理走廊 / 沉积 / 抛射物。Worker 安全：只 import 纯数据库模块。
 * 输入同表现层其他能力：site = battle.probe 的舞台采样 { grid:[[x,z,lv,house],…], scale, levelHeight?, … }。
 *
 * 为什么放在表现层（fx）而不是另开一层：四个能力都作用在同一张舞台格网上、产出的都是「叠在实景上的东西」（火粒子、走廊样板、
 * 崖面层带、弹道线），扫描与预览通道跟 fx 一样（battle.probe → fx.live.preview）；战役层（battle）由 R33–R36 在改，不碰。
 * 所以 computeLineage / collectExecutables 不用改：fx 层本来就在清单里，能力靠 meta.line 归到 fire / hallway / sediment / projectiles。
 *
 *   fx.fire         line fire         run：life/fire-coupling.js（点火曲线 / 爆燃团分层）+ core/smoke-order.js fireLightLevel
 *                                     实景：world/rea/fxLive.js 调 life/effects.js 的 Effects 火粒子（Max 混合）真的烧
 *   fx.hallway      line hallway      run：core/doodle-hallway-layout.js planHallway / mirroredMotifs（展开面版式）
 *                                     实景：fxLive.js 调 build/doodle-hallway.js makeHallway（贴图 + 几何），在一座小屋旁放一段走廊样板
 *   fx.sediment     line sediment     run：core/sediment-bands-c09.js bandRuns / bandType + core/sediment.js sedimentOffset（弯层）
 *                                     实景：fxLive.js 在崖面贴层带面片（颜色 = BAND_COLORS）
 *   fx.projectiles  line projectiles  run：core/ballistic-table.js createBallisticTable / createExpressionBallisticTable / projectileState
 *                                     实景：fxLive.js 画弹道线 + 沿线飞的箭点
 * meta 按 Guide §5.3：id / name / domain / line / requires / modules（真实调用的库模块，相对 REACodeRefactoring/）/ sources（同一批带库前缀）。
 */
import { burstPlan, fireLight, igniteCurve, FIRE_COUPLING } from '../../../../townscaper-web/REACodeRefactoring/src/life/fire-coupling.js';
import { fireLightLevel } from '../../../../townscaper-web/REACodeRefactoring/src/core/smoke-order.js';
import { planHallway, mirroredMotifs } from '../../../../townscaper-web/REACodeRefactoring/src/core/doodle-hallway-layout.js';
import { bandRuns, BAND_SLOTS, BAND_COLORS } from '../../../../townscaper-web/REACodeRefactoring/src/core/sediment-bands-c09.js';
import { sedimentOffset } from '../../../../townscaper-web/REACodeRefactoring/src/core/sediment.js';
import { createBallisticTable, createExpressionBallisticTable, projectileState } from '../../../../townscaper-web/REACodeRefactoring/src/core/ballistic-table.js';
import { gridOf, levelHeight, cellSpacing, makeNeighbourIndex, rankedHosts, edgeCells, round } from './stage-geom.js?v=fxe-r1';

export const FX_FRONTIER_VERSION = 1;
const LIB = 'townscaper-web/REACodeRefactoring/';
const lib = (mods) => mods.map((m) => LIB + m);
const ADDED = '2026-11-23';

// ── R37 火 ───────────────────────────────────────────────────────────────────────
/** 火焰粒子尺寸律（与 life/effects.js update 同式：0.13 × (1−age)^shrink × 抖动），用来给 fireLightLevel 喂一组样本。 */
export function flameSizes(shrink, n = 64) {
  const sizes = new Float32Array(n), ages = new Float32Array(n);
  for (let i = 0; i < n; i++) { const age = (i + 0.5) / n; ages[i] = age; sizes[i] = 0.13 * Math.pow(1 - age, shrink) * (0.8 + 0.4 * ((i * 0.618) % 1)); }
  return { sizes, ages };
}
const FIRE_MODULES = ['src/life/fire-coupling.js', 'src/core/smoke-order.js', 'src/life/effects.js'];
export const fxFire = {
  meta: { id: 'fx.fire', name: '小屋点火', domain: 'fx', line: 'fire', requires: [], modules: FIRE_MODULES, sources: lib(FIRE_MODULES), ideas: [], sourceVideos: ['1056990611738451968', '1258421104756097029', '837027901853810688'], added: ADDED,
    does: '在舞台的小屋（没有小屋就用最高台地）上点火：按 fire-coupling 实测曲线排点火时刻、火光衰减（0.18s 剩 58%、0.39s 剩 23%）、烟体积放大与爆燃团分层；实景预览用 life/effects.js 的火粒子（Max 混合）真的烧起来。',
    keywords: ['火', '火焰', '点火', '燃烧', '烟', 'fire'],
    reads: ['battleStage'], writes: ['fire'], preserves: ['userSaves'],
    params: { count: { label: '点火处数', min: 1, max: 8, step: 1, default: 3 }, stagger: { label: '相邻两处点火间隔（秒）', min: 0, max: 3, step: 0.1, default: 0.6 }, seconds: { label: '曲线采样时长（秒）', min: 1, max: 6, step: 0.5, default: 3 }, shrink: { label: '火苗上收（effects fireShrink）', min: 1, max: 6, step: 0.5, default: 2 }, maxBlend: { label: 'Max 混合（1=Max 0=Add）', min: 0, max: 1, step: 1, default: 1 } } },
  match(site) { const g = gridOf(site), h = rankedHosts(g, 8); return h.cells.length ? [{ id: 'site', cells: [], score: h.cells.length, reason: `${h.basis === 'house' ? '小屋' : '台地'} ${h.cells.length} 处可点火` }] : []; },
  run(site, { params }) {
    const g = gridOf(site), L = levelHeight(site), hosts = rankedHosts(g, params.count);
    const sources = hosts.cells.map((i, k) => ({ cell: i, x: round(g[i][0]), z: round(g[i][1]), lv: g[i][2], y: round(g[i][2] * L), house: !!g[i][3], t0: round(k * params.stagger, 2) }));
    const dt = 0.03, curve = [];
    for (let t = 0; t <= params.seconds + 1e-9; t += dt) { const c = igniteCurve(+t.toFixed(4)); curve.push([round(c.t, 3), round(c.light, 4), round(c.sizeMul, 4)]); }
    const peak = fireLight(0), half = curve.find((c) => c[1] <= peak * 0.5), burst = burstPlan();
    const { sizes, ages } = flameSizes(params.shrink);
    site.plan.fire = { sources, basis: hosts.basis, levelHeight: L, blend: params.maxBlend >= 0.5 ? 'max' : 'add', shrink: params.shrink, seconds: params.seconds,
      curve, peak, at018: round(fireLight(0.18), 4), at039: round(fireLight(0.39), 4), halfLife: half ? half[0] : null, smokeArea018: round(igniteCurve(0.18).area, 3),
      burst: { total: burst.total, layers: burst.layers.length, yMin: burst.yMin, yMax: burst.yMax }, flameLight: round(fireLightLevel(sizes, ages, 0), 4), tailTau: FIRE_COUPLING.lightTailTau };
    return { applied: ['site'], changed: [`点火 ${sources.length} 处（${hosts.basis === 'house' ? '小屋' : '含台地'}）· 火光 0.18s 剩 ${Math.round(site.plan.fire.at018 * 100)}% · 0.39s 剩 ${Math.round(site.plan.fire.at039 * 100)}% · 烟面积 ×${site.plan.fire.smokeArea018} · 爆燃 ${burst.total} 张`] };
  },
};

// ── R38 建筑纹理走廊 ─────────────────────────────────────────────────────────────
const HALL_MODULES = ['src/core/doodle-hallway-layout.js', 'src/build/doodle-hallway.js', 'src/build/doodle-wall.js'];
export const fxHallway = {
  meta: { id: 'fx.hallway', name: '涂鸦走廊样板', domain: 'fx', line: 'hallway', requires: [], modules: HALL_MODULES, sources: lib(HALL_MODULES), ideas: ['townscaper-web/REACode/src/doodlewall.js'], sourceVideos: ['1897266928961700215', '1890018647655272491'], added: ADDED,
    does: '按 doodle-hallway-layout 的展开面版式规划一段室内走廊（两面墙 + 转角 + cove 弯进天花 + 拱门 + 楼梯 + 护墙板），纹样左右镜像；实景预览在一座小屋旁放一段缩小的走廊样板（build/doodle-hallway.js 真贴图）。',
    keywords: ['走廊', '建筑纹理', '涂鸦', '墙饰', '镜像', 'hallway'],
    reads: ['battleStage'], writes: ['hallway'], preserves: ['userSaves'],
    params: { seed: { label: '版式种子', min: 1, max: 99, step: 1, default: 7 }, density: { label: '纹样密度', min: 0.5, max: 2, step: 0.05, default: 1 }, mirror: { label: '左右镜像（1=开）', min: 0, max: 1, step: 1, default: 1 }, fit: { label: '样板宽（格）', min: 1, max: 4, step: 0.5, default: 2 } } },
  match(site) { const g = gridOf(site), h = rankedHosts(g, 1); return h.cells.length ? [{ id: 'site', cells: [], score: 1, reason: h.basis === 'house' ? '有小屋可放走廊样板' : '没有小屋，放在最高台地' }] : []; },
  run(site, { params }) {
    const g = gridOf(site), L = levelHeight(site), host = rankedHosts(g, 1), i = host.cells[0];
    const opt = { seed: Math.round(params.seed), density: params.density, mirror: params.mirror >= 0.5 };
    const p = planHallway(opt);
    let motifs = 0; const panels = p.panels.map((q) => { const m = mirroredMotifs(p, q).length; motifs += m; return { s0: round(q.s0), s1: round(q.s1), w: round(q.w), tint: q.tint ?? 0, bay: !!q.bay, motifs: m }; });
    const strips = p.strips.reduce((s, x) => s + (x.s1 - x.s0), 0);
    site.plan.hallway = { host: { cell: i, x: round(g[i][0]), z: round(g[i][1]), lv: g[i][2], y: round(g[i][2] * L), basis: host.basis }, options: opt, fit: params.fit,
      S: round(p.S), V: round(p.V), H: p.H, wallA: p.wallA, wallB: p.wallB, door: p.door ? { s0: round(p.door.s0), s1: round(p.door.s1), top: round(p.door.top), v0: round(p.door.v0) } : null,
      panels, strips: p.strips.length, stripWidth: round(strips), motifs, coverage: round((panels.reduce((s, q) => s + q.w, 0) + strips) / p.S, 4) };
    return { applied: ['site'], changed: [`走廊展开面 ${round(p.S, 2)}×${round(p.V, 2)} · ${panels.length} 块板 · ${p.strips.length} 条竖带 · 纹样 ${motifs} 个${opt.mirror ? '（镜像）' : ''}`] };
  },
};

// ── R39 沉积 ─────────────────────────────────────────────────────────────────────
const SED_MODULES = ['src/core/sediment-bands-c09.js', 'src/core/sediment.js'];
/** 崖面：一格比邻格高 minDrop 层以上，两格交界就是一块崖面（法向从高格指向低格）。 */
export function cliffFaces(site, minDrop, cap = 2000) {
  const g = gridOf(site), L = levelHeight(site), idx = makeNeighbourIndex(g), faces = [];
  for (let i = 0; i < g.length; i++) for (const j of idx.neighbours(i)) {
    const drop = g[i][2] - g[j][2]; if (drop < minDrop) continue;
    const dx = g[j][0] - g[i][0], dz = g[j][1] - g[i][1], d = Math.hypot(dx, dz) || 1;
    if (d > idx.spacing * 1.25) continue;   // 只取正交邻格（对角格不算一面墙）
    faces.push({ i, j, drop, x: (g[i][0] + g[j][0]) / 2, z: (g[i][1] + g[j][1]) / 2, dx: dx / d, dz: dz / d, y0: Math.max(0, g[j][2]) * L, y1: g[i][2] * L });
  }
  faces.sort((a, b) => b.drop - a.drop || a.x - b.x || a.z - b.z);
  return { faces: faces.slice(0, cap), total: faces.length, spacing: idx.spacing, L };
}
/** 一面崖的层带：[岩性, y0, y1, 交界细深线]，弯层时先按 sedimentOffset 剪切再查层柱（几何不动，只换查表高度）。 */
export function faceBands(face, { period, bend, amplitude }) {
  const shear = bend ? sedimentOffset(face.x, face.z, amplitude) : 0, slot = period / BAND_SLOTS, out = [];
  for (const r of bandRuns(face.y0 + shear, face.y1 + shear, { period })) {
    const a = Math.max(face.y0, r.start * slot - shear), b = Math.min(face.y1, (r.start + r.slots) * slot - shear);
    if (b - a > 1e-6) out.push([r.type, round(a, 4), round(b, 4), r.line ? 1 : 0, r.slots]);
  }
  return out;
}
export const fxSediment = {
  meta: { id: 'fx.sediment', name: '崖面沉积层带', domain: 'fx', line: 'sediment', requires: [], modules: SED_MODULES, sources: lib(SED_MODULES), ideas: ['townscaper-web/REACode/engine/surface.js'], sourceVideos: ['1699038611125985317', '1699146321318314094'], added: ADDED,
    does: '找出舞台上的高崖面（相邻格落差 ≥ N 层），按 sediment-bands-c09 的层柱把世界高度切成宽窄相间的岩性带、交界画细深线；可选弯层（sediment.js 剪切场）。实景预览把层带面片贴到崖面上。',
    keywords: ['沉积', '层带', '岩层', '崖面', 'strata', 'sediment'],
    reads: ['battleStage'], writes: ['sediment'], preserves: ['userSaves'],
    params: { period: { label: '层柱周期（舞台单位）', min: 0.2, max: 2, step: 0.05, default: 0.5 }, minDrop: { label: '算崖的最小落差（层）', min: 1, max: 6, step: 1, default: 2 }, bend: { label: '弯层（1=开）', min: 0, max: 1, step: 1, default: 1 }, amplitude: { label: '弯层剪切幅度', min: 0, max: 0.4, step: 0.02, default: 0.12 }, maxFaces: { label: '最多崖面数', min: 20, max: 2000, step: 20, default: 600 } } },
  match(site) { const f = cliffFaces(site, 2, 1); return f.total ? [{ id: 'site', cells: [], score: f.total, reason: `${f.total} 面高崖（落差 ≥ 2 层）可贴层带` }] : []; },
  run(site, { params }) {
    const { faces, total, spacing, L } = cliffFaces(site, Math.round(params.minDrop), Math.round(params.maxFaces));
    if (!faces.length) return { applied: [], changed: ['没有落差够大的崖面'] };
    const opt = { period: params.period, bend: params.bend >= 0.5, amplitude: params.amplitude };
    const rows = faces.map((f) => ({ i: f.i, j: f.j, x: round(f.x), z: round(f.z), dx: round(f.dx, 4), dz: round(f.dz, 4), y0: round(f.y0, 4), y1: round(f.y1, 4), bands: faceBands(f, opt) }));
    const widths = rows.flatMap((r) => r.bands.map((b) => b[4])), mean = widths.reduce((s, v) => s + v, 0) / (widths.length || 1);
    const cv = widths.length ? Math.sqrt(widths.reduce((s, v) => s + (v - mean) ** 2, 0) / widths.length) / (mean || 1) : 0;
    const lines = rows.reduce((s, r) => s + r.bands.filter((b) => b[3]).length, 0), bands = widths.length;
    site.plan.sediment = { ...opt, slots: BAND_SLOTS, colors: BAND_COLORS, levelHeight: L, spacing, half: round(spacing / 2, 4), minDrop: Math.round(params.minDrop), faces: rows, total, stats: { faces: rows.length, bands, lines, widthCv: round(cv, 3), maxHeight: round(Math.max(...rows.map((r) => r.y1 - r.y0)), 3) } };
    return { applied: ['site'], changed: [`崖面 ${rows.length}${total > rows.length ? '/' + total : ''} 面 · 层带 ${bands} 条（宽窄变异 ${round(cv, 2)}）· 细深线 ${lines} 条${opt.bend ? ' · 弯层' : ''}`] };
  },
};

// ── R39 抛射物 ───────────────────────────────────────────────────────────────────
const PRJ_MODULES = ['src/core/ballistic-table.js'];
export const fxProjectiles = {
  meta: { id: 'fx.projectiles', name: '守军箭雨弹道', domain: 'fx', line: 'projectiles', requires: [], modules: PRJ_MODULES, sources: lib(PRJ_MODULES), ideas: ['townscaper-web/REACode/src/ballistic.js'], sourceVideos: ['987267068495003648'], added: ADDED,
    does: '从小屋 / 高台向岸边登陆点放箭：按 ballistic-table 查表选仰角（无阻力解析表；阻力 > 0 时用烘好的带阻力轨迹表），projectileState 逐帧取点成弹道；实景预览画弹道线和沿线飞的箭。',
    keywords: ['弹道', '箭', '抛射', '投射物', '射击', 'projectile'],
    reads: ['battleStage'], writes: ['projectiles'], preserves: ['userSaves'],
    params: { shots: { label: '箭数', min: 2, max: 24, step: 1, default: 8 }, weight: { label: '落角代价权重', min: 0, max: 2, step: 0.1, default: 0.6 }, drag: { label: '空气阻力（0=解析表）', min: 0, max: 1.5, step: 0.1, default: 0 }, samples: { label: '每条弹道采样点', min: 8, max: 40, step: 1, default: 20 } } },
  match(site) { const g = gridOf(site), h = rankedHosts(g, 1), e = edgeCells(g, makeNeighbourIndex(g)); return h.cells.length && e.length ? [{ id: 'site', cells: [], score: e.length, reason: `${e.length} 个岸边格可作落点` }] : []; },
  run(site, { params }) {
    const g = gridOf(site), L = levelHeight(site), idx = makeNeighbourIndex(g), u = idx.spacing || 1;
    const shore = edgeCells(g, idx), shoreSet = new Set(shore), N = Math.round(params.shots), shots = [];
    const table = params.drag > 0 ? createExpressionBallisticTable({ drag: params.drag }) : createBallisticTable({ impactWeight: params.weight });
    const P = (i) => [g[i][0] / u, (Math.max(0, g[i][2]) * L) / u, g[i][1] / u];
    // 射手：先用小屋 / 最高台地；查表只覆盖 |落差| ≤ 3 格，太高的台地射不到岸边时，退到「离岸边落差 ≤ 2.8 格」的内陆格
    const reach = (h, t) => { const d = Math.hypot(g[t][0] - g[h][0], g[t][1] - g[h][1]) / u, dy = Math.abs(P(t)[1] - P(h)[1]); return d >= 0.8 && d <= 5.5 && dy <= 2.8; };
    let hosts = rankedHosts(g, 6).cells.filter((h) => shore.some((t) => reach(h, t))), basis = 'house/top';
    if (!hosts.length) { hosts = g.map((c, i) => [i, c]).filter(([i, c]) => c[2] > 0 && !shoreSet.has(i) && shore.some((t) => reach(i, t))).sort((a, b) => b[1][2] - a[1][2] || a[1][0] - b[1][0] || a[1][1] - b[1][1]).slice(0, 6).map(([i]) => i); basis = 'inland'; }
    for (let k = 0; hosts.length && shots.length < N && k < N * 6; k++) {
      const h = hosts[k % hosts.length], from = P(h);
      const inRange = shore.filter((t) => reach(h, t));
      if (!inRange.length) continue;
      const t = inRange[Math.floor(((k * 0.618034) % 1) * inRange.length)], to = P(t);
      const dx = Math.hypot(to[0] - from[0], to[2] - from[2]), dy = to[1] - from[1], shot = table.lookup(dx, dy);
      if (!shot || shots.some((s) => s.from === h && s.to === t)) continue;
      const path = [];
      for (let q = 0; q <= params.samples; q++) { const s = projectileState(from, to, shot, shot.time * q / params.samples); path.push([round(s.x * u), round(s.y * u), round(s.z * u)]); }
      const end = path.at(-1), miss = Math.hypot(end[0] - to[0] * u, end[1] - to[1] * u, end[2] - to[2] * u) / u;
      shots.push({ from: h, to: t, a: path[0], b: [round(to[0] * u), round(to[1] * u), round(to[2] * u)], time: round(shot.time, 4), v: round(shot.v, 4), th: round(shot.th, 5), angleDeg: round(shot.th * 180 / Math.PI, 2), apex: round(Math.max(...path.map((p) => p[1])), 3), miss: round(miss, 4), path });
    }
    if (!shots.length) return { applied: [], changed: ['射程内没有岸边落点'] };
    site.plan.projectiles = { unit: round(u, 4), levelHeight: L, drag: params.drag, weight: params.weight, table: params.drag > 0 ? 'baked-drag' : 'analytic', shots,
      stats: { shots: shots.length, maxMiss: Math.max(...shots.map((s) => s.miss)), meanTime: round(shots.reduce((s, x) => s + x.time, 0) / shots.length, 3), maxApex: Math.max(...shots.map((s) => s.apex)) } };
    return { applied: ['site'], changed: [`箭 ${shots.length} 支 · ${params.drag > 0 ? '带阻力烘表' : '解析表'} · 平均飞行 ${site.plan.projectiles.stats.meanTime}s · 最大落点偏差 ${round(site.plan.projectiles.stats.maxMiss, 3)} 格`] };
  },
};

export const FX_FRONTIER_CAPABILITIES = [fxFire, fxHallway, fxSediment, fxProjectiles];
export { cellSpacing };
