import assert from 'node:assert/strict';
import { hullRing, ringArea, ringPerimeter, hubOf, fanTriangles, cornerTick, footprint } from '../src/badnorth/squad-footprint.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// 1. 3×3 的占位格：外轮廓只剩四个角，面积 = 2×2
const grid = [];
for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) grid.push([x, z]);
const ring = hullRing(grid);
assert.equal(ring.length, 4);
assert.ok(near(ringArea(ring), 4), 'area ' + ringArea(ring));
assert.ok(near(ringPerimeter(ring), 8), 'perimeter ' + ringPerimeter(ring));

// 2. 环是逆时针的（叉积全正），这样扇形三角面朝向一致
for (let i = 0; i < ring.length; i++) {
  const a = ring[i], b = ring[(i + 1) % ring.length], c = ring[(i + 2) % ring.length];
  assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) >= -1e-9, '第 ' + i + ' 个角不是逆时针');
}

// 3. 圆心 = 众数人的平均位置（片子里辐条就是从众数人中间那一点发出去的）
assert.deepEqual(hubOf([[0, 0], [2, 0], [1, 3]]), [1, 1]);

// 4. 扇形：角数 = 三角面数，每个三角面都含圆心
const hub = hubOf(grid);
const tris = fanTriangles(ring, hub);
assert.equal(tris.length, 4);
for (const [c, a, b] of tris) {
  const area = ((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0])) / 2;
  assert.ok(area > 0, '三角面面积必须为正 ' + area);
}
const sum = tris.reduce((s, [c, a, b]) => s + ((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0])) / 2, 0);
assert.ok(near(sum, 4), '扇形应当铺满轮廓 ' + sum);

// 5. L 形占位（缺一格）：凸包把缺口切掉 = 4 个角，面积 3（远小于包围盒 4）
//    这是已知取舍：片子里的队伍都是方块占位，看不出凹口；凹形占位会丢缺口，写进缺口清单。
const L = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
const lr = hullRing(L);
assert.equal(lr.length, 4, 'L 形凸包 ' + JSON.stringify(lr));
assert.ok(near(ringArea(lr), 3), 'L 形凸包面积 ' + ringArea(lr));
assert.ok(ringArea(lr) < 4, '缺口被切掉后面积应小于包围盒 4');

// 6. 重复点 / 近重复点要去掉，不能把同一个角数两次
const dup = hullRing([[0, 0], [0, 0], [0, 1e-9], [2, 0], [2, 2], [0, 2]]);
assert.equal(dup.length, 4);

// 7. 退化：一条直线 / 单个兵，面积 0 且标 degenerate，不许抛
const line = footprint([[0, 0], [1, 0], [2, 0]]);
assert.equal(line.degenerate, true);
assert.equal(line.area, 0);
assert.deepEqual(line.tris, []);
const one = footprint([[3, 4]]);
assert.equal(one.ring.length, 1);
assert.deepEqual(one.hub, [3, 4]);

// 8. 角上的小方块：四个角、边长 2×size、中心在被标记的角上
const tick = cornerTick([1, 2], 0.1);
assert.equal(tick.length, 4);
assert.ok(near(tick[0][0], 0.9) && near(tick[2][0], 1.1));
assert.ok(near(tick[0][1], 1.9) && near(tick[2][1], 2.1));
const fp = footprint(grid, { tick: 0.07 });
assert.equal(fp.ticks.length, fp.ring.length, '每个角一个 tick');
assert.equal(fp.spokes.length, 4);
assert.equal(fp.tris.length, 4);
assert.equal(fp.degenerate, false);

// 9. 非法输入
assert.throws(() => hullRing([[0, NaN]]), RangeError);
assert.throws(() => hullRing([['a', 1]]), RangeError);
assert.throws(() => hubOf([]), RangeError);

console.log('PASS squad-footprint：凸包逆时针、L 形轮廓、面积/周长、重复点去重、扇形铺满且面积为正、退化与非法输入');
