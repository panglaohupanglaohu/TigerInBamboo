/**
 * 光影与生命管线 · 能力库（Worker 安全：纯数据）。R65–R68（Guide §10「R61–R70 光影与生命」）。
 * 新的一层 tier 'lightlife'（Guide §7.2 第 5 条）：作用在任何场景上——先把场景采成「虚拟体素空间」（scene-voxels.js），9 个能力都读同一份 World。
 *   scene.town-graph  体素图 · 区域图（line grid）     core/town-graph.js（R64 嫁接自原版 town.js）：哪片是一栋楼、哪片是走道；烟囱位置
 *   scene.plateau-diag 台地诊断（line grid，补学 #6）   core/terrace-profile.js plateauRuns / stepDropArea：同一份 World 上的「同高片」（top 相同、边相邻聚成片：片数 / 格数 / 面积 / 周长）与「逻辑阶差」（相邻柱高差 ≥ minStep 层的边：边数 / 长度 / 立面面积）。只读诊断，不改场景；185帧原片算法未公开，这是可观察行为不是原算法恢复。
 *   light.voxel-ao    体素遮蔽（line shadows）          light/voxel-light.js（R63 嫁接自原版 lighting.js）：一张分层占用场 → 模糊 → 每格每层的遮蔽
 *   light.bounce      彩色反弹 · 多跳（line light）     light/voxel-light.js diffuseBounce：空气里扩散邻居的颜色，墙缝里泛邻居的色
 *   light.megatex     大纹理（line atlas）              light/mega-atlas.js（R64 嫁接自原版 megatex.js）+ light/texel-owner.js：所有顶面 / 墙面烘进一张大图，owner 表反查
 *   life.plant-atlas  植物图集全场景共用（line plants）  plant-atlas.js → life/sprite-pack-c09.js + core/level-flora.js
 *   life.wind         风（line wind）                   life.js → core/wind-flow.js traceWind
 *   life.smoke        烟（line smoke）                  life.js → core/smoke-order.js（烟源来自区域图）
 *   life.animals      动物（line animals）              life.js → world/navmesh-flow.js + core/swarm-maze.js
 * 契约（R51 contracts.js 格式）：每个 meta 带 reads / writes / preserves；preserves 由 verify.js 经 contract-verify.js 自动生成检查。
 * 候选 = site.plan（纯数据：遮蔽 / 反弹网格、大纹理指标与缩略图、图集映射、风线、烟团、动物关键帧）。plan.persist 恒为 false：
 * 实景预览（src/world/rea/lightlifeCandidate.js）只换顶点色、加一个可撤的生命图层，不写存档、不改湖上建筑、不设默认。
 */
import { buildVoxelField, bakeVertexAO, diffuseBounce } from '../../../../townscaper-web/REACodeRefactoring/src/light/voxel-light.js';
import { facesFrom, measureLayout, mipBleedShare } from '../../../../townscaper-web/REACodeRefactoring/src/light/mega-atlas.js';
import { Town, regionSummary } from '../../../../townscaper-web/REACodeRefactoring/src/core/town-graph.js';
import { plateauRuns, stepDropArea } from '../../../../townscaper-web/REACodeRefactoring/src/core/terrace-profile.js';
import { worldFromSite, columnMesh, surfaceClasses, hueOf, luma } from './scene-voxels.js?v=light-r65';
import { plantAtlasForScene } from './plant-atlas.js?v=light-r67';
import { windRun, windField, smokeRun, animalsRun } from './life.js?v=light-r69';

export const LIGHTLIFE_VERSION = 1;
const LIB = 'townscaper-web/REACodeRefactoring/';
const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100, pct = (v) => (v * 100).toFixed(1) + '%';
const landCount = (site) => (site?.h || []).filter((v) => v > 0.05).length;

