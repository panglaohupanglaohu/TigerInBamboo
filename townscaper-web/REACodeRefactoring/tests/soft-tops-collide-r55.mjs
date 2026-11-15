// r55 G4 · src/overhangterrain.js + src/terracecliff.js (1447488323845509121 "seamless soft slopes with distinct
// sharp cliffs", 1671808851895627776 overhangs, 815236105079398400 terraces): continuous soft-top surface in the
// terrain-mesh layer (terrain/soft-tops.js, world.softTops) + collision against the drawn, cage-deformed walls
// (terrain/terrain-collide.js) + mesh-measured slope profile (core/terrace-profile.js meshSlopeProfile).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { terrainCollider } = await import('../src/terrain/terrain-collide.js');
const { meshSlopeProfile } = await import('../src/core/terrace-profile.js');
const { softCorners } = await import('../src/terrain/soft-tops.js');
const L = 0.5;
const GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };
const mesh = (w, shape, flags) => { Object.assign(w, flags); const m = new MeshWriter(); const r = buildTerrain(m, w, { L, shape }); return { verts: m.pos.length / 3, r, surf: w.terrainSurface }; };
const near = (p, q, e = 1e-9) => Math.abs(p[0] - q[0]) < e && Math.abs(p[1] - q[1]) < e && Math.abs(p[2] - q[2]) < e;

/** crack check: wherever two neighbouring top fans disagree in height at a shared corner, wall quads on that edge cover the gap. */
function cracks(w, surf) {
  const top = new Map(); for (const t of surf.tops) top.set(t.cell * 64 + t.edge, t);
  const walls = new Map(); for (const q of surf.walls) { const k = q.cell * 64 + q.edge; if (!walls.has(k)) walls.set(k, []); walls.get(k).push(q.q); }
  let checked = 0, gaps = 0, bad = [];
  for (const c of w.cells) for (let i = 0; i < c.n; i++) {
    const oid = c.edgeNeighbors[i]; if (oid < 0 || oid < c.id) continue; const o = w.cells[oid];
    if (w.river[c.id] || w.river[oid]) continue;
    const full = (x) => { const g = w.ground(x), m = (1 << g) - 1; return w.solid[x.id] === m && w.rock[x.id] === m; };
    if (!full(c) || !full(o)) continue;   // caves / overhangs are real openings, not cracks
    const k = o.edgeNeighbors.indexOf(c.id), tc = top.get(c.id * 64 + i), to = top.get(oid * 64 + k); if (!tc || !to) continue;
    // c edge i: ring[i]=a, ring[i+1]=b ; o edge k: ring[k]=b, ring[k+1]=a
    const ends = [[tc.t[1], to.t[2], 0, 3, 1, 2], [tc.t[2], to.t[1], 1, 2, 0, 3]];
    for (const [pc, po, cb, ct, ob, ot] of ends) {
      checked++;
      const lo = Math.min(pc[1], po[1]), hi = Math.max(pc[1], po[1]); if (hi - lo < 1e-9) { assert.ok(near(pc, po), 'equal-height shared corner must share xz'); continue; }
      gaps++;
      const iv = [...(walls.get(c.id * 64 + i) ?? []).map((q) => [q[cb], q[ct]]), ...(walls.get(oid * 64 + k) ?? []).map((q) => [q[ob], q[ot]])].map(([b, t]) => [b[1], t[1]]).sort((x, y) => x[0] - y[0]);
      let reach = lo; for (const [b, t] of iv) if (b <= reach + 1e-9) reach = Math.max(reach, t);
      if (reach < hi - 1e-9) bad.push({ c: c.id, o: oid, lo, hi, reach });
    }
  }
  return { checked, gaps, bad };
}

