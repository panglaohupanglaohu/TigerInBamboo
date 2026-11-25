/** REACode propanim.js (1246074663546916873 "The props now animate when they appear and disappear.
 * This was much trickier than I anticipated.") — per-prop lifecycle with stable identity.
 *
 * Props are merged into one buffer, so a prop has no matrix of its own. The lab's route B: each
 * vertex carries a prop slot; a small per-prop record (origin xyz + scale) is uploaded per frame
 * and the vertex shader scales around the prop's root. This module keeps that record table:
 *   - identity = caller's stable key (e.g. "cell:edge:kind"), so a rebuild that re-emits the same
 *     prop does NOT restart its animation, and slots are reused only after a prop fully vanishes;
 *   - appear = underdamped spring (ζ≈0.6, ~10% overshoot) with left-to-right stagger;
 *   - disappear keeps the old geometry slot alive and shrinks it faster (stiffer, smaller).
 * r55: wired to a World-derived merged prop mesh in world/prop-anim-layer.js (aPropSlot + record
 * DataTexture, index.html?propanim=1); the terrain/building WorldMesh buffer itself is not touched.
 * r192: curves re-calibrated to the clip (appear peak 1.372 / 0.121 s settle, vanish 0.091 s monotone);
 * `curve: 'spring'` keeps the old r53 spring for templates that were tuned against it.
 */
/** 片内时间签名（第 192 轮逐帧标定，306 帧 / 33.00970873786408 fps = 0.03029 s/帧）：
 *   出现 0260→0261 一帧跳到稳定值的 1.372×，之后 4 帧 = 0.121s 单调回落 → 过冲后指数收敛；
 *   消失 0223→0224 **一帧**就塌掉（绿的草皮/绿篱 7077→86 px），0225/0226/0227 只剩 25/11/9 px 残影
 *   → 可见塌陷按 1 帧实现，不再编造更长的收尾；残影由 slot 保留期（3 帧 = 0.091s）承担。
 *  r192 起这是 PropLifecycle 的默认曲线；`spring` 档保留给旧模板（ζ=.6 只有 9.5% 过冲、0.35s 收）。 */
export const PROP_TIMING = Object.freeze({
  appearPeak: 1.372, appearRise: 1 / 33.00970873786408, appearSettle: .121,
  vanish: 1 / 33.00970873786408, slotHold: 3 / 33.00970873786408, decay: 6,
});
export const propTiming = (o = {}) => Object.freeze({ ...PROP_TIMING, ...o });

/** 出现：0→peak 在 rise（≈1 帧）内直线冲上去，再按 settle 指数回落到 1（单调，不再反弹）。 */
export function appearAt(t, timing = PROP_TIMING) {
  if (!Number.isFinite(t)) throw new RangeError('Invalid appear time');
  if (t <= 0) return 0;
  if (t < timing.appearRise) return timing.appearPeak * t / timing.appearRise;
  const dt = t - timing.appearRise;
  if (dt >= timing.appearSettle) return 1;
  return 1 + (timing.appearPeak - 1) * Math.exp(-timing.decay * dt / timing.appearSettle);
}
/** 消失：vanish（片内 = 1 帧）内单调塌到 0，无过冲（0224 已无可见道具，仅剩 3 帧残影像素）。 */
export function vanishAt(t, timing = PROP_TIMING) {
  if (!Number.isFinite(t)) throw new RangeError('Invalid vanish time');
  if (t <= 0) return 1;
  if (t >= timing.vanish) return 0;
  return 1 - Math.pow(t / timing.vanish, 2);
}
/** 片内曲线版 scaleAt：出现过冲 + 消失塌陷，二者共用同一个 delay/hideAt 契约。 */
export function timelineScale(entry, t, timing = PROP_TIMING) {
  const appear = appearAt(t - entry.delay, timing);
  if (entry.hideAt === undefined || t < entry.hideAt) return appear;
  return appearAt(entry.hideAt - entry.delay, timing) * vanishAt(t - entry.hideAt, timing);
}

