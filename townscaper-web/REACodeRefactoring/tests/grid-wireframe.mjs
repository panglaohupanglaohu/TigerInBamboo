// 1459169210752507904：不规则四边格 + 三角过渡带的线框诊断。
// 判据：每条边只归类一次、面型计数与实际格子一致、流形（≤2 面共边）、
//       三角带覆盖全部 seam 边且首尾相接、纯方格网没有 seam、确定性、退化输入拒绝。
import assert from 'node:assert/strict';
import { buildMixedGrid, buildSquareGrid } from '../src/core/grid.js';
import { classifyWireframe, seamBands } from '../src/core/grid-wireframe.js';

// 1. 混合网：四边格为主，三角残余留下过渡带
const grid = buildMixedGrid({ radius: 10, seed: 2024, mergeRate: 0.85, relaxPasses: 40 });
const wire = classifyWireframe(grid);
assert.equal(wire.faces.total, grid.cellCount);
assert.equal(wire.faces.quads + wire.faces.tris, grid.cellCount, '只有四边和三角两种面');
assert.ok(wire.faces.quads > wire.faces.tris, '合并率 0.85 时四边格必须多于三角');
assert.ok(wire.faces.tris > 0, '合并率不是 1，必须还剩三角');
assert.ok(wire.manifold, '每条边最多两个面共用');
assert.equal(wire.counts.seam, wire.edges.filter((e) => e.kind === 'seam').length);
assert.equal(
  wire.counts.quad + wire.counts.tri + wire.counts.seam + wire.counts.rim + wire.counts.other,
  wire.edges.length, '四类边之和必须等于边总数（每条边只归类一次）',
);
assert.equal(wire.counts.other, 0);
assert.ok(wire.counts.rim > 0, '岛缘必须有边');
assert.ok(wire.counts.seam > 0, '四边↔三角之间必须有过渡边');

// 2. 边与格子的一致性：所有面的角数之和 = 每条边的出现次数之和
const cornerSum = grid.cells.reduce((s, c) => s + c.n, 0);
const faceSum = wire.edges.reduce((s, e) => s + e.faces.length, 0);
assert.equal(faceSum, cornerSum, '每条边记账的面数必须对得上格子角数');
for (const e of wire.edges) assert.ok(e.faces.length === 1 || e.faces.length === 2, `边 ${e.a}-${e.b} 面数异常`);
for (const e of wire.edges) if (e.kind === 'rim') assert.equal(e.faces.length, 1, 'rim 边只能有一个面');

// 3. 三角带：覆盖全部 seam 边、首尾相接、按长度降序
const bands = seamBands(wire, { grid });
assert.ok(bands.length > 0);
assert.equal(bands.reduce((s, b) => s + b.length, 0), wire.counts.seam, '每条 seam 边必须正好落在一条带子里');
const seamSet = new Set(wire.edges.filter((e) => e.kind === 'seam').map((e) => `${Math.min(e.a, e.b)}|${Math.max(e.a, e.b)}`));
const walked = new Set();
for (const band of bands) {
  for (let i = 1; i < band.corners.length; i++) {
    const a = band.corners[i - 1], b = band.corners[i];
    const key = `${Math.min(a, b)}|${Math.max(a, b)}`;
    assert.ok(seamSet.has(key), `带子里的每一段都必须是 seam 边（${a}-${b}）`);
    assert.ok(!walked.has(key), '同一条 seam 边不能进两条带子');
    walked.add(key);
  }
}
for (let i = 1; i < bands.length; i++) assert.ok(bands[i - 1].length >= bands[i].length, '带子按长度降序');
// 片子里的带子是横穿整片格子的长条，最长那条必须远长于 2 段
assert.ok(bands[0].length >= 8, `最长三角带应当是一条长条，实际 ${bands[0].length}`);

// 4. 纯方格网：没有任何 seam / 三角
const square = buildSquareGrid({ radius: 4 });
const squareWire = classifyWireframe(square);
assert.equal(squareWire.counts.seam, 0, '方格网没有三角过渡带');
assert.equal(squareWire.counts.tri, 0);
assert.equal(squareWire.faces.tris, 0);
assert.equal(squareWire.counts.quad + squareWire.counts.rim, squareWire.edges.length);
assert.equal(squareWire.counts.rim, 4 * 9, 'radius 4 的方格网是 9×9，外圈正好 36 条边');
assert.equal(seamBands(squareWire, { grid: square }).length, 0);

// 5. 确定性：同种子两次生成完全一致
const again = classifyWireframe(buildMixedGrid({ radius: 10, seed: 2024, mergeRate: 0.85, relaxPasses: 40 }));
assert.equal(JSON.stringify(again.counts), JSON.stringify(wire.counts));
assert.equal(JSON.stringify(seamBands(again, { grid })), JSON.stringify(bands));

// 6. 换种子后拓扑真的变了（片子里每 40–60 帧重铺一次）
const other = classifyWireframe(buildMixedGrid({ radius: 10, seed: 777, mergeRate: 0.85, relaxPasses: 40 }));
assert.notEqual(JSON.stringify(other.counts), JSON.stringify(wire.counts), '换种子必须换出一套不同的格子');

// 7. 退化输入拒绝
assert.throws(() => classifyWireframe({}), RangeError);
assert.throws(() => classifyWireframe({ cells: [{ id: 0, n: 3, pts: [{ id: 0 }, { id: 1 }] }] }), RangeError);

console.log(
  `PASS grid-wireframe：${wire.faces.total} 格（${wire.faces.quads} 四边 / ${wire.faces.tris} 三角）·`,
  `边 ${wire.edges.length}（四边 ${wire.counts.quad} / 三角 ${wire.counts.tri} / 带轮廓 ${wire.counts.seam} / 岛缘 ${wire.counts.rim}）·`,
  `三角带 ${bands.length} 条，最长 ${bands[0].length} 段`,
);