const summary = {};
for (const kind of ['quad', 'mixed']) for (const seed of [7, 11]) {
  const w = new World(decorateCells(GRIDS[kind]()));
  generateTerrain(w, { seed, softSlopes: true });
  const shape = shapeTerrain(w, {});
  // default stays bit-identical: flag absent == flag false, and no surface recorded unless asked
  delete w.softTops; delete w.terrainCollide; delete w.terrainSurface;
  const base = mesh(w, shape, {});
  assert.equal(w.terrainSurface, undefined, 'no recording unless world.terrainCollide');
  assert.equal(mesh(w, shape, { softTops: false }).verts, base.verts, 'softTops:false keeps the original mesh');
  const off = mesh(w, shape, { softTops: false, terrainCollide: true });
  assert.equal(off.verts, base.verts, 'recording does not change geometry');
  const offProfile = meshSlopeProfile(off.surf);
  assert.equal(offProfile.top.soft + offProfile.top.steep, 0, 'without soft tops every drawn top is flat');
  assert.deepEqual(cracks(w, off.surf).bad, [], 'legacy mesh is closed at neighbour corners');
  const on = mesh(w, shape, { softTops: true, terrainCollide: true });
  const sc = softCorners(w, { L });
  assert.ok(sc.vertices > 5 && sc.groups > 5, `soft corners exist on softSlopes terrain (${kind} ${seed}: ${sc.vertices})`);
  const crack = cracks(w, on.surf);
  assert.deepEqual(crack.bad, [], 'soft tops: every height gap at a shared corner is closed by a wall');
  const onProfile = meshSlopeProfile(on.surf); if (process.env.DBG) console.log('DBG', kind, seed, sc.vertices, onProfile.top, offProfile.wallArea, onProfile.wallArea);
  assert.ok(onProfile.top.soft > 0 && (sc.vertices < 50 || onProfile.top.soft > 5), 'continuous slopes appear as sloped top area');
  assert.ok(onProfile.wallArea < offProfile.wallArea, `linked one-level steps lose wall area (${offProfile.wallArea.toFixed(1)} → ${onProfile.wallArea.toFixed(1)})`);
  // seamless: a linked 1-level soft pair shares both corner heights → no wall on that edge
  let seamless = 0;
  for (const c of w.cells) for (let i = 0; i < c.n; i++) { const o = w.neighbor(c, i); if (!o || w.ground(o) !== w.ground(c) - 1 || !sc.linked(c, o)) continue; const a = c.pts[i], b = c.pts[(i + 1) % c.n]; if (sc.y(c.id, a.id) === sc.y(o.id, a.id) && sc.y(c.id, b.id) === sc.y(o.id, b.id) && sc.has(c.id, a.id) && sc.has(c.id, b.id)) { seamless++; assert.ok(!on.surf.walls.some((q) => q.cell === c.id && q.edge === i), 'seamless edge has no wall'); } }
  assert.ok(seamless > 0, 'some one-level steps became seamless slopes');
  // sharp province keeps 2-level cliffs untouched (no linked pair across ≥2 levels)
  for (const c of w.cells) for (let i = 0; i < c.n; i++) { const o = w.neighbor(c, i); if (o && Math.abs(w.ground(o) - w.ground(c)) >= 2) assert.ok(!sc.linked(c, o)); }

  // ---- collision against the drawn, deformed walls ----
  const col = terrainCollider(w);
  let probes = 0, blocked = 0, maxPen = 0, shiftMax = 0, logicalWrong = 0, onWall = 0;
  for (let k = 0; k < on.surf.walls.length; k += 3) {
    const wq = on.surf.walls[k], [A, B, C, D] = wq.q;
    // a point on the drawn quad must lie on the collider's cut segment at that height
    const y = (A[1] + D[1] + B[1] + C[1]) / 4; const seg = col.wallSegmentsAt(y, (A[0] + B[0]) / 2, (A[2] + B[2]) / 2, 1).find((s) => s.k === k); if (!seg) continue;
    const mx = (seg.p[0] + seg.q[0]) / 2, mz = (seg.p[1] + seg.q[1]) / 2;
    const tA = (y - A[1]) / (D[1] - A[1]), tB = (y - B[1]) / (C[1] - B[1]);
    const qa = [A[0] + (D[0] - A[0]) * tA, A[2] + (D[2] - A[2]) * tA], qb = [B[0] + (C[0] - B[0]) * tB, B[2] + (C[2] - B[2]) * tB];
    assert.ok(Math.hypot(qa[0] - seg.p[0], qa[1] - seg.p[1]) < 1e-9 && Math.hypot(qb[0] - seg.q[0], qb[1] - seg.q[1]) < 1e-9, 'cut segment = drawn quad at y'); onWall++;
    // a unit sunk 0.08 into the drawn rock is pushed back to exactly r from every wall at that height
    const r = 0.15, x0 = mx - seg.n[0] * 0.08, z0 = mz - seg.n[1] * 0.08, out = col.pushOut(x0, y, z0, r), d = col.wallDistance(out.x, y, out.z, r);
    if (out.blocked) { // only allowed where no spot within 0.4 has clearance r (slot narrower than the unit)
      let best = 0; for (let gx = -8; gx <= 8; gx++) for (let gz = -8; gz <= 8; gz++) { const dd = col.wallDistance(x0 + gx * 0.05, y, z0 + gz * 0.05, r); if (!dd.inside) best = Math.max(best, dd.d); }
      assert.ok(best < r + 0.02, `blocked only in a pocket narrower than the unit (best clearance ${best})`); blocked++; } else { maxPen = Math.max(maxPen, r - d.d); probes++; }
    const c = w.cells[wq.cell], a = c.pts[wq.edge], b = c.pts[(wq.edge + 1) % c.n];
    const sh = Math.hypot((a.x + b.x) / 2 - mx, (a.z + b.z) / 2 - mz); shiftMax = Math.max(shiftMax, sh); if (sh > r * 0.5) logicalWrong++;
  }
  assert.ok(probes > 50 && maxPen < 1e-6, `pushOut leaves no penetration (max ${maxPen})`);
  assert.ok(shiftMax > 0.05, 'the drawn walls really are displaced from the logical cell edges');
  // heightAt reproduces the drawn top surface exactly (incl. soft slopes)
  let hs = 0, soft = 0;
  for (const t of on.surf.tops.filter((_, i) => i % 7 === 0)) { const [P, Q, R] = t.t, x = (P[0] + Q[0] + R[0]) / 3, z = (P[2] + Q[2] + R[2]) / 3, yy = (P[1] + Q[1] + R[1]) / 3; const h = col.heightAt(x, z, yy + 1e-6); assert.ok(h && Math.abs(h.y - yy) < 1e-9, 'heightAt = drawn top'); hs++; if (Math.abs(P[1] - Q[1]) > 1e-6 || Math.abs(Q[1] - R[1]) > 1e-6) soft++; }
  assert.ok(soft > 0);
  summary[`${kind}-${seed}`] = { baseVerts: base.verts, softVerts: on.verts, softVertices: sc.vertices, seamless, gapsClosed: crack.gaps, slopeOff: { wall: +offProfile.wallArea.toFixed(1) }, slopeOn: { soft: +onProfile.top.soft.toFixed(1), steep: +onProfile.top.steep.toFixed(1), wall: +onProfile.wallArea.toFixed(1) }, probes, blocked, maxPen, logicalShiftMax: +shiftMax.toFixed(3), logicalWrong, heightChecks: hs };
}
// overhang / cave walls (features on): collider covers walls that hang over air
{
  const w = new World(decorateCells(GRIDS.quad())); const r = generateTerrain(w, { seed: 7 }); const shape = shapeTerrain(w, {});
  const { surf } = mesh(w, shape, { terrainCollide: true, softTops: true });
  const col = terrainCollider(w);
  const hanging = surf.walls.filter((q) => q.lv >= 2 && !w.isSolid(w.cells[q.cell], q.lv - 1));
  assert.ok(hanging.length > 0, 'features produce overhang walls');
  for (const q of hanging) { const y = (q.q[0][1] + q.q[3][1]) / 2; assert.ok(col.wallSegmentsAt(y).some((s) => s.k === surf.walls.indexOf(q)), 'overhang wall is collidable'); }
  // under the overhang there is a lower floor: heightAt with a ceiling below the overhang top finds it
  summary.overhangWalls = hanging.length;
}
console.log('soft-tops-collide-r55 PASS', JSON.stringify(summary));
