// 第 60 轮 · 903647529203634176：击杀 "+10" 并进伤害数字同一套池子（kind='kill'）+ 同帧多个飘字横向错位。
import assert from 'node:assert/strict';
import { DMG_PER_HP, KILL_VALUE, damageValue, addDamageNumber, stepDamageNumbers, styleFor } from '../src/badnorth/damage-numbers.js';

// 1) 值口径不变：1 点血 = +4
assert.equal(damageValue(3, 2), DMG_PER_HP);
assert.equal(damageValue(3, 3), 0);

// 2) 伤害数字：同单位连击合并，不同单位各一条
const l = [];
addDamageNumber(l, { unitId: 1, x: 0, y: 0, z: 0, value: 4 });
addDamageNumber(l, { unitId: 1, x: 0, y: 0, z: 0, value: 4 });
assert.equal(l.length, 1);
assert.equal(l[0].text, '+8');
addDamageNumber(l, { unitId: 2, x: 0.05, y: 0, z: 0, value: 4 });
assert.equal(l.length, 2, '不同单位不能被合并');

// 3) 击杀：不同单位按距离合并（同一瞬间两个 +10 → +20）
const k = [];
addDamageNumber(k, { unitId: 7, x: 0, y: 0, z: 0, value: KILL_VALUE, kind: 'kill' });
addDamageNumber(k, { unitId: 8, x: 0.2, y: 0, z: 0, value: KILL_VALUE, kind: 'kill' });
assert.equal(k.length, 1);
assert.equal(k[0].text, '+20');
assert.equal(k[0].kind, 'kill');

// 4) 两种 kind 互不合并（伤害池里的 +4 不会被 +10 吞掉）
const mixed = [];
addDamageNumber(mixed, { unitId: 1, x: 0, y: 0, z: 0, value: 4 });
addDamageNumber(mixed, { unitId: 1, x: 0, y: 0, z: 0, value: KILL_VALUE, kind: 'kill' });
assert.equal(mixed.length, 2);
assert.deepEqual(mixed.map((p) => p.kind), ['damage', 'kill']);

// 5) 横向错位：同点同帧的第二条让开，不叠在一坨
const s = [];
const a = addDamageNumber(s, { unitId: 1, x: 1, y: 0, z: 1, value: 4 });
const b = addDamageNumber(s, { unitId: 2, x: 1, y: 0, z: 1, value: 4 });
assert.equal(a.sx, 0);
assert.ok(Math.abs(b.sx) > 0, '第二条必须横向让开');
assert.ok(Math.abs(a.x + a.sx - (b.x + b.sx)) >= 0.05, '错位后仍重叠');

// 6) 外观：击杀金色、伤害奶油白，字号一致
assert.notEqual(styleFor('kill').fill, styleFor('damage').fill);
assert.equal(styleFor('kill').heightPx, styleFor('damage').heightPx);

// 7) step 保留 kind / sx，且到期移除
const snap = stepDamageNumbers(s, 0.05);
assert.ok(snap.every((p) => p.kind === 'damage' && Number.isFinite(p.sx)));
const gone = stepDamageNumbers(s, 5);
assert.equal(gone.length, 0);
assert.equal(s.length, 0);

// 8) 非法入参
assert.throws(() => addDamageNumber([], { value: 0 }), RangeError);
assert.throws(() => addDamageNumber([], { value: 4, kind: 'heal' }), RangeError);

console.log('PASS damage-numbers-kind：合并口径 / kind 隔离 / 横向错位 / 金色样式 全部符合');
