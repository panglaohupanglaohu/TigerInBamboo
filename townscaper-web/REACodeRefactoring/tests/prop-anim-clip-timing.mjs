// 第 192 轮 · 1246074663546916873「The props now animate when they appear and disappear.」
// 片内标定（33.0097 fps）：出现 0260→0261 一帧跳到稳定值的 1.372×、4 帧（0.121s）单调回落；
// 消失 0223→0224 一帧塌到 6%、3 帧（0.091s）走完且无过冲。这里逐条卡住这三个数。
import assert from 'node:assert/strict';
import { PROP_TIMING, appearAt, vanishAt, timelineScale, PropLifecycle, springValue } from '../src/core/prop-anim.js';

const FPS = 33.00970873786408, FRAME = 1 / FPS;
assert.ok(Math.abs(PROP_TIMING.appearRise - FRAME) < 1e-12, 'rise = 1 frame');
assert.ok(Math.abs(PROP_TIMING.vanish - FRAME) < 1e-12, 'vanish = 1 frame');
assert.ok(Math.abs(PROP_TIMING.slotHold - 3 * FRAME) < 1e-12, 'slot hold = 3 frames (residual)');

// ---- 出现：一帧到 1.372×，之后单调回落，0.121s 内收到 1 ----
assert.equal(appearAt(0), 0);
const peakT = PROP_TIMING.appearRise;
assert.ok(Math.abs(appearAt(peakT) - 1.372) < 1e-9, 'peak 1.372 at 1 frame = ' + appearAt(peakT));
let prev = Infinity, over = 0;
for (let t = peakT; t <= peakT + PROP_TIMING.appearSettle + 1e-9; t += FRAME / 8) {
  const v = appearAt(t); assert.ok(v <= prev + 1e-12, 'monotone fall at ' + t.toFixed(4)); prev = v;
  if (v > 1.0001) over = t - peakT;
}
assert.ok(Math.abs(appearAt(peakT + PROP_TIMING.appearSettle) - 1) < 1e-12, 'settles at 1');
assert.ok(over > .03 && over < .13, 'overshoot window ' + over.toFixed(3));
// 4 帧处已经回到 1% 以内（片内 0265 就是稳定值）
assert.ok(appearAt(peakT + 4 * FRAME) < 1.01, 'within 1% after 4 frames ' + appearAt(peakT + 4 * FRAME));
assert.equal(appearAt(5), 1, 'stays at 1');
assert.throws(() => appearAt(NaN), RangeError);

// ---- 消失：单调、无过冲、3 帧归零 ----
assert.equal(vanishAt(0), 1); assert.equal(vanishAt(PROP_TIMING.vanish), 0); assert.equal(vanishAt(1), 0);
let last = 2;
for (let t = 0; t <= PROP_TIMING.vanish; t += PROP_TIMING.vanish / 40) {
  const v = vanishAt(t); assert.ok(v <= 1 && v >= 0 && v <= last + 1e-12, 'monotone vanish at ' + t.toFixed(4)); last = v;
}
// 片内一帧就塌掉：半帧还在中途、满一帧归零（不再编造 3 帧收尾）
assert.ok(vanishAt(FRAME / 2) > .6 && vanishAt(FRAME / 2) < .8, 'mid first frame ' + vanishAt(FRAME / 2));
assert.equal(vanishAt(FRAME), 0, 'collapsed within one frame');
assert.throws(() => vanishAt(Infinity), RangeError);

// ---- 两档曲线确实不同（旧 spring 只有 9.5% 过冲、0.35s 才收） ----
let springPeak = 0; for (let t = 0; t < 1.5; t += 1 / 480) springPeak = Math.max(springPeak, springValue(t));
assert.ok(springPeak - 1 < .12, 'spring overshoot ' + (springPeak - 1).toFixed(3));
assert.ok(appearAt(peakT) - springPeak > .15, 'clip overshoot clearly bigger than spring');

// ---- PropLifecycle 默认走片内曲线：过冲、0.091s 释放 slot、错峰左→右 ----
const L = new PropLifecycle({ capacity: 8, spread: .2 });
const row = (n) => Array.from({ length: n }, (_, i) => ({ key: 'p' + i, x: i, y: 1, z: 0 }));
L.sync(row(4), 0); L.update(0);
assert.equal(L.curve, 'clip'); assert.equal(L.outLife, PROP_TIMING.slotHold);
const sc = (k) => L.records[L.slotOf(k) * 4 + 3];
assert.equal(sc('p0'), 0);
L.update(FRAME);   // 一帧后：领头的已经过冲，队尾还没起
assert.ok(Math.abs(sc('p0') - 1.372) < 1e-5, 'slot scale hits 1.372 one frame in = ' + sc('p0'));
assert.equal(sc('p3'), 0, 'staggered tail has not started');
L.update(.211);   // 队尾刚起（0.011s，≈0.5），领头的已收在 1 → 左到右的波
assert.ok(sc('p3') > 0 && sc('p0') > sc('p3'), 'left-to-right wave');
assert.ok(sc('p0') < 1.01, 'leader settled');
L.update(5 * FRAME); assert.ok(sc('p3') < 1.01, 'tail settles after 4 frames');
// 消失：一帧塌到 0，但旧几何在 slot 里留 3 帧（0.091s）才回收 —— 对上 0225–0227 的残影
const V = 'p3', slot3 = L.slotOf(V), T1 = .5, geo = [...L.records.slice(slot3 * 4, slot3 * 4 + 3)];
L.update(T1); L.sync(row(3), T1); L.update(T1 + FRAME / 2);
assert.equal(L.slotOf(V), slot3); assert.ok(sc(V) > 0 && sc(V) < 1, 'collapsing ' + sc(V));
L.update(T1 + 2 * FRAME);
assert.equal(L.slotOf(V), slot3, 'slot kept while residual frames pass');
assert.equal(sc(V), 0, 'scale already 0 after one frame');
assert.deepEqual([...L.records.slice(slot3 * 4, slot3 * 4 + 3)], geo, 'root kept for the residual');
L.update(T1 + PROP_TIMING.slotHold + 1e-6);
assert.equal(L.slotOf(V), -1, 'slot released at 0.091s');
assert.equal(L.records[slot3 * 4 + 3], 0);
// spring 档仍可回退
const S = new PropLifecycle({ capacity: 4, curve: 'spring', outLife: .35 }); S.sync(row(1), 0); S.update(.8);
assert.ok(Math.abs(S.records[S.slotOf('p0') * 4 + 3] - 1) < .01, 'spring curve still available');
assert.throws(() => new PropLifecycle({ curve: 'nope' }), /curve/);
// timelineScale 契约：hideAt 之前按出现走，之后乘消失
const e = { delay: 0, hideAt: 1 };
assert.ok(Math.abs(timelineScale(e, .5) - 1) < 1e-12); assert.ok(timelineScale(e, 1 + FRAME) < 1e-12, 'vanished');
console.log('PASS prop-anim clip timing', { peak: +appearAt(peakT).toFixed(3), midFirstFrameVanish: +vanishAt(FRAME / 2).toFixed(3), springPeak: +springPeak.toFixed(3) });
