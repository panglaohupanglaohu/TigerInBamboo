import assert from 'node:assert/strict';
import { bannerBar, addPopup, stepPopups, STRIP } from '../src/badnorth/squad-hud.js';

// 1. 满员：整条槽都是绿的，没有空段、没有闪红
const full = bannerBar({ hp: 3, max: 3, width: 26 });
assert.equal(full.ratio, 1);
assert.equal(full.fill.w, 26);
assert.equal(full.empty.w, 0);
assert.equal(full.flash, null);
assert.deepEqual(full.fill.color, STRIP.full);
assert.equal(full.height, Math.max(2, Math.round(26 * 0.085)));

// 2. 掉人：绿条按比例缩短，空段接在后面，总宽不变
const hurt = bannerBar({ hp: 1, max: 3, width: 30 });
assert.equal(hurt.fill.w, 10);
assert.equal(hurt.empty.w, 20);
assert.equal(hurt.empty.x, 10);
assert.equal(hurt.fill.w + hurt.empty.w, 30);
assert.ok(hurt.fill.w < full.fill.w);

// 3. 掉到一半换黄、剩三成换红（片子里 0150 那面旗的槽就是黄的）；刚挨打时左端闪红，过了窗口就不再闪
const half = bannerBar({ hp: 2, max: 3, width: 26 });
assert.deepEqual(half.fill.color, STRIP.warn);
const low = bannerBar({ hp: 0.3, max: 3, width: 26 });
assert.deepEqual(low.fill.color, STRIP.hurt);
assert.ok(bannerBar({ hp: 2, max: 3, width: 26, hitAge: 0.05 }).flash, '受击窗口内应当闪红');
assert.equal(bannerBar({ hp: 2, max: 3, width: 26, hitAge: 0.4 }).flash, null, '窗口外不闪');
assert.equal(bannerBar({ hp: 2, max: 3, width: 26, hitAge: 0.05 }).flash.w, Math.round(26 * 0.22));

// 4. 非法输入要抛
assert.throws(() => bannerBar({ hp: 1, max: 0 }), RangeError);
assert.throws(() => bannerBar({ hp: NaN }), RangeError);
assert.throws(() => bannerBar({ width: 0 }), RangeError);

// 5. 飘字：第一次击杀出一条 "+10"
const list = [];
addPopup(list, { x: 4, y: 1, z: 2, value: 10 });
assert.equal(list.length, 1);
assert.equal(list[0].text, '+10');
assert.equal(list[0].merges, 1);

// 6. 同一小队短窗口内再击杀 → 并进同一条，数值累加（片子里就是 "+20" 而不是两条 "+10"）
addPopup(list, { x: 4.2, y: 1, z: 2.1, value: 10 });
assert.equal(list.length, 1, '近距离应当合并');
assert.equal(list[0].text, '+20');
assert.equal(list[0].value, 20);
assert.equal(list[0].merges, 2);
assert.equal(list[0].age, 0, '合并后重新计时');

// 7. 距离远或在窗口外 → 另起一条
addPopup(list, { x: 9, y: 1, z: 9, value: 12 });
assert.equal(list.length, 2);
const aged = [];
addPopup(aged, { x: 0, y: 0, z: 0, value: 10 });
stepPopups(aged, 0.5);
addPopup(aged, { x: 0.1, y: 0, z: 0, value: 10 });
assert.equal(aged.length, 2, '过了合并窗口就不该并');

// 8. 上升 + 淡出 + 到寿命移除，alpha 单调下降
const fly = [];
addPopup(fly, { x: 0, y: 2, z: 0, value: 10 });
let snap = stepPopups(fly, 0.1);
assert.equal(snap.length, 1);
assert.ok(Math.abs(snap[0].lifted - 0.15) < 1e-9, 'lifted ' + snap[0].lifted);
assert.equal(snap[0].scale, 1 + 0.18 * Math.min(1, 0.1 / 0.12));
let last = 1;
for (let t = 0; t < 10; t++) {
  snap = stepPopups(fly, 0.1);
  const a = snap.length ? snap[0].alpha : 0;
  assert.ok(a <= last + 1e-12, 'alpha 必须单调下降');
  last = a;
}
assert.equal(fly.length, 0, '总寿命 1.05s 后必须清空');

// 9. 多条飘字按高度排序（远的先画）
const two = [];
addPopup(two, { x: 0, y: 0, z: 0, value: 10 });
addPopup(two, { x: 3, y: 2, z: 0, value: 10 });
stepPopups(two, 0.1);
const sorted = stepPopups(two, 0);
assert.ok(sorted[0].y <= sorted[1].y);

// 10. 非法输入
assert.throws(() => addPopup([], { value: 0 }), RangeError);
assert.throws(() => stepPopups([], -1), RangeError);

console.log('PASS squad-hud：槽/绿条比例、低血告警色、受击闪红窗口、近距离合并 +20、远距离另起、单调淡出与寿命移除、排序与非法输入');
