/**
 * uv-radial-atlas.js — 第 56 批 C11：1478114309263839244 径向大小排序 UV 图集 + 1482346496460828674 三角反差纹理画进该图集。
 *
 * 1478114309263839244 "I quite like how the radial (instead of directional) size-sorting looks. Gonna make for some visually
 *   pleasing textures with that big coherent chunk in the middle."
 *   画面（frame-0021/0028）：上半 UV 页三角线框——正中一大片（岛的底板，挖着崖柱脚印的洞），其余碎片按大小向外绕；
 *   下半同一座岛：底板 + 几根崖柱（含一个拱洞），先线框、再贴棋盘格；分片在 UV 页里逐片出现。
 *   r55 的 buildCharts 只按「与种子法线夹角 ≤40°」长片，实景岛中心片只占 4%。本模块补：
 *     ① topMergeCharts：朝上面（n.y ≥ cos topAngle）沿共享边连通成一片，统一竖直投影（XZ）——同一层台地/底板整片，
 *        崖柱脚印自然成洞（片子里中心片的洞）；其余（崖面）仍走 buildCharts。片内投影自交 → 退回原分片。
 *     ② clipIsland：与片子同构的测试岛（底板 1 层 + 3 根 3–6 层崖柱 + 一个拱洞），写进共享 World。
 *     ③ rasterizeChartPage：UV 页逐像素记三角号 + 重心（颜色由回调给），供棋盘格 / 反差图上色。
 * 1482346496460828674 "a dedicated contrast texture system for the lines: an iterative simulation on the triangles that starts
 *   random and then tries to make contrasted edges different, and non-contrasted edges similar. A byproduct is a beautiful
 *   color gradient that help express connectivity"
 *   画面：顶部一排调试贴图（UV 图集里的反差色）；岛从灰模开始，颜色一轮轮长出来（frame 300–399），对比边成细线。
 *   r55 的 contrasttex 是在 World 格心扇形三角上解、画进世界 XZ 图（只上顶面）。本模块补「在真实 3D 网格三角上解、
 *   画进 UV 图集、崖面也参与、可逐轮回放」：meshContrastGraph（三角邻接；折痕 > creaseDeg 或特征不同 = 对比边）+
 *   contrast-field.js 的 relaxContrastColors 逐轮迭代（同一套求解器，不另写）。
 * 纯数据，不 import three。
 */
import { buildCharts } from './uv-charts.js';
import { makeRng } from './noise.js';
import { initContrastColors, relaxContrastColors, measureContrastColors } from './contrast-field.js';
import { oklabToSrgb, hexToOklab } from './oklab.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const triNormalArea = (P, [a, b, c]) => { const n = cross(sub(P[b], P[a]), sub(P[c], P[a])), l = Math.hypot(...n) || 1; return { n: [n[0] / l, n[1] / l, n[2] / l], area: l / 2 }; };
const edgeKey = (a, b) => (a < b ? a + ':' + b : b + ':' + a);

/** 片子同构测试岛：底板（1 层，噪声圆）+ towers 根崖柱（3–6 层，团块）+ 一个拱洞（最高柱旁的一格挖空 1–2 层）。 */
export function clipIsland(world, { seed = 4, radius = null, towers = 3 } = {}) {
  const cells = world.cells, rng = makeRng(seed);
  let span = 0; for (const c of cells) span = Math.max(span, Math.hypot(c.cx, c.cz));
  const R = radius ?? span * 0.82, ph = rng() * 6.283;
  world.reset?.();
  const land = cells.filter((c) => { const a = Math.atan2(c.cz, c.cx), r = R * (0.86 + 0.1 * Math.sin(3 * a + ph) + 0.05 * Math.sin(5 * a - ph)); return Math.hypot(c.cx, c.cz) < r; });
  for (const c of land) world.fill(c, 1, { rock: true });
  const byDist = [...land].sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz)), used = new Set(), tops = [];
  for (let t = 0; t < towers; t++) {
    const ang = ph + t * 2.1 + rng() * 0.5, rr = R * (0.14 + 0.22 * rng());
    let seedCell = byDist[0], best = Infinity;
    for (const c of land) { const d = Math.hypot(c.cx - Math.cos(ang) * rr, c.cz - Math.sin(ang) * rr); if (d < best && !used.has(c.id)) { best = d; seedCell = c; } }
    const h = 3 + Math.floor(rng() * 4), size = 4 + Math.floor(rng() * 6), cl = [seedCell]; used.add(seedCell.id);
    for (let q = 0; q < cl.length && cl.length < size; q++) for (let e = 0; e < cl[q].n && cl.length < size; e++) { const nb = world.neighbor(cl[q], e); if (nb && land.includes(nb) && !used.has(nb.id) && rng() < 0.7) { used.add(nb.id); cl.push(nb); } }
    for (const c of cl) world.fill(c, h, { rock: true });
    tops.push({ h, cells: cl });
  }
  // 拱洞：最高柱的边缘格挖空 1..2 层（上面仍实心 → 悬挑/拱）
  const tall = tops.reduce((a, b) => (b.h > a.h ? b : a));
  const arch = tall.cells.find((c) => [...Array(c.n).keys()].some((e) => { const nb = world.neighbor(c, e); return nb && world.top(nb) === 1; }));
  if (arch && tall.h >= 4) for (let lv = 1; lv <= 2; lv++) world.setSolid(arch, lv, false, { rock: true });
  world.touch?.();
  return { land: land.length, towers: tops.map((t) => ({ h: t.h, cells: t.cells.length })), arch: arch ? arch.id : -1 };
}

