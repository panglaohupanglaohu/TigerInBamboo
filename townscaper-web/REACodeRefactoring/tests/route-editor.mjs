/**
 * route-editor.mjs — 810157485638189056「路线采样编辑器」的纯逻辑验收。
 *
 * 片子（510 帧，俯视）里能读到的三件事，逐条对应的就是本文件的四个断言组：
 *   1. 带三轴方柄沿路线滑动 → 拖检查点后整条点串重采样（点数/总长跟着变，原数组不被改）
 *   2. 棕色块顶面一直有三角剖分对角线 → quadTriDiagonals 每块一条、长短对角线可切
 *   3. 点阵只增不减、铺满走过的地方 → accumulateTrail 按栅格去重累积
 */
import assert from 'node:assert/strict';
import {
  buildRoutePreview, buriedSamples, moveCheckpoint, accumulateTrail, quadTriDiagonals, editRouteStats,
} from '../src/core/route-preview.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

const SURFACE = (x) => (x < 4 ? 2 : x < 8 ? 1 : 0);
const CY = [[-0.6, -0.35, -0.6], [11.6, -0.35, -0.6], [11.6, -0.35, 10.6], [-0.6, -0.35, 10.6]];
ok(CY.length === 4, '地面底盘四角');

// —— 1. moveCheckpoint：不改入参、位移量正确、越界报错 ——
{
  const nodes = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const r = moveCheckpoint(nodes, 1, [0.5, -1, 2]);
  eq(r.index, 1, 'index 回传');
  ok(near(r.moved, Math.hypot(0.5, 1, 2)), 'moved = 位移长度 ' + r.moved);
  ok(near(r.nodes[1][0], 4.5) && near(r.nodes[1][1], 4) && near(r.nodes[1][2], 8), '检查点被搬到 4.5/4/8');
  ok(near(nodes[1][0], 4) && near(nodes[1][2], 6), '原节点串没被改（不可变）');
  ok(r.nodes[0] !== nodes[0], '返回的是新数组元素');
  assert.throws(() => moveCheckpoint(nodes, 3, [1, 0, 0]), /index out of range/);
  assert.throws(() => moveCheckpoint(nodes, -1, [1, 0, 0]), /index out of range/);
  assert.throws(() => moveCheckpoint(nodes, 0.5, [1, 0, 0]), /index out of range/);
  assert.throws(() => moveCheckpoint(nodes, 0, [NaN, 0, 0]), /finite XYZ/);
  assert.throws(() => moveCheckpoint('x', 0, [1, 0, 0]), /must be an array/);
}

