/**
 * 906425294533394432 "It's like navigating a Swiss cheese" / 797119718477991936 "Got some basic navigation going"
 * 洞口占用表的纯逻辑验收：容量按净宽定价、FIFO 排队、一人只占一个洞口、ttl 过期、死者清退、账目自洽。
 * 口径同 `src/world/door-occupancy.js` 文件头；运行：node tests/door-occupancy.mjs
 */
import assert from 'node:assert/strict';
import { DoorOccupancy } from '../src/world/door-occupancy.js';

const R = .055;
// ① 容量：宽拱多人、窄门 1 人，且随净宽单调不减（不发明「所有门都单列」）
const caps = [.11, .12, .2, .34, .6, 1.0, 1.6].map((w) => DoorOccupancy.capacity(w, R));
assert.deepEqual(caps, [1, 1, 1, 2, 5, 8, 13], '容量 = floor(净宽 / 体径+缝)');
for (let i = 1; i < caps.length; i++) assert.ok(caps[i] >= caps[i - 1], '容量随净宽单调不减');
assert.equal(DoorOccupancy.capacity(0, R), 1, '量不到净宽按 1 人');
assert.equal(DoorOccupancy.capacity(.4, 0), 1, '没有体径也按 1 人（不返回 Infinity）');
assert.throws(() => new DoorOccupancy({ ttl: 0 }), RangeError, 'ttl 必须为正');

// ② 满员 → 排队；先到者先过（FIFO）
const d = new DoorOccupancy({ ttl: 1 });
assert.deepEqual(d.claim(1, 'k', { t: 0, cap: 1 }).granted, true, '第一个进得去');
const second = d.claim(2, 'k', { t: .1, cap: 1 });
assert.equal(second.granted, false, '满员时第二个被拒');
assert.equal(second.reason, 'full'); assert.equal(second.queue, 1);
assert.equal(d.claim(1, 'k', { t: .2, cap: 1 }).reason, 'held', '持有者续期不重新排队');
d.release(1);
const third = d.claim(3, 'k', { t: .3, cap: 1 });
assert.equal(third.granted, false, '排在 2 号后面的人不能插队');
assert.equal(third.reason, 'fifo');
assert.equal(d.claim(2, 'k', { t: .4, cap: 1 }).granted, true, '队首放行');
assert.equal(d.holders('k'), 1, '一次只放 cap 个');

// ③ 宽拱：cap 3 时前三个人同时进，第四个排队
const wide = new DoorOccupancy();
const g = [1, 2, 3, 4].map((id, i) => wide.claim(id, 'w', { t: i * .01, cap: 3 }));
assert.deepEqual(g.map((x) => x.granted), [true, true, true, false], 'cap=3 时前三进第四个等');
assert.equal(wide.holders('w'), 3);
assert.equal(wide.summary().maxQueue, 1);

// ④ 一人同时只占一个洞口：换洞口自动释放旧洞口
const m = new DoorOccupancy();
m.claim(1, 'a', { t: 0, cap: 1 });
assert.equal(m.holding(1), 'a');
m.claim(1, 'b', { t: .1, cap: 1 });
assert.equal(m.holding(1), 'b', '换洞口后只占新的');
assert.equal(m.holders('a'), 0, '旧洞口已释放');

// ⑤ ttl 兜底：持有者不再申请（死亡/卡住/掉头）→ 过期后别人能过
const e = new DoorOccupancy({ ttl: .5 });
e.claim(1, 'x', { t: 0, cap: 1 });
assert.equal(e.claim(2, 'x', { t: .3, cap: 1 }).granted, false, 'ttl 内仍被占');
const after = e.claim(2, 'x', { t: .8, cap: 1 });
assert.equal(after.granted, true, 'ttl 过期后放行');
assert.ok(e.stats.expired >= 1, '过期计数');

// ⑥ 死者清退：sweep 立刻摘掉占用与排队，不让人白等一个 ttl
const s = new DoorOccupancy({ ttl: 5 });
s.claim(1, 'q', { t: 0, cap: 1 });
s.claim(2, 'q', { t: .1, cap: 1 });
assert.equal(s.summary().queue, 1);
const dropped = s.sweep((id) => id !== 1, .2);
assert.ok(dropped >= 1);
assert.equal(s.holders('q'), 0, '死者占用立刻清掉');
assert.equal(s.claim(3, 'q', { t: .3, cap: 1 }).granted, false, '排队里的 2 号仍然先过（清退不打乱次序）');
assert.equal(s.claim(2, 'q', { t: .31, cap: 1 }).granted, true, '队首立刻能过');

// ⑦ 账目自洽
const sum = s.summary();
assert.ok(sum.claims >= sum.granted + sum.denied, '申请数 ≥ 放行+拒绝');
assert.equal(typeof sum.maxQueue, 'number');
for (const k of ['claims', 'granted', 'denied', 'released', 'expired', 'evicted', 'maxQueue']) assert.ok(Number.isFinite(sum[k]), '账目字段 ' + k);
assert.throws(() => s.claim(1, 'q', { t: 0, cap: 0 }), RangeError, '容量必须 ≥1');

console.log('PASS door-occupancy', { caps, holds: sum.holders, queue: sum.queue, dropped });
