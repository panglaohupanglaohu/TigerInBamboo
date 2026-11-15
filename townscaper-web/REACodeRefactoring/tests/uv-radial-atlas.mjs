// 第 56 批 C11 · 1478114309263839244 径向大小排序 UV 图集 + 1482346496460828674 三角反差纹理画进图集（逐轮迭代）
// src/core/uv-radial-atlas.js：片子同构测试岛（共享 World + terrainmesh）→ 朝上面合并分片 → radialChartPack →
// 中心一大片（带崖柱脚印的洞）、大的在中间；UV 页光栅化 + 棋盘格；3D 网格三角反差图从随机开始迭代，对比边拉开、同类边趋同、低频渐变保留。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildMixedGrid, buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { weldSoup, buildCharts, radialChartPack, countChartOverlaps } = await import('../src/core/uv-charts.js');
const U = await import('../src/core/uv-radial-atlas.js');

const island = (grid, seed = 4) => { decorateCells(grid); const w = new World(grid); const info = U.clipIsland(w, { seed }); const mw = new MeshWriter(); buildTerrain(mw, w, { L: 0.5, shape: shapeTerrain(w) }); return { world: w, info, mesh: weldSoup(mw.pos) }; };
const { world, info, mesh } = island(buildMixedGrid({ radius: 7, seed: 3 }));
// ① 片子同构岛：底板 1 层 + 3 根 3–6 层崖柱 + 拱洞（柱下 1–2 层空、上面实心）
assert.equal(info.towers.length, 3); assert.ok(info.towers.every((t) => t.h >= 3 && t.h <= 6));
const arch = world.cells[info.arch]; assert.ok(arch && !world.isSolid(arch, 1) && !world.isSolid(arch, 2) && world.isSolid(arch, 3), '拱洞：下空上实');
assert.deepEqual(island(buildMixedGrid({ radius: 7, seed: 3 })).info, info, '确定性');

// ② 朝上面合并分片：所有朝上面都在 top 片里、竖直投影无翻面；其余三角各归一片；中心片 = 底板，带洞
const ch = U.topMergeCharts(mesh, { maxAngle: 40 });
const seen = new Int32Array(mesh.triangles.length); for (const c of ch.charts) for (const t of c.triangles) seen[t]++;
assert.ok(seen.every((n) => n === 1), '每个三角恰好一片');
for (const c of ch.charts.filter((c) => c.top)) for (const t of c.triangles) { const p = c.uv.get(t); assert.ok((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]) > 0, '朝上片竖直投影不翻面'); }
const pack = radialChartPack(ch.charts, { cell: 0.1, gap: 1, footprint: 'raster' });
assert.equal(countChartOverlaps(pack), 0, '0 重叠');
const total = ch.charts.reduce((s, c) => s + c.area, 0), center = ch.charts[pack.placements[0].chart];
assert.equal(pack.placements[0].distance, 0, '最大一片在正中');
assert.ok(center.top && center.area / total > 0.25, `中心片是底板且占 ${(center.area / total * 100).toFixed(1)}%（>25%；r55 实景 generateTerrain 岛只有 4%）`);
assert.ok(U.chartHoles(center, mesh.triangles) >= 1, '中心片带洞（崖柱脚印）');
const rho = U.radialSpearman(pack.placements); assert.ok(rho < -0.5, `径向大小排序：面积名次与离心距离负相关 ${rho.toFixed(2)}`);
// 与 r55 buildCharts 同一网格比：朝上合并不让中心片变小
const old = buildCharts(mesh, { maxAngle: 40 }).charts; assert.ok(center.area >= Math.max(...old.map((c) => c.area)) - 1e-9);
// 实景 generateTerrain 岛（台阶多）也能跑：0 重叠，最大片在中心
{ const g = buildQuadGrid({ radius: 6, seed: 3 }); decorateCells(g); const w = new World(g); generateTerrain(w, { seed: 5 }); const mw = new MeshWriter(); buildTerrain(mw, w, { L: 0.5, shape: shapeTerrain(w) }); const m = weldSoup(mw.pos);
  const c2 = U.topMergeCharts(m), p2 = radialChartPack(c2.charts, { cell: 0.1, gap: 1, footprint: 'raster' }); assert.equal(countChartOverlaps(p2), 0); assert.equal(p2.placements[0].distance, 0); }
assert.throws(() => U.topMergeCharts(mesh, { topAngle: 95 }), RangeError);

