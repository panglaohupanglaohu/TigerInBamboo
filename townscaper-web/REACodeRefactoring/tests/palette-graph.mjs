// 第 56 批 C11：1712088611934371876 节点式调色图（src/core/palette-graph.js）+ 1710031224838771027 色体网格（src/core/color-volume-grid.js）
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const PG = await import('../src/core/palette-graph.js');
const VG = await import('../src/core/color-volume-grid.js');
const { World } = await import('../src/core/world.js');
const { rasterCellColors } = await import('../src/world/ground-palette-map.js');
const { srgbToOklab } = await import('../src/core/oklab.js');
// from '../src/core/palette-graph.js';

// ---------- 调色图 ----------
const g = PG.defaultPaletteGraph({ div: 8 });
assert.equal(g.quads.length, 1); assert.equal(g.tris.length, 1); assert.equal(g.gradients.length, 1);
const F = PG.facets(g);
assert.equal(F.length, 8 * 8 * 2 + 4 * 4, '矩形 8×8×2 + 三角 4² 个离散面片');
// 角面片颜色接近角节点（离散：取质心色，不等于角色但很近）；矩形内部面片是平色
const q = g.quads[0], corner = PG.nodeById(g, q.nodes[0]).rgb, f0 = PG.quadFacetAt(g, q, 0.01, 0.01).rgb;
assert.ok(Math.hypot(...f0.map((v, i) => v - corner[i])) < 0.12, '左上面片≈左上角色');
// 同一面片内取样颜色相同（离散），相邻面片不同
const a1 = PG.quadFacetAt(g, q, 0.30, 0.30), a2 = PG.quadFacetAt(g, q, 0.31, 0.33), b1 = PG.quadFacetAt(g, q, 0.60, 0.30);
assert.equal(a1.facet, a2.facet); assert.deepEqual(a1.rgb, a2.rgb); assert.notDeepEqual(a1.rgb, b1.rgb);
// facets() 与 quadFacetAt 同规则：每个矩形面片的质心反查得到同一颜色
const toUV = (P, x, y) => { // 非扭曲矩形时 (x,y)→(u,v)
  const p0 = PG.nodeById(g, q.nodes[0]), p3 = PG.nodeById(g, q.nodes[3]); return [(x - p0.x) / (p3.x - p0.x), (y - p0.y) / (p3.y - p0.y)]; };
