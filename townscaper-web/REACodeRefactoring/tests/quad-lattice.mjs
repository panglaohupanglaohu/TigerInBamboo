// 1120036868966502401 quad-regular 档：等距方格 + 每格边只一条线 + 无对角线 + 交点齐平。
// 原片 frame-0330（460×460 原尺寸 + 3× 裁切）实测：格距中位 22px、线宽 2px、格内无对角线、交点 2–3px 亮斑。
// 这里锁的是几何本身（纯 node），像素观感由 tests/quad-lattice-browser.cjs 在真机位下量。
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildSquareGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { buildRegularLattice, gridToLattice, latticeForGrid } = await import('../src/core/quad-lattice.js');

// 1. 本体：cols×rows 等距方格，边数按公式、交点全齐平、全部轴对齐
const lat = buildRegularLattice({ cols: 6, rows: 5, size: 2, origin: { x: -6, z: -5 } });
assert.equal(lat.stats.edges, 6 * 6 + 5 * 7, '边数 = cols*(rows+1)+rows*(cols+1)');
assert.equal(lat.stats.expectedEdges, lat.stats.edges, '与公式一致');
assert.equal(lat.stats.corners, 7 * 6, '交点数 = (cols+1)*(rows+1)');
assert.equal(lat.stats.diagonals, 0, '等距方格上没有对角线');
assert.equal(lat.stats.spacing.median, 2, '格距 = size');
assert.equal(lat.stats.spacing.spread, 0, '格距零离散');
// 度数只有三档：4 个角点(2)、边上 (cols-1)*2+(rows-1)*2 个(3)、内部 (cols-1)*(rows-1) 个(4)。
// 出现 5/6 度就说明有斜边或重复边，跟原片「每格边只一条线」不符。
assert.deepEqual(lat.stats.degree, { 2: 4, 3: 2 * ((6 - 1) + (5 - 1)), 4: (6 - 1) * (5 - 1) }, '度数分布只有角 2 / 边 3 / 内 4 三档');
assert.equal(lat.stats.interiorQuads, 20, '内部交点 5×4');
assert.equal(lat.stats.regular, true);
assert.equal(lat.positions.length, lat.stats.edges * 6, '每段 6 个 float');
assert.ok(lat.positions.every((v, i) => (i % 3 !== 1) || Math.abs(v - lat.stats.y) < 1e-9), '整张格子同高');
assert.ok(lat.cornerPositions.length === lat.stats.corners * 3);

// 2. 本仓的方格网格本来就是等距方格：直接转成格网线也必须规整
const square = buildSquareGrid({ radius: 4, cellSize: 1.5 });
const sqLat = gridToLattice(square);
assert.equal(sqLat.stats.diagonals, 0, '四边格网格无对角线');
assert.equal(sqLat.stats.regular, true, 'buildSquareGrid 是等距方格');
assert.equal(sqLat.stats.spacing.median, 1.5, '格距 = cellSize');
assert.equal(sqLat.stats.corners, square.verts.length, '每个顶点一个交点');

// 3. 混合网格（三角带）不能当方格用：斜边就是对角线
const mixed = buildMixedGrid({ radius: 8 });
assert.throws(() => gridToLattice(mixed), RangeError, '混合网格直接拒绝');

// 4. latticeForGrid：借用地形外接框与中位格距，铺一张规整对照格
const lat2 = latticeForGrid(mixed, { y: 0.02 });
assert.equal(lat2.stats.regular, true, '对照格本身规整');
assert.equal(lat2.stats.diagonals, 0);
const triCells = mixed.cells.filter((c) => c.n === 3).length;
assert.ok(triCells > 0, '本仓混合网格里有三角格（' + triCells + ' 个）→ 它们的斜边就是原片里不存在的对角线');
assert.equal(lat2.stats.regular, true, '对照格本身规整');
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const v of mixed.verts) { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); }
const latW = lat2.stats.cols * lat2.stats.spacing.median, latH = lat2.stats.rows * lat2.stats.spacing.median;
assert.ok(latW >= (maxX - minX), '横向盖住地形外接框');
assert.ok(latH >= (maxZ - minZ), '纵向盖住地形外接框');
assert.ok(lat2.stats.gridSpacing.median > 0 && lat2.stats.gridSpacing.median === lat2.stats.spacing.median, '对照格格距 = 网格边中位长');

// 5. 交点亮斑的坐标全部落在格子交点上：横向不同 x 的个数 = cols+1，相邻差 ≈ 格距
const step = lat2.stats.spacing.median;
const xs = [...new Set(lat2.cornerPositions.filter((_, i) => i % 3 === 0).map((x) => +x.toFixed(5)))].sort((a, b) => a - b);
assert.equal(xs.length, lat2.stats.cols + 1, '交点横向列数 = cols+1');
assert.ok(xs.slice(1).every((x, i) => Math.abs((x - xs[i]) - step) < 1e-3), '相邻交点横距 = 格距');

console.log('PASS quad-regular 等距方格格网 ' + JSON.stringify({
  unit: lat.stats, square: sqLat.stats, mixedLattice: { edges: lat2.stats.edges, corners: lat2.stats.corners, spacing: lat2.stats.gridSpacing },
}));