/** 一次执行共用的上下文：体素空间、柱子网格、占用场（大对象，不进 plan） */
function vox(ctx, site) { if (!ctx.V) { ctx.V = worldFromSite(site); ctx.mesh = columnMesh(ctx.V); ctx.cls = surfaceClasses(ctx.V); } return ctx.V; }
const fieldOpts = (V, radius) => ({ grid: V.grid, levelHeight: V.L, sets: [{ world: V.world, colorOf: V.colorOf }], res: V.step / 3, pad: V.step * 0.5, blurRadius: radius, blurPasses: 2 });
function ensureField(ctx, site, radius = 3) { const V = vox(ctx, site); if (!ctx.field) { ctx.field = buildVoxelField(fieldOpts(V, radius)); ctx.radius = radius; } return ctx.field; }
/** 体素场采到「格心 × 层心」网格（实景着色用）：occ[(lv·n + j)·n + i]，tint 同序 × 3 */
export function sampleGrid(field, V, { tint = false } = {}) {
  const { n, grid, L } = V, Lv = Math.max(2, field.L || 2), occ = new Array(n * n * Lv).fill(0), col = tint ? new Array(n * n * Lv * 3).fill(1) : null;
  for (let lv = 0; lv < Lv; lv++) for (const c of grid.cells) {
    const y = (lv - 0.5) * L, k = (lv * n + c.j) * n + c.i;
    occ[k] = r3(field.sampleOcc(c.cx, y, c.cz));
    if (col) { const b = field.sampleBounce(c.cx, y, c.cz); col[k * 3] = r2(b[0]); col[k * 3 + 1] = r2(b[1]); col[k * 3 + 2] = r2(b[2]); }
  }
  return { Lv, occ, tint: col };
}
/** 烘一遍顶点色 → 量：平均压暗、开阔顶面压暗、凹角压暗、被碰到的顶点占比（只看产出颜色，与参数无关，擂台也用） */
export function aoStats(mesh, cls, after) {
  const { col, tri } = mesh; let all = 0, nAll = 0, open = 0, nOpen = 0, corner = 0, nCorner = 0, touched = 0;
  for (let t = 0; t < tri.length; t++) for (let v = 0; v < 3; v++) {
    const o = (t * 3 + v) * 3, l0 = luma(col[o], col[o + 1], col[o + 2]), l1 = luma(after[o], after[o + 1], after[o + 2]), dark = l0 > 1e-6 ? Math.max(0, 1 - l1 / l0) : 0;
    all += dark; nAll++; if (dark > 0.002) touched++;
    if (tri[t].part === 'top') { if (cls.open[tri[t].cell]) { open += dark; nOpen++; } if (cls.corner[tri[t].cell]) { corner += dark; nCorner++; } }
  }
  return { aoMean: nAll ? r3(all / nAll) : 0, open: nOpen ? r3(open / nOpen) : 0, corner: nCorner ? r3(corner / nCorner) : 0, touched: nAll ? r3(touched / nAll) : 0, vertices: nAll };
}
const plan = (site) => (site.plan ||= { persist: false, scene: site.scene?.id || null, grid: null, metrics: {} });
const gridMeta = (V) => ({ n: V.n, step: V.step, L: V.L, x0: V.grid.x0, z0: V.grid.z0 });

