/**
 * 山形管线 · 能力库（Worker 安全：纯数据）。输入 site.field = 实景高度网格（mountain.probe）：
 *   { n, step, h[n*n]（米，null = 无地形）, cls[n*n]（0 可改 1 建筑 2 轨道）, railY }
 * 每个能力挂在学习库的一条能力线上（meta.line）。meta.sources = 真正 import 调用的库模块；
 * meta.ideas = 方法出处（两库里的同类实现，本能力没有直接调用）。保护带与岩屑坡是本文件自己的实现：
 *   mountain.protect  保护带     —— 建筑 / 轨道 / 海岸不动，算出离保护区的距离场
 *   mountain.massif   山体隆起   —— core/noise.js ridged 脊线噪声 × 距离场，膜面化掉台阶
 *   mountain.erode    沟谷侵蚀   —— core/depression-fill.js erodeHeights（溪流功率，溯源下切）
 *   mountain.rolling  连绵圆润   —— 形态学闭运算连脊填谷 + 凸棱圆滑 + 低频起伏（Bad North 式连续山体）
 *   mountain.talus    岩屑坡     —— 热力松弛到休止角（REACode depfill / overhangterrain 的软坡思路）
 *   mountain.lowpoly  低面片着色 —— 抖动三角面 + core/mountain-bake.js bakeNormalLight 烘焙明暗
 */
import { fbm, ridged, smoothstep, hash01 } from '../../../../townscaper-web/REACodeRefactoring/src/core/noise.js';
import { erodeHeights } from '../../../../townscaper-web/REACodeRefactoring/src/core/depression-fill.js';
import { bakeNormalLight } from '../../../../townscaper-web/REACodeRefactoring/src/core/mountain-bake.js';
export const MOUNTAIN_CAPABILITIES_VERSION = 2;
export const SEA = 0.3;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LIB = 'townscaper-web/REACodeRefactoring/';

/** 工作状态：h0 原高、h 当前高、land、keep、dist（离保护区 / 海的距离，米） */
export function fieldState(site) {
  if (site._f) return site._f;
  const f = site.field, N = f.n * f.n, h0 = new Float64Array(N), land = new Uint8Array(N);
  for (let q = 0; q < N; q++) { h0[q] = f.h[q] == null ? NaN : f.h[q]; land[q] = h0[q] > SEA ? 1 : 0; }
  return (site._f = { n: f.n, step: f.step, N, h0, h: Float64Array.from(h0), land, cls: f.cls, keep: null, dist: null });
}
export function protectMask(F, band, railBand) {
  const { n, N, step, cls, land } = F, keep = new Uint8Array(N), dist = new Float64Array(N).fill(Infinity), near = new Float64Array(N).fill(Infinity);
  const grow = (k, r) => { const R = Math.ceil(r / step); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (cls[j * n + i] === k) for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const x = i + a, z = j + b; if (x >= 0 && z >= 0 && x < n && z < n && a * a + b * b <= R * R) keep[z * n + x] = 1; } };
  grow(1, band); grow(2, railBand);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = j * n + i; if (!land[q] || i === 0 || j === 0 || i === n - 1 || j === n - 1) keep[q] = 1; if (keep[q]) dist[q] = 0; if (cls[q] === 2) near[q] = 0; }
  const sweep = (d) => { const pass = (i, j, a, b, w) => { const x = i + a, z = j + b; if (x >= 0 && z >= 0 && x < n && z < n) d[j * n + i] = Math.min(d[j * n + i], d[z * n + x] + w * step); };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pass(i, j, -1, 0, 1); pass(i, j, 0, -1, 1); pass(i, j, -1, -1, 1.414); pass(i, j, 1, -1, 1.414); }
    for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) { pass(i, j, 1, 0, 1); pass(i, j, 0, 1, 1); pass(i, j, 1, 1, 1.414); pass(i, j, -1, 1, 1.414); } };
  sweep(dist); sweep(near);
  return { keep, dist, railDist: near };
}
const need = (site) => { const F = fieldState(site); if (!F.keep) Object.assign(F, protectMask(F, 6, 8), { band: 6, railBand: 8 }); return F; };
const freeCount = (F) => { let c = 0; for (let q = 0; q < F.N; q++) if (!F.keep[q]) c++; return c; };