// —— 2. accumulateTrail：同格去重、只增不减、超过 max 从最早丢 ——
{
  const a = accumulateTrail([], [[0, 0, 0], [0.5, 0, 0], [1, 0, 0]], { cell: 1 });
  eq(a.points.length, 2, 'cell=1 时 0 与 0.5 同格、1 另起一格 → 2 点');
  eq(a.added, 2, 'added 报新增');
  const b = accumulateTrail(a.points, [[0.5, 0, 0], [1, 0, 0], [2, 0, 0]], { cell: 1 });
  eq(b.added, 1, '重复格不重复加');
  eq(b.points.length, 3, '累积后 3 点（只增不减）');
  ok(b.points[0] !== a.points[0], '返回新点，不共享引用');
  const c = accumulateTrail([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [[3, 0, 0]], { cell: 1, max: 2 });
  eq(c.points.length, 2, 'max=2 截断到 2 点');
  eq(c.dropped, 2, '丢掉最早的两点');
  ok(near(c.points.at(-1)[0], 3), '最新的点留着');
  ok(a.points.length === 2, '原累积串不被改');
  assert.throws(() => accumulateTrail([], [[0, 0, 0]], { cell: 0 }), /cell must be > 0/);
  assert.throws(() => accumulateTrail([], [[0, 0, 0]], { max: 0 }), /max must be an integer/);
}

// —— 3. quadTriDiagonals：每块一条对角线，a/b/alt 三种斜向 ——
{
  const rects = [
    { x0: 0, x1: 4, z0: 0, z1: 2, y: 2 },
    { x0: 0, x1: 2, z0: 0, z1: 2, y: 2 },
  ];
  const s = quadTriDiagonals(rects, { mode: 'a' });
  eq(s.quads, 2, '两块');
  eq(s.segments.length, 2, '两条对角线');
  eq(s.a, 2, 'a 档全取 (x0,z0)-(x1,z1)');
  ok(s.segments.every(([u, v]) => near(u[1], 2) && near(v[1], 2)), '线段落在顶面高度 y=2');
  ok(near(s.segments[0][0][0], 0) && near(s.segments[0][1][0], 4), 'a 档端点横跨整块');
  const bb = quadTriDiagonals(rects, { mode: 'b' });
  eq(bb.b, 2, 'b 档全取另一向');
  ok(JSON.stringify(bb.segments[0]) !== JSON.stringify(s.segments[0]), 'b 档取另一条对角线');
  const alt = quadTriDiagonals(rects, { mode: 'alt' });
  eq(alt.a, 1); eq(alt.b, 1);
  ok(JSON.stringify(alt.segments[0]) !== JSON.stringify(alt.segments[1]), '相邻块斜向交替');
  assert.throws(() => quadTriDiagonals(rects, { mode: 'zig' }), /mode must be/);
  assert.throws(() => quadTriDiagonals([{ x0: 1, x1: 0, z0: 0, z1: 2, y: 0 }]), /x1>x0/);
  assert.throws(() => quadTriDiagonals([{ x0: 0, x1: 1, z0: 0, z1: 2, y: NaN }]), /must be finite/);
}

// —— 4. editRouteStats：拖拽回路读的就是这一组数 ——
{
  const nodes = [[1.4, 2, 1.6], [4.4, 2, 1.7], [6.4, 1, 1.9]];
  const cliffAt = (a, b) => (Math.abs(b[0] - a[0]) < 1e-9 ? 0.5 : Math.min(0.92, Math.max(0.08, (4 - a[0]) / (b[0] - a[0]))));
  const st = editRouteStats(nodes, { spacing: 0.12, radius: 0.3, at: cliffAt, surface: SURFACE });
  ok(st.count > 10, '点数随采出，' + st.count);
  ok(st.length > 3, '总长 ' + st.length.toFixed(3));
  eq(st.buried, 0, '落崖弧版一个点都不埋');
  eq(st.hops, 1, '这一段有 1 处跨层');
  const plain = editRouteStats(nodes, { spacing: 0.12 });
  eq(plain.buried, null, '没给 surface 就不数埋点');

  // 拖检查点 → 重采样：总长/点数跟着变，且不埋在岩体里
  const dragged = moveCheckpoint(nodes, 1, [0, 0, 2.4]);
  const st2 = editRouteStats(dragged.nodes, { spacing: 0.12, radius: 0.3, at: cliffAt, surface: SURFACE });
  ok(Math.abs(st2.length - st.length) > 0.2, '拖完总长变化 ' + st.length.toFixed(2) + ' → ' + st2.length.toFixed(2));
  eq(st2.buried, 0, '拖完仍然不埋点');

  // 累积：拖三次，点阵只增不减
  let trail = [];
  for (const d of [[0, 0, 1], [0.3, 0, 1], [0.6, 0, 1]]) {
    const s = editRouteStats(moveCheckpoint(nodes, 1, d).nodes, { spacing: 0.12, at: cliffAt });
    const acc = accumulateTrail(trail, s.points, { cell: 0.14, max: 400 });
    ok(acc.points.length >= trail.length, '累积串不缩短');
    trail = acc.points;
  }
  ok(trail.length > 20, '三次拖拽累积出 ' + trail.length + ' 点');

  // 埋点判据本身不恒 0：交给 tests/route-preview.mjs 的两级台阶对照（那边有正确的崖沿夹具）
  ok(typeof buriedSamples === 'function' && editRouteStats(nodes, { surface: SURFACE }).buried === 0,
    '拖拽回路版在两道崖的台地上不埋点');
}

console.log(`route-editor.mjs: ${checks} checks ALL PASS`);
