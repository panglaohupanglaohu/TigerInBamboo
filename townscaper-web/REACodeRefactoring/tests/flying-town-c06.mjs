// 第 56 批 C06：1313837640366596096 完美环飞岛——环内整列（地形+建筑）一起抬升。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { World } = await import('../src/core/world.js');
const { findLoops } = await import('../src/core/loop-lift.js');
const { liftColumns, attachFlyingTown } = await import('../src/world/flying-town-c06.js');

const grid = buildQuadGrid({ radius: 10, hexSize: .62, seed: 1337 });
const loops = findLoops(grid);
assert.ok(loops.length >= 1);
const ids = loops[0].cells.map((c) => c.id);
const w = new World(grid);
// 环内：一半格有 2 层地形 + 1 层建筑，一半空（水面）
ids.forEach((id, i) => { const c = grid.cells[id]; if (i % 2) { w.setSolid(c, 1, true, { rock: true }); w.setSolid(c, 2, true, { rock: true }); w.setSolid(c, 3, true); } });
const outside = grid.cells.find((c) => !ids.includes(c.id)); w.setSolid(outside, 1, true, { rock: true });
const before = ids.map((id) => w.solid[id]);
const moved = liftColumns(w, ids, 3);
ids.forEach((id, i) => {
  const c = grid.cells[id];
  for (let l = 1; l <= 3; l++) assert.ok(!w.isSolid(c, l), '下面三层腾空');
  if (i % 2) { assert.ok(w.isRock(c, 4) && w.isRock(c, 5) && w.isBuilt(c, 6), '地形 + 建筑整列上移、岩石/建筑属性保留'); assert.equal(w.solid[id], before[i] << 3); }
  else assert.ok(w.isRock(c, 4), '原来的水面格补一块船壳板');
});
assert.ok(w.isSolid(outside, 1) && !w.isSolid(outside, 4), '环外不动');
assert.equal(moved, ids.length + ids.filter((_, i) => i % 2).length * 2);
assert.throws(() => liftColumns(w, ids, 12), /MAX_LEVEL/);
// attach：最小的 View 替身
const view = { scene: new THREE.Scene(), levelHeight: .5, changed() { this.n = (this.n || 0) + 1; } };
const w2 = new World(grid);
const f = attachFlyingTown(view, w2, grid, { lift: 3 });
assert.ok(f.ok && f.cells === ids.length && f.legs >= 3 && view.n === 1);
const g = view.scene.getObjectByName('flying-town-c06'); assert.ok(g && g.children.length >= f.legs * 3);
f.dispose(); assert.ok(!view.scene.getObjectByName('flying-town-c06'));
console.log('PASS flying-town-c06', JSON.stringify({ loops: loops.length, cells: ids.length, legs: f.legs, moved }));