export const mountainProtect = {
  meta: { id: 'mountain.protect', name: '保护带', domain: 'mountain', line: 'terrain',
    does: '建筑、轨道、海岸线及其外扩保护带不动；其余陆地才交给后面的山形能力。',
    keywords: ['保护', '轨道', '净空', '建筑', '海岸'], related: ['1120036868966502401'], sources: [], modules: ['src/core/voxel-distance.js'], ideas: [LIB + 'src/core/region-boundary.js'],
    reads: ['heightfield', 'landMask', 'buildingMask', 'railMask', 'coastline'], writes: ['protectMask'], preserves: ['userBuildings', 'buildingBuffer', 'railClearance', 'coastline', 'userSaves'],
    params: { band: { label: '建筑保护带（米）', min: 3, max: 15, step: 1, default: 6 }, railBand: { label: '轨道保护带（米）', min: 6, max: 20, step: 1, default: 8 } } },
  match(site) { const F = fieldState(site); let s = 0, r = 0; for (let q = 0; q < F.N; q++) { if (F.cls[q] === 1) s++; else if (F.cls[q] === 2) r++; } return s + r ? [{ id: 'protected', cells: [], score: s + r, reason: `建筑 ${s} 格 · 轨道 ${r} 格` }] : []; },
  run(site, { params }) { const F = fieldState(site); Object.assign(F, protectMask(F, params.band, params.railBand), { band: params.band, railBand: params.railBand }); site.plan.protect = { band: params.band, railBand: params.railBand };
    return { applied: ['protected'], changed: [`保护 ${F.N - freeCount(F)} 格，可塑陆地 ${freeCount(F)} 格（${Math.round(freeCount(F) * F.step * F.step)} m²）`] }; },
};

export const mountainMassif = {
  meta: { id: 'mountain.massif', name: '山体隆起', domain: 'mountain', line: 'terrain', requires: ['mountain.protect'],
    does: '把可塑陆地的方台阶化成连续膜面，再沿脊线噪声隆起主峰与支脉；离建筑 / 轨道越近隆起越小。',
    keywords: ['山', '山峰', '山脊', '隆起', '高山', '轮廓'], related: ['1447488323845509121', '832633189277409280'], sources: [LIB + 'src/core/noise.js'], ideas: [LIB + 'src/terrain/generate.js', 'townscaper-web/REACode/engine/mesa.js'],
    reads: ['heightfield', 'protectMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline'],
    params: { peak: { label: '主峰隆起（米）', min: 8, max: 60, step: 1, default: 22 }, reach: { label: '隆起所需纵深（米）', min: 10, max: 80, step: 1, default: 22 }, slope: { label: '近保护区最大坡比', min: 0.4, max: 1.6, step: 0.05, default: 1.2 },
      ridgeScale: { label: '山脊间距（米）', min: 30, max: 160, step: 5, default: 85 }, sharp: { label: '山脊锐度', min: 0.6, max: 3, step: 0.1, default: 1.5 }, soften: { label: '台阶膜面化', min: 0, max: 1, step: 0.05, default: 0.2 }, seed: { label: '种子', min: 1, max: 99, step: 1, default: 7 } } },
  match(site) { const F = need(site), c = freeCount(F); return c > 50 ? [{ id: 'free-land', cells: [], score: c, reason: `可塑陆地 ${c} 格` }] : []; },
  run(site, { params }) {
    const F = need(site), { n, N, step, h, keep, dist } = F;
    // 膜面：保护区当固定边界，自由格做拉普拉斯松弛，方台阶化成连续坡
    const iters = Math.round(params.soften * 60), base = Float64Array.from(h);
    for (let it = 0; it < iters; it++) for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const q = j * n + i; if (keep[q]) continue; const g = (v) => (Number.isFinite(v) ? v : SEA); base[q] += 0.9 * ((g(base[q - 1]) + g(base[q + 1]) + g(base[q - n]) + g(base[q + n])) / 4 - base[q]); }
    let top = 0, raised = 0, crest = 1; for (let q = 0; q < N; q++) if (F.land[q]) crest = Math.max(crest, F.h0[q]);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const q = j * n + i; if (keep[q]) continue;
      const x = i * step, z = j * step, wx = fbm(x / 140 + 3.1, z / 140 + 8.4, { octaves: 2, freq: 1, seed: params.seed + 11 }) * 40, wz = fbm(x / 140 + 9.7, z / 140 + 1.3, { octaves: 2, freq: 1, seed: params.seed + 23 }) * 40;
      const r = Math.pow(clamp(ridged((x + wx) / params.ridgeScale, (z + wz) / params.ridgeScale, { octaves: 4, freq: 1, gain: 0.5, seed: params.seed }), 0, 1), params.sharp);
      const body = smoothstep(0, params.reach, dist[q]), rise = Math.min(params.peak * body * (0.3 + 0.7 * r) * (0.55 + 0.9 * clamp(base[q] / crest, 0, 1)), params.slope * dist[q]);   // 本来就高的地方隆得更多：主峰出在原山脊上
      h[q] = Math.max(SEA + 0.3, base[q] + rise); if (rise > 0.5) raised++; top = Math.max(top, h[q]);
    }
    site.plan.massif = { ...params };
    return { applied: raised ? ['free-land'] : [], changed: [`隆起 ${raised} 格 · 最高点 ${top.toFixed(1)} m`] };
  },
};

