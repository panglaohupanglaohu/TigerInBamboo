// contour-overlay 第二层：每个高度层沿格边的区域边界（1120036868966502401），真实生成地形上画得出、且段都在对应层高。
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
const { ContourOverlay } = await import('../src/world/contour-overlay.js');
const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 10 })], ['mixed', buildMixedGrid({ radius: 14 })]]) {
  const w = new World(decorateCells(grid)); generateTerrain(w, { seed: 7, rivers: 0, caves: 0 });
  const o = new ContourOverlay(w, { levelHeight: .5 }); o.setVisible(true);
  const pos = o.regions.geometry.getAttribute('position');
  assert.ok(pos.count > 100, '画出区域边界');
  const ys = new Set(); for (let i = 0; i < pos.count; i++) ys.add(+pos.getY(i).toFixed(3));
  assert.ok([...ys].every((y) => Math.abs(((y - .04) / .5) - Math.round((y - .04) / .5)) < 1e-6), '每段在整层高度');
  assert.ok(o.regionStats.length >= 3 && o.regionStats.every((s) => s.open === 0), '多层、都闭合');
  assert.ok(o.mesh.geometry.getAttribute('position').count > 0, '原等值线仍在');
  const v = w.version; o.refresh(); assert.equal(o.version, v, '版本不变不重算');
  // 第 76 轮：格角方块贴图在无 DOM 时必须降级成同图案 DataTexture（第 66 轮起这条测试就是死在这上面）
  assert.equal(o.cornerTextureSource, 'data', '纯 node 走 DataTexture 降级');
  const tex = o.cornerTex.image, S = tex.width;
  assert.equal(S, 16, '贴图 16×16');
  const px = (x, y) => Array.from(tex.data.slice((y * S + x) * 4, (y * S + x) * 4 + 3));
  assert.deepEqual(px(0, 0), [0xf2, 0xf7, 0xf4], '外圈亮边');
  assert.deepEqual(px(8, 8), [0x1b, 0x23, 0x20], '内芯深色');
  assert.deepEqual(px(2, 2), [0x1b, 0x23, 0x20], '内芯从 2px 起');
  assert.deepEqual(px(1, 1), [0xf2, 0xf7, 0xf4], '1px 亮边');
  // 第 49 轮：整格高亮——四边形 2 个三角、三角格 1 个，画在该格顶高
  const quad = w.cells.find((c) => c.n === 4 && w.top(c) >= 2), tri = w.cells.find((c) => c.n === 3);
  const sq = o.selectCell(quad); assert.equal(sq.triangles, 2); assert.ok(Math.abs(sq.y - (w.top(quad) * .5 + .045)) < 1e-9, '高亮画在格顶');
  if (tri) assert.equal(o.selectCell(tri).triangles, 1, '三角格按三角');
  assert.equal(o.selectCell(null), null); assert.equal(o.selected.visible, false, '取消高亮');
  out[name] = { levels: o.regionStats.length, vertices: pos.count, loops: o.regionStats.reduce((n, s) => n + s.loops, 0), branch: o.regionStats.reduce((n, s) => n + s.branch, 0) };
}
console.log('PASS 等值线叠层 + 沿格边的分层区域边界', JSON.stringify(out));
