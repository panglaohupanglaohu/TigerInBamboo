// r55 splice (1584623053061099520 "would be useful insert them at will too"): spliced houses are
// part of the save string (v5 tail), of World.snapshot/restore (undo stack) and of the editor toggle.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { spliceHouse, toggleSplice } = await import('../src/build/splice.js');
const { encodeWorld, decodeWorld } = await import('../src/world/save.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const entries = (w) => w.splicedHouses?.size ? [...w.splicedHouses].sort((a, b) => a[0] - b[0]) : [];
let houses = 0, legacyChecked = 0, undoChecked = 0;
for (const kind of ['quad', 'mixed']) for (const [seed, opts] of [[7, {}], [19, { rivers: 2 }], [5, { rivers: 0 }]]) {
  const w = new F.World(F.grid(kind)); w.palette = F.PALETTES.town; generateTerrain(w, { seed, ...opts });
  w.grid.radius = kind === 'quad' ? 14 : 22;
  // legacy: a save written before any splice equals the old byte string and reads back with no houses
  const legacy = encodeWorld(w, 'terrain');
  const ok = w.cells.filter((c) => spliceHouse(Object.create(w), c.id).ok);
  assert.ok(ok.length > 20);
  const pick = ok.filter((_, i) => i % 7 === 0).slice(0, 18);
  const snap0 = w.snapshot();
  assert.equal(snap0.spliced, null, 'no overlay -> null in snapshot');
  for (const c of pick) assert.equal(toggleSplice(w, c), true);
  w.splicedHouses.get(pick[0].id).inset = .27; w.splicedHouses.get(pick[1].id).sink = .13; w.splicedHouses.get(pick[2].id).stories = 4;
  const snap1 = w.snapshot();
  const code = encodeWorld(w, 'terrain');
  assert.ok(code.length > legacy.length && code.startsWith(legacy.slice(0, -1)), 'splices are an appended tail');
  // round trip into a fresh World: voxels, river flow and houses identical
  const b = new F.World(w.grid); b.palette = w.palette;
  assert.equal(decodeWorld(code, b), 'terrain');
  assert.deepEqual(b.snapshot(), snap1);
  assert.deepEqual(entries(b), entries(w));
  if (w.riverFlow) assert.ok(b.riverFlow, 'flow tail still read before the splice tail');
  assert.equal(encodeWorld(b, 'terrain'), code, 'canonical');
  // legacy string decodes into b: houses cleared, voxels same
  decodeWorld(legacy, b); assert.equal(b.splicedHouses, null); assert.deepEqual(b.snapshot(), snap0); legacyChecked++;
  // rendered: terrain mesh on the decoded world shows the same splices
  decodeWorld(code, b);
  const ma = new F.MeshWriter(), mb = new F.MeshWriter();
  const ra = buildTerrain(ma, w, { L: F.L }), rb = buildTerrain(mb, b, { L: F.L });
  assert.equal(rb.splices.length, pick.length); assert.deepEqual(mb.pos, ma.pos);
  // undo/redo through the snapshot path used by app.js (pushUndo(world.snapshot()) / world.restore)
  const undo = [snap0], redo = [];
  redo.push(w.snapshot()); w.restore(undo.pop());
  assert.equal(w.splicedHouses, null, 'undo removes houses');
  const m0 = new F.MeshWriter(); buildTerrain(m0, w, { L: F.L });
  const mPlain = new F.MeshWriter(); const plain = new F.World(w.grid); plain.restore(snap0); buildTerrain(mPlain, plain, { L: F.L });
  assert.equal(m0.pos.length, mPlain.pos.length, 'undo restores the old terrain mesh');
  undo.push(w.snapshot()); w.restore(redo.pop());
  assert.deepEqual(entries(w), entries(b), 'redo restores houses with their parameters'); undoChecked++;
  // snapshot is a deep copy: editing the live overlay does not mutate the stored frame
  w.splicedHouses.get(pick[3].id).stories = 3; assert.notEqual(snap1.spliced.find(([id]) => id === pick[3].id)[1].stories, 3);
  // editor toggle removes
  assert.equal(toggleSplice(w, pick[4]), true); assert.ok(!w.splicedHouses.has(pick[4].id));
  // reset clears overlay
  const tmp = new F.World(w.grid); tmp.restore(w.snapshot()); tmp.reset(); assert.equal(tmp.snapshot().spliced, null);
  houses += pick.length;
  // atomic rejection: a splice record on a sea cell must not touch the live world
  const sea = w.cells.find((c) => w.ground(c) === 0);
  const forged = new F.World(w.grid); forged.restore(snap0); forged.splicedHouses = new Map([[sea.id, { inset: .2, stories: 1, sink: .08 }]]);
  const bad = encodeWorld(forged, 'terrain');
  const before = b.snapshot(), v = b.version;
  assert.throws(() => decodeWorld(bad, b), /裸露岩顶/); assert.deepEqual(b.snapshot(), before); assert.equal(b.version, v);
  assert.throws(() => decodeWorld(code + '1', b)); assert.deepEqual(b.snapshot(), before);
}
// toggle refuses sea / built-over cells
{ const w = new F.World(F.grid('quad')); generateTerrain(w, { seed: 7 }); const sea = w.cells.find((c) => w.ground(c) === 0); const v = w.version; assert.equal(toggleSplice(w, sea), false); assert.equal(w.version, v); }
console.log('PASS splice save/undo/editor:', { houses, legacyChecked, undoChecked });