export const mountainErode = {
  meta: { id: 'mountain.erode', name: '沟谷侵蚀', domain: 'mountain', line: 'terrain', requires: ['mountain.massif'],
    does: '按汇水面积 × 落差做溪流功率侵蚀，沟谷从山脚溯源下切，山体分出支脉和冲沟。',
    keywords: ['侵蚀', '沟谷', '冲沟', '汇水', '河谷'], related: ['1447488323845509121'], sources: [LIB + 'src/core/depression-fill.js'], ideas: [LIB + 'src/terrain/drainage.js', 'townscaper-web/REACode/src/depfill.js'],
    reads: ['heightfield', 'protectMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline'],
    params: { passes: { label: '侵蚀轮数', min: 1, max: 12, step: 1, default: 5 }, k: { label: '起蚀阈值', min: 1, max: 12, step: 0.5, default: 4 }, m: { label: '汇水指数', min: 0.2, max: 0.9, step: 0.05, default: 0.5 }, unit: { label: '下切步长（米）', min: 0.5, max: 3, step: 0.25, default: 1.25 } } },
  match(site) { const F = need(site), c = freeCount(F); return c > 50 ? [{ id: 'free-land', cells: [], score: c, reason: '可塑陆地上有落差可供下切' }] : []; },
  run(site, { params }) {
    const F = need(site), { n, N, h, keep, land } = F, u = params.unit;
    const cells = Array.from({ length: N }, (_, q) => { const i = q % n, j = (q / n) | 0; return { id: q, edgeNeighbors: [i > 0 ? q - 1 : -1, i < n - 1 ? q + 1 : -1, j > 0 ? q - n : -1, j < n - 1 ? q + n : -1] }; });
    const L = new Float64Array(N); for (let q = 0; q < N; q++) L[q] = land[q] ? Math.max(1, Math.round(h[q] / u) + 1) : 0;
    const r = erodeHeights(cells, L, { passes: params.passes, m: params.m, k: params.k, keep });
    let cut = 0, deep = 0; for (let q = 0; q < N; q++) { const d = (L[q] - r.heights[q]) * u; if (d > 0 && !keep[q]) { h[q] = Math.max(SEA + 0.3, h[q] - d); cut++; deep = Math.max(deep, d); } }
    site.plan.erode = { ...params, lowered: r.lowered, volume: r.volume };
    return { applied: cut ? ['free-land'] : [], changed: [`下切 ${cut} 格 · 最深 ${deep.toFixed(1)} m · ${r.log.length} 轮`] };
  },
};

