// r56 C08 · 1765041830461055127 REACode RectBin interface over the shared Atlas + long add/remove churn
import assert from 'node:assert/strict';
import { RectBin, churn, treeNodes } from '../src/core/rectbin-c08.js';
const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const b = new RectBin(64, 64);
// REACode API surface
for (const k of ['leaves', 'canPlace', 'place', 'remove', 'recursiveFill', 'report']) assert.equal(typeof b[k], 'function', k);
const s1 = b.place('a', 10, 10, { rng: () => .5 }); assert.deepEqual([s1.x, s1.y, s1.w, s1.h], [0, 0, 10, 10]);
assert.equal(b.canPlace(5, 5, 4, 4), false); assert.equal(b.canPlace(10, 0, 4, 4), true);
assert.equal(b.place('big', 65, 2), null);
assert.ok(b.remove('a')); assert.ok(!b.remove('a'));
assert.equal(b.report().leaves, 1, 'removal merges back to one leaf');
// long churn: invariants every step chunk
const curve = churn(b, { steps: 1500, seed: 9 });
const live = [...b.placed.values()];
for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) assert.ok(!ov(live[i], live[j]), 'no overlap');
for (const r of live) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 64 && r.y + r.h <= 64);
// cross-leaf: at least one live rect occupies several leaves (Atlas.allocateAt)
assert.ok(live.some((r) => r.leaves > 1), 'cross-leaf allotment exists');
const rep = b.report(), late = curve.slice(-50);
const meanFill = late.reduce((s, c) => s + c.fill, 0) / late.length;
assert.ok(meanFill > .45, 'still packs tight late in churn: ' + meanFill);
assert.ok(rep.merges > 0 && rep.splits > 0 && rep.removals > 0);
// fragmentation visible: free space split into many leaves
assert.ok(rep.freeLeaves > 10, 'fragmented free space');
// every used leaf belongs to a placed rect; tree nodes consistent
const nodes = treeNodes(b); assert.equal(nodes.filter((n) => n.leaf).length, rep.leaves);
for (const n of nodes.filter((n) => n.leaf && n.used)) assert.ok(live.some((r) => n.x >= r.x && n.y >= r.y && n.x + n.w <= r.x + r.w && n.y + n.h <= r.y + r.h));
// remove everything → single free leaf again
for (const k of [...b.placed.keys()]) assert.ok(b.remove(k));
assert.equal(b.report().leaves, 1); assert.equal(b.report().fill, 0);
console.log({ meanFillLate: +meanFill.toFixed(3), freeLeaves: rep.freeLeaves, largestShare: +rep.largestShare.toFixed(3), merges: rep.merges, splits: rep.splits, crossLeaf: live.filter((r) => r.leaves > 1).length });
console.log('PASS rectbin-c08');
