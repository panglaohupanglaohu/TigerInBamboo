// r55 hiproof (807256278154301441, REACode/hiproof): exact straight-skeleton hip roofs.
// Convex: height == min distance to edge lines; rectangle ridge == long − short; L / U / courtyard
// (hole loop): exact single coverage, area conserved, valleys consistent; World regions (town/fusion,
// quad/mixed) through buildings.js with world.hipSkeleton: no gables, level eaves, seated chimneys.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { straightSkeleton, skeletonTriangles, auditSkeleton, ringArea, offsetRing } = await import('../src/core/straight-skeleton.js');
const { regionRings, skeletonRoof } = await import('../src/core/hip-roof.js');
const { roofHeightAt, verifyHouseKit } = await import('../src/core/house-kit.js');
const R = (pts) => pts.map(([x, z]) => ({ x, z }));
let rs = 7; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const inPoly = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };
const segD = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
const heights = (tris, p) => { const out = []; for (const t of tris) { const y = roofHeightAt([t], p.x, p.z); if (y !== null) out.push(y); } return out; };
function coverage(rings, tris, n = 400) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of rings) for (const p of r) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  let inside = 0, miss = 0, multi = 0, over = 0;
  for (let k = 0; k < n; k++) {
    const p = { x: minX + (maxX - minX) * rnd(), z: minZ + (maxZ - minZ) * rnd() };
    const cnt = rings.reduce((s, r) => s + (inPoly(p, r) ? 1 : 0), 0); if (cnt % 2 === 0) continue; inside++;
    const hs = heights(tris, p), u = new Set(hs.map(y => y.toFixed(8)));
    if (!hs.length) miss++; else if (u.size > 1) multi++;
    let d = Infinity; for (const r of rings) for (let i = 0; i < r.length; i++) d = Math.min(d, segD(p, r[i], r[(i + 1) % r.length]));
    if (hs.length && Math.max(...hs) > d + 1e-9) over++;   // straight-skeleton height never exceeds Euclidean distance
  }
  return { inside, miss, multi, over };
}
// 1) convex: exact min over edge lines
for (let trial = 0; trial < 6; trial++) {
  const n = 3 + trial, ring = Array.from({ length: n }, (_, i) => { const ang = (i + rnd() * .6) / n * Math.PI * 2; return { x: Math.cos(ang) * 1.5, z: Math.sin(ang) * .9 }; });
  if (ringArea(ring) < 0) ring.reverse();
  const sk = straightSkeleton([ring]), { tris } = skeletonTriangles(sk), a = auditSkeleton([ring], sk);
  assert.ok(Math.abs(a.pieceArea - ringArea(ring)) < 1e-9 && a.planarErr < 1e-9);
  for (let k = 0; k < 200; k++) {
    const p = { x: (rnd() - .5) * 3.6, z: (rnd() - .5) * 3.6 }; if (!inPoly(p, ring)) continue;
    let h = Infinity; for (let i = 0; i < n; i++) { const A = ring[i], B = ring[(i + 1) % n], l = Math.hypot(B.x - A.x, B.z - A.z); h = Math.min(h, (-(B.z - A.z) * (p.x - A.x) + (B.x - A.x) * (p.z - A.z)) / l); }
    const hs = heights(tris, p); assert.ok(hs.length >= 1 && hs.every(y => Math.abs(y - h) < 1e-9), 'convex roof = min distance to edge lines');
  }
}
// 2) rectangle ridge = long − short (overhang keeps it)
for (const [W, D, o] of [[4, 2, 0], [5, 1.5, .1], [3, 3, 0]]) {
  const sk = straightSkeleton([R([[0, 0], [W, 0], [W, D], [0, D]])], { overhang: o }), top = [];
  for (const pc of sk.pieces) for (const p of pc.poly) if (Math.abs(p.t - D / 2) < 1e-9) top.push(p.x);
  assert.ok(Math.abs(Math.max(...top) - Math.min(...top) - (W - D)) < 1e-9, 'ridge length');
}
// 3) concave + hole: coverage exactly once, area (with overhang = mitered offset area), valleys consistent
const shapes = {
  L: [R([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]])],
  U: [R([[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]])],
  T: [R([[0, 0], [5, 0], [5, 1.2], [3, 1.2], [3, 4], [2, 4], [2, 1.2], [0, 1.2]])],
  courtyard: [R([[0, 0], [5, 0], [5, 4], [0, 4]]), R([[1.5, 1.2], [1.5, 2.6], [3.4, 2.6], [3.4, 1.2]])],
  skewCourt: [R([[0, 0], [6, .4], [5.6, 4.5], [-.3, 4]]), R([[2, 1.5], [2.2, 3], [4, 2.7], [3.6, 1.4]])],
};
let valleysTotal = 0, splitTotal = 0;
for (const [k, rings] of Object.entries(shapes)) for (const o of [0, .1]) {
  const sk = straightSkeleton(rings, { overhang: o }), a = auditSkeleton(rings, sk), area = rings.reduce((s, r) => s + ringArea(offsetRing(r, o)), 0);
  assert.ok(Math.abs(a.pieceArea - area) < 1e-9, k + ' area'); assert.ok(a.planarErr < 1e-9 && a.valleyErr < 1e-9, k + ' planar/valley');
  assert.ok(a.valleys > 0, k + ' has valleys'); valleysTotal += a.valleys; splitTotal += a.splitEvents;
  if (o === 0) { const c = coverage(rings, skeletonTriangles(sk).tris, 600); assert.ok(c.inside > 100 && !c.miss && !c.multi && !c.over, k + ' coverage ' + JSON.stringify(c)); }
}
assert.ok(splitTotal > 0, 'split events exercised (U / courtyard)');
// cap: flat top at t=cap, area still conserved
{ const rings = shapes.courtyard, r = skeletonRoof(rings, { base: 1, slope: 1.3, cap: .3 }); assert.ok(r.sk.flats.length > 0 && r.audit.areaErr < 1e-9); for (const t of r.tris) for (const p of t) assert.ok(p[1] <= 1 + .3 * 1.3 + 1e-9); }
{ for (const k of ['courtyard', 'skewCourt', 'U']) { const r = skeletonRoof(shapes[k], { cap: .3 }), c = coverage(shapes[k], r.tris, 500); assert.ok(r.sk.flats.length && r.audit.areaErr < 1e-9 && !c.miss && !c.multi && !c.over, k + ' capped flat top with hole bridged ' + JSON.stringify(c)); } }
// 4) World regions through buildings.js
let regions = 0, worldValleys = 0, worldSplits = 0, chim = 0, holes = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['town', 11], ['fusion', 7]]) {
  const w = F.world(kind, scene, seed), before = F.voxels(w), off = F.build(w), off2 = F.build(w, { hipSkeleton: false }), on = F.build(w, { hipSkeleton: true });
  assert.deepEqual(F.voxels(w), before); assert.equal(off.verts, off2.verts); assert.equal(off.r.roofStats.skeletons, undefined, 'flag off: legacy roofs only');
  const sks = on.r.roofStats.skeletons; assert.ok(sks.length > 5);
  for (const s of sks) {
    assert.equal(s.gables, 0); assert.equal(s.eaveLo, s.eaveHi);
    assert.ok(s.areaErr < 1e-9 && s.planarErr < 1e-9 && s.valleyErr < 1e-9, 'region roof exact');
    regions++; worldValleys += s.valleys; worldSplits += s.splitEvents; holes += s.holes;
  }
  // coverage on real regions (no overhang so the footprint is the cell union)
  const { regions: regs } = w.regions();
  for (const reg of regs.filter(r => r.h >= 2).slice(0, 12)) {
    const ids = new Set(reg.cells.map(c => c.id)), { rings } = regionRings(reg.cells, id => ids.has(id)), rr = skeletonRoof(rings, {});
    const c = coverage(rings, rr.tris, 150); assert.ok(!c.miss && !c.multi && !c.over, 'world coverage ' + JSON.stringify(c));
  }
  const tris = sks.flatMap(s => s.tris3), v = verifyHouseKit({ chimneys: on.r.chimneys, roofTris: tris, L: F.L });
  assert.equal(v.unseated, 0); assert.ok(v.chimneyFloat < 1e-9 && v.chimneyCentreErr < 1e-9, 'chimneys sit on the skeleton roof'); chim += v.chimneys;
}
// 5) courtyard in a real World: a ring of built cells around an empty yard → hole loop
{
  const w = new F.World(F.grid('quad')); w.palette = F.PALETTES.town;
  const centre = w.cells.slice().sort((a, b) => Math.hypot(a.cx, a.cz) - Math.hypot(b.cx, b.cz))[0];
  const ring = new Set(); for (const p of centre.pts) for (const id of w.grid.vertexCells.get(p.id)) if (id !== centre.id) ring.add(id);
  for (const id of ring) w.fill(w.cells[id], 3); w.fill(centre, 1);
  const on = F.build(w, { hipSkeleton: true }), s = on.r.roofStats.skeletons.find(x => x.cells === ring.size);
  assert.ok(s && s.holes === 1 && s.rings === 2 && s.areaErr < 1e-9 && s.valleys >= 4, 'courtyard roof uses a hole loop'); holes += s.holes;
}
assert.ok(worldValleys > 50 && worldSplits > 20 && chim > 10);
console.log('PASS exact straight-skeleton hip roofs', { shapes: Object.keys(shapes).length, valleysTotal, splitTotal, regions, worldValleys, worldSplits, holes, chimneys: chim });
