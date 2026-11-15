/** 1664565063552847873: "It seems to need 32 bit float render targets … might also be a
 * challenge to … feed back to CPU". CPU reference of the original floatprobe.js advection
 * (fixed vortex, semi-Lagrangian, clamp-to-edge) with the STORAGE format emulated after
 * every pass, so the precision question is measurable without a GPU:
 *   f64 (reference) · f32 (Math.fround) · f16 (IEEE half round-to-nearest-even) · u8 (UNORM8, clamps negatives/HDR)
 * and nearest vs bilinear sampling (what a target without float-linear filtering degrades to).
 * This is NOT a GPU measurement and NOT a cross-platform matrix; a fluid solver is not wired in.
 */
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
/** Round a number to the nearest IEEE-754 binary16 value (RNE, subnormals, ±Inf on overflow). */
export function roundHalf(v) {
  if (!Number.isFinite(v)) return v;
  if (v === 0) return v;
  const a = Math.abs(v), s = Math.sign(v);
  if (a >= 65520) return s * Infinity;
  if (a < 2 ** -14) { const q = 2 ** -24; return s * roundEven(a / q) * q; }
  const e = Math.floor(Math.log2(a)), q = 2 ** (e - 10);
  return s * roundEven(a / q) * q;
}
function roundEven(x) { const f = Math.floor(x), d = x - f; return d > 0.5 || (d === 0.5 && f % 2) ? f + 1 : f; }
export const STORAGE = Object.freeze({
  f64: (v) => v,
  f32: (v) => Math.fround(v),
  f16: roundHalf,
  u8: (v) => Math.round(Math.min(1, Math.max(0, v)) * 255) / 255,
});

export function seedBlob(size) {
  const a = new Float64Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5);
    a[y * size + x] = Math.max(0, 1 - d * 2) ** 2;
  }
  return a;
}

/** Run `steps` semi-Lagrangian passes. field: Float64Array size². */
export function advect(field, { size, steps = 60, dt = 0.02, spin = 0.35, storage = 'f32', filter = 'linear', velocity = null } = {}) {
  if (!Number.isInteger(size) || size < 2 || size > 512 || field.length !== size * size || !Number.isInteger(steps) || steps < 0 || steps > 10000 || !STORAGE[storage] || !['linear', 'nearest'].includes(filter) || ![dt, spin].every(Number.isFinite)) throw new RangeError('advect options');
  const store = STORAGE[storage], vel = velocity || ((u, v) => [-(v - 0.5) * spin, (u - 0.5) * spin]);
  let a = Float64Array.from(field, store);
  const at = (arr, i, j) => arr[Math.max(0, Math.min(size - 1, j)) * size + Math.max(0, Math.min(size - 1, i))];
  const sample = filter === 'linear'
    ? (arr, x, y) => { const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0; return (at(arr, x0, y0) * (1 - fx) + at(arr, x0 + 1, y0) * fx) * (1 - fy) + (at(arr, x0, y0 + 1) * (1 - fx) + at(arr, x0 + 1, y0 + 1) * fx) * fy; }
    : (arr, x, y) => at(arr, Math.floor(x), Math.floor(y));
  for (let s = 0; s < steps; s++) {
    const b = new Float64Array(a.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size, [vx, vy] = vel(u, v);
      b[y * size + x] = store(sample(a, (u - vx * dt) * size, (v - vy * dt) * size));
    }
    a = b;
  }
  return a;
}

const mass = (a) => a.reduce((s, v) => s + v, 0);
/** Compare storage/filter variants against the f64 bilinear reference. */
export function advectionQuality({ size = 32, steps = 60, dt = 0.02, field = null, variants = [['f32', 'linear'], ['f16', 'linear'], ['u8', 'linear'], ['f32', 'nearest']] } = {}) {
  const start = field ?? seedBlob(size), m0 = mass(start);
  const ref = advect(start, { size, steps, dt, storage: 'f64', filter: 'linear' });
  const rows = variants.map(([storage, filter]) => {
    const out = advect(start, { size, steps, dt, storage, filter });
    let l1 = 0, max = 0, nonFinite = 0, moved = 0;
    for (let i = 0; i < out.length; i++) { if (!Number.isFinite(out[i])) { nonFinite++; continue; } moved += Math.abs(out[i] - start[i]); const d = Math.abs(out[i] - ref[i]); l1 += d; max = Math.max(max, d); }
    return { storage, filter, massDrift: m0 ? (mass(out) - m0) / m0 : 0, meanAbsError: l1 / out.length, maxAbsError: max, meanAbsMotion: moved / out.length, nonFinite };
  });
  return { size, steps, dt, referenceMassDrift: m0 ? (mass(ref) - m0) / m0 : 0, referenceMotion: ref.reduce((s, v, i) => s + Math.abs(v - start[i]), 0) / ref.length, rows, scope: 'cpu-emulated-storage; not a GPU or cross-platform measurement' };
}

/** Signed / HDR round-trip through a storage format (velocity fields are signed). */
export function storageRoundTrip(values, storage) {
  if (!STORAGE[storage]) throw new RangeError('storage');
  return values.map((v) => ({ value: v, stored: STORAGE[storage](v), exact: STORAGE[storage](v) === v }));
}
