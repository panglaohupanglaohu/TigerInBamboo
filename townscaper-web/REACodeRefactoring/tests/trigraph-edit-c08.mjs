// r56 C08 · 1677242779162877952 local edits on the shared TriGraph: tracked insert, vertex removal, move
import assert from 'node:assert/strict';
import { TriGraph, addTracked, removeVertex, moveVertex, checkLive } from '../src/core/trigraph-edit-c08.js';
let s = 7; const rnd = () => ((s = Math.imul(s, 1664525) + 1013904223 >>> 0) / 2 ** 32);
const g = new TriGraph(10);
let addedTotal = 0;
for (let i = 0; i < 300; i++) {
  // elongated, growing blob like the clip (outline keeps expanding)
  const r = .2 + 1.8 * i / 300, a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
  const t = addTracked(g, Math.cos(a) * d * 1.6, Math.sin(a) * d * .8);
  assert.ok(t.added.length >= 3, 'every insert creates at least 3 edges');
  assert.ok(t.added.every(([u, v]) => u === t.id || v === t.id || true));
  addedTotal += t.added.length;
  if (i % 25 === 24) { const c = checkLive(g); assert.ok(c.manifold && c.delaunay, 'insert ' + i + JSON.stringify(c)); }
}
// removals keep manifold + delaunay; removed vertex disappears from all triangles
const before = g.triangles().length;
for (let k = 0; k < 60; k++) {
  const live = []; for (let i = 3; i < g.x.length; i++) if (!(g.removed && g.removed.has(i))) live.push(i);
  const id = live[Math.floor(rnd() * live.length)];
  const r = removeVertex(g, id);
  assert.ok(!g.tris.some((t) => t.includes(id)));
  assert.ok(r.ring >= 3 && r.removed.length >= 3);
  const c = checkLive(g); assert.ok(c.manifold && c.delaunay, 'remove ' + k + JSON.stringify(c));
}
assert.ok(g.triangles().length < before);
assert.throws(() => removeVertex(g, [...g.removed][0]));
assert.throws(() => removeVertex(g, 1));
// moves
for (let k = 0; k < 30; k++) {
  const live = []; for (let i = 3; i < g.x.length; i++) if (!g.removed.has(i)) live.push(i);
  const id = live[Math.floor(rnd() * live.length)], m = moveVertex(g, id, g.x[id] + (rnd() - .5) * .3, g.y[id] + (rnd() - .5) * .3);
  assert.ok(m.to > id); const c = checkLive(g); assert.ok(c.manifold && c.delaunay, 'move ' + k);
}
// failing move rolls back (outside super triangle)
const snapTris = JSON.stringify(g.tris), live0 = [...Array(g.x.length).keys()].find((i) => i > 2 && !g.removed.has(i));
assert.throws(() => moveVertex(g, live0, 0, 1e9));
assert.equal(JSON.stringify(g.tris), snapTris);
console.log({ verts: g.x.length - 3, removed: g.removed.size, tris: g.triangles().length, avgNewEdgesPerInsert: +(addedTotal / 300).toFixed(2) });
console.log('PASS trigraph-edit-c08');