let mism = 0; for (const f of F.filter((k) => k.prim === q.id)) { const cx = (f.pts[0][0] + f.pts[1][0] + f.pts[2][0]) / 3, cy = (f.pts[0][1] + f.pts[1][1] + f.pts[2][1]) / 3, [u, v] = toUV(null, cx, cy); const r = PG.quadFacetAt(g, q, u, v).rgb; if (Math.hypot(...r.map((x, i) => x - f.rgb[i])) > 1e-9) mism++; }
assert.equal(mism, 0, 'facets 与 quadFacetAt 一致');
// 白收束三角：靠白节点的子三角接近白
const tri = g.tris[0], tip = PG.triFacetAt(g, tri, 0.02, 0.97).rgb; assert.ok(Math.min(...tip) > 0.8, '收束尖端接近白 ' + tip);
// 三种插值空间：中点不同；OkLab 中点明度≈两端平均，sRGB 中点更暗（经典「sRGB 混色发灰发暗」）
const A = [0.9, 0.2, 0.3], B = [0.2, 0.5, 0.9];
const mids = Object.fromEntries(PG.SPACES.map((s) => [s, PG.mixColor(A, B, 0.5, s)]));
assert.notDeepEqual(mids.srgb, mids.oklab); assert.notDeepEqual(mids.oklab, mids.okhsl);
const L = (c) => srgbToOklab(...c)[0], La = L(A), Lb = L(B);
assert.ok(Math.abs(L(mids.oklab) - (La + Lb) / 2) < 1e-6, 'OkLab 中点 L 线性'); assert.ok(L(mids.srgb) < L(mids.oklab), 'sRGB 中点更暗');
// 色带：端点=节点本色，steps 个；换空间后中间色变化
const grad = g.gradients[0], gc = PG.gradientColors(g, grad);
assert.equal(gc.length, 12); assert.ok(Math.hypot(...gc[0].map((v, i) => v - PG.nodeById(g, grad.nodes[0]).rgb[i])) < 3e-3);
PG.setSpace(g, grad.id, 'srgb'); const gs = PG.gradientColors(g, grad); assert.notDeepEqual(gs[5], gc[5]);
// 拖点：共享节点，拖矩形左下角 → 三角的那个顶点一起动
const c = q.nodes[2]; PG.moveNode(g, c, -0.4, 1.7); const triF = PG.facets(g).filter((f) => f.prim === tri.id); assert.ok(triF.some((f) => f.pts.some((p) => Math.abs(p[0] + 0.4) < 1e-9 && Math.abs(p[1] - 1.7) < 1e-9)), '三角共享节点跟着动');
// 新建（右键菜单三项的数据操作）+ 导出 / 导入往返
const n1 = PG.addNode(g, { x: 2, y: 0, rgb: [1, 0, 0] }), n2 = PG.addNode(g, { x: 2, y: 1, rgb: [0, 0, 1] }); PG.addGradient(g, n1, n2, { steps: 5, space: 'oklab' }); PG.addTriangle(g, [n1, n2, q.nodes[1]], { div: 3, space: 'okhsl' });
const json = PG.exportGraph(g), back = PG.importGraph(json);
assert.equal(PG.exportGraph(back), json, '导出→导入→导出 一致');
const strip = PG.paletteStrip(g); assert.equal(strip.width, strip.hex.length); assert.ok(strip.width > 100, '调色板条带 ' + strip.width + ' 色');
assert.throws(() => PG.importGraph('{"format":"x"}'), RangeError); assert.throws(() => PG.addQuad(g, [1, 1, 2, 3]), RangeError); assert.throws(() => PG.setNodeColor(g, n1, [2, 0, 0]), RangeError);

// ---------- 色体网格 ----------
const G = VG.defaultVolumeGrids();
assert.deepEqual(VG.VOLUME_FEATURES, Object.keys(G));
const grass = G.Grass; assert.equal(grass.cells.length, 5 * 3 * 3);
const blocks = VG.volumeBlocks(grass); assert.equal(blocks.length, 5); assert.equal(blocks[0].flat().filter(Boolean).length, 1, 'Grass 第 1 块只剩中格（片 0040）');
assert.equal(VG.volumeStrip(grass).length, 45 - 8 - 5, '折叠色带 = 启用格数');
// 点一下切换（0140→0240）
const t1 = VG.toggleCell(grass, VG.cellIndex(grass, 4, 2, 2)); assert.equal(VG.volumeStrip(t1).length, VG.volumeStrip(grass).length - 1);
assert.equal(VG.volumeStrip(VG.toggleCell(t1, VG.cellIndex(grass, 4, 2, 2))).length, VG.volumeStrip(grass).length);
// H 跨 0（0.60–1）与整圈（Flowers 7 步 0–1：首尾不同色相）
const wrap = VG.makeVolumeGrid({ h: [0.9, 0.1], steps: [3, 1, 1] }); assert.deepEqual(wrap.cells.map((k) => +k.hsl[0].toFixed(6)), [0.9, 0, 0.1]);
const fl = G.Flowers; const hs = [...new Set(fl.cells.map((k) => +k.hsl[0].toFixed(6)))]; assert.equal(hs.length, 7, '整圈 7 个不同色相');
// 拖 H 范围整组换色相；改步数后掩码重置
const moved = VG.setVolumeRange(grass, 'h', [0.6, 1]); assert.notDeepEqual(moved.cells[4].rgb, grass.cells[4].rgb); assert.deepEqual(moved.mask, grass.mask);
assert.ok(VG.setVolumeRange(grass, 's', [0.2, 0.7], 4).mask.every(Boolean));
// okhsl 与 hsl 两种空间都可用、结果不同；同 L 格 OkHsl 明度更一致
const okG = VG.makeVolumeGrid({ h: [0, 1], s: [0.6, 0.6], l: [0.6, 0.6], steps: [8, 1, 1], space: 'okhsl' }), hsG = VG.makeVolumeGrid({ h: [0, 1], s: [0.6, 0.6], l: [0.6, 0.6], steps: [8, 1, 1], space: 'hsl' });
const spread = (gr) => { const Ls = gr.cells.map((k) => srgbToOklab(...k.rgb)[0]); return Math.max(...Ls) - Math.min(...Ls); };
assert.ok(spread(okG) < 0.01 && spread(hsG) > 0.1, `同 L 明度差 okhsl ${spread(okG).toFixed(3)} / hsl ${spread(hsG).toFixed(3)}`);
// 最近启用格：直接命中禁用格时退到最近启用格
const hit = VG.nearestCell(grass, 0, 0, 0); assert.ok(hit.on && hit.ih === 0 && hit.is === 1 && hit.il === 1, '第 1 块角落 → 中格');
assert.equal(VG.nearestCell(VG.makeVolumeGrid({ steps: [1, 1, 1], mask: [false] }), .5, .5, .5), null);
assert.throws(() => VG.makeVolumeGrid({ steps: [0, 1, 1] }), RangeError); assert.throws(() => VG.makeVolumeGrid({ s: [0.8, 0.2] }), RangeError);

