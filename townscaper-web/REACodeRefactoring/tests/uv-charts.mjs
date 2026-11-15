import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { weldSoup, buildCharts, radialChartPack, countChartOverlaps } = await import('../src/core/uv-charts.js');
const { Atlas } = await import('../src/core/atlas.js');
const out={};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 7, seed: 3 })], ['mixed', buildMixedGrid({ radius: 9, seed: 3 })]]) {
  decorateCells(grid); const world = new World(grid); generateTerrain(world, { seed: 5 });
  const w = new MeshWriter(); buildTerrain(w, world, { L: 0.5, shape: shapeTerrain(world) });
  const mesh = weldSoup(w.pos); assert(mesh.triangles.length > 500);
  const { charts, owner } = buildCharts(mesh, { maxAngle: 40 });
  // 1) 每个三角恰属一片；片内投影等距压缩 ∈ [cos40°, 1]、不翻面
  const seen = new Set(); for (const c of charts) for (const t of c.triangles) { assert(!seen.has(t)); seen.add(t); assert.equal(owner[t], c.id); }
  assert.equal(seen.size, mesh.triangles.length); assert(charts.length > 3 && charts.length < mesh.triangles.length / 2, 'charts group triangles');
  const pack = radialChartPack(charts, { cell: 0.2, gap: 1 });
  // 2) 不同图块在 UV 上两两不重叠（精确三角 SAT）；UV 全在 [0,1]²
  assert.equal(countChartOverlaps(pack), 0);
  let minScale = Infinity, maxScale = 0;
  for (let t = 0; t < mesh.triangles.length; t++) {
    const uv = pack.uv(t); assert(uv && uv.flat().every((x) => x >= -1e-12 && x <= 1 + 1e-12));
    const P = mesh.triangles[t].map((i) => mesh.positions[i]);
    const area3 = (() => { const u = P[1].map((v, i) => v - P[0][i]), v = P[2].map((x, i) => x - P[0][i]); return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; })();
    const area2 = Math.abs((uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[1][1] - uv[0][1]) * (uv[2][0] - uv[0][0])) / 2 / pack.texelScale ** 2;
    const r = area2 / area3; minScale = Math.min(minScale, r); maxScale = Math.max(maxScale, r);
  }
  assert(maxScale <= 1 + 1e-6 && minScale >= Math.cos(40 * Math.PI / 180) - 1e-6, 'orthographic chart scale ' + minScale);
  // 3) 径向大小排序：最大一片在中心（距离 0），面积大的离中心近（Spearman 负相关），中心附近一大块连贯
  const pl = pack.placements; assert.equal(pl[0].distance, 0); assert.equal(pl[0].area, Math.max(...charts.map((c) => c.area)));
  const rank = (arr) => { const o = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), r = new Array(arr.length); o.forEach(([, i], k) => (r[i] = k)); return r; };
  const ra = rank(pl.map((p) => p.area)), rd = rank(pl.map((p) => p.distance)), n = pl.length, mean = (n - 1) / 2;
  let num = 0, da = 0, dd = 0; for (let i = 0; i < n; i++) { num += (ra[i] - mean) * (rd[i] - mean); da += (ra[i] - mean) ** 2; dd += (rd[i] - mean) ** 2; }
  const spearman = num / Math.sqrt(da * dd); assert(spearman < -0.3, 'radial size sorting ' + spearman);
  const share = pl[0].area / charts.reduce((s, c) => s + c.area, 0);
  // 4) 确定性
  const again = radialChartPack(buildCharts(mesh, { maxAngle: 40 }).charts, { cell: 0.2, gap: 1 }); assert.deepEqual(again.placements, pack.placements);
  // 5) 交给共享 Atlas：这页 UV 作为一个分配（按 texel 密度换算像素），满了就 grow() 整体重排、键不丢
  const px = Math.ceil(pack.bounds.side * 16), atlas = new Atlas(64, 64);
  for (let i = 0; i < 6; i++) atlas.place('spr' + i, 24, 24, { rng: () => 0.5 });
  let page = atlas.place('uv-' + name, Math.min(px, 64), Math.min(px, 64), { rng: () => 0.5 });
  let grown = null; if (!page) { grown = atlas.grow(); assert(grown); page = grown.atlas.place('uv-' + name, Math.min(px, 128), Math.min(px, 128), { rng: () => 0.5 }); }
  if (grown) { for (let i = 0; i < 6; i++) { const o = atlas.slot('spr' + i); if (o) assert.equal(grown.moved.get(o), grown.atlas.slot('spr' + i)); } }
  out[name] = { triangles: mesh.triangles.length, charts: charts.length, spearman: +spearman.toFixed(3), centerShare: +share.toFixed(3), fill: +pack.fill.toFixed(3), scale: [+minScale.toFixed(3), +maxScale.toFixed(3)], grown: !!grown };
}
// Atlas.repack：全部重插、尺寸不变、键跟着走；装不下返回 null 且原图集不动
const a = new Atlas(32, 32); const keep = []; for (let i = 0; i < 8; i++) keep.push(a.place('k' + i, 8 + (i % 3) * 2, 8, { rng: () => 0 }));
const before = JSON.stringify(a.rects()); assert.equal(a.repack(8, 8), null); assert.equal(JSON.stringify(a.rects()), before);
const r = a.repack(); assert(r); for (let i = 0; i < 8; i++) if (keep[i]) { const n = r.atlas.slot('k' + i); assert(n && n.w === keep[i].w && n.h === keep[i].h); assert.equal(r.moved.get(keep[i]), n); }
console.log(out, 'PASS real terrain mesh → angle-bounded orthographic charts → radial size-sorted non-overlapping UV page; Atlas repack/grow with keys');
