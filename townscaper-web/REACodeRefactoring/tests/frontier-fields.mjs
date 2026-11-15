// r53 G4: REACode borderpath.js stage 4 — fields on either side of the sampled frontier are tessellated
// (area conserved, triangles on the correct side), nodes owned by a side, several frontiers at once.
import assert from 'node:assert/strict';
import { buildFrontier, frontierFields, buildFrontiers, earClip, pointInPolygon } from '../src/core/frontier.js';
import { generateCampaign } from '../src/campaign/campaign.js';
const triArea = ([a, b, c]) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
let checked = 0, multi = 0;
for (let seed = 0; seed < 16; seed++) {
  const c = generateCampaign({ seed });
  for (const position of [-6, 0, 6]) {
    const f = buildFrontier(c.nodes, { position }); if (!f.ok) continue;
    const F = frontierFields(f);
    const sb = F.belowTris.reduce((s, t) => s + triArea(t), 0), sa = F.aboveTris.reduce((s, t) => s + triArea(t), 0);
    assert.ok(Math.abs(sb - F.area.below) < 1e-6 * F.area.rect && Math.abs(sa - F.area.above) < 1e-6 * F.area.rect, 'tessellation covers each field');
    assert.ok(Math.abs(F.area.below + F.area.above - F.area.rect) < 1e-6 * F.area.rect, 'two fields partition the padded rectangle');
    for (const t of F.belowTris) { const ctr = { x: (t[0].x + t[1].x + t[2].x) / 3, y: (t[0].y + t[1].y + t[2].y) / 3 }; assert.ok(!pointInPolygon(ctr, F.above) || pointInPolygon(ctr, F.below)); }
    // bezier samples are field vertices: every path point appears in both polygons
    assert.equal(F.below.length, f.path.length + 2);
    // nodes far below/above the step are on the expected side
    c.nodes.forEach((n, i) => { if (n.y < position - 3) assert.equal(F.nodeSide[i], 'below'); if (n.y > position + 3) assert.equal(F.nodeSide[i], 'above'); });
    checked++;
  }
  const M = buildFrontiers(c.nodes, [6, -6, 0]);
  if (M.frontiers.every((f) => f.ok)) {
    multi++;
    assert.deepEqual(M.positions, [-6, 0, 6]);
    c.nodes.forEach((n, i) => { if (n.y < -9) assert.equal(M.band[i], 0); if (n.y > 9) assert.equal(M.band[i], 3); });
    if (!M.conflicts.length) c.nodes.forEach((n, i) => assert.ok(M.band[i] >= 0 && M.band[i] <= 3));
  }
}
assert.ok(checked > 30 && multi > 8, `checked ${checked} fields, ${multi} multi-frontier campaigns`);
// ear clipping sanity on a concave polygon
const L = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
assert.ok(Math.abs(earClip(L).reduce((s, t) => s + triArea(t), 0) - 3) < 1e-12);
assert.throws(() => frontierFields({ ok: false }));
console.log('PASS frontier fields', { checked, multi });
