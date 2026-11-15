// 1490068909042642944：邻接图的极坐标同心环布局。
// 判据：环半径单调、分支各占连续圆弧、边不重复、连通分量与 BFS 深度正确、确定性、退化输入拒绝。
import assert from 'node:assert/strict';
import { adjacencyComponents, radialLayout } from '../src/core/graph-layout.js';

// 1. 环图：12 个节点连成圈，从 0 出发深度 0..6
const ringIds = Array.from({ length: 12 }, (_, i) => i);
const ringNb = ringIds.map((i) => [(i + 11) % 12, (i + 1) % 12]);
const ring = radialLayout({ ids: ringIds, neighbors: ringNb, root: 0 });
assert.equal(ring.nodes.length, 12);
assert.equal(ring.rings.length, 7, '12 环从 0 出发最深是 6，共 7 环');
assert.equal(ring.maxDepth, 6);
for (let d = 0; d < ring.rings.length; d++) {
  assert.equal(ring.rings[d].depth, d);
  if (d > 0) assert.ok(ring.rings[d].radius > ring.rings[d - 1].radius, `第 ${d} 环半径必须大于前一环`);
}
assert.equal(ring.nodes.filter((n) => n.depth === 6).length, 1, '最外环只有对跖那一个节点');
assert.equal(ring.edges.length, 12, '圈的 12 条边都要在（含同环边）');
assert.equal(ring.edgeKinds.adjacent, 12, '欧数圈上每条边都跨相邻两环');
assert.equal(ring.edgeKinds.same, 0, '欧数圈没有同环边');
assert.equal(ring.edgeKinds.long, 0, '环图没有跳环边');
// 奇数圈（13）才会在对跖处出现同环边：6-7 都在第 6 环
const oddIds = Array.from({ length: 13 }, (_, i) => i);
const odd = radialLayout({ ids: oddIds, neighbors: oddIds.map((i) => [(i + 12) % 13, (i + 1) % 13]), root: 0 });
assert.equal(odd.maxDepth, 6);
assert.equal(odd.edgeKinds.same, 1, '13 圈在对跖处有一条同环边');
assert.equal(odd.edgeKinds.adjacent, 12);
for (const n of ring.nodes) {
  assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), '坐标必须是有限值');
  assert.ok(Math.abs(Math.hypot(n.x, n.y) - ring.rings[n.depth].radius) < 1e-9, '节点必须正好落在自己那环的圆周上');
}

// 2. 链图：深度即序号，每环一个节点，半径按 ringGap 走
const chainIds = [0, 1, 2, 3, 4, 5];
const chainNb = [[1], [0, 2], [1, 3], [2, 4], [3, 5], [4]];
const chain = radialLayout({ ids: chainIds, neighbors: chainNb, root: 0, ringGap: 2 });
assert.deepEqual(chain.rings.map((r) => r.count), [1, 1, 1, 1, 1, 1]);
assert.deepEqual(chain.rings.map((r) => Math.round(r.radius)), [0, 2, 4, 6, 8, 10]);
assert.equal(chain.branches.length, 1, '链只有一个根分支');
assert.equal(chain.edges.length, 5);

// 3. 星图：根的所有孩子在同一环上，等角分布
const starIds = [0, 1, 2, 3, 4, 5, 6, 7];
const starNb = starIds.map((i) => (i === 0 ? [1, 2, 3, 4, 5, 6, 7] : [0]));
const star = radialLayout({ ids: starIds, neighbors: starNb, root: 0 });
assert.equal(star.rings.length, 2);
assert.equal(star.rings[1].count, 7);
assert.equal(star.branches.length, 7, '星图的 7 个孩子各是一个分支');
const gaps = star.rings[1].ids.map((id) => star.angleOf.get(id)).sort((a, b) => a - b)
  .map((a, i, arr) => (i ? a - arr[i - 1] : 0)).slice(1);
for (const gap of gaps) assert.ok(Math.abs(gap - (2 * Math.PI) / 7) < 1e-9, '星图外环必须等角');

// 4. minArc：节点多的环要被撑大，不能挤成一圈重叠
const wideIds = Array.from({ length: 200 }, (_, i) => i);
const wideNb = wideIds.map((i) => (i === 0 ? wideIds.slice(1) : [0]));
const wide = radialLayout({ ids: wideIds, neighbors: wideNb, root: 0, minArc: 0.1, ringGap: 1 });
assert.ok(wide.rings[1].radius >= (199 * 0.1) / (2 * Math.PI) - 1e-9, '外环半径必须容得下 199 个 minArc 弧长');

// 5. 多连通分量：只布 root 所在分量，别的进 unreachable
const splitIds = [0, 1, 2, 3, 10, 11];
const splitNb = [];
for (const id of splitIds) splitNb[id] = [];
splitNb[0] = [1]; splitNb[1] = [0, 2]; splitNb[2] = [1, 3]; splitNb[3] = [2];
splitNb[10] = [11]; splitNb[11] = [10];
const split = radialLayout({ ids: splitIds, neighbors: splitNb, root: 1 });
assert.equal(split.nodes.length, 4);
assert.deepEqual(split.unreachable, [10, 11]);
assert.deepEqual(split.components.sizes, [4, 2]);
const comps = adjacencyComponents(splitIds, splitNb);
assert.deepEqual(comps.components[0], [0, 1, 2, 3], '大分量在前，内部按 id 排序');
assert.equal(comps.componentOf.get(11), 1);

// 6. 确定性：同样输入两次结果逐字节一致
const a = JSON.stringify(radialLayout({ ids: ringIds, neighbors: ringNb, root: 3 }));
const b = JSON.stringify(radialLayout({ ids: ringIds, neighbors: ringNb, root: 3 }));
assert.equal(a, b);

// 7. 边不重复、无自环
for (const layout of [ring, chain, star, wide, split]) {
  const seen = new Set();
  for (const e of layout.edges) {
    assert.ok(e.a < e.b, '边要按 a<b 归一');
    assert.ok(!seen.has(`${e.a}|${e.b}`), '同一条边不能出现两次');
    seen.add(`${e.a}|${e.b}`);
  }
}

// 8. 退化输入必须拒绝
assert.throws(() => radialLayout({ ids: [0, 0], neighbors: [[0], [0]], root: 0 }), RangeError, '重复 id');
assert.throws(() => radialLayout({ ids: [0, 1], neighbors: [[1], [0]], root: 9 }), RangeError, 'root 不在 ids 里');
assert.throws(() => radialLayout({ ids: [0], neighbors: [1], root: 0 }), RangeError, 'neighbors 必须是数组');
assert.throws(() => radialLayout({ ids: [0], neighbors: [[]], root: 0, ringGap: 0 }), RangeError, 'ringGap 必须为正');
assert.throws(() => radialLayout({ ids: [0], neighbors: [[]], root: 0, minArc: 0 }), RangeError, 'minArc 必须为正');

console.log('PASS graph-layout：环图 7 环 / 链图等距 / 星图 7 分支 / minArc 撑环 / 分量拆分 / 确定性 / 退化拒绝');