export const mountainRolling = {
  meta: { id: 'mountain.rolling', name: '连绵圆润', domain: 'mountain', line: 'terrain', requires: ['mountain.massif'],
    does: 'Bad North 式山体：闭运算把窄谷填起来连成一片，凸出的棱线圆滑倒角，再叠一层低频起伏；保护区和海岸不动。',
    keywords: ['圆润', '连绵', '平滑', 'bad north', '连脊', '倒角', '闭运算'], related: ['1670720537662836736', '1670725072540106755', '1447488323845509121'], sources: [LIB + 'src/core/noise.js'], ideas: ['townscaper-web/REACode/src/depfill.js', 'townscaper-web/REACode/src/edgesmooth.js', 'townscaper-web/REACode/engine/mesa.js'],
    reads: ['heightfield', 'protectMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline'],
    params: {
      bridge: { label: '连脊半径（格）', min: 0, max: 3, step: 1, default: 2 },
      round: { label: '圆润轮数', min: 0, max: 10, step: 1, default: 6 },          // R26 擂台调参：4 → 6（擂台实算见 WORKSHOP_LOG「R26 擂台调参（Quick）」）
      swell: { label: '起伏幅度（米）', min: 0, max: 12, step: 0.5, default: 3.5 },  // R26 擂台调参：5 → 3.5
      reach: { label: '起伏所需纵深（米）', min: 6, max: 60, step: 2, default: 30 },  // R26 擂台调参：18 → 30
      slope: { label: '近保护区最大坡比', min: 0.4, max: 1.6, step: 0.05, default: 1.2 },
      seed: { label: '噪声种子', min: 0, max: 999, step: 1, default: 7 } } },
  match(site) { const F = need(site), c = freeCount(F); return c > 50 ? [{ id: 'free-land', cells: [], score: c, reason: `可塑陆地 ${c} 格连成圆润山体` }] : []; },
  run(site, { params }) {
    const F = need(site), { n, N, step, h, h0, keep, land, dist } = F; let filled = 0, rounded = 0, swelled = 0;
    if (params.bridge > 0) {
      const R = params.bridge, dil = Float64Array.from(h);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = j * n + i; if (!land[q] || keep[q]) continue; let mx = h[q];
        for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= n || z >= n || a * a + b * b > R * R) continue; const p = z * n + x; if (land[p] && h[p] > mx) mx = h[p]; }
        dil[q] = mx; }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = j * n + i; if (!land[q] || keep[q]) continue; let mn = dil[q];
        for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= n || z >= n || a * a + b * b > R * R) continue; const p = z * n + x; if (land[p] && dil[p] < mn) mn = dil[p]; }
        const rise = Math.min(mn, h0[q] + params.slope * dist[q]) - h[q]; if (rise > 0) { h[q] += rise; filled++; } }
    }
    if (params.round > 0) {
      const tmp = new Float64Array(N);
      for (let it = 0; it < params.round; it++) { tmp.set(h);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = j * n + i; if (!land[q] || keep[q]) continue;
          let s = tmp[q], w = 1;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const x = i + a, z = j + b; if (x < 0 || z < 0 || x >= n || z >= n) continue; const p = z * n + x; if (!land[p]) continue; const ww = a && b ? 0.5 : 1; s += tmp[p] * ww; w += ww; }
          const nh = s / w; if (nh !== h[q]) { h[q] = nh; rounded++; } } }
    }
    if (params.swell > 0) {
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const q = j * n + i; if (!land[q] || keep[q]) continue;
        const x = i * step, z = j * step, body = smoothstep(0, params.reach, dist[q]); if (body <= 0) continue;
        let add = (fbm(x / 110 + 5.2, z / 110 + 2.8, { octaves: 3, freq: 1, seed: params.seed }) * 2 - 1) * params.swell * body;
        if (add) { h[q] = Math.min(h[q] + add, h0[q] + params.slope * dist[q]); swelled++; } }
    }
    for (let q = 0; q < N; q++) if (land[q] && !keep[q]) { h[q] = Math.max(h[q], Math.min(h0[q], SEA + 0.3)); h[q] = Math.min(h[q], h0[q] + params.slope * dist[q]); }
    site.plan.rolling = { ...params };
    return { applied: filled || rounded || swelled ? ['free-land'] : [], changed: [`连脊填谷 ${filled} 格 · 圆润 ${rounded} 次 · 起伏 ${swelled} 格`] };
  },
};

