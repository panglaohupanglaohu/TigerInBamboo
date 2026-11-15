// r53 G4: REACode uikit.js — stable keyed slots, rotated AABBs never overlap, hue walk, glyph paths.
import assert from 'node:assert/strict';
import { layoutList, hueFor, colorFor, GLYPHS, playfulJitter } from '../src/core/playful-layout.js';
const keys = Object.keys(GLYPHS);
for (const gap of [2, 6, 14]) {
  const L = layoutList(keys, { gap, maxRot: 4, maxDx: 6, maxDy: 4 });
  assert.equal(L.overlaps, 0, 'no neighbour overlap at gap ' + gap); assert.ok(L.minGapPx > 0);
  assert.ok(L.maxRotDeg > 0, 'still playful');
  L.items.forEach((it, i) => { assert.equal(it.y, i * (40 + gap), 'slot (hit target) untouched'); assert.equal(it.rot, playfulJitter(it.key, { seed: 17, width: 40, height: 40, gap, maxRot: 4, maxDx: 6, maxDy: 4 }).rot); });
}
// identity by key: reordering keeps each button's pose
const a = layoutList(keys), b = layoutList([...keys].reverse());
for (const it of a.items) assert.equal(b.items.find((x) => x.key === it.key).rot, it.rot);
const flat = layoutList(keys, { wobble: false }); assert.equal(flat.maxRotDeg, 0);
assert.equal(hueFor(0, 8), 0); assert.equal(hueFor(7, 8), 300); assert.notEqual(colorFor(0, 8).fill, colorFor(7, 8).fill);
for (const d of Object.values(GLYPHS)) assert.match(d, /^M[\d .,\-MLHVCSQTAZmlhvcsqtaz]+$/);
assert.throws(() => layoutList(['a', 'a'])); assert.throws(() => hueFor(8, 8));
console.log('PASS uikit layout', { glyphs: keys.length, maxRot: +a.maxRotDeg.toFixed(2), minGap: +a.minGapPx.toFixed(2) });
