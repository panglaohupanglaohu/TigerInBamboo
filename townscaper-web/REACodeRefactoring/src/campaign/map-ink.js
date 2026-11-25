/** 1097458505315946496 stage-4/5 ink layer for campaign.html.
 *
 * The clip builds the campaign map in four steps (triangulate with padding → walk triangle edges →
 * Bezier sample → tessellate the fields on either side), then letters it: hand-written place names,
 * tiny stage numerals, arrow-heads on the sailed routes and the faint wave/paper pattern inside the
 * fields. `src/core/frontier.js` already owns steps 1–4 and `frontier-overlay.js` paints the fields;
 * this module only adds the ink that the clip shows on top of them. Lettering shapes are local
 * choices (the original is hand-drawn art) — names are generated deterministically from seed+id.
 */

const PRE = ['Bjorn', 'Sku', 'Herm', 'Kol', 'Fugl', 'Dark', 'Graem', 'Sker', 'Inch', 'Gan', 'Ott', 'Hous',
  'Can', 'Muck', 'Rag', 'Col', 'Sten', 'Vik', 'Hav', 'Tors', 'Eld', 'Nes', 'Ravn', 'Hild', 'Grim', 'Unn',
  'Sol', 'Brei', 'Dun', 'Kil', 'Ast', 'Fen', 'Gull', 'Myr', 'Ord', 'Sel'];
const SUF = ['holm', 'voy', 'tur', 'rock', 'say', 'keith', 'nick', 'teron', 'mur', 'fur', 'wick', 'gard',
  'ness', 'bo', 'stad', 'fell', 'ey', 'vik', 'skerry', 'dale'];

const hash = (seed, i) => {
  let h = (seed * 2654435761 + i * 40503 + 12345) >>> 0;
  h ^= h >>> 13; h = (h * 1274126177) >>> 0; h ^= h >>> 16;
  return h >>> 0;
};

/** Deterministic viking-ish island name; stable across reloads for the same seed + node id.
 *  Prefix/suffix are indexed by the node id so two islands on one map never share a name
 *  (id < 38*20 = 760 covers every campaign); the hash only picks the "Little/Great" style. */
export function islandName(seed, id) {
  const h = hash(seed, id);
  const a = PRE[((id % PRE.length) + PRE.length) % PRE.length];
  const b = SUF[(Math.floor(id / PRE.length) % SUF.length + SUF.length) % SUF.length];
  return (h >>> 16) % 5 === 0 ? `${['Little', 'Great', 'Old', 'North', 'South'][(h >>> 18) % 5]} ${a}${b}` : a + b;
}

/** Stage order along the sailed route: main-route nodes get 1..n, the rest 0. */
export function stageOrder(campaign) {
  const order = new Map();
  (campaign.main || []).forEach((id, i) => order.set(id, i + 1));
  return order;
}

const P2 = (P, p) => P(p.x, p.y);

/** Faint wave/contour pattern clipped to each field polygon (the "paper" the clip fills the fields with). */
export function drawFieldPattern(ctx, M, P, { spacing = 13, alpha = .16, ink = '#20343b', amp = 1.6 } = {}) {
  const ok = M.frontiers.map((f, k) => (f.ok && M.fields[k] ? k : -1)).filter((k) => k >= 0);
  let strokes = 0;
  if (!ok.length) return 0;
  const polys = [M.fields[ok[0]].below, ...ok.map((k) => M.fields[k].above)];
  for (const poly of polys) {
    if (!poly || poly.length < 3) continue;
    const pts = poly.map((p) => P2(P, p));
    const ys = pts.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    ctx.save();
    ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = ink; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
    for (let y = y0 + spacing / 2; y < y1; y += spacing) {
      ctx.beginPath();
      // 2% of the map width per wave so the pattern reads as hand-drawn water, not a grid
      for (let x = pts[0][0] - 40, k = 0; x < 4000; x += 12, k++) ctx[k ? 'lineTo' : 'moveTo'](x, y + Math.sin(k * .7 + y * .3) * amp);
      ctx.stroke(); strokes++;
    }
    ctx.restore();
  }
  return strokes;
}

