import assert from 'node:assert/strict';
import {
  throwArc,
  sampleTicks,
  trajectoryFan,
  defaultAngles,
  analyticRange,
  DEFAULT_GRAVITY,
} from '../src/core/trajectory-fan.js';

const near = (a, b, e) => Math.abs(a - b) <= e;

// 1. 参数校验
assert.throws(() => throwArc({ speed: 0, angleDeg: 45 }), RangeError);
assert.throws(() => throwArc({ speed: 10, angleDeg: 45, drag: -1 }), RangeError);
assert.throws(() => throwArc({ speed: 10, angleDeg: 45, gravity: 0 }), RangeError);
assert.throws(() => throwArc({ speed: 10, angleDeg: 45, dt: 0.5 }), RangeError);
assert.throws(() => throwArc({ speed: 10 }), RangeError, 'angleDeg 必填');

// 2. 无阻力：射程对得上解析解 v²sin2θ/g，顶点在中点
for (const [v, ang] of [[10, 45], [20, 30], [6.08, 45], [7.61, 60]]) {
  const arc = throwArc({ speed: v, angleDeg: ang });
  const exact = analyticRange(v, ang);
  assert.ok(near(arc.range, exact, exact * 0.004), `range ${arc.range} vs ${exact}`);
  assert.ok(near(arc.flightTime, (2 * v * Math.sin((ang * Math.PI) / 180)) / DEFAULT_GRAVITY, 0.01), 'flight ' + arc.flightTime);
  const apexExact = ((v * Math.sin((ang * Math.PI) / 180)) ** 2) / (2 * DEFAULT_GRAVITY);
  const apexMax = Math.max(...arc.points.map((p) => p[1]));
  assert.ok(near(apexMax, apexExact, Math.max(0.02, apexExact * 0.01)), `apex ${apexMax} vs ${apexExact}`);
  assert.equal(arc.points[0][0], 0);
  assert.equal(arc.points[arc.points.length - 1][1], 0, '落地点回到地面');
}

// 3. 45° 射程最大，往上往下都短（无阻力）
const ranges = [15, 30, 45, 60, 75].map((a) => throwArc({ speed: 10, angleDeg: a }).range);
for (let i = 1; i <= 2; i++) assert.ok(ranges[i] > ranges[i - 1], '上升段应单调增 ' + ranges);
for (let i = 3; i <= 4; i++) assert.ok(ranges[i] < ranges[i - 1], '下降段应单调减 ' + ranges);

// 4. 阻力：射程单调变短，且耗时变长或顶点变低
let prev = Infinity;
for (const drag of [0, 0.1, 0.3, 0.8, 1.6]) {
  const arc = throwArc({ speed: 10, angleDeg: 45, drag });
  assert.ok(arc.range < prev, `drag ${drag} 射程应递减：${arc.range} vs ${prev}`);
  prev = arc.range;
}
const noDrag = throwArc({ speed: 10, angleDeg: 45, drag: 0 });
const heavy = throwArc({ speed: 10, angleDeg: 45, drag: 1.6 });
assert.ok(heavy.range < noDrag.range * 0.75, '重阻力射程应显著变短');
assert.ok(heavy.apex < noDrag.apex, '重阻力顶点应更低');

// 5. 阻力下轨迹不对称：降到地面时的水平速度小于出手水平速度（等时间间距会变密）
{
  const arc = throwArc({ speed: 10, angleDeg: 30, drag: 0.6 });
  const p = arc.points;
  const k = Math.floor(p.length * 0.1);
  const headSpeed = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
  const tailSpeed = Math.hypot(p[p.length - 1][0] - p[p.length - 2][0], p[p.length - 1][1] - p[p.length - 2][1]);
  assert.ok(tailSpeed < headSpeed * 0.75, `末段速度应明显小于出手段 ${tailSpeed} vs ${headSpeed}`);
}

// 6. 白色划线：等弧长、切线是单位向量、方向朝前
{
  const arc = throwArc({ speed: 9, angleDeg: 50, drag: 0.4 });
  const ticks = sampleTicks(arc.points, { spacing: 0.5 });
  assert.ok(ticks.length > 10, 'ticks ' + ticks.length);
  const gaps = [];
  for (let i = 1; i < ticks.length; i++) gaps.push(Math.hypot(ticks[i].x - ticks[i - 1].x, ticks[i].y - ticks[i - 1].y));
  for (const g of gaps) assert.ok(near(g, 0.5, 0.06), '等弧长间距 ' + g);
  for (const t of ticks) {
    assert.ok(near(Math.hypot(t.dx, t.dy), 1, 1e-9), '单位切线');
    assert.ok(t.dx > 0, '切线朝发射方向');
  }
  // 弧线不够长时不出划线
  assert.deepEqual(sampleTicks([[0, 0], [0.2, 0]], { spacing: 0.5 }), []);
  assert.throws(() => sampleTicks([[0, 0], [1, 1]], { spacing: 0 }), RangeError);
}

// 7. 扇面：每条弧各自带划线，角度覆盖从俯角到接近竖直
{
  const fan = trajectoryFan({ speed: 7.61, drag: 0.83 });
  assert.equal(fan.arcs.length, defaultAngles().length);
  assert.ok(fan.arcs.length >= 20, 'arcs ' + fan.arcs.length);
  assert.ok(fan.tickCount > fan.arcs.length * 5, 'ticks ' + fan.tickCount);
  assert.ok(fan.maxRange > 0);
  const angles = fan.arcs.map((a) => a.angleDeg);
  assert.equal(Math.min(...angles), -20);
  assert.equal(Math.max(...angles), 90);
  // 竖直那条射程几乎为 0
  const up = fan.arcs.find((a) => a.angleDeg === 90);
  assert.ok(up.range < 1e-9, '90° 应落回原点 ' + up.range);
  // 带阻力时最大射程小于无阻力解析解
  assert.ok(fan.maxRange < analyticRange(7.61, 45), '阻力应让扇面变小');
}

// 8. 片子里两个 Drag 取值：0.83 → 1.26，扇面整体收缩
{
  const a = trajectoryFan({ speed: 7.61, drag: 0.83 });
  const b = trajectoryFan({ speed: 7.47, drag: 1.26 });
  assert.ok(b.maxRange < a.maxRange, `drag 变大射程应变短 ${b.maxRange} vs ${a.maxRange}`);
}

console.log('trajectory-fan PASS', {
  noDrag45: throwArc({ speed: 10, angleDeg: 45 }).range.toFixed(3),
  drag16: throwArc({ speed: 10, angleDeg: 45, drag: 1.6 }).range.toFixed(3),
  fan: trajectoryFan({ speed: 7.61, drag: 0.83 }).arcs.length,
  ticks: trajectoryFan({ speed: 7.61, drag: 0.83 }).tickCount,
});
