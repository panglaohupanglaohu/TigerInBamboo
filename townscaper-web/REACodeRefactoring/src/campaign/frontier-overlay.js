/** r55 G3 · 1097458505315946496 "4. Tessellate the fields on either side using the bezier and the
 * triangulation" + several frontiers at once. Canvas2D overlay for campaign.html built on
 * src/core/frontier.js buildFrontiers / frontierFields. Colours and line styles are local choices,
 * not the original Bad North art.
 */
import { buildFrontiers } from '../core/frontier.js';

export const BAND_COLORS = ['#c9e3a0', '#f3d27a', '#eaa36b', '#d56f6f', '#9b6fb0', '#6f8fd5'];
export const FRONT_COLORS = ['#fff0b7', '#ffd0a0', '#ffb3c6', '#c9f0ff', '#d9c6ff'];
const triArea = ([a, b, c]) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;

/** Build + summarise the fields for a campaign. Never throws: a failed step is reported, not drawn. */
export function campaignFrontierFields(nodes, positions = [-6, 0, 6], opts = {}) {
  let M;
  try { M = buildFrontiers(nodes, positions, opts); } catch (error) { return { ok: false, error: error.message, M: null, summary: null }; }
  const per = M.frontiers.map((f, k) => {
    const F = M.fields[k];
    if (!f.ok || !F) return { position: M.positions[k], ok: false, reason: f.reason };
    const below = F.belowTris.reduce((s, t) => s + triArea(t), 0), above = F.aboveTris.reduce((s, t) => s + triArea(t), 0);
    return { position: M.positions[k], ok: true, samples: f.path.length, belowTris: F.belowTris.length, aboveTris: F.aboveTris.length, areaError: Math.abs(below + above - F.area.rect) / F.area.rect };
  });
  const bands = {}; for (const b of M.band) bands[b] = (bands[b] || 0) + 1;
  return { ok: per.every((p) => p.ok), M, summary: { frontiers: per, okCount: per.filter((p) => p.ok).length, conflicts: M.conflicts, bands, triangles: per.reduce((n, p) => n + (p.belowTris || 0) + (p.aboveTris || 0), 0) } };
}

/** Paint band fields (painter's order: below the first frontier, then above each frontier),
 * the ear-clip triangle wireframe, the frontier curves and band tags on nodes. P maps world (x,y) → screen [sx,sy]. */
export function drawFrontierFields(ctx, M, P, { alpha = .38, wire = true, nodes = null, tagOffset = 0, palette = BAND_COLORS, curves = true } = {}) {
  const fillTris = (tris, color) => {
    ctx.fillStyle = color;
    for (const [a, b, c] of tris) { ctx.beginPath(); ctx.moveTo(...P(a.x, a.y)); ctx.lineTo(...P(b.x, b.y)); ctx.lineTo(...P(c.x, c.y)); ctx.closePath(); ctx.fill(); }
  };
  const ok = M.frontiers.map((f, k) => (f.ok && M.fields[k] ? k : -1)).filter((k) => k >= 0);
  if (!ok.length) return { painted: 0 };
  let painted = 0;
  ctx.save(); ctx.globalAlpha = alpha;
  // band 0 = below the lowest successful frontier; band k+1 = above frontier k (later ones overpaint)
  fillTris(M.fields[ok[0]].belowTris, palette[0]); painted += M.fields[ok[0]].belowTris.length;
  ok.forEach((k, i) => { fillTris(M.fields[k].aboveTris, palette[(i + 1) % palette.length]); painted += M.fields[k].aboveTris.length; });
  ctx.restore();
  if (wire) {
    ctx.save(); ctx.lineWidth = .5; ctx.strokeStyle = 'rgba(30,40,45,.2)';
    for (const k of ok) for (const tris of [M.fields[k].belowTris, M.fields[k].aboveTris]) for (const [a, b, c] of tris) {
      // only the strip next to this frontier, so the wireframes of nested fields stay readable
      const near = [a, b, c].some((p) => Math.abs(p.y - M.positions[k]) < 2.5);
      if (!near) continue;
      ctx.beginPath(); ctx.moveTo(...P(a.x, a.y)); ctx.lineTo(...P(b.x, b.y)); ctx.lineTo(...P(c.x, c.y)); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  if (curves) {
  ctx.save(); ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ok.forEach((k, i) => {
    const path = M.frontiers[k].path;
    ctx.strokeStyle = 'rgba(20,25,30,.55)'; ctx.lineWidth = 5; ctx.beginPath(); path.forEach((p, j) => ctx[j ? 'lineTo' : 'moveTo'](...P(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = FRONT_COLORS[i % FRONT_COLORS.length]; ctx.lineWidth = 2.5; ctx.beginPath(); path.forEach((p, j) => ctx[j ? 'lineTo' : 'moveTo'](...P(p.x, p.y))); ctx.stroke();
  });
  ctx.restore();
  }
  if (nodes) {
    ctx.save(); ctx.font = '600 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    nodes.forEach((n, i) => { if (!n) return; const [x0, y0] = P(n.x, n.y), x = x0 + tagOffset, y = y0 - tagOffset; ctx.fillStyle = BAND_COLORS[M.band[i] % BAND_COLORS.length]; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#1d2f36'; ctx.fillText(String(M.band[i]), x, y + .5); });
    ctx.restore();
  }
  return { painted };
}
