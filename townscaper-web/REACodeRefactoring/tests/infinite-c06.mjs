// 第 56 批 C06：1151137783785771008 / 1151770831619534848 流式窗口 + 黑白对偶；1302686201401442309 翻折 bug 复现 + 面积回拉。
import assert from 'node:assert/strict';
import { buildInfinite, verify, createInfiniteStream } from '../src/core/infinite.js';
import { streamWindow, windowDual, areaStats, restoreArea, patchLattice, patchRim } from '../src/core/infinite-c06.js';

// ① bugPatches 默认关：与旧行为逐位一致
const a = buildInfinite({ N: 3, rings: 1, passes: 20 }), b = buildInfinite({ N: 3, rings: 1, passes: 20, bugPatches: [] });
for (const v of a.verts) assert.deepEqual(a.versions.blend(v), b.versions.blend(b.verts[v.id]));
// ② 复现：翻折块 + 邻块被拉长；修好后 0 翻折
const ok = verify(buildInfinite({ N: 4, rings: 2, passes: 60 }), 'blend');
const bug = verify(buildInfinite({ N: 4, rings: 2, passes: 60, bugPatches: [0, 5, 12] }), 'blend');
assert.equal(ok.flipped, 0);
assert.ok(bug.flipped > 10 && bug.stretched > 10 && bug.maxStretch > 3, `bug 复现：翻折 ${bug.flipped}、拉伸>2× ${bug.stretched}`);
assert.ok(bug.seam < 1e-9, 'bug 不破坏块接缝（片中也是拉伸而不是开缝）');
// ③ 面积回拉：块边界钉住、无翻折、最小面积比显著上升
const inf = buildInfinite({ N: 4, rings: 2, passes: 60 });
const before = areaStats(inf.quads, (v) => inf.versions.blend(v));
const P = restoreArea(inf.quads, (v) => inf.versions.blend(v));
const after = areaStats(inf.quads, (v) => P.get(v.id));
assert.equal(after.flipped, 0);
assert.ok(after.min > before.min + .15 && after.min > .65 && after.max < before.max, `回拉 ${before.min.toFixed(2)}→${after.min.toFixed(2)}`);
for (const v of inf.verts) if (v.rim) assert.deepEqual(P.get(v.id), inf.versions.blend(v), '块边界点不动');
// ④ 流式窗口：与 buildInfinite 同一块结果一致；走很远缓存有界；块间无缝
const st = createInfiniteStream({ N: 4, passes: 60 });
const lat = patchLattice(st);
const w0 = streamWindow(st, { focus: [0, 0], radius: 1 });
assert.equal(w0.finals.length, 1);
const centre = inf.patches[0];
for (const v of centre.verts) { const sv = st.verts.find((u) => Math.round(u.x0 * 1000) === Math.round(v.x0 * 1000) && Math.round(u.z0 * 1000) === Math.round(v.z0 * 1000)); const p = w0.finals[0].pos.get(sv.id), q = inf.versionAt(v, 0, 'blend'); assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9, '流式 = 窗口版'); }
const st2 = createInfiniteStream({ N: 4, passes: 30 }); st2.finalPatch(0, 0); let maxCached = 0, lastSeam = 0;
for (let i = 0; i < 25; i++) {
  const w = streamWindow(st2, { focus: [i * 7, -i * 3], radius: 9 });
  maxCached = Math.max(maxCached, w.cached.patches);
  const seen = new Map(); for (const F of w.finals) for (const [id, p] of F.pos) { const o = seen.get(id); if (o) lastSeam = Math.max(lastSeam, Math.hypot(o[0] - p[0], o[1] - p[1])); else seen.set(id, p); }
  assert.ok(w.finals.length >= 5 && w.raws.length > 10);
}
assert.ok(st2.counters.patches > 3 * maxCached, `走过 ${st2.counters.patches} 块，缓存最多 ${maxCached} 块`);
assert.ok(st2.counters.evicted > 100);
assert.ok(lastSeam < 1e-9, '块间无缝 ' + lastSeam);
// 丢弃后回到原处：重算结果与第一次逐位一致（确定性，只由 (q,r) 决定）
const first = new Map(st2.finalPatch(0, 0)); st2.evict(() => false);
const again = streamWindow(st2, { focus: [0, 0], radius: 1 }).finals[0].pos;
for (const [id, p] of first) assert.deepEqual(again.get(id), p, '丢弃后重算一致');
// ⑤ 面积回拉在流式里也无缝（块外圈钉住）
const st3 = createInfiniteStream({ N: 4, passes: 40 });
const wf = streamWindow(st3, { focus: [0, 0], radius: 9, areaFix: true });
const seen = new Map(); let seam = 0; for (const F of wf.finals) for (const [id, p] of F.pos) { const o = seen.get(id); if (o) seam = Math.max(seam, Math.hypot(o[0] - p[0], o[1] - p[1])); else seen.set(id, p); }
assert.ok(seam < 1e-9, '面积回拉后流式仍无缝');
// ⑥ 黑白对偶：每个内部原始点一个对偶面
const d = windowDual(w0);
assert.ok(d.faces.length > 150 && d.vertices.length === w0.finals[0].quads.length);
console.log('PASS infinite-c06', JSON.stringify({ bug: { flipped: bug.flipped, stretched: bug.stretched, max: +bug.maxStretch.toFixed(2) }, area: [+before.min.toFixed(3), +after.min.toFixed(3)], walked: st2.counters.patches, maxCached, evicted: st2.counters.evicted, dual: d.faces.length }));
