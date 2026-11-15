// 第 56 批 C06：1384958097542819845 拓扑直线（光标两侧拼接 / 方向选边 / 闭环）；游戏 UI 的纯函数部分。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildQuadGrid, traceStraightReport } = await import('../src/core/grid.js');
const { straightLineThrough, edgeToward } = await import('../src/ui/game-ui-c06.js');

const grid = buildQuadGrid({ radius: 10, hexSize: .62, seed: 1337 });
let lines = 0, loops = 0;
for (const cell of grid.cells.filter((c) => c.n === 4).slice(0, 300)) for (let e = 0; e < 4; e++) {
  const r = straightLineThrough(grid, cell, e);
  lines++;
  assert.ok(r.cells.includes(cell), '直线经过光标格');
  // 相邻两格必共边（拓扑直线连续）
  for (let i = 1; i < r.cells.length; i++) assert.ok(r.cells[i - 1].edgeNeighbors.includes(r.cells[i].id) || r.closed, '相邻格共边');
  // 正反两个方向得到同一条线（格集合相同）
  const back = straightLineThrough(grid, cell, (e + 2) % 4);
  assert.deepEqual(new Set(back.cells.map((c) => c.id)), new Set(r.cells.map((c) => c.id)), '正反方向同一条线');
  if (r.closed) { loops++; assert.equal(traceStraightReport(grid, cell, e).reason, 'loop'); }
  assert.ok(r.points.every((p) => p.every(Number.isFinite)));
}
assert.ok(loops > 0, '网格里能找到完美环');
// 方向选边：朝某条边中点的方向 → 选到那条边
const c = grid.cells.find((x) => x.n === 4 && x.edgeNeighbors.every((n) => n >= 0));
for (let e = 0; e < 4; e++) { const a = c.pts[e], b = c.pts[(e + 1) % 4]; assert.equal(edgeToward(c, [(a.x + b.x) / 2 - c.cx, (a.z + b.z) / 2 - c.cz]), e); }
console.log('PASS game-ui-c06', JSON.stringify({ lines, loops }));