export function springValue(t, stiffness = 170, zeta = .6) {
  if (![t, stiffness, zeta].every(Number.isFinite) || stiffness <= 0 || zeta < 0) throw new RangeError('Invalid spring');
  if (t <= 0) return 0;
  const a = Math.sqrt(stiffness) * zeta, w2 = stiffness - a * a;
  if (w2 <= 0) return 1 - Math.exp(-a * t) * (1 + a * t);
  const wd = Math.sqrt(w2); return 1 - Math.exp(-a * t) * (Math.cos(wd * t) + a / wd * Math.sin(wd * t));
}
export function staggerAt(i, n, spread = .2) { if (!Number.isInteger(i) || !Number.isInteger(n) || i < 0 || i >= Math.max(1, n)) throw new RangeError('Invalid stagger'); return n <= 1 ? 0 : spread * i / (n - 1); }
export function scaleAt(entry, t, { stiffness = 170, zeta = .6, outStiffness = 900, outZeta = .8 } = {}) {
  const appear = springValue(t - entry.delay, stiffness, zeta);
  if (entry.hideAt === undefined || t < entry.hideAt) return appear;
  return springValue(entry.hideAt - entry.delay, stiffness, zeta) * (1 - springValue(t - entry.hideAt, outStiffness, outZeta));
}

export class PropLifecycle {
  constructor({ capacity = 512, spread = .2, timing = PROP_TIMING, outLife = PROP_TIMING.slotHold, curve = 'clip' } = {}) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Invalid prop capacity');
    if (curve !== 'clip' && curve !== 'spring') throw new RangeError('Invalid curve ' + curve);
    this.capacity = capacity; this.spread = spread; this.outLife = outLife;
    this.timing = timing; this.curve = curve;
    this.byKey = new Map(); this.free = Array.from({ length: capacity }, (_, i) => capacity - 1 - i);
    this.records = new Float32Array(capacity * 4);   // x, y, z, scale per slot (uniform/texture upload)
  }
  /** Present the full set of props after a World rebuild: [{key, x, y, z}]. */
  sync(props, now) {
    if (!Array.isArray(props) || !Number.isFinite(now)) throw new RangeError('Invalid prop sync');
    const seen = new Set(), born = [];
    for (const p of props) {
      if (seen.has(p.key)) throw new RangeError('Duplicate prop key ' + p.key);
      seen.add(p.key);
      const e = this.byKey.get(p.key);
      if (e && e.hideAt === undefined) { e.x = p.x; e.y = p.y; e.z = p.z; continue; }   // unchanged: keep animating
      if (e) { e.delay = now; e.hideAt = undefined; continue; }   // re-added while vanishing: grow again
      born.push(p);
    }
    born.sort((a, b) => a.x - b.x || a.z - b.z);   // left-to-right wave, as in the clip
    born.forEach((p, i) => {
      if (!this.free.length) throw new RangeError('Prop capacity exceeded');
      this.byKey.set(p.key, { key: p.key, slot: this.free.pop(), x: p.x, y: p.y, z: p.z, delay: now + staggerAt(i, born.length, this.spread) });
    });
    for (const e of this.byKey.values()) if (!seen.has(e.key) && e.hideAt === undefined) e.hideAt = now;   // geometry kept, shrinks out
    return { born: born.length };
  }
  /** Advance to `now`: write per-slot records; release slots whose shrink finished. */
  update(now) {
    let live = 0;
    for (const e of [...this.byKey.values()]) {
      const s = this.curve === 'spring' ? scaleAt(e, now) : timelineScale(e, now, this.timing);
      if (e.hideAt !== undefined && now - e.hideAt >= this.outLife) { this.records.fill(0, e.slot * 4, e.slot * 4 + 4); this.free.push(e.slot); this.byKey.delete(e.key); continue; }
      this.records.set([e.x, e.y, e.z, s], e.slot * 4); live++;
    }
    return live;
  }
  slotOf(key) { return this.byKey.get(key)?.slot ?? -1; }
  /** Cost model of the two routes per frame (floats written). */
  static uploadCost({ props, vertsPerProp }) { return { rebuildFloats: props * vertsPerProp * 3, recordFloats: props * 4 }; }
}

export const propScaleGLSL = `
// aPropSlot: per-vertex slot; uPropRecords[slot] = (root xyz, scale). Scale around the prop root.
// Non-prop vertices use slot -1 and skip this call.
vec3 propScaled(vec3 p, vec4 rec) { return rec.xyz + (p - rec.xyz) * rec.w; }`;
