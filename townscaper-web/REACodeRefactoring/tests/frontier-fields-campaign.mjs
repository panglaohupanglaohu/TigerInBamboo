// r55 G3: REACode borderpath.js (1097458505315946496) — campaign.html draws several frontiers and the
// ear-clipped fields on either side (src/campaign/frontier-overlay.js over src/core/frontier.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateCampaign } from '../src/campaign/campaign.js';
import { campaignFrontierFields, drawFrontierFields, BAND_COLORS } from '../src/campaign/frontier-overlay.js';

// recording ctx: keeps each filled path (with current fillStyle / globalAlpha) and stroked path
function rec() {
  const fills = [], strokes = [], stack = []; let path = [];
  const st = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1 };
  const ctx = new Proxy(st, { get: (t, k) => k in t ? t[k] : ({
    save: () => stack.push({ ...st }), restore: () => Object.assign(st, stack.pop()),
    beginPath: () => { path = []; }, moveTo: (x, y) => path.push({ x, y }), lineTo: (x, y) => path.push({ x, y }), closePath() {},
    fill: () => fills.push({ color: st.fillStyle, alpha: st.globalAlpha, pts: path.slice() }), stroke: () => strokes.push({ color: st.strokeStyle, pts: path.slice() }),
  })[k] ?? (() => {}), set: (t, k, v) => (t[k] = v, true) });
  return { ctx, fills, strokes, stack };
}
const inTri = (p, [a, b, c]) => { const s = (u, v, w) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x), d1 = s(a, b, p), d2 = s(b, c, p), d3 = s(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
const P = (x, y) => [x, y];

let campaigns = 0, checkedNodes = 0;
for (let seed = 0; seed < 12; seed++) {
  const C = generateCampaign({ seed }), R = campaignFrontierFields(C.nodes, [6, -6, 0]);
  if (!R.ok) { assert.ok(R.summary || R.error, 'failure is reported, not thrown'); continue; }
  campaigns++;
  const S = R.summary;
  assert.equal(S.okCount, 3); assert.deepEqual(S.frontiers.map((f) => f.position), [-6, 0, 6]);
  for (const f of S.frontiers) assert.ok(f.areaError < 1e-9 && f.belowTris > 0 && f.aboveTris > 0, 'fields partition the padded rect');
  assert.equal(Object.values(S.bands).reduce((a, b) => a + b, 0), C.nodes.length);
  const r = rec(), out = drawFrontierFields(r.ctx, R.M, P, { nodes: C.nodes });
  assert.equal(r.stack.length, 0, 'balanced save/restore');
  const tris = r.fills.filter((f) => f.pts.length === 3 && f.alpha < 1);
  assert.equal(out.painted, tris.length); assert.equal(tris.length, R.M.fields[0].belowTris.length + R.M.fields.reduce((n, F) => n + F.aboveTris.length, 0));
  // painter's order: the last field triangle covering a node carries that node's band colour
  C.nodes.forEach((n, i) => {
    const last = tris.findLast((t) => inTri(n, t.pts)); if (!last) return;
    if (R.M.frontiers.some((f) => f.path.some((p) => Math.hypot(p.x - n.x, p.y - n.y) < .05))) return;   // on a curve: ambiguous
    assert.equal(last.color, BAND_COLORS[R.M.band[i]], `node ${i} band ${R.M.band[i]}`); checkedNodes++;
  });
  // one stroked curve per frontier (dark under-stroke + coloured), following the Bezier samples
  const curves = r.strokes.filter((s) => s.pts.length > 3);
  assert.equal(curves.length, 6);
  R.M.frontiers.forEach((f, k) => assert.deepEqual(curves[2 * k + 1].pts, f.path.map((p) => ({ x: p.x, y: p.y }))));
}
assert.ok(campaigns >= 8 && checkedNodes > 500, `${campaigns} campaigns, ${checkedNodes} nodes`);
// out-of-bounds step → reported, nothing drawn for it; drawing with no successful frontier paints nothing
const C0 = generateCampaign({ seed: 4 }), bad = campaignFrontierFields(C0.nodes, [0, 999]);
assert.equal(bad.ok, false); assert.ok(bad.error && !bad.M);
// page wiring: checkbox + ?fields=1, off by default, summary exposed via campaign().fields
const html = readFileSync(new URL('../campaign.html', import.meta.url), 'utf8');
assert.match(html, /import \{ campaignFrontierFields, drawFrontierFields \} from '\.\/src\/campaign\/frontier-overlay\.js'/);
assert.match(html, /<input id="frontier-fields" type="checkbox">/);
assert.match(html, /get\('fields'\)==='1'/);
assert.match(html, /fields: MF \? \(MF\.summary \?\? \{ error: MF\.error \}\) : null/);
console.log('PASS campaign frontier fields', { campaigns, checkedNodes });