/** Dashed ink frontier: wide faint wash + thin dark dash per frontier, plus a stage numeral on the line. */
export function drawFrontierInk(ctx, M, P, { labels = true, ink = '#16323a', alpha = .85 } = {}) {
  const ok = M.frontiers.map((f, k) => (f.ok && M.fields[k] ? k : -1)).filter((k) => k >= 0);
  const out = { curves: 0, labels: 0, anchors: [] };
  if (!ok.length) return out;
  ctx.save();
  ok.forEach((k, i) => {
    const path = M.frontiers[k].path;
    if (!path || path.length < 2) return;
    const trace = () => { ctx.beginPath(); path.forEach((p, j) => ctx[j ? 'lineTo' : 'moveTo'](...P2(P, p))); };
    ctx.setLineDash([9, 7]);
    ctx.strokeStyle = ink; ctx.globalAlpha = .22; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    trace(); ctx.stroke();
    ctx.globalAlpha = alpha; ctx.lineWidth = 2.4;
    trace(); ctx.stroke();
    ctx.setLineDash([]);
    out.curves++;
    if (labels) {
      const at = path[Math.floor(path.length * (i + .5) / ok.length)] || path[0];
      const [x, y] = P2(P, at);
      ctx.globalAlpha = .9; ctx.fillStyle = ink;
      ctx.font = '600 12px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // 片中的小数字沿前线散落（7…13），原尺寸下判不出语义 → 本仓写前线步序 1..n
      ctx.fillText(String(i + 1), x, y + 2);
      out.labels++; out.anchors.push({ x, y, text: String(i + 1) });
    }
  });
  ctx.restore();
  return out;
}

/** Hand-lettered place names above each island, tilted a couple of degrees like the clip's map. */
export function drawPlaceNames(ctx, P, nodes, { seed = 4, only = null, scale = 1, ink = '#16323a' } = {}) {
  let drawn = 0;
  const anchors = [];
  ctx.save();
  ctx.font = 'italic 600 14px "Iowan Old Style",Palatino,Georgia,serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  nodes.forEach((n, i) => {
    if (!n || (only && !only.has(i))) return;
    const [x, y] = P(n.x, n.y);
    const h = hash(seed, i);
    const tilt = ((h >>> 5) % 7 - 3) * 0.012;
    // every second name sits under its island so neighbouring labels stop colliding
    const below = ((h >>> 21) & 1) === 1;
    const right = ((h >>> 23) & 1) === 1;
    const dy = n.r * scale + 9, dx = right ? n.r * scale * .55 : -n.r * scale * .55;
    ctx.save();
    ctx.translate(x + dx, y + (below ? dy : -dy));
    ctx.rotate(tilt);
    ctx.textAlign = right ? 'left' : 'right';
    ctx.globalAlpha = .92; ctx.fillStyle = ink;
    const name = islandName(seed, n.id ?? i);
    ctx.fillText(name, 0, 0);
    ctx.restore();
    drawn++; anchors.push({ x: x + dx, y: y + (below ? dy : -dy), text: name });
  });
  ctx.restore();
  return { drawn, anchors };
}

/** Small ink numeral per route stage (the numbers that sit beside islands on the clip's final map). */
export function drawStageMarks(ctx, P, nodes, { route = [], scale = 1, ink = '#16323a' } = {}) {
  let drawn = 0; const anchors = [];
  ctx.save();
  ctx.font = '600 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ink; ctx.globalAlpha = .78;
  route.forEach((id, i) => {
    const n = nodes[id]; if (!n) return;
    const [x, y] = P(n.x, n.y);
    const ax = x + n.r * scale * .75 + 2, ay = y + n.r * scale * .55 + 3;
    ctx.fillText(String(i + 1), ax, ay);
    drawn++; anchors.push({ x: ax, y: ay, text: String(i + 1) });
  });
  ctx.restore();
  return { drawn, anchors };
}

/** Dotted route + arrow-heads, drawn outward from the start so the direction reads off the map. */
export function drawRouteArrows(ctx, P, nodes, edges, { route = [], ink = 'rgba(20,30,35,.8)' } = {}) {
  let arrows = 0; const anchors = [];
  const dir = new Map();
  if (route.length > 1) for (let i = 1; i < route.length; i++) dir.set(route[i - 1] + ':' + route[i], true);
  ctx.save();
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    if (!a || !b) continue;
    const forward = dir.has(e.a + ':' + e.b);
    const [ax, ay] = P(a.x, a.y), [bx, by] = P(b.x, b.y);
    const tx = bx - ax, ty = by - ay, len = Math.hypot(tx, ty);
    if (len < 12) continue;
    // head 62% along the edge: the clip keeps an unbroken gap around each island icon
    const t = .62, hx = ax + tx * t, hy = ay + ty * t, ux = tx / len, uy = ty / len;
    const s = forward ? 1 : -1, size = Math.min(7, len * .12);
    ctx.beginPath();
    ctx.moveTo(hx + ux * size * s, hy + uy * size * s);
    ctx.lineTo(hx - uy * size * .55 * s, hy + ux * size * .55 * s);
    ctx.lineTo(hx + uy * size * .55 * s, hy - ux * size * .55 * s);
    ctx.closePath(); ctx.fill();
    arrows++; anchors.push({ x: hx, y: hy });
  }
  ctx.restore();
  return { arrows, anchors };
}
