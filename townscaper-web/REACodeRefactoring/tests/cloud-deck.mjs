// r53 G4: REACode clouddeck.js — three-depth deck, parallax speed ∝ 1/depth, max density,
// shadow = projected cloud field on receivers at any height (roof / ground / water).
import assert from 'node:assert/strict';
import { makeCloudDeck, CLOUD_DECK_LAYERS, cloudDepth } from '../src/core/cloud-depth.js';
const deck = makeCloudDeck({ seed: 11, wind: [1.5, .3] });
assert.equal(deck.layers.length, 3);
// parallax: speeds inversely proportional to depth
const sp = deck.layers.map((l) => Math.hypot(l.vx, l.vz));
assert.ok(Math.abs(sp[2] / sp[0] - CLOUD_DECK_LAYERS[0].depth / CLOUD_DECK_LAYERS[2].depth) < 1e-12);
assert.ok(CLOUD_DECK_LAYERS[0].blur > CLOUD_DECK_LAYERS[2].blur, 'far layer blurrier');
assert.equal(cloudDepth(2), CLOUD_DECK_LAYERS[2].depth, 'same depth groups as existing near-cloud drift');
// density = max, not sum: never exceeds 1 even with overlapping puffs
let mx = 0; for (let x = -40; x < 40; x += .5) for (let z = -20; z < 20; z += .5) mx = Math.max(mx, deck.density(1, x, z));
assert.ok(mx <= 1 && mx > .5);
// a layer translates rigidly with time
const t = 7.3, L = deck.layers[1];
for (let i = 0; i < 50; i++) { const x = -30 + i, z = (i % 7) - 3; assert.ok(Math.abs(deck.density(1, x + L.vx * t, z + L.vz * t, t) - deck.density(1, x, z, 0)) < 1e-9); }
// shadow is the cloud field projected along the sun, receiver height changes the offset
const sun = [.5, .8, .2];
for (const y of [0, .03, 1.5]) {   // ground, water surface, roof
  for (let i = 0; i < 60; i++) {
    const x = -25 + i * .8, z = 1.3, s = (deck.layers[1].height - y) / sun[1];
    assert.ok(Math.abs(deck.shadowAt(x, y, z, sun, 2) - .46 * deck.density(1, x + sun[0] * s, z + sun[2] * s, 2)) < 1e-12);
  }
}
const roof = [], ground = [];
for (let i = 0; i < 200; i++) { roof.push(deck.shadowAt(-40 + i * .4, 1.5, 0, sun)); ground.push(deck.shadowAt(-40 + i * .4, 0, 0, sun)); }
assert.notDeepEqual(roof, ground, 'roof and ground receive differently offset shadows');
assert.equal(deck.shadowAt(0, 20, 0, sun), 0, 'receiver above the deck is unshadowed');
assert.equal(deck.shadowAt(0, 0, 0, [0, -1, 0]), 0, 'night sun casts nothing');
// shadow cover sweeps over time (not a constant darkening)
let lo = 1, hi = 0;
for (let k = 0; k < 24; k++) { let dark = 0; for (let x = -20; x <= 20; x += .5) if (deck.shadowAt(x, 0, 0, sun, k * 2) > .23) dark++; lo = Math.min(lo, dark / 81); hi = Math.max(hi, dark / 81); }
assert.ok(hi - lo > .1, `cover sweeps ${lo.toFixed(2)}..${hi.toFixed(2)}`);
assert.throws(() => deck.density(1, NaN, 0));
console.log('PASS cloud deck', { speedRatio: (sp[2] / sp[0]).toFixed(2), cover: [lo.toFixed(2), hi.toFixed(2)] });
