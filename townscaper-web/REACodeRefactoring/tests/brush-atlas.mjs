// r53 G4: REACode engine/bnbrush.js — tileable directional scratch atlas vs hash "pepper" dots.
import assert from 'node:assert/strict';
import { buildScratchAtlas, scratchStats, blockCoherence } from '../src/core/brush-atlas.js';
const a = buildScratchAtlas({ size: 128, seed: 7, counts: [175, 312] });   // same density per area as 256²/700+1250
const st = scratchStats(a);
assert.ok(st.cover > .2 && st.cover < .65, 'sparse-but-present strokes ' + st.cover);
// pepper: same coverage made of independent 1-px dots
const pepper = { size: 128, data: new Uint8Array(128 * 128 * 4) };
let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 128 * 128; i++) pepper.data[i * 4] = r() < st.cover ? 255 : 0;
const ps = scratchStats(pepper);
assert.ok(Math.abs(ps.cover - st.cover) < .03);
assert.ok(st.edgeEnergy < ps.edgeEnergy * .6, `strokes form continuous shapes: edge ${st.edgeEnergy.toFixed(3)} vs pepper ${ps.edgeEnergy.toFixed(3)}`);
const cs = blockCoherence(a, { block: 6 }), cp = blockCoherence(pepper, { block: 6 });
assert.ok(cs > cp + .1, `directional scratches ${cs.toFixed(3)} > pepper ${cp.toFixed(3)}`);
// tiles: wrap seam no stronger than interior
const seam = (d, n) => { let e = 0; for (let y = 0; y < n; y++) e += Math.abs(d[(y * n) * 4] - d[(y * n + n - 1) * 4]); return e; };
const inner = (d, n) => { let e = 0; for (let y = 0; y < n; y++) e += Math.abs(d[(y * n + 63) * 4] - d[(y * n + 64) * 4]); return e; };
assert.ok(seam(a.data, 128) < inner(a.data, 128) * 1.6 + 400, 'tileable');
// density channel is low-frequency (much smoother than R)
let gR = 0, gB = 0; for (let i = 0; i < 128 * 127; i++) { gR += Math.abs(a.data[i * 4] - a.data[(i + 1) * 4]); gB += Math.abs(a.data[i * 4 + 2] - a.data[(i + 1) * 4 + 2]); }
assert.ok(gB < gR / 3, 'B is a low-frequency density field');
assert.deepEqual(buildScratchAtlas({ size: 64, seed: 2 }).data, buildScratchAtlas({ size: 64, seed: 2 }).data, 'deterministic');
assert.throws(() => buildScratchAtlas({ size: 30 }));
console.log('PASS scratch atlas', { cover: +st.cover.toFixed(3), edge: +st.edgeEnergy.toFixed(3), pepperEdge: +ps.edgeEnergy.toFixed(3), coherence: +cs.toFixed(3), pepperCoherence: +cp.toFixed(3) });
