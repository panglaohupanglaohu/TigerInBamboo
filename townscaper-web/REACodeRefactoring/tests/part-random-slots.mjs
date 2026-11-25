/**
 * 958371606350454784 · 槽位表数据接口 + 剪影 IoU（纯逻辑）。
 *
 * 片子里是同一套「层级部件」走表器换出 88 张不同脸：脸形/发型/眉/眼/鼻/嘴/雀斑组合变，
 * 背景与构图不变（见 artifacts/coverage/958371606350454784-review-r177.md）。
 * 本测试只锁两件事：
 *   1. spec 是纯数据、可序列化、内容无关（换一张表就换内容，走表逻辑零改动）；
 *   2. 剪影度量（portraitSilhouette / silhouetteDiversity）在同 spec 上是恒等、跨 seed 上有差异。
 */
import assert from 'node:assert/strict';
import { sampleSlots, portraitSilhouette, silhouetteDiversity, partSeed, PORTRAIT_SLOTS } from '../src/core/part-random.js';

/* 1. spec 结构：键序与槽位表一致、取值都在各自 variants 里、可 JSON 往返 */
const slotKeys = PORTRAIT_SLOTS.map((s) => s.key);
assert.deepEqual(slotKeys, ['bg', 'head', 'ear', 'hair', 'brow', 'eye', 'nose', 'mouth', 'marks']);
for (let seed = 1; seed <= 2000; seed++) {
  const spec = sampleSlots(seed);
  assert.equal(spec.seed, seed);
  assert.deepEqual(Object.keys(spec.parts), slotKeys);
  for (const s of PORTRAIT_SLOTS) assert.ok(s.variants.includes(spec.parts[s.key]), `${s.key} 越界`);
  assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec, 'spec 不是纯数据');
  assert.ok(spec.params.wide >= .9 && spec.params.wide <= 1.16);
  assert.ok(spec.params.long >= .9 && spec.params.long <= 1.16);
  assert.ok(Math.abs(spec.params.drop) <= .03);
}
console.log('PASS 2000 specs: 9 slot keys in order, every variant legal, JSON round-trip, params in range');

/* 2. 确定性：同 seed 逐字段相等（重画 / 切页 / 换列都不该改身份） */
for (let seed = 1; seed <= 500; seed++) assert.deepEqual(sampleSlots(seed), sampleSlots(seed));
console.log('PASS same seed reproduces the same spec field-by-field');

/* 3. 内容无关：换一张槽位表，同一个走表器画出完全不同的内容 */
const TWO_SLOTS = [
  { key: 'cap', variants: ['A', 'B', 'C'], provides: 'cap' },
  { key: 'visor', variants: ['x', 'y'], needs: 'cap' },
];
const swapped = sampleSlots(7, TWO_SLOTS);
assert.deepEqual(Object.keys(swapped.parts), ['cap', 'visor']);
assert.ok(TWO_SLOTS[0].variants.includes(swapped.parts.cap));
assert.ok(TWO_SLOTS[1].variants.includes(swapped.parts.visor));
assert.notDeepEqual(swapped.parts, sampleSlots(7).parts, '换表没换内容');
assert.deepEqual(sampleSlots(7, TWO_SLOTS), swapped, '换表后同 seed 不再确定');
console.log('PASS content-agnostic: same walker, different slot table, different parts');

/* 4. 约束：needs 必须先提供；非法 seed / 非法槽位要报错 */
assert.throws(() => sampleSlots(7, [{ key: 'b', variants: ['1'], needs: 'a' }, { key: 'a', variants: ['1'], provides: 'a' }]), /needs a/);
assert.throws(() => sampleSlots(7, [{ key: 'a' }]), /Invalid slot/);
assert.throws(() => sampleSlots(7, [{ key: 'a', variants: [] }]), /Invalid slot/);
assert.throws(() => sampleSlots(0), /Invalid slot sample/);
assert.throws(() => sampleSlots(1.5), /Invalid slot sample/);
assert.throws(() => sampleSlots(7, []), /Invalid slot sample/);
console.log('PASS dependency order enforced, invalid seed / slot table rejected');

/* 5. 剪影：同 spec 恒等；不同 head/ear/hair 变体给出不同掩码；hood 覆盖更多、bald 最少 */
const base = sampleSlots(4242);
const mask = portraitSilhouette(base, 64);
assert.equal(mask.length, 4096);
assert.deepEqual(portraitSilhouette(base, 64), mask);
const count = (m) => m.reduce((a, b) => a + b, 0);
const area = (patch) => count(portraitSilhouette({ ...base, parts: { ...base.parts, ...patch } }, 64));
const bald = area({ hair: 'bald' }), hood = area({ hair: 'hood' }), side = area({ hair: 'sidePart' });
const narrow = area({ head: 'narrow' }), oval = area({ head: 'oval' });
const earBig = area({ ear: 'big' }), earSmall = area({ ear: 'small' });
assert.ok(side > bald && hood > bald, `发型没进剪影：bald ${bald} side ${side} hood ${hood}`);
assert.ok(side > bald && hood > side, `hood 应最大：side ${side} hood ${hood}`);
assert.ok(narrow < oval, `窄脸剪影没变小：${narrow} vs ${oval}`);
assert.ok(earBig > earSmall, `大耳剪影没变大：${earBig} vs ${earSmall}`);
assert.ok(bald > 1000 && bald < 4096, `剪影覆盖率异常：${bald}`);
assert.throws(() => portraitSilhouette(base, 4), /Invalid silhouette size/);
assert.throws(() => portraitSilhouette(base, 64.5), /Invalid silhouette size/);
console.log(`PASS silhouette: identity, hair ${bald}/${side}/${hood}, head ${narrow}/${oval}, ear ${earSmall}/${earBig}`);

/* 6. IoU：同一剪影 1/0；24 张脸的差异与均匀度落在实测区间 */
assert.deepEqual(silhouetteDiversity([mask, mask]).meanIoU, 1);
assert.equal(silhouetteDiversity([mask, mask]).diversity, 0);
const blank = new Uint8Array(4096), full = new Uint8Array(4096).fill(1);
assert.equal(silhouetteDiversity([blank, full]).meanIoU, 0);
assert.equal(silhouetteDiversity([blank, full]).diversity, 1);
assert.throws(() => silhouetteDiversity([mask]), /Need at least two masks/);
const masks = Array.from({ length: 24 }, (_, i) => portraitSilhouette(sampleSlots(partSeed(7, i)), 64));
const d = silhouetteDiversity(masks);
assert.equal(d.pairs, 276);
assert.ok(d.diversity > 0.15 && d.diversity < 0.6, `diversity 越界 ${d.diversity}`);
assert.ok(d.meanIoU > 0.4 && d.meanIoU < 0.85, `meanIoU 越界 ${d.meanIoU}`);
const hairs = new Set(Array.from({ length: 24 }, (_, i) => sampleSlots(partSeed(7, i)).parts.hair));
assert.ok(hairs.size >= 4, `24 张里发型太少：${[...hairs]}`);
console.log(`PASS IoU: identity 1/0, unrelated 0/1, 24 faces diversity ${d.diversity.toFixed(3)} meanIoU ${d.meanIoU.toFixed(3)} hairs ${hairs.size}`);
