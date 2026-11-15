// r55 surfacedeco (1181464374839521280, REACode/surfacedeco): door wall segments join the long facade
// run (entry pinned at its slot), runs continue around building corners with consistent rules (no
// shutter pairs across a corner), and arch entries cut a real hole in the wall body.
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { solveFacadeDecoration, validateFacade } = await import('../src/core/surface-decoration.js');
const { edgeOut } = await import('../src/core/meshwriter.js');
// solver: entry column + breaks
for (let seed = 1; seed < 40; seed++) {
  const r = solveFacadeDecoration(3, { width: 7, seed, entry: seed % 2 ? 'arch' : 'door', entryAt: seed % 7, breaks: [2, 5] });
  assert.ok(r.ok && !r.violations.length && r.styles[seed % 7] === (seed % 2 ? 'arch' : 'door'));
  for (let y = 0; y < 3; y++) for (const b of [2, 5]) { assert.notEqual(r.styles[y * 7 + b], 'shutterL'); assert.notEqual(r.styles[y * 7 + b - 1], 'shutterR'); }
}
assert.deepEqual(validateFacade(['window', 'shutterL', 'none'], { width: 3, levels: 1, breaks: [1] }), [1], 'shutter across a corner is rejected');
assert.throws(() => solveFacadeDecoration(1, { width: 3, entry: 'door', entryAt: 3 }));
const base = { surfaceWFC: true, surfaceFacade: true, surfaceFacadeRuns: true };
const area = (t) => { const [a, b, c] = t; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };
let doorRuns = 0, cornerRuns = 0, holes = 0, checkedHoles = 0;
for (const kind of ['quad', 'mixed']) for (const [scene, seed] of [['town', 7], ['town', 11], ['fusion', 7]]) {
  const w = F.world(kind, scene, seed);
  const ref = F.build(w, base), ref2 = F.build(w, { ...base, surfaceFacadeDoors: false, surfaceFacadeCorners: false, archCutout: false });
  assert.equal(ref.verts, ref2.verts, 'new flags off = r53 geometry');
  const on = F.build(w, { ...base, surfaceFacadeDoors: true, surfaceFacadeCorners: true });
  const entries = (r) => (r.decoDrawn.door ?? 0) + (r.decoDrawn.arch ?? 0);
  assert.equal(entries(on.r), entries(ref.r), 'every house keeps its entry when the door span joins a run');
  for (const run of on.r.facadeRuns) {
    assert.ok(run.ok && !run.violations.length);
    if (run.entry) { doorRuns++; assert.equal(run.styles[run.entryAt], run.entry); assert.ok(run.spans.some(s => s.door)); assert.ok(run.spans.length >= 2); }
    if (run.breaks.length) { cornerRuns++; for (let y = 0; y < run.levels; y++) for (const b of run.breaks) { const row = run.styles.slice(y * run.width, (y + 1) * run.width); assert.ok(row[b] !== 'shutterL' && row[b - 1] !== 'shutterR', 'no shutter pair across a corner'); if (/window/.test(row[b])) assert.notEqual(row[b], row[b - 1], 'same-window rule holds across the corner'); } }
  }
  // drawn cross-cell shutters never straddle a corner break
  for (const p of on.r.decoPlacements.filter(p => p.crossCell)) { const run = on.r.facadeRuns[p.run]; for (const b of run.breaks) assert.ok(!(p.style === 'shutterL' && p.global === b) && !(p.style === 'shutterR' && p.global === b - 1)); }
  // arch cutout: capture wall-plane triangles of each hole's wall strip
  const m = new F.MeshWriter(), planeTris = [], tri = m.tri.bind(m);
  m.tri = (a, b, c, ...rest) => { planeTris.push([a, b, c]); return tri(a, b, c, ...rest); };
  const flags = { ...base, surfaceFacadeDoors: true, surfaceFacadeCorners: true, archCutout: true }, old = {}; for (const [k, v] of Object.entries(flags)) { old[k] = w[k]; w[k] = v; }
  const cut = F.buildBuildings(m, w, { L: F.L }); for (const k of Object.keys(flags)) w[k] = old[k];
  assert.equal(cut.archHoles.length, cut.decoDrawn.archHole ?? 0); holes += cut.archHoles.length;
  assert.equal((cut.decoDrawn.arch ?? 0), cut.archHoles.length, 'every arch entry is a real hole when archCutout is on');
  for (const h of cut.archHoles) {
    const c = w.cells[h.cell], A = c.pts[h.edge], B = c.pts[(h.edge + 1) % c.n], len = Math.hypot(B.x - A.x, B.z - A.z), [nx, nz] = edgeOut(c, h.edge);
    const onPlane = (p) => Math.abs((p[0] - A.x) * nx + (p[2] - A.z) * nz) < 1e-9, s = (p) => ((p[0] - A.x) * (B.x - A.x) + (p[2] - A.z) * (B.z - A.z)) / len;
    const wall = planeTris.filter(t => t.every(onPlane) && t.every(p => p[1] >= h.y0 - 1e-9 && p[1] <= h.y1 + 1e-9 && s(p) >= -1e-9 && s(p) <= len + 1e-9));
    const r = h.width / 2, holeA = 2 * r * (h.height - r) + .5 * r * r * 12 * Math.sin(Math.PI / 12);
    const got = wall.reduce((q, t) => q + area(t), 0);
    assert.ok(Math.abs(got - (len * (h.y1 - h.y0) - holeA)) < 1e-9, `wall area = strip − hole (${got} vs ${len * (h.y1 - h.y0) - holeA})`);
    // hole centre is not covered by any wall-plane triangle
    const cx = A.x + (B.x - A.x) * h.t, cz = A.z + (B.z - A.z) * h.t, cy = h.y + h.height * .5;
    const covered = wall.some(t => { const [a, b, cc] = t, e = (p, q) => ((q[0] - p[0]) * (B.x - A.x) + (q[2] - p[2]) * (B.z - A.z)) / len; const P2 = (p) => [s(p), p[1]], X = [h.t * len, cy], [p0, p1, p2] = [P2(a), P2(b), P2(cc)]; const d = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]); if (Math.abs(d) < 1e-14) return false; const l1 = ((p1[1] - p2[1]) * (X[0] - p2[0]) + (p2[0] - p1[0]) * (X[1] - p2[1])) / d, l2 = ((p2[1] - p0[1]) * (X[0] - p2[0]) + (p0[0] - p2[0]) * (X[1] - p2[1])) / d; return l1 > 1e-9 && l2 > 1e-9 && 1 - l1 - l2 > 1e-9; });
    assert.ok(!covered, 'arch hole is open'); checkedHoles++;
  }
}
assert.ok(doorRuns >= 10 && cornerRuns >= 50 && holes >= 4 && checkedHoles === holes);
console.log('PASS facade runs with doors / corners / real arch holes', { doorRuns, cornerRuns, holes });
