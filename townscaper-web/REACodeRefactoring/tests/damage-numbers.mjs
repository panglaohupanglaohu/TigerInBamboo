// 903647529203634176：伤害数字的口径（只按真实掉血、只合并同一单位）+ 生命周期
import assert from 'node:assert/strict';
import { DMG_PER_HP, damageValue, addDamageNumber, stepDamageNumbers, DAMAGE_STYLE } from '../src/badnorth/damage-numbers.js';

// 1) 只按真实掉血算：1 点血 = +4
assert.equal(DMG_PER_HP, 4);
assert.equal(damageValue(2, 1), 4, '掉 1 点血 → +4');
assert.equal(damageValue(3, 1), 8, '掉 2 点血 → +8');
assert.equal(damageValue(1, 0), 4, '打死那一刀也给数字');
assert.equal(damageValue(2, 2), 0, '没掉血 → 不给数字（打空/格挡）');
assert.equal(damageValue(2, 3), 0, '回血不算伤害');
assert.equal(damageValue(6, 5.5), 2, '半点血四舍五入成 +2');
assert.equal(damageValue(6, 5.5, 10), 5, 'per 可换（10/点）');
assert.throws(() => damageValue(NaN, 1), RangeError);
assert.throws(() => damageValue(2, 1, 0), RangeError);

// 2) 命中集联动：**不同单位各一条**（片子里相邻三个敌人各跳各的 +4），同一单位连击才合并成 +8
const list = [];
const a = addDamageNumber(list, { unitId: 11, x: 0, y: 1, z: 0, value: 4 });
const b = addDamageNumber(list, { unitId: 12, x: 0.05, y: 1, z: 0, value: 4 });   // 位置几乎重合、但换了单位
assert.equal(list.length, 2, '不同单位不合并');
assert.equal(b.text, '+4');
assert.equal(a.text, '+4');
const c = addDamageNumber(list, { unitId: 11, x: 0.01, y: 1, z: 0, value: 4 });   // 同单位、同位置、窗口内
assert.equal(list.length, 2, '同一单位连击合并');
assert.equal(c.text, '+8');
assert.equal(c.merges, 2);
// 超出窗口不再合并
c.age = 0.5;
const d = addDamageNumber(list, { unitId: 11, x: 0.01, y: 1, z: 0, value: 4 });
assert.equal(list.length, 3, '过了合并窗口另起一条');
assert.equal(d.text, '+4');
assert.throws(() => addDamageNumber(list, { unitId: 1, x: 0, y: 0, z: 0, value: 0 }), RangeError);

// 3) 生命周期：上升 + 淡出 + 到寿命移除
const fly = [];
addDamageNumber(fly, { unitId: 7, x: 0, y: 1, z: 0, value: 4 });
let snap = stepDamageNumbers(fly, 0.1);
assert.equal(snap.length, 1);
assert.equal(snap[0].alpha, 1);
assert.ok(Math.abs(snap[0].lifted - 0.055) < 1e-9, '每秒升 0.55 → 0.1s 抬 0.055');
snap = stepDamageNumbers(fly, 0.6);
assert.ok(snap[0].alpha < 1 && snap[0].alpha > 0, '后半程开始淡出');
snap = stepDamageNumbers(fly, 0.4);
assert.equal(snap.length, 0, '超过寿命移除');
assert.equal(fly.length, 0);
assert.throws(() => stepDamageNumbers(fly, -1), RangeError);

// 4) 外观：奶油白 + 深色描边（不是纯白硬字）
assert.equal(DAMAGE_STYLE.fill, '#fff6e2');
assert.match(DAMAGE_STYLE.stroke, /rgba\(48,24,20/);

console.log('PASS 伤害数字：只按真实掉血（1 点血=+4）、不同单位不合并、同单位连击合并成 +8、0.9s 升 0.55 并淡出');
