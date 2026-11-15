// 1654401054828638214 / 1670064751181791233：分阶段生成的慢放执行器 + 真 Delaunay 增量三角化。
// 判据：三角网是真 Delaunay（零违例、无重叠边）、点是按顺序插进去的（可见边数只增不减）、
// 每个 tick 只推进 budget 毫秒（不管真实 dt 多大），阶段顺序不可跳、seek 能落点、时长表可换。
import assert from 'node:assert/strict';
import {
  STAGES, createSharedClock, islandPoints, delaunay, meshReport, liftHeights,
  stagePlan, StageRunner, revealedPoints, buildIsland,
} from '../src/terrain/pipeline-stages.js';

// 1. 点集：都在圆盘内，抖动能换一套，点数受控
const pts = islandPoints({ count: 120, radius: 10, seed: 7 });
assert.ok(pts.length > 40 && pts.length <= 120, `点数应受 count 约束，实际 ${pts.length}`);
for (const p of pts) assert.ok(Math.hypot(p.x, p.z) <= 10 + 1e-9, '点必须落在圆盘内');
const ptsB = islandPoints({ count: 120, radius: 10, seed: 8 });
assert.notEqual(JSON.stringify(pts.map((p) => [p.x.toFixed(3), p.z.toFixed(3)])),
  JSON.stringify(ptsB.map((p) => [p.x.toFixed(3), p.z.toFixed(3)])), '换种子必须换一套点位');
assert.deepEqual(islandPoints({ count: 120, radius: 10, seed: 7 }), pts, '同种子必须完全确定');

// 2. 三角化：真 Delaunay、流形、面积合理
const tris = delaunay(pts);
const empty = meshReport(pts.map((p) => ({ x: p.x, z: p.z })), []);
assert.equal(empty.tris, 0);
const rep = meshReport(pts, tris);
assert.ok(rep.tris > 100, `三角形太少：${rep.tris}`);
assert.equal(rep.violations, 0, 'Delaunay 零违例（外接圆内不得有别的点）');
assert.equal(rep.nonManifold, 0, '任何边最多被两个三角形共用');
assert.equal(rep.edges, rep.boundaryEdges + rep.interiorEdges, '边必须被分成边界边/内部边');
assert.ok(rep.boundaryEdges >= 8, `圆盘外圈必须有边界边，实际 ${rep.boundaryEdges}`);
assert.ok(rep.area > 200 && rep.area < Math.PI * 100 * 1.05, `总面积应接近圆盘面积，实际 ${rep.area.toFixed(1)}`);
// 欧拉：V - E + F = 1（带洞为 0，这里是单连通圆盘 → 1，边界点算在内）
assert.equal(pts.length - rep.edges + rep.tris, 1, '平面单连通三角化的欧拉示性数必须是 1');

// 3. 插入顺序：onInsert 计数只增，最后等于点数
const seen = [];
delaunay(pts, { onInsert: (i, triCount) => seen.push(triCount) });
assert.equal(seen.length, pts.length, '每个点都要插入一次');
for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1] - 1, '三角形的数量在插入过程中不能乱跳');

// 4. 高度：0..levels，随径向衰减，靠边为 0 的多
const h = liftHeights(pts, { seed: 7, levels: 6, radius: 10 });
assert.equal(h.length, pts.length);
for (const v of h) assert.ok(Number.isInteger(v) && v >= 0 && v <= 6, `高度必须在 0..6，实际 ${v}`);
const rim = pts.map((p, i) => [p, h[i]]).filter(([p]) => Math.hypot(p.x, p.z) > 9.2);
assert.ok(rim.every(([, v]) => v === 0), '圆盘最外圈必须是水面（否则片子里不会有一圈沙滩）');
assert.ok(h.filter((v) => v >= 4).length > 0, '中间必须有台地');

// 5. 时长表：顺序固定、累计正确、可覆盖
const plan = stagePlan({ durations: { triangulate: 1000 } });
assert.deepEqual(plan.map((s) => s.stage), STAGES);
assert.equal(plan[1].ms, 1000);
assert.equal(plan[1].start, plan[0].end);
for (let i = 1; i < plan.length; i++) assert.equal(plan[i].start, plan[i - 1].end, '各段必须首尾相接');

// 6. 慢放：真实 dt 再大，一个 tick 也只走 budget
const clock = createSharedClock();
const runner = new StageRunner({ plan, clock, budget: 16 });
const s0 = runner.state;
assert.equal(s0.stage, 'seed');
assert.equal(s0.elapsed, 0);
const s1 = runner.advance(1000);
assert.equal(s1.elapsed, 16, 'budget=16 时 advance(1000) 只能推进 16ms');
assert.equal(clock.get(), 16, '共享时钟必须被同步（job 里读到的是同一个数）');
assert.equal(s1.stage, 'seed', '16ms 还没出 seed 段');
assert.ok(s1.stageProgress > 0 && s1.stageProgress < 0.2);
runner.advance(1000);
assert.equal(runner.state.elapsed, 32);
// 小 dt 也照走
const fine = new StageRunner({ plan, budget: 16 });
fine.advance(5);
assert.equal(fine.state.elapsed, 5);
fine.advance(0);
assert.equal(fine.state.elapsed, 5, 'dt=0 不该推进');
fine.advance(-100);
assert.equal(fine.state.elapsed, 5, '负 dt 不该后退');

// 7. 阶段顺序：必须走完 STAGES 才 done，中途不能跳
const walk = new StageRunner({ plan, budget: 16 });
const order = [];
while (!walk.state.done && walk.ticks < 5000) {
  const st = walk.advance(16);
  if (order[order.length - 1] !== st.stage) order.push(st.stage);
}
assert.ok(walk.state.done, '预算给够必须能跑完');
assert.deepEqual(order, [...STAGES, 'done'], '阶段必须按 STAGES 顺序逐个出现');
assert.equal(walk.state.elapsed, walk.total);
assert.equal(walk.state.progress, 1);

// 8. seek：跳到某段末尾，已完成列表正确
const jump = new StageRunner({ plan });
const st = jump.seek('lift');
assert.equal(st.stage, 'clay', 'seek(lift) 之后应该正好站在 clay 开头');
assert.deepEqual(st.completed, ['seed', 'triangulate', 'lift']);
assert.throws(() => jump.seek('nope'), /unknown stage/);
assert.throws(() => new StageRunner({ budget: 0 }), /budget/);

// 9. 可见点数：三角化阶段单调增长，之后满额
const reveal = [];
const r2 = new StageRunner({ plan });
for (let t = 0; t <= 4000; t += 16) reveal.push(revealedPoints(r2.advance(16), 120));
for (let i = 1; i < reveal.length; i++) assert.ok(reveal[i] >= reveal[i - 1], '可见点数只能涨');
assert.equal(reveal[reveal.length - 1], 120);

// 10. 一步装配：形状统计自洽
const island = buildIsland({ count: 150, radius: 10, seed: 1337 });
assert.equal(island.points.length, island.heights.length);
assert.equal(island.report.violations, 0);
assert.equal(island.report.nonManifold, 0);
assert.equal(island.order.length, island.points.length);
assert.equal(new Set(island.order).size, island.points.length, 'reveal 顺序必须是排列');
assert.ok(island.report.boundaryEdges > 0);

console.log(`pipeline-stages PASS · tris ${rep.tris} · edges ${rep.edges} · boundary ${rep.boundaryEdges} · area ${rep.area.toFixed(1)} · 慢放 ${(plan[plan.length - 1].end)}ms / budget 16`);