export const mountainTalus = {
  meta: { id: 'mountain.talus', name: '岩屑坡', domain: 'mountain', line: 'terrain', requires: ['mountain.protect'],
    does: '超过休止角的陡坎向下塌成岩屑坡：竖直方柱变成有坡度的山坡，海岸线与保护区不动。',
    keywords: ['坡', '缓坡', '软坡', '崩塌', '休止角', '崖'], related: ['1671808851895627776', '1447488323845509121'], sources: [], modules: ['src/terrain/soft-tops.js'], ideas: [LIB + 'src/terrain/soft-tops.js', 'townscaper-web/REACode/src/overhangterrain.js'],
    reads: ['heightfield', 'protectMask'], writes: ['heightfield'], preserves: ['buildingBuffer', 'railClearance', 'coastline'],
    params: { angle: { label: '休止角（度）', min: 30, max: 65, step: 1, default: 49 }, iters: { label: '松弛轮数', min: 10, max: 200, step: 10, default: 120 } } },
  match(site) { const F = need(site), c = freeCount(F); return c > 50 ? [{ id: 'free-land', cells: [], score: c, reason: '可塑陆地上的陡坎' }] : []; },
  run(site, { params }) {
    const F = need(site), { n, N, step, h, h0, keep, land } = F, T = Math.tan(params.angle * Math.PI / 180) * step; let moved = 0;
    for (let it = 0; it < params.iters; it++) { let any = 0;
      for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const q = j * n + i; if (keep[q]) continue;
        for (const nb of [q - 1, q + 1, q - n, q + n]) { const hn = land[nb] ? h[nb] : SEA, d = h[q] - hn; if (d <= T) continue; const mv = (d - T) / 4; h[q] -= mv; if (!keep[nb]) h[nb] += mv; any++; } }
      moved += any; if (!any) break; }
    for (let q = 0; q < N; q++) if (!keep[q]) h[q] = Math.max(h[q], Math.min(h0[q], SEA + 0.3));
    site.plan.talus = { ...params };
    return { applied: moved ? ['free-land'] : [], changed: [`松弛 ${moved} 次 · 休止角 ${params.angle}°`] };
  },
};

export const mountainLowpoly = {
  meta: { id: 'mountain.lowpoly', name: '低面片着色', domain: 'mountain', line: 'lines', requires: ['mountain.protect'],
    does: '顶点抖动成不规则三角面，按坡度 / 海拔分草坡、岩壁、碎石、雪线，明暗一次烘进顶点色（平面着色）。',
    keywords: ['low poly', '低面', '面片', '着色', '雪线', '岩壁', '草坡'], related: ['1786014232594485497'], sources: [LIB + 'src/core/mountain-bake.js'], ideas: ['townscaper-web/REACode/src/mountainlight.js'],
    reads: ['heightfield'], writes: ['terrainMesh', 'palette'], preserves: ['buildingBuffer', 'railClearance', 'coastline', 'originalTerrain'],
    params: { jitter: { label: '顶点抖动（格）', min: 0, max: 0.45, step: 0.05, default: 0.18 }, rock: { label: '岩壁起始坡度（度）', min: 25, max: 60, step: 1, default: 50 }, snow: { label: '雪线（占峰高）', min: 0, max: 0.4, step: 0.02, default: 0.1 }, contrast: { label: '烘焙明暗', min: 0, max: 0.6, step: 0.02, default: 0.36 }, palette: { label: '配色（0 原 / 1 Bad North / 2 Townscaper）', min: 0, max: 2, step: 1, default: 1 } } },
  match(site) { const F = need(site); return [{ id: 'surface', cells: [], score: F.N, reason: `${(F.n - 1) * (F.n - 1) * 2} 个三角面` }]; },
  run(site, { params }) {
    const F = need(site), { n, N, step, h, keep, land, cls } = F, jx = new Float32Array(N), jz = new Float32Array(N);
    for (let q = 0; q < N; q++) if (!keep[q]) { jx[q] = (hash01(q * 2 + 1) - 0.5) * 2 * params.jitter * step; jz[q] = (hash01(q * 2 + 2) - 0.5) * 2 * params.jitter * step; }
    let top = -Infinity; for (let q = 0; q < N; q++) if (land[q]) top = Math.max(top, h[q]);
    const snowY = params.snow > 0 ? top * (1 - params.snow) : Infinity, T = (n - 1) * (n - 1) * 2, mat = new Uint8Array(T), normals = new Float32Array(T * 3), count = [0, 0, 0, 0, 0, 0, 0];
    const P = (q) => [(q % n) * step + jx[q], Number.isFinite(h[q]) ? h[q] : 0, ((q / n) | 0) * step + jz[q]];
    let t = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, d = a + n, e = d + 1, tris = (i + j) & 1 ? [[a, d, b], [b, d, e]] : [[a, d, e], [a, e, b]];
      for (const tri of tris) {
        const [p, q, r] = tri.map(P), ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
        normals[t * 3] = nx / l; normals[t * 3 + 1] = ny / l; normals[t * 3 + 2] = nz / l;
        const slope = Math.acos(clamp(ny / l, -1, 1)) * 180 / Math.PI, y = (p[1] + q[1] + r[1]) / 3, built = tri.some((v) => cls[v] === 1);
        const k = y < 1.2 ? 4 : y > snowY && slope < 58 ? 3 : slope > params.rock ? (Math.floor(y / 6) & 1 ? 6 : 1) : slope > params.rock - 7 ? 2 : built && slope < 12 ? 4 : fbm(p[0] / 38, p[2] / 38, { octaves: 2, freq: 1, seed: 5 }) > 0.56 ? 5 : 0;
        mat[t] = k; count[k]++; t++;
      }
    }
    const shade = bakeNormalLight(normals, { base: 1 - params.contrast * 0.6, strength: params.contrast });
    site.plan.style = { ...params, top: +top.toFixed(1) }; site._surface = { jx, jz, mat, shade };
    return { applied: ['surface'], changed: [`草坡 ${count[0] + count[5]} · 岩壁 ${count[1] + count[6]} · 碎石 ${count[2]} · 雪 ${count[3]} · 滩 / 台地 ${count[4]} 面`] };
  },
};