/**
 * 朝上面合并分片 + 其余 buildCharts。返回与 buildCharts 相同结构 {charts, owner, maxAngle, topCharts}。
 * topAngle：朝上判据（度）；minTopTris：小于此三角数的朝上连通块不单独合并（交回 buildCharts）。
 */
export function topMergeCharts({ positions, triangles }, { maxAngle = 40, topAngle = 50, minTopTris = 1 } = {}) {
  if (!(topAngle > 0 && topAngle < 90)) throw new RangeError('topAngle must be in (0, 90)');
  const P = positions, T = triangles.length, cosTop = Math.cos(topAngle * Math.PI / 180);
  const info = triangles.map((t) => triNormalArea(P, t)), up = info.map((x) => x.n[1] >= cosTop);
  const et = new Map(); triangles.forEach((t, i) => { for (let k = 0; k < 3; k++) { const e = edgeKey(t[k], t[(k + 1) % 3]); if (!et.has(e)) et.set(e, []); et.get(e).push(i); } });
  // XZ 投影，与 buildCharts 对 n=(0,1,0) 的基一致：u = z, v = x（正面朝上的三角有向面积 > 0）
  const proj = (t) => t.map((i) => [P[i][2], P[i][0]]);
  const signed = (p) => (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
  const own = new Int32Array(T).fill(-1), groups = [];
  for (let s = 0; s < T; s++) {
    if (own[s] >= 0 || !up[s] || signed(proj(triangles[s])) <= 1e-14) continue;
    const q = [s]; own[s] = groups.length;
    for (let i = 0; i < q.length; i++) { const t = triangles[q[i]]; for (let k = 0; k < 3; k++) for (const o of et.get(edgeKey(t[k], t[(k + 1) % 3]))) if (own[o] < 0 && up[o] && signed(proj(triangles[o])) > 1e-14) { own[o] = groups.length; q.push(o); } }
    groups.push(q);
  }
  const topCharts = [], rest = new Set([...Array(T).keys()]);
  for (const g of groups) {
    if (g.length < minTopTris) continue;
    const uv = new Map(g.map((t) => [t, proj(triangles[t])]));
    if (selfOverlap(g.map((t) => uv.get(t)))) continue;         // 悬挑把同一连通朝上面叠在一起：退回原分片
    for (const t of g) rest.delete(t);
    topCharts.push({ id: 0, triangles: g, normal: [0, 1, 0], uv, area: g.reduce((s, t) => s + info[t].area, 0), top: true });
  }
  const restIds = [...rest], sub = buildCharts({ positions, triangles: restIds.map((i) => triangles[i]) }, { maxAngle }).charts;
  const remapped = sub.map((c) => ({ ...c, triangles: c.triangles.map((i) => restIds[i]), uv: new Map([...c.uv].map(([i, v]) => [restIds[i], v])), top: false }));
  const charts = [...topCharts, ...remapped]; charts.forEach((c, i) => { c.id = i; });
  const owner = new Int32Array(T); for (const c of charts) for (const t of c.triangles) owner[t] = c.id;
  return { charts, owner, maxAngle, topCharts: topCharts.length };
}

function selfOverlap(tris) {
  if (tris.length < 2) return false;
  const box = tris.map((t) => [Math.min(...t.map((p) => p[0])), Math.min(...t.map((p) => p[1])), Math.max(...t.map((p) => p[0])), Math.max(...t.map((p) => p[1]))]);
  const idx = [...tris.keys()].sort((a, b) => box[a][0] - box[b][0]);
  for (let ii = 0; ii < idx.length; ii++) { const i = idx[ii]; for (let jj = ii + 1; jj < idx.length; jj++) { const j = idx[jj]; if (box[j][0] >= box[i][2] - 1e-9) break; if (box[i][3] <= box[j][1] + 1e-9 || box[j][3] <= box[i][1] + 1e-9) continue; if (triOverlap(tris[i], tris[j])) return true; } }
  return false;
}
function triOverlap(A, B, eps = 1e-9) {
  for (const Q of [A, B]) for (let i = 0; i < 3; i++) {
    const p = Q[i], q = Q[(i + 1) % 3], nx = -(q[1] - p[1]), ny = q[0] - p[0], l = Math.hypot(nx, ny); if (!l) continue;
    const pa = A.map((v) => (v[0] * nx + v[1] * ny) / l), pb = B.map((v) => (v[0] * nx + v[1] * ny) / l);
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= eps) return false;
  }
  return true;
}

