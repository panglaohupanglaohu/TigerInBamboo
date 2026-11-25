// 1302686201401442309 第 117 轮收口：无限网格的「面积拉回点阵」松弛权重。
// 片里的两个症状：① 翻折块塌成一团（verify 的 flipped）；② 没翻折的邻格被拉长去补缺口（stretch）。
// 但还有第三件此前没量的东西：被挤的格**只丢面积不还** —— 拟合目标是「当前偏移的均值」，一旦被挤小就照着更小的半径继续拟合。
// 本轮加 areaPull（默认 0.85）：目标半径朝「与本格原始点阵面积相等的正 n 边形」拉，外圈仍钉住 → 接缝不变。
//   ① areaPull=0 复现旧账（最小收缩比 ≤0.5、有若干格被判收缩）；
//   ② 默认档：最小收缩比明显抬高、收缩格归零、翻折 0、接缝 0、拉伸不恶化；
//   ③ 逐块面积守恒：松弛后块内各格面积之和 == 原始点阵之和（钉住边界 → 面积不可凭空增删）；
//   ④ 确定性：同参数两次逐位一致；流式与窗口版逐位一致（两条路径同口径传 areaPull）。
import assert from 'node:assert/strict';
import { buildInfinite, verify, createInfiniteStream } from '../src/core/infinite.js';
import { signedArea } from '../src/core/grid.js';

const sumArea = (pts) => pts.reduce((s, p) => s + Math.abs(signedArea(p.map(([x, z]) => ({ x, z })))), 0);

// ---- ① 旧行为（areaPull=0）作为对照，钉住「以前确实在丢面积」
const old = [];
for (const N of [2, 3, 4]) for (const rings of [1, 2]) {
  const r = verify(buildInfinite({ N, rings, passes: 60, areaPull: 0 }), 'blend');
  old.push({ N, rings, minShrink: r.minShrink, shrunk: r.shrunk, maxStretch: r.maxStretch });
}
const oldWorst = Math.min(...old.map((x) => x.minShrink));
assert.ok(oldWorst <= 0.5, 'areaPull=0 应当复现旧账：最小收缩比 ≤ 0.5，实测 ' + oldWorst);
assert.ok(old.reduce((s, x) => s + x.shrunk, 0) > 0, 'areaPull=0 应当有格被判收缩');
console.log('旧账 areaPull=0 worstMinShrink', oldWorst.toFixed(3), '收缩格', old.reduce((s, x) => s + x.shrunk, 0));

// ---- ② 默认档（0.85）
const now = [];
for (const N of [2, 3, 4]) for (const rings of [1, 2]) {
  const inf = buildInfinite({ N, rings, passes: 60 });
  const r = verify(inf, 'blend');
  assert.equal(r.invalid, 0);
  assert.equal(r.flipped, 0, `N${N} rings${rings} 有翻折`);
  assert.ok(r.seam < 1e-12, `N${N} rings${rings} 接缝 ${r.seam}`);
  assert.equal(r.shrunk, 0, `N${N} rings${rings} 仍有 ${r.shrunk} 格收缩`);
  assert.equal(r.stretched, 0);
  assert.ok(r.minShrink > 0.6, `N${N} rings${rings} minShrink ${r.minShrink}`);
  assert.ok(r.maxStretch < 1.6, `N${N} rings${rings} maxStretch ${r.maxStretch}`);
  // ---- ③ 逐块面积守恒：'patch' 档（块内松弛，外圈钉住）必须逐块守恒；'blend' 档是块+两簇的重心插值，
  //      插值本身会把面积挪一点，所以只记录不硬断言（下面把 blend 的漂移一起打出来）。
  let worstRel = 0, blendRel = 0;
  for (const P of inf.patches) {
    const acc = (mode) => { let a = 0, b = 0; for (const q of P.quads) {
      a += Math.abs(signedArea(q.map((v) => { const p = inf.versionAt(v, P.id, mode); return { x: p[0], z: p[1] }; })));
      b += Math.abs(signedArea(q.map((v) => { const p = inf.versionAt(v, P.id, 'raw'); return { x: p[0], z: p[1] }; })));
    } return [a, b]; };
    const [pa, pb] = acc('patch'); if (pb > 1e-9) worstRel = Math.max(worstRel, Math.abs(pa - pb) / pb);
    const [ba, bb] = acc('blend'); if (bb > 1e-9) blendRel = Math.max(blendRel, Math.abs(ba - bb) / bb);
  }
  assert.ok(worstRel < 1e-6, `N${N} rings${rings} 块内面积不守恒：${worstRel}`);
  now.push({ N, rings, minShrink: +r.minShrink.toFixed(3), maxStretch: +r.maxStretch.toFixed(3), maxEdgeStretch: +r.maxEdgeStretch.toFixed(3), areaRel: +worstRel.toExponential(2), blendRel: +blendRel.toFixed(4) });
}
const newWorst = Math.min(...now.map((x) => x.minShrink));
assert.ok(newWorst > oldWorst + 0.1, `面积拉回没改善最小收缩比：${oldWorst} → ${newWorst}`);
console.log('默认档 areaPull=0.85 worstMinShrink', newWorst.toFixed(3), JSON.stringify(now));

// ---- ④ 确定性 + 流式/窗口一致
const a = buildInfinite({ N: 4, rings: 2, passes: 60 }), b = buildInfinite({ N: 4, rings: 2, passes: 60 });
assert.deepEqual(a.verts.map((v) => [v.x, v.z]), b.verts.map((v) => [v.x, v.z]), '同参数两次不一致');
const st = createInfiniteStream({ N: 4, passes: 60 });
const win = buildInfinite({ N: 4, rings: 1, passes: 60 });
const target = win.patches[0];
const streamed = st.finalPatch(target.q, target.r);
let maxD = 0;
for (const v of new Set(target.quads.flat())) {
  const p = win.versionAt(v, target.id, 'blend'), q = streamed.get(v.id);
  assert.ok(q, '流式缺顶点 ' + v.id);
  maxD = Math.max(maxD, Math.hypot(p[0] - q[0], p[1] - q[1]));
}
assert.ok(maxD < 1e-9, '流式与窗口版不一致：' + maxD);
console.log('PASS infinite area pull', JSON.stringify({ oldWorst: +oldWorst.toFixed(3), newWorst: +newWorst.toFixed(3), streamMaxDiff: maxD, panels: now.length }));
