// 第 56 批 C03 · 816332161036984320「Avoid your ballistics homework by making a lookup table」
// 白线 = 规则点阵上每格点的出射方向（够不着只剩点）；第三参数 Gravity。
import assert from 'node:assert/strict';
import { solveLaunch, heightAtX, launchGrid, throwArc } from '../src/core/trajectory-fan.js';
// ① 无阻力：解出的角用解析式回代必须命中
for (const [x, y] of [[2, 0], [3, 1], [1, -2], [4, -1]]) {
  const s = solveLaunch({ speed: 8, drag: 0, gravity: 9.8, x, y });
  assert.ok(s, `(${x},${y}) 有解`);
  const th = s.angleDeg * Math.PI / 180, t = x / (8 * Math.cos(th)), yy = 8 * Math.sin(th) * t - 4.9 * t * t;
  assert.ok(Math.abs(yy - y) < 1e-6, '回代命中');
  // 低弧：比它小 1° 的角打不到那么高
  assert.ok(heightAtX({ speed: 8, gravity: 9.8, angleDeg: s.angleDeg - 1, x }) < y);
}
// ② 带阻力：回代 throwArc 的点串，穿过 x 时高度≈目标
const s2 = solveLaunch({ speed: 7.99, drag: 0.83, gravity: 9.8, x: 3, y: 0.5 });
const arc = throwArc({ speed: 7.99, drag: 0.83, gravity: 9.8, angleDeg: s2.angleDeg, groundY: -5 });
let yAt = null; for (let i = 1; i < arc.points.length; i++) { const [a, b] = [arc.points[i - 1], arc.points[i]]; if (a[0] <= 3 && b[0] >= 3) { yAt = a[1] + (b[1] - a[1]) * (3 - a[0]) / (b[0] - a[0]); break; } }
assert.ok(Math.abs(yAt - 0.5) < 0.01, `阻力弧回代 ${yAt}`);
// ③ 够不着：线性阻力渐近射程 v/k 之外无解；竖直方向
assert.equal(solveLaunch({ speed: 5, drag: 1, x: 6, y: 0 }), null);
assert.equal(solveLaunch({ speed: 5, drag: 0, x: 0, y: 1 }).angleDeg, 90);
assert.equal(solveLaunch({ speed: 5, drag: 0, x: 0, y: 25 / 19.6 + .01 }), null);
// ④ 查找表：右上角够不着、左下都有；Drag/Gravity 越大可达格越少；lookup 插值与直接解接近
const g0 = launchGrid({ speed: 7.99, drag: 0, gravity: 9.8, x1: 6.4, y0: -2.4, y1: 2.4, cell: .4 });
const g1 = launchGrid({ speed: 7.99, drag: .83, gravity: 9.8, x1: 6.4, y0: -2.4, y1: 2.4, cell: .4 });
const g2 = launchGrid({ speed: 7.99, drag: .83, gravity: 16, x1: 6.4, y0: -2.4, y1: 2.4, cell: .4 });
assert.ok(g0.solved > g1.solved && g1.solved > g2.solved && g2.unreachable > 0, JSON.stringify([g0.solved, g1.solved, g2.solved]));
const topRight = g1.nodes.find((n) => n.i === g1.nx - 1 && n.j === g1.ny - 1);
assert.equal(topRight.shot, null, '右上角够不着');
const direct = solveLaunch({ speed: 7.99, drag: .83, gravity: 9.8, x: 1.7, y: .3 }).angleDeg, table = g1.lookup(1.7, .3);
assert.ok(Math.abs(direct - table) < 2, `查表 ${table.toFixed(2)} ≈ 直接解 ${direct.toFixed(2)}`);
// 原点上方一列朝上、下方一列朝下（片中左列竖线）
assert.equal(g1.nodes.find((n) => n.i === 0 && n.y > .3).shot.angleDeg, 90);
console.log('PASS 弹道查找表点阵', JSON.stringify({ nodes: g1.nodes.length, solved: [g0.solved, g1.solved, g2.solved], direct: +direct.toFixed(2), table: +table.toFixed(2) }));