/** 片内洞数（Euler：连通片 V − E + F = 1 − holes；对边界上的捏点也稳健）。 */
export function chartHoles(chart, triangles) {
  const V = new Set(), E = new Set();
  for (const t of chart.triangles) { const tri = triangles[t]; for (let k = 0; k < 3; k++) { V.add(tri[k]); E.add(edgeKey(tri[k], tri[(k + 1) % 3])); } }
  return Math.max(0, 1 - (V.size - E.size + chart.triangles.length));
}

/** 径向排序质量：面积名次与离中心距离的 Spearman 相关（越负越"大的在中间"）。 */
export function radialSpearman(placements) {
  const n = placements.length; if (n < 3) return 0;
  const rank = (arr) => { const o = [...arr.keys()].sort((a, b) => arr[a] - arr[b]), r = new Array(n); o.forEach((i, k) => { r[i] = k; }); return r; };
  const ra = rank(placements.map((p) => p.area)), rd = rank(placements.map((p) => p.distance)), m = (n - 1) / 2;
  let num = 0, da = 0, dd = 0; for (let i = 0; i < n; i++) { num += (ra[i] - m) * (rd[i] - m); da += (ra[i] - m) ** 2; dd += (rd[i] - m) ** 2; }
  return num / Math.sqrt(da * dd);
}

/**
 * UV 页光栅化：size² 像素，每像素记 tri（-1 = 空）与重心 (l0,l1)。uvOf(t) → [[u,v]×3]（0..1）。
 * 像素中心在三角内（含边，容差 0.5px）才算；严格内部的覆盖优先。另返回 order（每个三角所在 placement 名次，供逐片动画）。
 */
export function rasterizeChartPage(triangles, uvOf, size = 512) {
  if (!Number.isInteger(size) || size < 8 || size > 4096) throw new RangeError('page size');
  const tri = new Int32Array(size * size).fill(-1), bary = new Float32Array(size * size * 2); let covered = 0;
  for (let t = 0; t < triangles.length; t++) {
    const uv = uvOf(t); if (!uv) throw new RangeError('triangle ' + t + ' has no UV');
    const px = uv.map(([u, v]) => [0.5 + u * (size - 1), 0.5 + v * (size - 1)]), [a, b, c] = px;
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-12) continue;
    const el = [Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]), Math.hypot(a[0] - b[0], a[1] - b[1])];
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - 1)), x1 = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0]) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - 1)), y1 = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1]) + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5, l0 = ((b[1] - c[1]) * (qx - c[0]) + (c[0] - b[0]) * (qy - c[1])) / den, l1 = ((c[1] - a[1]) * (qx - c[0]) + (a[0] - c[0]) * (qy - c[1])) / den, l2 = 1 - l0 - l1;
      const A2 = Math.abs(den); if (![l0, l1, l2].every((l, i) => l * A2 / el[i] > -0.5)) continue;
      const o = y * size + x, strict = l0 >= 0 && l1 >= 0 && l2 >= 0; if (tri[o] >= 0 && !strict) continue;
      if (tri[o] < 0) covered++;
      tri[o] = t; bary[o * 2] = Math.max(0, l0); bary[o * 2 + 1] = Math.max(0, l1);
    }
  }
  return { size, tri, bary, covered, fill: covered / (size * size) };
}