// ---------- 接 World：每格离散颜色 + XZ 栅格 ----------
const N = 12, cells = []; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const id = z * N + x; cells.push({ id, n: 4, cx: x, cz: z, pts: [{ x: x - .5, z: z - .5 }, { x: x + .5, z: z - .5 }, { x: x + .5, z: z + .5 }, { x: x - .5, z: z + .5 }], edgeNeighbors: [z > 0 ? id - N : -1, x < N - 1 ? id + 1 : -1, z < N - 1 ? id + N : -1, x > 0 ? id - 1 : -1] }); }
const w = new World({ cells });
for (const c of cells) { const r = Math.hypot(c.cx - 5.5, c.cz - 5.5); const h = r < 2 ? 6 : r < 4 ? 3 : r < 5.5 ? 1 : 0; for (let lv = 1; lv <= h; lv++) w.fill(c, lv, { rock: true }); }
const index = { cellAt: (x, z) => { const i = Math.round(x), k = Math.round(z); return i >= 0 && k >= 0 && i < N && k < N ? cells[k * N + i] : null; } };
const byVol = VG.colorWorldByVolumeGrids(w, G);
const landCells = cells.filter((c) => w.top(c)).length; assert.equal(Object.values(byVol.used).reduce((s, x) => s + x, 0), landCells);
for (const [f, list] of Object.entries(byVol.cellsUsed)) for (const i of list) assert.ok(G[f].cells[i].on, `${f} 只用启用格`);
const byGraph = PG.colorWorldByGraph(w, PG.defaultPaletteGraph({ div: 6 }));
assert.ok(byGraph.facetsUsed >= 4, '多个离散面片落到地上 ' + byGraph.facetsUsed);
const ras = rasterCellColors(w, index, { top: byGraph.rgb }, 64); assert.ok(ras.hits > 64 * 64 * 0.3, '栅格命中 ' + ras.hits);
const px = (x, z) => { const B = ras.bounds, i = Math.floor((x - B.minX) / B.span * 64), k = Math.floor((z - B.minZ) / B.span * 64), o = (k * 64 + i) * 4; return [...ras.top.slice(o, o + 4)]; };
const cc = cells[5 * N + 5]; assert.deepEqual(px(5, 5).slice(0, 3), [...byGraph.rgb.slice(cc.id * 3, cc.id * 3 + 3)].map((v) => Math.round(v * 255)));
assert.equal(px(0, 0)[3], 0, '海格无色');
console.log('PASS palette-graph + color-volume-grid', JSON.stringify({ facets: F.length, strip: strip.width, grassStrip: VG.volumeStrip(grass).length, used: byVol.used, graphFacetsOnWorld: byGraph.facetsUsed, rasterHits: ras.hits }));
