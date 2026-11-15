// 1710031224838771027 / 1712088611934371876: 8-corner feature colour volumes on the shared World.
import assert from 'node:assert/strict';
import { buildQuadGrid } from '../src/core/grid.js';
import { decorateCells } from '../src/core/spatial.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { makeCornerVolume, sampleCornerVolume, setVolumeCorner, volumeStrip, volumeSheet, cornerVolumeStats, defaultFeatureVolumes, classifyWorldFeature, colorWorldFeatures, makeColorVolume, sampleColorVolume } from '../src/core/color-volume.js';
import { srgbToOklab, deltaE } from '../src/core/oklab.js';
const corners = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#000000', '#ffffff'];
for (const space of ['oklab', 'srgb', 'linear']) {
  const v = makeCornerVolume('t', corners, { space });
  for (let i = 0; i < 8; i++) { const c = sampleCornerVolume(v, i & 1, (i >> 1) & 1, (i >> 2) & 1); assert(c.every((x, k) => Math.abs(x - v.rgb[i][k]) < 1e-5), space + ' corner ' + i); }
  assert.deepEqual(sampleCornerVolume(v, -3, 9, .5), sampleCornerVolume(v, 0, 1, .5), 'clamped');
}
// Spaces really differ at the midpoint (red↔green): OKLab keeps lightness, sRGB dips.
const rg = (s) => makeCornerVolume('rg', ['#ff0000', '#00ff00', '#ff0000', '#00ff00', '#ff0000', '#00ff00', '#ff0000', '#00ff00'], { space: s });
const L = (s) => srgbToOklab(...sampleCornerVolume(rg(s), .5, 0, 0))[0];
assert(L('oklab') > L('srgb') + .03, 'oklab midpoint not muddy');
// Free drag of one corner only changes samples touching it
const base = makeCornerVolume('b', corners), moved = setVolumeCorner(base, 7, '#808080');
assert.deepEqual(sampleCornerVolume(moved, 0, 0, 0), sampleCornerVolume(base, 0, 0, 0)); assert.notDeepEqual(sampleCornerVolume(moved, 1, 1, 1), sampleCornerVolume(base, 1, 1, 1));
assert.equal(base.rgb[7][0], 1, 'original volume immutable');
assert.equal(volumeStrip(base, 12).length, 12); assert.equal(volumeSheet(base, 12, 5).length, 5);
// Five clip features: separated (minGap>8 ΔE) yet each has internal variation (extent>4)
const vols = defaultFeatureVolumes(), names = Object.keys(vols);
assert.deepEqual(names, ['Grass', 'Roof', 'Cliff', 'Beach', 'Flowers']);
const st = cornerVolumeStats(Object.values(vols));
assert(st.minGap > 8, 'features never share colours: ' + st.minGap); assert(st.extents.every((e) => e > 4), 'not a dead single colour');
// Shared World classification
const w = new World(decorateCells(buildQuadGrid({ radius: 10 }))); generateTerrain(w, { seed: 7, rivers: 0, caves: 0 });
const roofCell = w.cells.find((c) => w.top(c) >= 3); w.setSolid(roofCell, w.top(roofCell) + 1, true);
assert.equal(classifyWorldFeature(w, roofCell).feature, 'Roof');
assert.equal(classifyWorldFeature(w, w.cells.find((c) => !w.top(c))), null, 'water cells skipped');
const r = colorWorldFeatures(w, vols);
for (const f of names) assert(r.used[f] > 0, 'feature present on real World: ' + f);
for (const c of w.cells) { const f = r.feature[c.id]; if (!f) continue; const col = [...r.rgb.slice(c.id * 3, c.id * 3 + 3)], own = srgbToOklab(...col);
  // every coloured cell is closer to its own volume than any other feature's samples allow
  for (const other of names) if (other !== f) { let m = Infinity; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) m = Math.min(m, deltaE(own, srgbToOklab(...sampleCornerVolume(vols[other], i / 4, j / 4, k / 4)))); assert(m > 3, `${f} cell drifted into ${other}`); } }
const cliffs = w.cells.filter((c) => r.feature[c.id] === 'Cliff'); assert(cliffs.every((c) => classifyWorldFeature(w, c).v >= .75));
// Existing HSL API untouched
assert.deepEqual(sampleColorVolume(makeColorVolume({ h: [.95, .05], s: [1, 1], l: [.5, .5] }), .5, .5, .5), [1, 0, 0]);
assert.throws(() => makeCornerVolume('x', corners.slice(0, 7)), RangeError); assert.throws(() => makeCornerVolume('x', corners, { space: 'hsv' }), RangeError); assert.throws(() => setVolumeCorner(base, 8, '#000000'), RangeError);
console.log('PASS 8-corner volumes (oklab/srgb/linear), corner drag, 5 separated features on shared World', JSON.stringify({ minGap: +st.minGap.toFixed(1), extents: st.extents.map((e) => +e.toFixed(1)), used: r.used }));