/** UV 空间棋盘格（片子 frame-0028：模型上的棋盘随各片 UV 方向转）。returns RGBA Uint8Array。 */
export function paintCheckerPage(page, { cells = 48, a = [96, 112, 168], b = [150, 162, 210], bg = [0, 0, 0, 0] } = {}) {
  const { size, tri } = page, out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = y * size + x, c = tri[o] < 0 ? bg : ((Math.floor(x / size * cells) + Math.floor(y / size * cells)) & 1 ? a : b);
    out[o * 4] = c[0]; out[o * 4 + 1] = c[1]; out[o * 4 + 2] = c[2]; out[o * 4 + 3] = tri[o] < 0 ? bg[3] : 255;
  }
  return out;
}

/**
 * 3D 网格三角反差图：三角 = 节点，共享边 = 边。对比边：两面折痕 > creaseDeg，或特征不同（顶面 / 崖面 / 底面按法线分）。
 * 特征底色：顶面按高度在 grass→sand→pink 之间（片子的绿→黄→粉渐变来源之一），崖面灰。输出 contrast-field.js 的 mesh 格式。
 */
export function meshContrastGraph({ positions, triangles }, { creaseDeg = 35, levelHeight = 0.5 } = {}) {
  const centroids = triangles.map((t) => [0, 1, 2].map((k) => (positions[t[0]][k] + positions[t[1]][k] + positions[t[2]][k]) / 3));
  const P = positions, info = triangles.map((t) => triNormalArea(P, t)), cosC = Math.cos(creaseDeg * Math.PI / 180);
  const keyOf = (i) => { const n = info[i].n; if (n[1] > 0.6) { const y = triangles[i].reduce((s, v) => s + P[v][1], 0) / 3; return 'top:' + Math.round(y / levelHeight); } return n[1] < -0.6 ? 'under' : 'cliff'; };
  const fid = new Map(), tris = triangles.map((t, i) => { const k = keyOf(i); if (!fid.has(k)) fid.set(k, fid.size); return { feature: fid.get(k), key: k }; });
  const et = new Map(); triangles.forEach((t, i) => { for (let k = 0; k < 3; k++) { const e = edgeKey(t[k], t[(k + 1) % 3]); if (!et.has(e)) et.set(e, []); et.get(e).push(i); } });
  const edges = [];
  for (const list of et.values()) if (list.length === 2) { const [i, j] = list, d = info[i].n[0] * info[j].n[0] + info[i].n[1] * info[j].n[1] + info[i].n[2] * info[j].n[2]; edges.push({ i, j, contrast: d < cosC || tris[i].feature !== tris[j].feature }); }
  return { tris, edges, features: [...fid.keys()], centroids };
}

/** 特征底色（OKLab）：顶面层越高越暖（绿 → 黄 → 粉），崖面灰，底面暗。 */
export function islandFeatureBases(features) {
  const G = hexToOklab('#9ccf7a'), Y = hexToOklab('#d9cf86'), K = hexToOklab('#e7a9a4'), C = hexToOklab('#bdb6ad'), U = hexToOklab('#6f6a66');
  const tops = features.filter((k) => k.startsWith('top:')).map((k) => +k.split(':')[1]), lo = Math.min(...tops, 0), hi = Math.max(...tops, 1);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return features.map((k) => { if (k === 'cliff') return [...C]; if (k === 'under') return [...U]; const t = (+k.split(':')[1] - lo) / Math.max(1, hi - lo); return t < 0.5 ? lerp(G, Y, t * 2) : lerp(Y, K, (t - 0.5) * 2); });
}