// ③ UV 页光栅化 + 棋盘格 + gutter
const page = U.rasterizeChartPage(mesh.triangles, pack.uv, 256);
assert.ok(page.fill > 0.25 && page.fill < 0.9, `页面覆盖 ${page.fill.toFixed(3)}`);
const owners = new Set(); for (const t of page.tri) if (t >= 0) owners.add(t); assert.ok(owners.size > mesh.triangles.length * 0.6, '大多数三角都有像素');
const chk = U.paintCheckerPage(page, { cells: 16 }); let a = 0, b = 0; for (let o = 0; o < 256 * 256; o++) if (page.tri[o] >= 0) (chk[o * 4] === 96 ? a++ : b++); assert.ok(a > 1000 && b > 1000, '棋盘两色都有');
const before = chk.filter((_, i) => i % 4 === 3 && _ === 0).length; U.dilatePage(chk, 256, 2, 128); const after = chk.filter((_, i) => i % 4 === 3 && _ === 0).length;
assert.ok(after < before && chk.some((v, i) => i % 4 === 3 && v === 128), 'gutter 外扩 2 圈、alpha 128 标记');
assert.throws(() => U.rasterizeChartPage(mesh.triangles, pack.uv, 3), RangeError);

// ④ 三角反差：随机开始 → 迭代；对比边 ΔE 保持大、同类边 ΔE 降到很小；低频渐变保留（同一顶面内仍有大尺度色差）
const graph = U.meshContrastGraph(mesh, { creaseDeg: 35 });
assert.equal(graph.tris.length, mesh.triangles.length); assert.ok(graph.edges.some((e) => e.contrast) && graph.edges.some((e) => !e.contrast));
assert.ok(graph.features.includes('cliff') && graph.features.filter((k) => k.startsWith('top:')).length >= 3, '特征：崖面 + 多层顶面');
const sim = U.contrastSimulation(graph, { seed: 3, random: true, centroids: graph.centroids });
const m0 = sim.measure(); sim.step(60); const m60 = sim.measure(); sim.step(160); const m220 = sim.measure();
assert.equal(sim.iter, 220);
assert.ok(m0.sameDE > 20, `开始是随机的（同类边 ΔE ${m0.sameDE.toFixed(1)}）`);
assert.ok(m60.sameDE < m0.sameDE * 0.1 && m220.sameDE <= m60.sameDE + 1e-9 && m220.sameDE < 1, `同类边趋同 ${m0.sameDE.toFixed(1)} → ${m60.sameDE.toFixed(2)} → ${m220.sameDE.toFixed(2)}`);
assert.ok(m220.minContrastDE > 10 && m220.contrastDE > m220.sameDE * 20, `对比边保持不同（最小 ΔE ${m220.minContrastDE.toFixed(1)}）`);
// 渐变：底板（top:1 最大一层）内最远两端的色差 >> 同类相邻边色差
const base = graph.features.indexOf('top:1'), rgb = sim.rgb(), ids = graph.tris.map((t, i) => t.feature === base ? i : -1).filter((i) => i >= 0);
let span = 0; for (const i of ids) for (const j of ids) span = Math.max(span, Math.hypot(...[0, 1, 2].map((k) => rgb[i][k] - rgb[j][k])));
assert.ok(span > 0.08, `底板内保留大尺度渐变（最大色差 ${span.toFixed(3)} sRGB）`);
// 不给 centroids（纯随机 + 默认锚定）就收敛成一片均色 —— 渐变是低频初值 + 弱锚定的结果
const flat = U.contrastSimulation(graph, { seed: 3, random: true }).step(220), frgb = flat.rgb(); let fspan = 0; for (const i of ids) for (const j of ids) fspan = Math.max(fspan, Math.hypot(...[0, 1, 2].map((k) => frgb[i][k] - frgb[j][k])));
assert.ok(fspan < span * 0.5, `对照：无低频场时底板几乎均色（${fspan.toFixed(3)}）`);
// ⑤ 反差色上 UV 页：对比边两侧硬边、同类区内插值连续
const crgb = U.paintContrastPage(page, mesh, graph, rgb);
let painted = 0; for (let o = 0; o < 256 * 256; o++) if (page.tri[o] >= 0) { assert.equal(crgb[o * 4 + 3], 255); painted++; } assert.equal(painted, page.covered);
console.log('PASS uv-radial-atlas', JSON.stringify({ tris: mesh.triangles.length, charts: ch.charts.length, center: +(center.area / total).toFixed(3), holes: U.chartHoles(center, mesh.triangles), spearman: +rho.toFixed(2), fill: +pack.fill.toFixed(3), sameDE: [+m0.sameDE.toFixed(1), +m60.sameDE.toFixed(2), +m220.sameDE.toFixed(2)], minContrastDE: +m220.minContrastDE.toFixed(1), gradient: +span.toFixed(3), flat: +fspan.toFixed(3) }));
