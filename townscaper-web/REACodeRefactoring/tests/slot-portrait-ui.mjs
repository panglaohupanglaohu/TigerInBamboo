// r55 G3: REACode portrait.js → ui.html draws faces from part-random.js PORTRAIT_SLOTS / sampleSlots
// through src/ui/slot-portrait.js (procedural vector stand-ins; original artwork unavailable).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTRAIT_SLOTS, sampleSlots, portraitSilhouette, partSeed } from '../src/core/part-random.js';
import { SLOT_DRAWERS, drawSlotPortrait, drawSlotSilhouette, slotGeometry } from '../src/ui/slot-portrait.js';

// recording Canvas2D stand-in
function rec() {
  const log = [];
  const ctx = new Proxy({ log }, { get: (t, k) => k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : (...a) => { log.push([k, ...a]); }, set: (t, k, v) => { t[k] = v; log.push(['set:' + String(k), v]); return true; } });
  return ctx;
}
// every variant of every slot has a drawer
for (const s of PORTRAIT_SLOTS) for (const v of s.variants) assert.equal(typeof SLOT_DRAWERS[s.key]?.[v], 'function', `drawer ${s.key}:${v}`);
// the walker follows the slot table order and draws exactly the sampled variants
const hairSeen = new Set();
for (let i = 0; i < 48; i++) {
  const spec = sampleSlots(partSeed(7, i)), ctx = rec();
  const drawn = drawSlotPortrait(ctx, spec, { x: 10, y: 20, w: 100, h: 100 });
  assert.deepEqual(drawn.map(([k]) => k), PORTRAIT_SLOTS.map((s) => s.key));
  assert.deepEqual(Object.fromEntries(drawn), spec.parts);
  assert.ok(ctx.log.filter(([k]) => k === 'save').length === ctx.log.filter(([k]) => k === 'restore').length, 'balanced save/restore');
  assert.ok(ctx.log.some(([k]) => k === 'ellipse'), 'head drawn');
  hairSeen.add(spec.parts.hair);
}
assert.equal(hairSeen.size, 5, 'all 5 hair variants (incl. hood) reached in 48 faces');
// deterministic per spec
const a = rec(), b = rec(), s7 = sampleSlots(partSeed(7, 3));
drawSlotPortrait(a, s7, { x: 0, y: 0, w: 64, h: 64 }); drawSlotPortrait(b, s7, { x: 0, y: 0, w: 64, h: 64 });
assert.deepEqual(a.log, b.log);
// geometry is shared with portraitSilhouette: head centre on, outside head+ears off, hair band only when hair present
for (let i = 0; i < 24; i++) {
  const spec = sampleSlots(partSeed(11, i)), g = slotGeometry(spec), m = portraitSilhouette(spec, 64), at = (u, v) => m[Math.min(63, (v * 64) | 0) * 64 + Math.min(63, (u * 64) | 0)];
  assert.equal(at(g.cx, g.cy), 1);
  assert.equal(at(g.cx + g.hw + g.er + .03, g.cy + g.hh * .7), 0);
  // head ellipse edge from slotGeometry is where the mask switches (within one pixel)
  assert.equal(at(g.cx, g.cy + g.hh - 1.5 / 64), 1); if (spec.parts.hair !== 'hood') assert.equal(at(g.cx, g.cy + g.hh + 1.5 / 64), 0);
  if (spec.parts.hair === 'hood') assert.equal(at(g.cx, g.cy - .02 - g.hh * 1.1), 1, 'hood above head');
}
// silhouette drawer: fills only, hair clip regions present for non-bald hair
const sil = rec(), hooded = Array.from({ length: 48 }, (_, i) => sampleSlots(partSeed(7, i))).find((s) => s.parts.hair === 'hood');
drawSlotSilhouette(sil, hooded, 64);
assert.ok(sil.log.some(([k, r]) => k === 'fill' && r === 'evenodd') && !sil.log.some(([k]) => k === 'stroke'));
// content agnostic: a different table + drawer map runs through the same walker; missing drawer throws
const BANNER = [{ key: 'cloth', variants: ['square'], provides: 'field' }, { key: 'emblem', variants: ['ring'], needs: 'field' }];
const calls = [];
drawSlotPortrait(rec(), { ...sampleSlots(3, BANNER), params: { wide: 1, long: 1, drop: 0 } }, { x: 0, y: 0, w: 10, h: 10 }, { slots: BANNER, drawers: { cloth: { square: () => calls.push('cloth') }, emblem: { ring: () => calls.push('emblem') } } });
assert.deepEqual(calls, ['cloth', 'emblem']);
assert.throws(() => drawSlotPortrait(rec(), { ...s7, parts: { ...s7.parts, hair: 'mohawk' } }, { x: 0, y: 0, w: 9, h: 9 }), /No drawer for hair:mohawk/);
assert.throws(() => drawSlotPortrait(rec(), s7, { x: 0, y: 0, w: 0, h: 9 }));
// ui.html wiring: slot mode imports the sampler + drawer, toggle via ?portrait=slots, default stays the old tree
const html = readFileSync(new URL('../ui.html', import.meta.url), 'utf8');
assert.match(html, /import \{drawSlotPortrait,drawSlotSilhouette\} from "\.\/src\/ui\/slot-portrait\.js"/);
assert.match(html, /sampleSlots\(localSeed\)/);
assert.match(html, /get\('portrait'\)==='slots'\?'slots':'tree'/);
assert.match(html, /id="face-mode"/);
console.log('PASS slot portrait ui', { variants: PORTRAIT_SLOTS.reduce((n, s) => n + s.variants.length, 0), hair: [...hairSeen] });