/** 逐轮反差模拟（可回放）：从随机开始，每次 step(n) 推进 n 轮。 */
export function contrastSimulation(graph, { seed = 3, random = true, centroids = null, smooth = 0.22, target = 0.17, pull = 0.24, push = 0.42, anchor = null } = {}) {
  if (anchor == null) anchor = centroids ? 0.002 : 0.02;   // 有低频场时锚定要弱，否则 220 轮后渐变被拉回特征均值
  const bases = islandFeatureBases(graph.features), colors = initContrastColors(graph, { seed, random, bases }), rnd = makeRng(seed + 101);
  // centroids 给出时，随机初值再叠一层低频场（按三角中心位置的几组正弦，OKLab a/b/L）：高频随机被迭代抹平，
  // 低频起伏留下来 → 同一连通区内的大尺度渐变（片子绿→黄→粉）。不给 centroids 就是纯随机开始（与 contrast-field 相同）。
  if (centroids) {
    const r2 = makeRng(seed + 7), waves = Array.from({ length: 3 }, () => [r2() * 6.283, 0.35 + r2() * 0.35, r2() * 6.283]);
    colors.forEach((c, i) => { const [x, y, z] = centroids[i]; waves.forEach(([a, f, p], k) => { const v = Math.sin((x * Math.cos(a) + z * Math.sin(a)) * f + p + y * 0.3); c[k] += v * smooth * (k === 0 ? 0.35 : 0.45); }); });
  }
  const before = measureContrastColors(graph, colors); let iter = 0;
  return {
    graph, colors, before, get iter() { return iter; },
    step(n = 1, total = 220) { for (let k = 0; k < n; k++) { const t = iter / total; relaxContrastColors(graph, colors, { target, pull, push, anchor, noise: t < 0.35 ? 0.012 * (1 - t / 0.35) : 0, rnd }); iter++; } return this; },
    measure() { return measureContrastColors(graph, colors); },
    rgb() { return colors.map((c) => oklabToSrgb(...c).map((v) => Math.min(1, Math.max(0, v)))); },
  };
}

/**
 * 反差色上 UV 页：每像素按所在三角的顶点色重心插值（顶点色 = 共享该顶点、且与本三角没有隔着对比边的同特征三角平均）——
 * 同特征区内是连续渐变（"表达连通性的渐变色"），对比边两侧不混 → 贴图上是硬边，着色器 fwidth 出像素细线。
 */
export function paintContrastPage(page, { triangles }, graph, rgb) {
  const T = triangles.length, vSum = new Map();
  for (let t = 0; t < T; t++) for (const v of triangles[t]) { const k = v + '|' + graph.tris[t].feature; const s = vSum.get(k) || [0, 0, 0, 0]; s[0] += rgb[t][0]; s[1] += rgb[t][1]; s[2] += rgb[t][2]; s[3]++; vSum.set(k, s); }
  const corner = triangles.map((tri, t) => tri.map((v) => { const s = vSum.get(v + '|' + graph.tris[t].feature); return [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; }));
  const { size, tri, bary } = page, out = new Uint8Array(size * size * 4);
  for (let o = 0; o < size * size; o++) {
    const t = tri[o]; if (t < 0) continue; const l0 = bary[o * 2], l1 = bary[o * 2 + 1], l2 = Math.max(0, 1 - l0 - l1), C = corner[t];
    for (let k = 0; k < 3; k++) out[o * 4 + k] = Math.round(255 * (l0 * C[0][k] + l1 * C[1][k] + l2 * C[2][k]));
    out[o * 4 + 3] = 255;
  }
  return out;
}

/** 空像素往外扩 n 圈（取已填邻居平均），避免双线性/mip 把背景色串进图块边。gutterAlpha：gutter 像素的 alpha（着色器可据此认出接缝外）。 */
export function dilatePage(rgba, size, n = 2, gutterAlpha = 254) {
  for (let g = 0; g < n; g++) {
    const add = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4; if (rgba[i + 3]) continue; let r = 0, gg = 0, b = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= size || Y >= size) continue; const j = (Y * size + X) * 4; if (rgba[j + 3] === 255 || (g > 0 && rgba[j + 3] === gutterAlpha)) { r += rgba[j]; gg += rgba[j + 1]; b += rgba[j + 2]; k++; } }
      if (k) add.push([i, r / k, gg / k, b / k]);
    }
    for (const [i, r, gg, b] of add) { rgba[i] = r; rgba[i + 1] = gg; rgba[i + 2] = b; rgba[i + 3] = gutterAlpha; }
  }
  return rgba;
}
