// r55 G5: engine/spritepack.js 缺口——UV 页接贴图烘焙 + 提高填充率。
// 三角栅格占用（footprint:'raster'）比逐三角包围盒填充率高、仍 0 重叠；UV 页放进共享 Atlas（放不下 grow），
// 逐像素烘焙：每个三角的重心像素归它自己、颜色 = shade(重心)、gutter 只在图块外一圈。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { weldSoup, buildCharts, radialChartPack, countChartOverlaps } = await import('../src/core/uv-charts.js');
const { bakeChartPage, checkerLitShade } = await import('../src/core/uv-bake.js');
const { Atlas } = await import('../src/core/atlas.js');
const grid = buildMixedGrid({ radius: 6, seed: 3 }); decorateCells(grid); const world = new World(grid); generateTerrain(world, { seed: 5 });
const w = new MeshWriter(); buildTerrain(w, world, { L: 0.5, shape: shapeTerrain(world) });
const mesh = weldSoup(w.pos), { charts, owner: chartOf } = buildCharts(mesh, { maxAngle: 40 });
// 1) 填充率：同一 cell 下 raster ≥ bbox；默认 cell .1 的 raster 比 r53 的 .2 bbox 翻倍；都 0 重叠
const old = radialChartPack(charts, { cell: .2, gap: 1 }), same = radialChartPack(charts, { cell: .2, gap: 1, footprint: 'raster' }), fine = radialChartPack(charts, { cell: .1, gap: 1, footprint: 'raster' });
for (const p of [old, same, fine]) assert.equal(countChartOverlaps(p), 0, '图块不重叠');
assert.ok(same.fill >= old.fill * .97, `raster 不比 bbox 差 ${same.fill} ${old.fill}`);
assert.ok(fine.fill > old.fill * 1.7, `填充率提高 ${old.fill.toFixed(3)} → ${fine.fill.toFixed(3)}`);
assert.equal(fine.placements[0].distance, 0, '最大一片仍在中心'); assert.equal(fine.placements[0].area, Math.max(...charts.map((c) => c.area)));
assert.deepEqual(radialChartPack(charts, { cell: .1, gap: 1, footprint: 'raster' }).placements, fine.placements, '确定性');
assert.throws(() => radialChartPack(charts, { footprint: 'x' }), RangeError);
// 2) 烘焙进共享 Atlas（先占 6 个精灵槽，256² 放不下 → grow）
const atlas = new Atlas(256, 256); for (let i = 0; i < 6; i++) atlas.place('sprite' + i, 64, 64, { rng: () => .5 });
const texels = Math.round(fine.bounds.side / .1 * 3), shade = checkerLitShade();
const bake = bakeChartPage(mesh, fine, { atlas, texels, gutter: 1, key: 'terrain-uv', shade });
assert.ok(bake.grown && bake.atlas.width >= 512, '放不下时 grow');
for (let i = 0; i < 6; i++) assert.ok(bake.atlas.slot('sprite' + i), '精灵槽在 grow 后仍在');
const s = bake.slot, W = bake.width, H = bake.height;
let own = 0, sameChart = 0, n = 0;
for (let t = 0; t < mesh.triangles.length; t++) {
  const u = bake.uvs.subarray(t * 6, t * 6 + 6), cx = (u[0] + u[2] + u[4]) / 3 * W, cy = (u[1] + u[3] + u[5]) / 3 * H;
  for (let k = 0; k < 3; k++) { const x = u[k * 2] * W, y = u[k * 2 + 1] * H; assert.ok(x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h, 'UV 在槽内'); }
  const ax = (u[2] - u[0]) * W, ay = (u[3] - u[1]) * H, bx = (u[4] - u[0]) * W, by = (u[5] - u[1]) * H; if (Math.abs(ax * by - ay * bx) / 2 < 6) continue; // 只查 ≥6 px² 的三角
  n++; const px = Math.floor(cx), py = Math.floor(cy), o = (py - s.y) * s.w + (px - s.x);
  if (bake.owner[o] === t) own++; if (bake.owner[o] >= 0 && chartOf[bake.owner[o]] === chartOf[t]) sameChart++;
  const P = mesh.triangles[t].map((i) => mesh.positions[i]), c3 = [0, 1, 2].map((d) => (P[0][d] + P[1][d] + P[2][d]) / 3);
  const nrm = (() => { const a = P[1].map((v, i) => v - P[0][i]), b = P[2].map((v, i) => v - P[0][i]), c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...c); return c.map((v) => v / l); })();
  const want = shade(c3, nrm), i4 = (py * W + px) * 4;
  assert.equal(bake.rgba[i4 + 3], 255, '重心像素被覆盖');
  if (bake.owner[o] === t) for (let k = 0; k < 3; k++) assert.ok(Math.abs(bake.rgba[i4 + k] - want[k]) < 90, '颜色来自 shade');
}
assert.equal(sameChart, n, '重心像素从不被别的图块覆写');
assert.ok(n > 300 && own / n > .95, `重心像素归本三角 ${own}/${n}（其余被同片相邻三角写，颜色连续）`);
// gutter 只在已覆盖像素旁边一圈；槽外不写
let outside = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = bake.rgba[(y * W + x) * 4 + 3]; if (a && (x < s.x || y < s.y || x >= s.x + s.w || y >= s.y + s.h)) outside++; }
assert.equal(outside, 0, '只写自己的槽');
assert.ok(bake.gutterFilled > 0 && bake.texelFill > .2, 'gutter + 像素覆盖率 ' + bake.texelFill);
// 页面接入
const html = readFileSync(join(root, 'uv-bake.html'), 'utf8');
assert.ok(html.includes("bakeChartPage(m, pack") && html.includes("footprint: $('#pack').value") && html.includes('MeshBasicMaterial({ map: tex })'));
console.log('PASS uv bake', { charts: charts.length, fill: { r53bbox: +old.fill.toFixed(3), raster02: +same.fill.toFixed(3), raster01: +fine.fill.toFixed(3) }, texels, texelFill: +bake.texelFill.toFixed(3), atlas: bake.atlas.width, own: `${own}/${n}`, sameChart });
