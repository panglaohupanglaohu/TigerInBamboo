/** r55 G3 · 958371606350454784 "content agnostic ... similar hierarchy" + 1010979395719319552 in-game faces.
 * Canvas2D drawer for specs produced by part-random.js `sampleSlots(seed, PORTRAIT_SLOTS)`.
 * The original artwork is not available: every variant below is a local procedural vector
 * stand-in (ellipses / quadratic strokes) modelled on the REACode portrait.js descriptions.
 * Head / ear / hair geometry is shared with `portraitSilhouette` through `slotGeometry`, so
 * the drawn silhouette is the same shape the diversity metric measures.
 * The drawer only walks the slot table in order and dispatches `SLOT_DRAWERS[key][variant]`;
 * swapping the table + drawer map swaps the content (no face-specific logic in the walker).
 */
import { PORTRAIT_SLOTS } from '../core/part-random.js';

const INK = '#2a2118', SKIN = '#efe6d8', PINK = '#e79a92';
const HAIR_COLORS = ['#3d2a1c', '#5a3d26', '#6b4a2e', '#2e2118', '#8a6a44'];
const HOOD_COLORS = ['#6d5a48', '#5d6670', '#7a4a3a'];

/** Unit-box geometry identical to portraitSilhouette (part-random.js). */
export function slotGeometry(spec) {
  const { wide, long, drop } = spec.params, P = spec.parts;
  const hw = (P.head === 'narrow' ? .25 : .3) * wide, hh = .36 * long, cx = .5, cy = .55 + drop;
  return { cx, cy, hw, hh, top: cy - hh, er: P.ear === 'big' ? .07 : .045 };
}
function hash(seed, k) { let h = Math.imul(seed ^ (k * 374761393), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/** Hair silhouettes (exactly the mask regions of portraitSilhouette), as canvas fills. */
function hairShape(ctx, g, variant, X, Y, S) {
  const { cx, cy, hw, hh, top } = g, W = 1e3;
  const clipRect = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.rect(X(x0), Y(y0), (x1 - x0) * S, (y1 - y0) * S); ctx.clip(); };
  const ell = (ex, ey, rx, ry) => { ctx.beginPath(); ctx.ellipse(X(ex), Y(ey), rx * S, ry * S, 0, 0, Math.PI * 2); };
  if (variant === 'sidePart') { ctx.save(); clipRect(-W, -W, W, cy - .05); ell(cx - .02, top + .08, hw * 1.08, .13); ctx.fill(); ctx.restore(); return true; }
  if (variant === 'buzz') { ctx.save(); clipRect(-W, -W, W, cy - .1); ell(cx, top + .05, hw * 1.02, .08); ctx.fill(); ctx.restore(); return true; }
  if (variant === 'receding') {
    for (const [x0, x1] of [[-W, cx - hw * .45], [cx + hw * .45, W]]) { ctx.save(); clipRect(x0, -W, x1, cy - .08); ell(cx, top + .12, hw * 1.05, .1); ctx.fill(); ctx.restore(); }
    return true;
  }
  if (variant === 'hood') {
    ctx.beginPath();
    ctx.ellipse(X(cx), Y(cy - .02), hw * 1.35 * S, hh * 1.18 * S, 0, 0, Math.PI * 2);
    ctx.ellipse(X(cx), Y(cy + .04), hw * .8 * S, hh * .78 * S, 0, 0, Math.PI * 2);
    ctx.fill('evenodd'); return true;
  }
  return false;   // bald: no silhouette change
}

/** Per-slot variant drawers. Signature: (ctx, frame) where frame = {g, X, Y, S, spec, ink}. */
export const SLOT_DRAWERS = {
  bg: {
    flat({ ctx, box }) { ctx.fillStyle = '#2f5f8c'; ctx.fillRect(box.x, box.y, box.w, box.h); ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 6; i++) ctx.fillRect(box.x, box.y + i * box.h / 6, box.w, box.h / 22); },
    vignette({ ctx, box }) { const gr = ctx.createRadialGradient(box.x + box.w / 2, box.y + box.h * .42, box.w * .15, box.x + box.w / 2, box.y + box.h * .5, box.w * .75); gr.addColorStop(0, '#3a6f9e'); gr.addColorStop(1, '#1e4266'); ctx.fillStyle = gr; ctx.fillRect(box.x, box.y, box.w, box.h); },
  },
  head: {
    oval: (f) => drawHead(f), narrow: (f) => drawHead(f),
  },
  ear: { small: (f) => drawEars(f), big: (f) => drawEars(f) },
  hair: Object.fromEntries(['sidePart', 'buzz', 'bald', 'receding', 'hood'].map((k) => [k, (f) => drawHair(f, k)])),
  brow: {
    thin: (f) => drawBrows(f, .022), thick: (f) => drawBrows(f, .036),
  },
  eye: { heavy: (f) => drawEyes(f, true), wide: (f) => drawEyes(f, false) },
  nose: { long: (f) => drawNose(f, 1), short: (f) => drawNose(f, .62) },
  mouth: {
    line({ ctx, g, X, Y, S, spec }) { const y = g.cy + g.hh * .55, c = (hash(spec.seed, 3) - .5) * .03; ctx.strokeStyle = INK; ctx.lineWidth = .018 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(g.cx - g.hw * .2), Y(y)); ctx.quadraticCurveTo(X(g.cx), Y(y + c), X(g.cx + g.hw * .2), Y(y)); ctx.stroke(); },
    open({ ctx, g, X, Y, S }) { const y = g.cy + g.hh * .55; ctx.fillStyle = '#6a3d38'; ctx.strokeStyle = INK; ctx.lineWidth = .012 * S; ctx.beginPath(); ctx.ellipse(X(g.cx), Y(y), g.hw * .17 * S, g.hh * .06 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); },
  },
  marks: {
    none() {},
    freckles({ ctx, g, X, Y, S, spec }) { ctx.fillStyle = 'rgba(150,110,90,0.6)'; for (let i = 0; i < 22; i++) { const a = hash(spec.seed, 10 + i) * Math.PI * 2, r = .3 + .5 * hash(spec.seed, 40 + i); ctx.fillRect(X(g.cx + Math.cos(a) * g.hw * .7 * r), Y(g.cy + .06 + Math.sin(a) * g.hh * .25 * r), .011 * S, .011 * S); } },
  },
};
function drawHead({ ctx, g, X, Y, S }) {
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy), g.hw * S, g.hh * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(200,185,168,0.55)'; ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy + g.hh * .55), g.hw * .82 * S, g.hh * .34 * S, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = .014 * S; ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy), g.hw * S, g.hh * S, 0, 0, Math.PI * 2); ctx.stroke();
}
function drawEars({ ctx, g, X, Y, S, box, spec }) {
  // ears sit behind the face edge: clip out the head ellipse, then draw full ear ellipses
  ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.ellipse(X(g.cx), Y(g.cy), g.hw * S, g.hh * S, 0, 0, Math.PI * 2); ctx.clip('evenodd');
  ctx.fillStyle = SKIN; ctx.strokeStyle = INK; ctx.lineWidth = .012 * S;
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(X(g.cx + sgn * g.hw), Y(g.cy), g.er * S, g.er * 1.4 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(X(g.cx + sgn * g.hw), Y(g.cy), g.er * .5 * S, g.er * .8 * S, 0, -Math.PI / 2, Math.PI / 2, sgn < 0); ctx.stroke();
  }
  ctx.restore();
}
function drawHair(f, k) {
  const { ctx, g, X, Y, S, spec } = f;
  const color = k === 'hood' ? HOOD_COLORS[(spec.seed >>> 3) % HOOD_COLORS.length] : HAIR_COLORS[spec.seed % HAIR_COLORS.length];
  ctx.fillStyle = color;
  hairShape(ctx, g, k, X, Y, S);   // fill only (no ink outline on clipped hair regions)
  ctx.save(); ctx.lineCap = 'round';
  if (k === 'sidePart') { ctx.strokeStyle = 'rgba(25,16,10,0.55)'; ctx.lineWidth = .009 * S; for (let i = 0; i < 6; i++) { const t = i / 5; ctx.beginPath(); ctx.moveTo(X(g.cx - g.hw * (.9 - t * .5)), Y(g.top + .03 + t * .01)); ctx.quadraticCurveTo(X(g.cx + g.hw * (.1 + t * .4)), Y(g.top + .02 + t * .05), X(g.cx + g.hw * (.85 - t * .2)), Y(g.top + .14 + t * .06)); ctx.stroke(); } ctx.strokeStyle = INK; ctx.lineWidth = .012 * S; ctx.beginPath(); ctx.moveTo(X(g.cx - g.hw * .35), Y(g.top + .02)); ctx.lineTo(X(g.cx - g.hw * .25), Y(g.top + .18)); ctx.stroke(); }
  else if (k === 'buzz') { ctx.fillStyle = 'rgba(20,14,8,0.35)'; for (let i = 0; i < 70; i++) { const a = Math.PI * (1.05 + .9 * i / 70), r = .5 + (i % 5) * .1; ctx.fillRect(X(g.cx + Math.cos(a) * g.hw * r), Y(g.top + .06 + Math.sin(a) * .06 * r), .008 * S, .008 * S); } }
  else if (k === 'bald') { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .012 * S; ctx.beginPath(); ctx.arc(X(g.cx + g.hw * .3), Y(g.top + .08), g.hw * .25 * S, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke(); ctx.fillStyle = 'rgba(90,70,50,0.3)'; for (let i = 0; i < 40; i++) { const a = Math.PI * (.2 + .6 * i / 40); ctx.fillRect(X(g.cx + Math.cos(a) * g.hw * .78), Y(g.cy + Math.sin(a) * g.hh * .8), .007 * S, .007 * S); } }
  else if (k === 'hood') { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .012 * S; ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy + .04), g.hw * .8 * S, g.hh * .78 * S, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(g.cx), Y(g.cy - .02 - g.hh * 1.18)); ctx.lineTo(X(g.cx), Y(g.cy + .04 - g.hh * .78)); ctx.stroke(); }
  ctx.restore();
}
function drawBrows({ ctx, g, X, Y, S, spec }, w) {
  const tilt = (hash(spec.seed, 1) - .5) * .02;
  ctx.strokeStyle = INK; ctx.lineWidth = w * S; ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(g.cx + sgn * g.hw * .62), Y(g.cy - g.hh * .17)); ctx.lineTo(X(g.cx + sgn * g.hw * .2), Y(g.cy - g.hh * .22 + tilt)); ctx.stroke(); }
}
function drawEyes({ ctx, g, X, Y, S }, heavy) {
  for (const sgn of [-1, 1]) {
    const x = g.cx + sgn * g.hw * .4, y = g.cy - g.hh * .04, rx = g.hw * (heavy ? .19 : .22), ry = g.hh * (heavy ? .08 : .1);
    ctx.fillStyle = '#f7f4ee'; ctx.strokeStyle = INK; ctx.lineWidth = .01 * S; ctx.beginPath(); ctx.ellipse(X(x), Y(y), rx * S, ry * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(x + sgn * g.hw * .02), Y(y), ry * .55 * S, 0, Math.PI * 2); ctx.fill();
    if (heavy) { ctx.strokeStyle = 'rgba(90,70,55,0.6)'; ctx.lineWidth = .016 * S; ctx.beginPath(); ctx.ellipse(X(x), Y(y + .004), rx * S, ry * S, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  }
}
function drawNose({ ctx, g, X, Y, S, spec }, k) {
  const len = (.8 + .5 * hash(spec.seed, 2)) * k, x = g.cx, y0 = g.cy - g.hh * .04, y1 = g.cy + g.hh * .3 * len;
  ctx.strokeStyle = 'rgba(60,45,35,0.85)'; ctx.lineWidth = .016 * S; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(x - g.hw * .02), Y(y0)); ctx.quadraticCurveTo(X(x + g.hw * .05), Y((y0 + y1) / 2), X(x + g.hw * .02), Y(y1)); ctx.stroke();
  ctx.fillStyle = PINK; ctx.lineWidth = .009 * S; ctx.beginPath(); ctx.ellipse(X(x + g.hw * .02), Y(y1), g.hw * .1 * S, g.hw * .08 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

/** Walk the slot table in order, dispatch each sampled variant. Returns the list of drawn [key,variant]. */
export function drawSlotPortrait(ctx, spec, box, { slots = PORTRAIT_SLOTS, drawers = SLOT_DRAWERS } = {}) {
  if (!spec?.parts || !spec.params || !box || !(box.w > 0) || !(box.h > 0)) throw new RangeError('Invalid portrait spec/box');
  const S = Math.min(box.w, box.h), ox = box.x + (box.w - S) / 2, oy = box.y + (box.h - S) / 2;
  const frame = { ctx, box, spec, S, g: slotGeometry(spec), X: (u) => ox + u * S, Y: (v) => oy + v * S };
  const drawn = [];
  for (const s of slots) {
    const v = spec.parts[s.key], fn = drawers[s.key]?.[v];
    if (typeof fn !== 'function') throw new RangeError(`No drawer for ${s.key}:${v}`);
    ctx.save(); try { fn(frame); } finally { ctx.restore(); }
    drawn.push([s.key, v]);
  }
  return drawn;
}

/** Black head+ear+hair fill only (no strokes): the same region portraitSilhouette rasterises. */
export function drawSlotSilhouette(ctx, spec, size) {
  const g = slotGeometry(spec), S = size, X = (u) => u * S, Y = (v) => v * S;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy), g.hw * S, g.hh * S, 0, 0, Math.PI * 2); ctx.fill();
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X(g.cx + sgn * g.hw), Y(g.cy), g.er * S, g.er * 1.4 * S, 0, 0, Math.PI * 2); ctx.fill(); }
  hairShape(ctx, g, spec.parts.hair, X, Y, S);
}
