/** 839067977781768193: what a squad's banner carries above the men.
 *  227 frames of a daytime island fight. Every banner has a thin dark slot across
 *  its top edge with a green fill; the fill shortens from the right as the squad
 *  loses men, and the left end flashes red on a fresh hit. Kills pop a white
 *  "+10" above the corpse, rising about half a unit and fading over ~1s; two
 *  kills inside a short window fold into one "+20".
 *  Proportions here are a local vocabulary, not a pixel copy of the reference.
 */
export const STRIP = { slot: [22, 32, 42], full: [104, 206, 124], warn: [232, 186, 86], hurt: [228, 96, 92], flash: [238, 74, 66] };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Slot + fill rectangles for a banner of `width`, in banner-local pixels. */
export function bannerBar({ hp = 3, max = 3, width = 26, hitAge = Infinity, flashWindow = 0.16 } = {}) {
  if (!(max > 0) || !Number.isFinite(hp)) throw new RangeError('invalid squad hp');
  if (!(width > 0)) throw new RangeError('invalid banner width');
  const ratio = clamp(hp / max, 0, 1);
  const filled = Math.round(width * ratio);
  const height = Math.max(2, Math.round(width * 0.085));
  const flashing = hitAge >= 0 && hitAge < flashWindow;
  return {
    width, ratio, height,
    slot: { x: 0, y: 0, w: width, h: height, color: STRIP.slot },
    fill: { x: 0, y: 0, w: filled, h: height, color: ratio > 0.7 ? STRIP.full : ratio > 0.34 ? STRIP.warn : STRIP.hurt },
    empty: { x: filled, y: 0, w: width - filled, h: height, color: STRIP.slot },
    flash: flashing ? { x: 0, y: 0, w: Math.max(2, Math.round(width * 0.22)), h: height, color: STRIP.flash } : null,
  };
}

/** Floating kill score: one entry per visible popup. */
export function addPopup(popups, { x = 0, y = 0, z = 0, value = 10 } = {}, { mergeRadius = 0.55, mergeWindow = 0.28 } = {}) {
  if (!Number.isFinite(value) || value === 0) throw new RangeError('invalid popup value');
  for (const p of popups) {
    if (p.age > mergeWindow) continue;
    if (Math.hypot(p.x - x, p.y - y, p.z - z) > mergeRadius) continue;
    p.value += value;
    p.text = '+' + p.value;
    p.age = 0;
    p.merges += 1;
    return p;
  }
  const p = { x, y, z, value, text: '+' + value, age: 0, merges: 1, y0: y };
  popups.push(p);
  return p;
}

/** Advance every popup; returns the drawable snapshot after the step. */
export function stepPopups(popups, dt, { rise = 1.5, life = 1.05, popIn = 0.12, popScale = 0.18 } = {}) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('invalid dt');
  const out = [];
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    p.y += rise * dt;
    if (p.age >= life) { popups.splice(i, 1); continue; }
    const t = p.age / life;
    out.push({
      ...p,
      alpha: clamp(1 - t ** 1.6, 0, 1),
      scale: 1 + popScale * clamp(p.age / popIn, 0, 1),
      lifted: p.y - p.y0,
    });
  }
  return out.sort((a, b) => a.y - b.y);
}
