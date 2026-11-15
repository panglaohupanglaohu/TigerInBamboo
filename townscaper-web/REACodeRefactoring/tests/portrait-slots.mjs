// r53 G4: REACode portrait.js — content-agnostic slot table, deterministic specs, silhouette IoU diversity.
import assert from 'node:assert/strict';
import { PORTRAIT_SLOTS, sampleSlots, portraitSilhouette, silhouetteDiversity, partSeed } from '../src/core/part-random.js';
const specs = Array.from({ length: 24 }, (_, i) => sampleSlots(partSeed(7, i)));
assert.deepEqual(sampleSlots(5), sampleSlots(5), 'deterministic per seed');
for (const s of specs) assert.deepEqual(Object.keys(s.parts), PORTRAIT_SLOTS.map((x) => x.key), 'same hierarchy for every face');
assert.ok(new Set(specs.map((s) => s.parts.hair)).size >= 4, 'hair variants used');
const masks = specs.map((s) => portraitSilhouette(s, 64));
const d = silhouetteDiversity(masks);
assert.ok(d.diversity > .08 && d.diversity < .6, 'same system, different silhouettes ' + d.diversity.toFixed(3));
const same = silhouetteDiversity([masks[0], masks[0], masks[0]]); assert.equal(same.diversity, 0);
let s = 1; const noise = Array.from({ length: 6 }, () => Uint8Array.from({ length: 4096 }, () => ((s = (s * 16807) % 2147483647) & 1)));
assert.ok(silhouetteDiversity(noise).diversity > d.diversity + .2, 'noise is far more diverse than the hierarchy');
// content agnostic: a banner table runs through the same sampler; order constraints enforced
const BANNER = [{ key: 'cloth', variants: ['swallow', 'square'], provides: 'field' }, { key: 'emblem', variants: ['ring', 'axe', 'tree'], needs: 'field' }];
assert.deepEqual(Object.keys(sampleSlots(3, BANNER).parts), ['cloth', 'emblem']);
assert.throws(() => sampleSlots(3, [BANNER[1], BANNER[0]]), /needs field/);
assert.throws(() => sampleSlots(0));
console.log('PASS portrait slots', { faces: specs.length, diversity: +d.diversity.toFixed(3), meanIoU: +d.meanIoU.toFixed(3) });
