// tests/path-samples-referee.mjs — 823848950553780226 残差核销：裁判 navribbon 弧长重采样逐位对拍。
// 裁判 = 只读 ../../REACode/src/navribbon.js（centerline Catmull-Rom 按参数取点 → sampleByArc 沿累计
// 弧长等距重采样，另带每点切向/法向/解析半宽/共享边格子与 measure 统计）。
// 本侧 = src/core/path-samples.js samplePath：同一机制的 3D 共享 World 移植，battle.js 的
// commandPathSamples 与 battle-navigation.js#commandRibbon 都在用它。
// 可逐位对拍的部分：同一折线上、同一弧长 s 处的采样位置——两边都是「先逐段 Math.hypot 累计，
// 再定位所在段，按 (s-cum[lo])/(cum[hi]-cum[lo]) 线性插值」，裁判用二分定位、本侧用线性游标，
// 数学上是同一条式子（z≡0 时 3D hypot 与 2D hypot 逐位相等，实测见断言）。
// 如实差异（本侧工程选择，不属于裁判式子）：① samplePath 末尾必追加折线终点——裁判
// s=floor(len/step)*step 会丢掉不足一步的尾巴；② ribbonCells 法向取相邻采样点中差、半宽由
// 命令路径所在格的封闭边净距给（裁判取所在段切向、半宽是解析 halfWidth(u)）；③ smoothRoutedPath
// 的 accept 回退是 G5「平滑不得拉出可站区」约束，裁判中线不做约束。
import assert from 'node:assert/strict';
import test from 'node:test';
import { centerline, sampleByArc, measure } from '../../REACode/src/navribbon.js';
import { samplePath } from '../src/core/path-samples.js';

// 同一中线，两种步距 × 两种参数密度：裁判每个采样点在本侧同弧长处必有逐位相同的位置。
test('裁判中线 sampleByArc 与 samplePath 同弧长采样位置逐位一致', () => {
  for (const perSeg of [64, 12]) for (const step of [1.0, 0.7, 0.35]) {
    const line = centerline(perSeg), pts3 = line.pts.map((p) => [p[0], 0, p[1]]);
    const ref = sampleByArc(line, step), ours = samplePath(pts3, { spacing: step, maxSamples: 1e6 });
    assert.equal(ours.length, line.len, `perSeg=${perSeg} step=${step} 累计长度逐位`);
    assert.ok(ours.points.length >= ref.pts.length, '本侧采样数不少于裁判（端点必保留）');
    for (let i = 0; i < ref.pts.length; i++) {
      const r = ref.pts[i];
      assert.equal(ours.distances[i], r.s, `perSeg=${perSeg} step=${step} 第${i}点弧长逐位`);
      assert.equal(ours.points[i][0], r.x, `第${i}点 x 逐位`);
      assert.equal(ours.points[i][2], r.z, `第${i}点 z 逐位`);
    }
    // 如实差异①：裁判丢 len%step 尾巴（最后一点 s<len），本侧追加终点 s=len。
    const tail = line.len - ref.pts.at(-1).s;
    assert.ok(tail >= 0 && tail < step, '裁判末尾不足一步');
    assert.equal(ours.distances.at(-1), line.len, '本侧端点弧长=全长');
    assert.deepEqual(ours.points.at(-1), pts3.at(-1), '本侧端点=折线终点');
    assert.equal(ours.points.length, ref.pts.length + (tail > 0 ? 1 : 0));
  }
});

// 机制性质对拍：弧长等距（内部间距恰好 step、std=0）与「转角更密」是弦长错觉——
// 裁判 measure() 的统计口径在本侧采样上同样成立。
test('弧长等距 + 弦长错觉与裁判 measure 同性质', () => {
  const step = 1.0, m = measure(step);
  assert.equal(m.arc.std, 0, '裁判弧长间距 std=0');
  assert.ok(m.ctrl.ratio > 1, '控制点基线疏密不均（对照组）');
  assert.ok(m.chord.arcOverChordMax >= 1, '弧长/弦长比 ≥1（错觉来源）');
  const line = centerline(), pts3 = line.pts.map((p) => [p[0], 0, p[1]]);
  const s = samplePath(pts3, { spacing: step, maxSamples: 1e6 });
  let arcMin = Infinity, arcMax = -Infinity, chordMax = -Infinity;
  for (let i = 1; i < s.distances.length - 1; i++) {
    const g = s.distances[i] - s.distances[i - 1];
    arcMin = Math.min(arcMin, g); arcMax = Math.max(arcMax, g);
    chordMax = Math.max(chordMax, Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][2] - s.points[i - 1][2]));
  }
  assert.equal(arcMin, step); assert.equal(arcMax, step, '本侧弧长间距恒等于 step');
  assert.ok(chordMax <= step * (1 + 1e-9), '弦长不超弧长（转角处弦更短=看起来更密）');
});

// 输入不被改写、预算有界——裁判线折线喂进来不能动，超预算要拒绝（与既有 path-samples.mjs 口径）。
test('裁判中线输入不变式与预算边界', () => {
  const pts3 = centerline().pts.map((p) => [p[0], 0, p[1]]), before = JSON.stringify(pts3);
  const s = samplePath(pts3, { spacing: 0.5, maxSamples: 1e6 });
  assert.equal(JSON.stringify(pts3), before, '输入折线未被改写');
  assert.equal(s.points.length, s.distances.length);
  assert.throws(() => samplePath(pts3, { spacing: 0.001, maxSamples: 8 }), /budget/);
});
