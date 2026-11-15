import assert from 'node:assert/strict';
import { buildQuadGrid, traceStraightReport } from '../src/core/grid.js';
import {
  loopPolygon, polygonArea, pointInPolygon, distanceToPolygon,
  loopRegion, findLoops, liftField, hullDepth, supportLegs, buildFlyingTown,
} from '../src/core/loop-lift.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

const grid = buildQuadGrid({ radius: 10, hexSize: 0.62, seed: 1337 });

// 1. 环本身：grid.js 判 loop；loopPolygon 首尾闭合、面积/包围盒有量
const loops = findLoops(grid);
// 半径 10 的四边形网格（种子 1337）实测只有 3 个不重复的完美环，且都能圈住格：
// 最大那个 119 格 / 面积 8.99，另两个各 28 格。
ok(loops.length === 3, `不重复完美环 3 个，实得 ${loops.length}`);
ok(loops.every((l) => l.cells.length >= 28), '每个环圈内至少 28 格');
ok(loops.every((l) => l.polygon.length >= 4), '每个环折线至少 4 点');
for (const l of loops) {
  const a = l.polygon[0], b = l.polygon[l.polygon.length - 1];
  ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6, '折线不收重复末点（闭合靠 wrap）');
  ok(polygonArea(l.polygon) > 0.1, '环围出正面积');
  for (const c of l.cells) ok(!pointInPolygon(l.polygon, 1e6, 1e6), '远点不在环内');
}
// 面积降序
for (let i = 1; i < loops.length; i++) ok(loops[i - 1].area >= loops[i].area, 'findLoops 按面积降序');

// 2. 环内格：格心在折线内，且格数 ≥1；- 外面的格不算进来
const big = loops[0];
const again = loopRegion(grid, big.report);
ok(again.closed && again.cells.length === big.cells.length, 'loopRegion 可重算同一批格');
ok(again.cells.every((c) => pointInPolygon(again.polygon, c.cx, c.cz)), '环内格格心都在折线内');
ok(again.bbox[0] < again.bbox[2] && again.bbox[1] < again.bbox[3], '包围盒有序');

// 3. 非闭环：boundary 出去的直线不算飞岛
const edgeCell = grid.cells.find((c) => c.edgeNeighbors.includes(-1));
let nonLoop = null;
for (let i = 0; i < edgeCell.n; i++) {
  const r = traceStraightReport(grid, edgeCell, i, 400);
  if (!r.closed) { nonLoop = r; break; }
}
ok(nonLoop && loopPolygon(nonLoop) === null, '非闭环不产出折线');
const noTown = buildFlyingTown(grid, { startCell: edgeCell, edge: edgeCell.edgeNeighbors.indexOf(-1) });
ok(noTown.closed === false && noTown.reason === 'boundary', 'buildFlyingTown 对边界直线回 closed:false');

// 4. 抬升场：圈心最高 = peak，船壳边沿最低 ≈ rim，且随离环距离单调不减
const field = liftField(big, { peak: 2.4, rim: 0.02 });
ok(field.heights.size === big.cells.length, '每格一个高度');
const hs = [...field.heights.values()];
ok(Math.abs(Math.max(...hs) - 2.4) < 1e-9, `最高点等于 peak（${Math.max(...hs)}）`);
ok(Math.abs(Math.min(...hs) - 0.02) <= 0.3, `最低点贴着 rim（${Math.min(...hs).toFixed(3)}）`);
const rows = big.cells.map((c) => ({ d: distanceToPolygon(big.polygon, c.cx, c.cz), h: field.heights.get(c.id) }));
rows.sort((a, b) => a.d - b.d);
for (let i = 1; i < rows.length; i++) ok(rows[i].h >= rows[i - 1].h - 1e-12, '离环越远抬得越高（单调）');
// 中心那格一定比靠边那格高
const mid = rows[Math.floor(rows.length / 2)];
ok(mid.h > rows[0].h + 0.2, `中位格明显高于边沿（${mid.h.toFixed(2)} vs ${rows[0].h.toFixed(2)}）`);
assert.throws(() => liftField(big, { peak: 0.5, rim: 0.6 }), RangeError); checks++;

// 5. 船壳厚度：随面积单调、封顶
const d1 = hullDepth(4), d2 = hullDepth(16), d3 = hullDepth(1e6);
ok(d1 < d2 && d2 <= d3 && d3 <= 1.2, `船壳厚度随面积增大并封顶（${d1.toFixed(2)}/${d2.toFixed(2)}/${d3.toFixed(2)}）`);
ok(hullDepth(0) >= 0.3, '零面积回最小厚度');

// 6. 支撑腿：全部竖直落到水面、等距、数量≈周长/间距
const legOut = supportLegs(big, { spacing: 1.1, depth: hullDepth(big.area) });
ok(legOut.legs.length >= 3, `至少 3 条腿（${legOut.legs.length}）`);
ok(legOut.legs.every((l) => l.top < 0 && l.bottom === 0), '腿从船壳底竖直落到水面 y=0');
ok(legOut.legs.every((l) => distanceToPolygon(big.polygon, l.x, l.z) < 1e-9), '落脚点都在环上');
const gaps = legOut.legs.map((l, i) => {
  const n = legOut.legs[(i + 1) % legOut.legs.length];
  return Math.hypot(n.x - l.x, n.z - l.z);
});
const gapMin = Math.min(...gaps), gapMax = Math.max(...gaps);
ok(gapMax - gapMin < 0.35 * gapMax, `弧长等距（${gapMin.toFixed(3)}..${gapMax.toFixed(3)}）`);
ok(Math.abs(legOut.perimeter / legOut.legs.length - legOut.spacing) < 1e-9, '间距 = 周长 / 腿数');
const sparse = supportLegs(big, { spacing: 4 });
ok(sparse.legs.length < legOut.legs.length, '加大间距腿变少');

// 7. 一体化：整座飞岛
const town = buildFlyingTown(grid, { startCell: big.report.cells[0], edge: 0, peak: 2.6 });
ok(town.closed === true, '从环上任意格出发都能起一座飞岛');
ok(town.stats.legs === town.legs.length && town.stats.loopCells === town.region.cells.length, 'stats 与实际几何一致');
ok(town.depth === hullDepth(town.region.area), '船壳厚度取自面积');
ok(town.stats.peak === 2.6, 'peak 透传到 stats');

console.log(`PASS ${checks} 飞岛几何断言 · 环 ${loops.length} 个 · 最大环 ${big.cells.length} 格 / 面积 ${big.area.toFixed(2)} / 腿 ${town.stats.legs} 条 / 船壳 ${town.depth.toFixed(2)}`);
