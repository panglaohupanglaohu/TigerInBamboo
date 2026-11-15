// r55 propanim (1246074663546916873 "props now animate when they appear and disappear"): the slot
// record table is wired to one merged prop mesh derived from the shared World (prop-anim-layer.js).
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { PropAnimLayer, collectWorldProps, propVerts } = await import('../src/world/prop-anim-layer.js');
const { classifyCourtyards } = await import('../src/core/courtyards.js');
let checked = 0;
for (const kind of ['quad', 'mixed']) for (const seed of [7, 11]) {
  const w = F.world(kind, 'town', seed);
  const props = collectWorldProps(w, { L: F.L });
  assert.ok(props.length > 20, 'town scene has World-derived props ' + props.length);
  assert.equal(new Set(props.map((p) => p.key)).size, props.length, 'unique keys');
  const { mask } = classifyCourtyards(w);
  for (const p of props) { assert.equal(w.top(w.cells[p.cell]), 1); if (p.kind === 'crate') assert.equal(mask[p.cell], 1); }
  const layer = new PropAnimLayer(w, { L: F.L, capacity: 2048 });
  const slotAttr = layer.geometry.attributes.aPropSlot.array;
  // slot attribute: each slot owns a fixed vertex range
  assert.equal(slotAttr.length, 2048 * 72); assert.equal(slotAttr[72 * 5 + 3], 5);
  const r0 = layer.refresh(0); layer.update(0);
  assert.equal(r0.born, props.length);
  // geometry of a slot is the prop template at its root, records start at scale 0 and spring up left→right
  const p0 = props[0], s0 = layer.life.slotOf(p0.key), vs = propVerts(p0, F.L);
  assert.deepEqual([...layer.pos.slice(s0 * 216, s0 * 216 + 3)].map((x) => +x.toFixed(5)), vs[0].p.map((x) => +x.toFixed(5)));
  layer.update(.15);
  const xs = props.map((p) => [p.x, layer.scaleOf(p.key)]).sort((a, b) => a[0] - b[0]);
  assert.ok(xs[0][1] > xs[xs.length - 1][1], 'stagger wave left to right');
  layer.update(2);
  for (const p of props) assert.ok(Math.abs(layer.scaleOf(p.key) - 1) < .01, 'settled');
  // a World edit elsewhere (paint) -> refresh: nothing born, no geometry upload, no restart
  const slots = new Map(props.map((p) => [p.key, layer.life.slotOf(p.key)]));
  const c0 = w.cells.find((c) => w.top(c) > 2); w.color[c0.id] = (w.color[c0.id] + 1) % 5; w.touch();
  const r1 = layer.refresh(2.1); layer.update(2.1);
  assert.equal(r1.born, 0); assert.equal(r1.floats, 0, 'unchanged props upload nothing');
  for (const p of props) { assert.equal(layer.life.slotOf(p.key), slots.get(p.key)); assert.ok(Math.abs(layer.scaleOf(p.key) - 1) < .01); }
  // remove a courtyard wall cell's quay: erase a yard cell -> its crate shrinks with old geometry, slot freed later
  const crate = props.find((p) => p.kind === 'crate') ?? null;
  const victim = crate ?? props[0];
  const posBefore = layer.pos.slice(slots.get(victim.key) * 216, slots.get(victim.key) * 216 + 216);
  w.fill(w.cells[victim.cell], 0); // erase the quay cell → prop disappears (and maybe neighbours change)
  const r2 = layer.refresh(3); layer.update(3.05);
  const sv = layer.life.slotOf(victim.key);
  assert.equal(sv, slots.get(victim.key), 'vanishing prop keeps its slot');
  const sc = layer.scaleOf(victim.key); assert.ok(sc > 0 && sc < 1, 'shrinking, still drawn ' + sc);
  assert.deepEqual(layer.pos.slice(sv * 216, sv * 216 + 216), posBefore, 'old geometry kept for the shrink');
  layer.update(3.6);
  assert.equal(layer.life.slotOf(victim.key), -1, 'slot released after shrink');
  assert.equal(layer.life.records[sv * 4 + 3], 0);
  // upload comparison: incremental slot writes vs rebuilding the merged mesh on every World change
  assert.ok(layer.stats.geometryFloats < layer.stats.rebuildFloats / 1.8, JSON.stringify(layer.stats));
  assert.ok(r2.floats < props.length * 72 * 9 / 4);
  // re-adding: restore -> same key grows again
  w.fill(w.cells[victim.cell], 1); w.color[victim.cell] = 0; w.touch();
  layer.refresh(4); layer.update(4.02);
  if (collectWorldProps(w, { L: F.L }).some((p) => p.key === victim.key)) { const s = layer.scaleOf(victim.key); assert.ok(s !== null && s < .5, 'regrows from 0'); }
  checked++;
}
// shader hook: material injects slot attribute + texelFetch of the record texture
{
  const w = F.world('quad', 'town', 7), layer = new PropAnimLayer(w);
  const sh = { uniforms: {}, vertexShader: 'void main(){\n#include <begin_vertex>\n}' };
  layer.material.onBeforeCompile(sh);
  assert.ok(sh.uniforms.uPropRec.value === layer.recTex && /attribute float aPropSlot/.test(sh.vertexShader) && /propScaled\(transformed, propRec\)/.test(sh.vertexShader));
  assert.equal(layer.recTex.image.data, layer.life.records, 'records table is the uploaded texture');
}
console.log('PASS prop-anim layer: World-derived props, slot attribute, no restart on rebuild, shrink-then-release, incremental upload', { checked });