export const MOUNTAIN_CAPABILITIES = [mountainProtect, mountainMassif, mountainErode, mountainRolling, mountainTalus, mountainLowpoly];
const byId = new Map(MOUNTAIN_CAPABILITIES.map((c) => [c.meta.id, c]));
export function describeMountainCapabilities() { return MOUNTAIN_CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true })); }
const defaults = (meta, params = {}) => Object.fromEntries(Object.entries(meta.params || {}).map(([k, p]) => [k, clamp(+(params[k] ?? p.default), p.min ?? -Infinity, p.max ?? Infinity)]));
export function matchAll(site) {
  return MOUNTAIN_CAPABILITIES.map((cap) => { let rows = []; try { rows = cap.match(site); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; } return { id: cap.meta.id, count: rows.length, targets: rows }; });
}
const r2 = (a, d = 100) => Array.from(a, (v) => (Number.isFinite(v) ? Math.round(v * d) / d : null));
/** 执行：按固定顺序（保护 → 隆起 → 侵蚀 → 岩屑坡 → 着色）在私有副本上累积山形；保护区最后强制回写原高 */
export function runPlan(site, steps, onStep = () => {}) {
  const report = []; site.plan = {}; delete site._f; delete site._surface;
  const order = MOUNTAIN_CAPABILITIES.map((c) => c.meta.id), sorted = [...steps].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const step of sorted) {
    const cap = byId.get(step.id); if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const params = defaults(cap.meta, step.params); onStep(step.id);
    const t0 = Date.now(), out = cap.run(site, { params });
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params });
  }
  const F = need(site); for (let q = 0; q < F.N; q++) if (F.keep[q]) F.h[q] = F.h0[q];
  if (!site._surface) mountainLowpoly.run(site, { params: { ...defaults(mountainLowpoly.meta), jitter: 0 } });
  const s = site._surface;
  Object.assign(site.plan, { n: F.n, step: F.step, h: r2(F.h), jx: r2(s.jx), jz: r2(s.jz), mat: Array.from(s.mat), shade: r2(s.shade, 1000), protect: site.plan.protect || { band: F.band, railBand: F.railBand } });
  delete site._f; delete site._surface;
  return report;
}
