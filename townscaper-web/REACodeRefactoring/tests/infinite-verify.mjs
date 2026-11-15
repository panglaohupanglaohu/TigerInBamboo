import assert from 'node:assert/strict';
import { buildInfinite, verify } from '../src/core/infinite.js';

// 每一格都以「本格原始点阵」为基准量拉伸，所以合并格不会被误判；'raw' 必须精确 =1。
// 用页面默认的 passes:60（松弛最狠的一档）当基准，实测最大 1.83×、最小 0.46×、翻折 0。
const reports = [];
for (const N of [2, 3, 4]) for (const rings of [1, 2]) {
  const inf = buildInfinite({ N, rings, passes: 60 });
  for (const mode of ['raw', 'patch', 'cluster', 'blend']) {
    const r = verify(inf, mode);
    assert.equal(r.invalid, 0);
    assert.equal(r.flipped, 0);
    assert.ok(r.comparisons >= r.border);
    // 1302686201401442309 的第二个症状：没翻折的邻格被拉长去补缺口。松弛后不该有格子超过原始 footprint 的 2 倍。
    assert.equal(r.stretched, 0, `${mode} N${N} rings${rings} stretched ${r.stretched}`);
    assert.ok(r.maxStretch < 2, `${mode} maxStretch ${r.maxStretch}`);
    assert.ok(r.minShrink > 0.4, `${mode} minShrink ${r.minShrink}`);
    assert.ok(r.maxEdgeStretch < 1.6, `${mode} maxEdgeStretch ${r.maxEdgeStretch}`);
    if (mode === 'raw') { assert.equal(r.maxStretch, 1); assert.equal(r.minShrink, 1); assert.equal(r.maxEdgeStretch, 1); }
    reports.push({ N, rings, mode, ...r });
  }
  assert.throws(() => verify(inf, 'oops'));
  assert.throws(() => verify(inf, 'blend', { stretchLimit: 1 }));
  assert.throws(() => verify(inf, 'blend', { stretchLimit: NaN }));
}

// 合成用例：三种几何各自必须被度量出来（真实网格里量不到是被防住了，不代表度量瞎）。
const fake = (rawPts, modePts) => {
  const verts = rawPts.map((p, i) => ({ id: i, patches: [0], x0: p[0], z0: p[1] }));
  const patch = { id: 0, quads: [verts] };
  return { versions: { raw: 1, blend: 1 }, verts, quads: [verts], patches: [patch], versionAt: (v, _pi, m) => (m === 'raw' ? [v.x0, v.z0] : modePts[v.id]) };
};
const UNIT = [[0, 0], [1, 0], [1, 1], [0, 1]];
// (a) 拉长 3 倍：面积 9 倍，边 3 倍
const stretched = verify(fake(UNIT, UNIT.map(([x, z]) => [x * 3, z * 3])), 'blend');
assert.equal(stretched.flipped, 0); assert.equal(stretched.stretched, 1);
assert.ok(Math.abs(stretched.maxStretch - 9) < 1e-9); assert.ok(Math.abs(stretched.maxEdgeStretch - 3) < 1e-9);
assert.equal(stretched.worst.ratio, stretched.maxStretch);
assert.equal(verify(fake(UNIT, UNIT.map(([x, z]) => [x * 3, z * 3])), 'blend', { stretchLimit: 12 }).stretched, 0);
// (b) 塌成一点（片里的 inverted patch）：翻折 + 收缩到 0
const collapsed = verify(fake(UNIT, UNIT.map(() => [0.5, 0.5])), 'blend');
assert.equal(collapsed.flipped, 1); assert.equal(collapsed.shrunk, 1); assert.equal(collapsed.minShrink, 0);
// (c) 未变形的对照：三项都必须精确 1
const intact = verify(fake(UNIT, UNIT), 'blend');
assert.deepEqual([intact.maxStretch, intact.minShrink, intact.maxEdgeStretch], [1, 1, 1]);

// A mismatch only in the THIRD owner used to be invisible to the first-two-owner audit.
const v = { id: 0, patches: [0, 1, 2] };
const inf = { versions: { raw: () => [0, 0], blend: () => [0, 0] }, verts: [v], quads: [], patches: [{ id: 0, quads: [] }, { id: 1, quads: [] }, { id: 2, quads: [] }], versionAt: (_v, p, m) => [m === 'raw' ? 0 : p === 2 ? 2 : 0, 0] };
assert.equal(verify(inf, 'blend').seam, 2);
assert.equal(verify(inf, 'raw').seam, 0);
assert.equal(verify(inf).comparisons, 3);

console.log('PASS', reports.length, 'real mode audits + stretch/shrink/collapse probes');
console.log(reports.filter((r) => r.N === 4 && r.rings === 2).map((r) => ({ mode: r.mode, stretch: +r.maxStretch.toFixed(3), shrink: +r.minShrink.toFixed(3), edge: +r.maxEdgeStretch.toFixed(3), stretched: r.stretched, shrunk: r.shrunk })));
