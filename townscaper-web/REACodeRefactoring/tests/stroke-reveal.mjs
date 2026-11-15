// 1448039167057879048 / 1447483550257799171：线稿逐笔描出的排期与裁剪。
// 判据：单调累积、末端按弧长插值、总时长收尾、确定性、退化输入不炸。
import assert from 'node:assert/strict';
import { createStrokeReveal, polylineLength, trimPolyline } from '../src/core/stroke-reveal.js';

const line = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]];
const ring = (r, seg = 48, cx = 0, cy = 0) =>
  Array.from({ length: seg + 1 }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

// 1. 弧长
assert.equal(polylineLength(line(0, 0, 3, 4)), 5);
assert.equal(polylineLength([[0, 0], [0, 0], [0, 6]]), 6, '重复点要去掉');
assert.ok(Math.abs(polylineLength(ring(2)) - 2 * Math.PI * 2) < 0.02, '闭合环弧长≈周长');

// 2. 裁剪：半途落在段内要插值，不能整段蹦出来
const half = trimPolyline(line(0, 0, 10, 0), 2.5);
assert.equal(half.length, 2);
assert.deepEqual(half[1], [2.5, 0], '末端必须落在 2.5 处');
assert.deepEqual(trimPolyline(line(0, 0, 10, 0), 0), [], '长度为 0 不画');
assert.equal(trimPolyline(line(0, 0, 10, 0), 99).length, 2, '超长截断到整条');
const twoSeg = trimPolyline([[0, 0], [4, 0], [4, 3]], 5.5);
assert.deepEqual(twoSeg[1], [4, 0]);
assert.deepEqual(twoSeg[2], [4, 1.5], '跨段后仍要在最后一段插值');

// 3. 排期：全部笔画在 duration 内收尾
const strokes = [ring(1), ring(2), ring(3), line(-4, 0, 4, 0), line(0, -4, 0, 4)];
const rv = createStrokeReveal({ strokes, duration: 6, stagger: 0.6, order: 'random', seed: 7 });
assert.equal(rv.strokeCount, 5);
assert.ok(rv.endTime <= 6 + 1e-9, `收尾时间 ${rv.endTime} 必须 <= duration`);
for (const s of rv.plan) {
  assert.ok(s.delay >= 0 && s.delay < 6, '延迟在总时长内');
  assert.ok(s.delay + s.span <= 6 + 1e-9, '单笔不得越界');
}

// 4. 单调累积 + 端点状态
let prev = -1;
for (let i = 0; i <= 60; i++) {
  const t = (i / 60) * 6;
  const st = rv.statsAt(t);
  assert.ok(st.drawnLength >= prev - 1e-9, `t=${t} 时已画长度回退了`);
  assert.ok(st.ratio <= 1 + 1e-12, 'ratio 不得超 1');
  prev = st.drawnLength;
}
assert.equal(rv.statsAt(0).drawnLength, 0, 't=0 一笔未画');
assert.equal(rv.statsAt(3).started >= 1, true, '中途应有笔画已开始');
const end = rv.statsAt(6);
assert.equal(end.ratio, 1, '收尾时整张图必须画完');
assert.equal(end.finished, end.strokes, '收尾时全部笔画 finished');
assert.ok(Math.abs(end.drawnLength - rv.totalLength) < 1e-6, '画完长度=总弧长');
assert.equal(end.done, true);

// 5. 采样：只给已开始的笔画，进度与长度一致
const mid = rv.sampleAt(3);
assert.ok(mid.length >= 1 && mid.length < 5, '中途既不是全无也不是全有');
for (const s of mid) {
  assert.ok(s.points.length >= 2, '画出的笔画至少两点');
  if (s.progress < 1) {
    const drawn = polylineLength(s.points);
    const plan = rv.plan[s.index];
    assert.ok(Math.abs(drawn - plan.length * s.progress) < 1e-6, '裁剪长度必须等于 progress*length');
  }
}
assert.equal(rv.sampleAt(0).length, 0);
assert.equal(rv.sampleAt(6).length, 5);

// 6. 确定性：同种子同排期，换种子换顺序
const a = createStrokeReveal({ strokes, duration: 4, order: 'random', seed: 3 });
const b = createStrokeReveal({ strokes, duration: 4, order: 'random', seed: 3 });
const c = createStrokeReveal({ strokes, duration: 4, order: 'random', seed: 4 });
assert.deepEqual(a.plan.map((s) => s.order), b.plan.map((s) => s.order), '同种子必须同序');
assert.notDeepEqual(a.plan.map((s) => s.order), c.plan.map((s) => s.order), '不同种子应当不同序');

// 7. document 顺序：延迟单调不减
const doc = createStrokeReveal({ strokes, duration: 5, order: 'document' });
for (let i = 1; i < doc.plan.length; i++) {
  assert.ok(doc.plan[i].delay >= doc.plan[i - 1].delay - 1e-12, 'document 顺序的延迟要单调');
}

// 8. 长度权重：长笔画耗时不少于短笔画（同一 stagger 下）
const lw = createStrokeReveal({ strokes: [line(0, 0, 10, 0), line(0, 1, 1, 1)], duration: 6, stagger: 0.5, lengthWeighted: true });
assert.ok(lw.plan[0].span > lw.plan[1].span, '长笔画应当画得更久');

// 9. 退化输入
assert.throws(() => createStrokeReveal({ strokes: [] }), /no drawable stroke/);
assert.throws(() => createStrokeReveal({ strokes: [[[1, 1]]] }), /no drawable stroke/, '单点笔画不成线');
assert.throws(() => createStrokeReveal({ strokes, duration: 0 }), /duration/);
assert.throws(() => createStrokeReveal({ strokes, stagger: 1 }), /stagger/);
assert.throws(() => createStrokeReveal({ strokes, order: 'zigzag' }), /order/);
assert.throws(() => createStrokeReveal({ strokes, ease: 'bounce' }), /ease/);
const nanSafe = createStrokeReveal({ strokes, duration: 2 });
assert.equal(nanSafe.statsAt(NaN).drawnLength, 0, 'NaN 时间按 0 处理');

console.log(`PASS stroke-reveal: ${rv.strokeCount} 笔 / 总弧长 ${rv.totalLength.toFixed(2)} / 收尾 ${rv.endTime.toFixed(3)}s，单调累积、末端插值、确定性均通过`);