export const townGraph = {
  meta: { id: 'scene.town-graph', name: '体素图 · 区域图', domain: 'lightlife', line: 'grid', reads: ['heightfield', 'buildingMask'], writes: ['regionGraph'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '把场景的虚拟体素空间按原版 Town 的口径连成区域：顶部同高、边相邻的柱子是一栋楼（或 1 层走道）。给烟囱、植物、光照用。',
    keywords: ['区域', '楼', '走道', '屋顶', '体素图', 'town', 'region'], params: {},
    modules: ['src/core/town-graph.js', 'src/core/world.js'], sources: [LIB + 'src/core/town-graph.js', 'townscaper-web/REACode/src/town.js'], learn: ['931196707236392960'] },
  match(site) { const n = landCount(site); return n ? [{ id: 'columns', count: n, reason: `${n} 个陆地 / 建筑柱子` }] : []; },
  run(site, _p, ctx) {
    const V = vox(ctx, site), T = new Town(V.grid, { world: V.world }), s = regionSummary(T), { regions } = T.regions(), P = plan(site);
    const chimneys = regions.filter((r) => r.h >= 2 && r.cells.some((c) => V.world.topIsBuilt(c))).sort((a, b) => b.h - a.h || b.cells.length - a.cells.length).slice(0, 12).map((r) => {
      const mx = r.cells.reduce((a, c) => a + c.cx, 0) / r.cells.length, mz = r.cells.reduce((a, c) => a + c.cz, 0) / r.cells.length, c = r.cells.reduce((b, c2) => (Math.hypot(c2.cx - mx, c2.cz - mz) < Math.hypot(b.cx - mx, b.cz - mz) ? c2 : b), r.cells[0]);
      return { cell: c.id, x: r2(c.cx), y: r2(r.h * V.L + V.L * 0.3), z: r2(c.cz), h: r.h };
    });
    P.grid ||= gridMeta(V); P.town = { ...s, chimneys }; ctx.chimneys = chimneys;
    return { applied: ['town:regions'], changed: [`区域 ${s.regions} 块 · 楼 ${s.buildings} · 走道 ${s.walkways} · 最大一块 ${s.largest} 格 · 烟囱候选 ${chimneys.length}`] };
  },
};
export const voxelAO = {
  meta: { id: 'light.voxel-ao', name: '体素遮蔽（AO）', domain: 'lightlife', line: 'shadows', reads: ['heightfield', 'buildingMask', 'palette'], writes: ['lighting'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '整个场景一张分层体素占用场（地形 + 建筑同一张），模糊后每个顶点沿法线外移采样压暗：墙脚、巷子、屋檐下变暗，开阔的顶面不压。',
    keywords: ['遮蔽', 'AO', '阴影', '墙脚', '暗部', '体素', 'occlusion', 'shadow'], params: { strength: { label: '遮蔽强度', min: 0.2, max: 0.9, step: 0.02, default: 0.62 }, radius: { label: '模糊半径（像素）', min: 1, max: 6, step: 1, default: 3 } },
    modules: ['src/light/voxel-light.js', 'src/core/world.js', 'src/core/spatial.js'], sources: [LIB + 'src/light/voxel-light.js', 'townscaper-web/REACode/src/lighting.js'], learn: ['1168571866405097472', '931196707236392960'] },
  match(site) { const n = landCount(site); return n ? [{ id: 'voxels', count: n, reason: `${n} 个柱子进同一张占用场` }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site), f = ensureField(ctx, site, p.radius), after = ctx.mesh.col.slice(), offset = 0.34 * V.L;
    bakeVertexAO(f, ctx.mesh.pos, after, { offset, strength: p.strength, bounce: 0 });
    const st = aoStats(ctx.mesh, ctx.cls, after), g = sampleGrid(f, V), P = plan(site);
    P.grid ||= gridMeta(V); P.light = { ...gridMeta(V), Lv: g.Lv, strength: p.strength, radius: ctx.radius, offset: r3(offset), mix: 0, occ: g.occ, tint: null, voxels: f.voxels }; P.metrics.ao = st;
    return { applied: ['light:ao'], changed: [`体素 ${f.voxels} · 平均压暗 ${pct(st.aoMean)} · 开阔顶面 ${pct(st.open)} · 凹角 ${pct(st.corner)} · 碰到顶点 ${pct(st.touched)}`] };
  },
};
export const colorBounce = {
  meta: { id: 'light.bounce', name: '彩色反弹 · 多跳', domain: 'lightlife', line: 'light', reads: ['lighting', 'palette'], writes: ['lighting'], preserves: ['userSaves', 'lakeBuildings'], requires: ['light.voxel-ao'],
    does: '在同一张体素场上做多跳颜色扩散（约 3 跳后看不出差别）：白墙靠红房子那侧泛粉、墙缝里泛邻居的颜色；是染色不是提亮。',
    keywords: ['反弹', '反射光', '染色', '间接光', '彩色', 'bounce', 'GI'], params: { mix: { label: '反弹量', min: 0, max: 0.8, step: 0.02, default: 0.42 }, passes: { label: '扩散跳数', min: 1, max: 4, step: 1, default: 3 }, gain: { label: '扩散强度', min: 0.3, max: 1.5, step: 0.05, default: 0.9 }, air: { label: '多跳补光', min: 0, max: 0.6, step: 0.02, default: 0.25 } },
    modules: ['src/light/voxel-light.js'], sources: [LIB + 'src/light/voxel-light.js', 'townscaper-web/REACode/src/lighting.js'], learn: ['1237305125070426112', '1580846877855338497'] },
  match(site) { const n = landCount(site), cols = new Set((site?.col || []).filter((c, i) => site.h[i] > 0.05)).size; return n && cols > 1 ? [{ id: 'colors', count: cols, reason: `${cols} 种顶面色互相染` }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site), f = ensureField(ctx, site), P = plan(site), strength = P.light?.strength ?? 0.62, offset = 0.34 * V.L;
    const single = ctx.mesh.col.slice(); bakeVertexAO(f, ctx.mesh.pos, single, { offset, strength, bounce: p.mix });
    diffuseBounce(f, p.passes, p.gain, 3);
    const multi = ctx.mesh.col.slice(); bakeVertexAO(f, ctx.mesh.pos, multi, { offset, strength, bounce: p.mix, airGain: p.air });
    let shift = 0, hue = 0, n = 0;
    for (let o = 0; o < multi.length; o += 3) {
      shift += (Math.abs(multi[o] - single[o]) + Math.abs(multi[o + 1] - single[o + 1]) + Math.abs(multi[o + 2] - single[o + 2])) / 3; n++;
      const a = { r: single[o], g: single[o + 1], b: single[o + 2] }, b = { r: multi[o], g: multi[o + 1], b: multi[o + 2] }, dh = Math.abs(hueOf(a) - hueOf(b));
      if (Math.max(a.r, a.g, a.b) - Math.min(a.r, a.g, a.b) > 0.05 && Math.min(dh, 360 - dh) > 6) hue++;
    }
    const g = sampleGrid(f, V, { tint: true });
    P.grid ||= gridMeta(V); P.light ||= { ...gridMeta(V), Lv: g.Lv, strength, radius: ctx.radius, offset: r3(offset), occ: g.occ, voxels: f.voxels };
    Object.assign(P.light, { mix: p.mix, air: p.air, passes: p.passes, tint: g.tint }); P.metrics.bounce = { tintShift: n ? r3(shift / n) : 0, hueShifted: n ? r3(hue / n) : 0, airGrid: f.airGrid };
    return { applied: ['light:bounce'], changed: [`多跳 ${p.passes} 次 · 相对单跳平均改色 ${r3(shift / Math.max(1, n))} · 色相偏移的顶点 ${pct(hue / Math.max(1, n))}`] };
  },
};
export const megatex = {
  meta: { id: 'light.megatex', name: '大纹理（一张图集）', domain: 'lightlife', line: 'atlas', reads: ['heightfield', 'palette'], writes: ['megatexture'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '场景里每个顶面、每段墙烘进同一张大图（每块面带自己的笔触、四周垫边），一个像素能 O(1) 反查回哪个面、面上哪个 u,v；量占空比、反查正确率、双线性和 mip 串色。',
    keywords: ['大纹理', '图集', '烘焙', 'megatexture', 'atlas', '贴图'], params: { texel: { label: '每格像素', min: 2, max: 8, step: 1, default: 4 }, pad: { label: '垫边像素', min: 0, max: 4, step: 1, default: 2 } },
    modules: ['src/light/mega-atlas.js', 'src/light/texel-owner.js', 'src/core/atlas.js'], sources: [LIB + 'src/light/mega-atlas.js', 'townscaper-web/REACode/src/megatex.js'], learn: ['1481661852887265288'] },
  match(site) { const n = landCount(site); return n ? [{ id: 'faces', count: n, reason: `约 ${n} 个顶面 + 露出的墙面` }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site), list = [], { tri } = ctx.mesh;
    for (let t = 0; t < tri.length; t += 2) { const x = tri[t], h = x.part === 'top' ? p.texel : Math.max(1, Math.round((x.y1 - x.y0) / V.L)) * p.texel; list.push({ w: p.texel, h, hue: hueOf(V.colorOf(V.grid.cells[x.cell])), key: x.cell + ':' + x.part + (x.edge ?? '') }); }
    const faces = facesFrom(list), area = faces.reduce((s, f) => s + (f.w + 2 * p.pad) * (f.h + 2 * p.pad), 0);
    let size = 64; while (size < 2048 && size * size < area * 1.35) size *= 2;
    const m = measureLayout(faces, { size, pad: p.pad, pack: 'atlas', keep: true }), mip1 = mipBleedShare(m.A, 1);
    const S = 64, k = size / S, prev = new Array(S * S * 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const q = (Math.floor(y * k) * size + Math.floor(x * k)) * 3, o = (y * S + x) * 3; prev[o] = m.A.rgb[q]; prev[o + 1] = m.A.rgb[q + 1]; prev[o + 2] = m.A.rgb[q + 2]; }
    const P = plan(site); P.grid ||= gridMeta(V);
    P.megatex = { size, pad: p.pad, texel: p.texel, faces: faces.length, fail: m.fail, occupancy: r3(m.occupancy), exactRate: r3(m.exactRate), bleedRate: r3(m.bleedRate), mip1Bleed: r3(mip1), preview: { w: S, h: S, rgb: prev } };
    return { applied: ['light:megatex'], changed: [`${faces.length} 块面 → ${size}² 图集 · 占空比 ${pct(m.occupancy)} · 反查 ${pct(m.exactRate)} · 双线性串色 ${pct(m.bleedRate)} · mip1 串色 ${pct(mip1)}${m.fail ? ` · ${m.fail} 块放不下` : ''}`] };
  },
};
export const plantAtlas = {
  meta: { id: 'life.plant-atlas', name: '植物图集（全场景共用）', domain: 'lightlife', line: 'plants', reads: ['vegetation'], writes: ['plantAtlas'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '所有场景的植物种类共用同一张 512² 精灵图集（树类 2×2 四视角）；这个场景只登记自己用到哪几格、认出了多少株。',
    keywords: ['植物', '图集', '树', '草', '共用', '精灵', 'impostor', 'plants'], params: {},
    modules: ['src/life/sprite-pack-c09.js', 'src/core/level-flora.js', 'src/core/atlas.js'], sources: [LIB + 'src/life/sprite-pack-c09.js', LIB + 'src/core/level-flora.js'], learn: ['1593215065423245313', '959530111187013632'] },
  match(site) { const k = Object.keys(site?.flora || {}).length; return k ? [{ id: 'flora', count: k, reason: `${k} 种植物网格` }] : []; },
  run(site) {
    const a = plantAtlasForScene(site.flora || {}), P = plan(site); P.plants = a;
    return { applied: ['life:plants'], changed: [`共享图集 ${a.atlasHash}（${a.shared} 种）· 本场景用 ${a.used.length} 种 · 认出 ${pct(a.coverage)} 株${Object.keys(a.unmapped).length ? ` · 认不出：${Object.keys(a.unmapped).slice(0, 4).join('、')}` : ''}`] };
  },
};
export const wind = {
  meta: { id: 'life.wind', name: '风', domain: 'lightlife', line: 'wind', reads: ['heightfield'], writes: ['wind'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '盛行风 + 迎风坡抬升的风场，在同一份体素里放一排虚拟风粒子：绕过房子、沿坡爬升，永远不进实心。实景里画成淡蓝的风线。',
    keywords: ['风', '风向', '气流', '风线', 'wind'], params: { dir: { label: '风向°', min: 0, max: 359, step: 1, default: 225 }, speed: { label: '风速', min: 0.4, max: 3, step: 0.1, default: 1.2 } },
    modules: ['src/core/wind-flow.js'], sources: [LIB + 'src/core/wind-flow.js'], ideas: ['townscaper-web/REACode/src/wind.js'], learn: ['926903893866541057', '931196707236392960'] },
  match(site) { const n = landCount(site); return n ? [{ id: 'air', count: 1, reason: '整片场景上空' }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site), w = windRun(V, { dir: p.dir, speed: p.speed }), P = plan(site); P.grid ||= gridMeta(V);
    ctx.wind = windField(V, { dir: p.dir, speed: p.speed }); P.wind = { dir: p.dir, speed: p.speed, lines: w.lines }; Object.assign(P.metrics, { wind: w.metrics });
    return { applied: ['life:wind'], changed: [`${w.metrics.windLines} 条风线 · 被挡步数占比 ${pct(w.metrics.windBlocked)} · 平均抬升 ${w.metrics.windRise} m · 穿进实心 ${w.metrics.windInside} 点`] };
  },
};
export const smoke = {
  meta: { id: 'life.smoke', name: '烟（烟囱）', domain: 'lightlife', line: 'smoke', reads: ['regionGraph', 'wind'], writes: ['smoke'], preserves: ['userSaves', 'lakeBuildings'], requires: ['scene.town-graph'],
    does: '每栋楼的最高格冒一串烟团，随风场漂、往上升、变大；画的时候两遍各自按远到近排序。',
    keywords: ['烟', '烟囱', '炊烟', '雾', 'smoke'], params: { puffs: { label: '每个烟囱的烟团', min: 4, max: 20, step: 1, default: 10 }, rise: { label: '上升速度', min: 0.3, max: 2, step: 0.1, default: 0.9 } },
    modules: ['src/core/smoke-order.js', 'src/core/wind-flow.js', 'src/core/town-graph.js'], sources: [LIB + 'src/core/smoke-order.js'], ideas: ['townscaper-web/REACode/src/smokefx.js'], learn: ['1015142746372366336'] },
  match(site) { const b = (site?.kind || []).filter((k) => k === 2).length; return b ? [{ id: 'chimneys', count: b, reason: `${b} 个建筑格` }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site);
    if (!ctx.chimneys) townGraph.run(site, {}, ctx);
    const s = smokeRun(V, ctx.chimneys, { wind: ctx.wind, puffs: p.puffs, rise: p.rise }), P = plan(site); P.grid ||= gridMeta(V);
    P.smoke = { sources: s.sources, puffs: s.puffs, order: s.order }; P.metrics.smoke = s.metrics;
    return { applied: s.sources.length ? ['life:smoke'] : [], changed: [`${s.metrics.smokeSources} 个烟囱 · ${s.metrics.smokePuffs} 个烟团 · 最高升 ${s.metrics.smokeRise} m`] };
  },
};
export const animals = {
  meta: { id: 'life.animals', name: '小动物（导航面流动）', domain: 'lightlife', line: 'animals', reads: ['heightfield', 'landMask', 'buildingMask'], writes: ['animals'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '在陆地导航面上撒一群小动物，按顶点距离场像液体一样流向远处的目标：窄口收成一股、开阔处摊开，不穿出导航面、不进海。',
    keywords: ['动物', '螃蟹', '鸡', '群体', '生命', 'animals', 'swarm'], params: { count: { label: '只数', min: 6, max: 60, step: 1, default: 24 } },
    modules: ['src/world/navmesh-flow.js', 'src/core/swarm-maze.js'], sources: [LIB + 'src/world/navmesh-flow.js', LIB + 'src/core/swarm-maze.js'], learn: ['810157485638189056', '816748103193817088'] },
  match(site) { const n = (site?.h || []).filter((v, i) => v > 0.05 && (site.kind?.[i] ?? 1) !== 2).length; return n >= 6 ? [{ id: 'ground', count: n, reason: `${n} 个可走地面格` }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site), a = animalsRun(V, site, { count: p.count }), P = plan(site); P.grid ||= gridMeta(V);
    P.animals = { agents: a.agents, goal: a.goal || null, frames: a.frames }; P.metrics.animals = a.metrics;
    return { applied: a.agents ? ['life:animals'] : [], changed: [a.note || `${a.agents} 只 · 走了平均 ${a.metrics.animalsTravel} m · 留在陆地 ${pct(a.metrics.animalsOnLand)} · 出导航面 ${a.metrics.animalsLeft} 次`] };
  },
};

export const plateauDiag = {
  meta: { id: 'scene.plateau-diag', name: '台地诊断（同高片 · 逻辑阶差面积）', domain: 'lightlife', line: 'grid', reads: ['heightfield'], writes: ['regionGraph'], preserves: ['userSaves', 'lakeBuildings'], requires: [],
    does: '把场景采成虚拟体素空间后，在同一份 World 上数两样：同高片（顶面同高、边相邻的柱子聚成片，记每片的层数 / 格数 / 面积 / 边界周长）与逻辑阶差（相邻柱高差 ≥ minStep 层的边，记边数 / 总长 / 高差 × 边长的立面面积）。只读诊断，不改一格一体素；185帧原片（815236105079398400）算法未公开，这里量的是可观察行为，不是原算法恢复。',
    keywords: ['台地', '同高', '片', '阶差', '崖', 'plateau', 'terrace', '诊断', '地形'], params: { minStep: { label: '几层才算阶差', min: 1, max: 4, step: 1, default: 2 }, rock: { label: '只看岩石地表（0 = 顶面含建筑）', min: 0, max: 1, step: 1, default: 0 } },
    modules: ['src/core/terrace-profile.js', 'src/core/world.js'], sources: [LIB + 'src/core/terrace-profile.js', 'townscaper-web/REACode/src/terracecliff.js'], learn: ['815236105079398400'] },
  match(site) { const n = landCount(site); return n ? [{ id: 'columns', count: n, reason: `${n} 根柱子查同高片与阶差边` }] : []; },
  run(site, p, ctx) {
    const V = vox(ctx, site), height = p.rock ? 'ground' : 'top';
    const R = plateauRuns(V.world, { height }), S = stepDropArea(V.world, { minStep: p.minStep, height });
    const P = plan(site); P.grid ||= gridMeta(V);
    P.plateau = { height, minStep: p.minStep, landCells: R.landCells, runs: R.count, levels: R.levels,
      list: R.runs.map((r) => ({ level: r.level, count: r.count, area: r3(r.area), boundary: r3(r.boundary), boundaryEdges: r.boundaryEdges })),
      largest: R.runs[0] ? { level: R.runs[0].level, count: R.runs[0].count } : null,
      steps: { edges: S.edges, land: S.land, shore: S.shore, shoreLength: r3(S.shoreLength), length: r3(S.length), area: r3(S.area), byDrop: S.byDrop } };
    P.metrics.plateau = { runs: R.count, levels: Object.keys(R.levels).length, largest: R.runs[0]?.count || 0, boundary: r3(R.runs.reduce((a, r) => a + r.boundary, 0)), stepEdges: S.edges, stepLand: S.land, stepLength: r3(S.length), stepArea: r3(S.area) };
    return { applied: ['plateau:diag'], changed: [`同高片 ${R.count} 片（${Object.keys(R.levels).length} 层 · 最大 ${P.metrics.plateau.largest} 格）· ≥${p.minStep} 层阶差边 ${S.edges} 条（陆地间 ${S.land} · 朝水/格外 ${S.shore} · 立面 ${r3(S.area)}）`] };
  },
};

export const LIGHTLIFE_CAPABILITIES = [townGraph, voxelAO, colorBounce, megatex, plantAtlas, wind, smoke, animals, plateauDiag];
const byId = new Map(LIGHTLIFE_CAPABILITIES.map((c) => [c.meta.id, c]));
export function describeLightLifeCapabilities() { return LIGHTLIFE_CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true })); }
export function paramsFor(meta, given = {}) {
  const out = {};
  for (const [k, d] of Object.entries(meta.params || {})) { let v = Number(given?.[k] ?? d.default); if (!Number.isFinite(v)) v = d.default; v = Math.max(d.min, Math.min(d.max, v)); if (d.step === 1) v = Math.round(v); out[k] = v; }
  return out;
}
export function matchAll(site) {
  return LIGHTLIFE_CAPABILITIES.map((cap) => { let rows = []; try { rows = cap.match(site); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; } return { id: cap.meta.id, count: rows.reduce((a, r) => a + r.count, 0), targets: rows }; });
}
/** 执行：固定顺序（区域图 → 遮蔽 → 反弹 → 大纹理 → 植物 → 风 → 烟 → 动物；烟要风场和烟囱），报告按调用方给的步骤顺序。 */
export function runPlan(site, steps, onStep = () => {}) {
  const report = [], ctx = {}, order = LIGHTLIFE_CAPABILITIES.map((c) => c.meta.id), sorted = [...steps].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  site.plan = { persist: false, scene: site.scene?.id || null, grid: null, metrics: {} };
  for (const step of sorted) {
    const cap = byId.get(step.id); if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const params = paramsFor(cap.meta, step.params); onStep(step.id);
    const t0 = Date.now(), out = cap.run(site, params, ctx);
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params });
  }
  site.plan.steps = sorted.map((s) => s.id);
  const pos = new Map(steps.map((s, i) => [s.id, i])); report.sort((a, b) => (pos.get(a.id) ?? 99) - (pos.get(b.id) ?? 99));
  return report;
}
/** 分布报告用的指标（seed-layers.js）：都只看产出，与输入参数无关。 */
export const LIGHTLIFE_SEED_METRICS = Object.freeze([
  { key: 'aoMean', label: '平均压暗', unit: '%', better: 'none' }, { key: 'corner', label: '凹角压暗', unit: '%', better: 'higher' }, { key: 'open', label: '开阔顶面压暗', unit: '%', better: 'lower' },
  { key: 'tintShift', label: '多跳改色', unit: '', better: 'none' }, { key: 'megaOccupancy', label: '大纹理占空比', unit: '%', better: 'higher' }, { key: 'plantCoverage', label: '植物认出率', unit: '%', better: 'higher' },
  { key: 'windLines', label: '风线', unit: '条', better: 'none' }, { key: 'smokePuffs', label: '烟团', unit: '个', better: 'none' }, { key: 'animalsOnLand', label: '动物留在陆地', unit: '%', better: 'higher' },
]);
export function seedMetricsOf(P) {
  const m = P?.metrics || {};
  return { aoMean: m.ao?.aoMean ?? null, corner: m.ao?.corner ?? null, open: m.ao?.open ?? null, tintShift: m.bounce?.tintShift ?? null, megaOccupancy: P?.megatex?.occupancy ?? null, plantCoverage: P?.plants?.coverage ?? null,
    windLines: m.wind?.windLines ?? null, smokePuffs: m.smoke?.smokePuffs ?? null, animalsOnLand: m.animals?.animalsOnLand ?? null };
}
