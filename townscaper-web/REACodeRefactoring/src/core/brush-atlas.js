/** REACode engine/bnbrush.js buildBrushAtlas — pre-baked directional scratch strokes for grass.
 * The lab found hash-sprinkled fragment dots read as "pepper" (tiny, uniform, independent);
 * the reference grass is short directional scratches that overlap into patches. So strokes are
 * rasterised once on the CPU into a tileable RGBA8 atlas:
 *   R big scratches, G medium scratches, B low-frequency density (R box-downsampled ×8, re-upsampled).
 * Strokes crossing the border are written wrapped, so the atlas tiles without seams.
 * The ledge (terrace edge distance) field already exists on the shared World as
 * terrain/blotch-atlas.js buildBlotchRimField; this module does not duplicate it.
 */
const TAU = Math.PI * 2;
function lcg(seed) { let s = (seed * 22695477 + 1) | 0; return () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; }

export function buildScratchAtlas({ size = 256, seed = 7, counts = [700, 1250] } = {}) {
  if (!Number.isInteger(size) || size < 32 || size > 1024 || size % 8 || !Number.isFinite(seed) || counts.length !== 2 || !counts.every((c) => Number.isInteger(c) && c >= 0)) throw new RangeError('Invalid scratch atlas');
  const rnd = lcg(seed), data = new Uint8Array(size * size * 4);
  const splat = (cx, cy, ang, len, wid, amt, ch) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), a = len / 2, b = wid / 2, r = Math.ceil(Math.max(a, b) + 1.5);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca, d = lx * lx / (a * a) + ly * ly / (b * b);
      if (d > 1) continue;
      const v = Math.round(amt * Math.pow(1 - d, .4) * 255);   // nearly solid to the end: survives mips
      if (v <= 0) continue;
      const X = ((Math.round(cx + dx) % size) + size) % size, Y = ((Math.round(cy + dy) % size) + size) % size, i = (Y * size + X) * 4 + ch;
      data[i] = Math.min(255, data[i] + v);
    }
  };
  for (let i = 0; i < counts[0]; i++) splat(rnd() * size, rnd() * size, rnd() * TAU, 9 + rnd() * 7, 2.4 + rnd() * 1.6, .55 + rnd() * .45, 0);
  for (let i = 0; i < counts[1]; i++) splat(rnd() * size, rnd() * size, rnd() * TAU, 4 + rnd() * 4, 1.3 + rnd(), .35 + rnd() * .4, 1);
  const half = size >> 3, low = new Float32Array(half * half);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) low[(y >> 3) * half + (x >> 3)] += data[(y * size + x) * 4] / 255;
  const mx = Math.max(1e-6, ...low);
  const g = (u) => { const t = u * half - .5, i0 = Math.floor(t); return [((i0 % half) + half) % half, ((i0 + 1) % half + half) % half, t - i0]; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [x0, x1, fx] = g(x / size), [y0, y1, fy] = g(y / size);
    const a = low[y0 * half + x0] * (1 - fx) + low[y0 * half + x1] * fx, b = low[y1 * half + x0] * (1 - fx) + low[y1 * half + x1] * fx;
    data[(y * size + x) * 4 + 2] = Math.round(Math.pow((a * (1 - fy) + b * fy) / mx, .8) * 255);
  }
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { data, size };
}

/** Thresholded coverage (the shader's smoothstep(lo, hi) on R), edge energy and orientation
 * coherence (structure tensor) of one channel — the lab's "scratch vs pepper" comparison. */
export function scratchStats({ data, size }, { channel = 0, lo = .28, hi = .52 } = {}) {
  const v = (x, y) => data[((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4 + channel] / 255;
  const sm = (t) => { const k = Math.max(0, Math.min(1, (t - lo) / (hi - lo))); return k * k * (3 - 2 * k); };
  let cover = 0, edge = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = sm(v(x, y)); cover += c > .5 ? 1 : 0;
    edge += Math.abs(sm(v(x + 1, y)) - c) + Math.abs(sm(v(x, y + 1)) - c);
  }
  return { cover: cover / (size * size), edgeEnergy: edge / (size * size), meanR: Array.from({ length: size * size }, (_, i) => data[i * 4] / 255).reduce((a, b) => a + b, 0) / (size * size) };
}

/** Mean local orientation coherence over k×k blocks: 1 = all gradients parallel, 0 = isotropic. */
export function blockCoherence({ data, size }, { channel = 0, block = 8 } = {}) {
  const v = (x, y) => data[((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4 + channel] / 255;
  let sum = 0, n = 0;
  for (let by = 0; by < size; by += block) for (let bx = 0; bx < size; bx += block) {
    let jxx = 0, jyy = 0, jxy = 0;
    for (let y = by; y < by + block; y++) for (let x = bx; x < bx + block; x++) { const gx = v(x + 1, y) - v(x - 1, y), gy = v(x, y + 1) - v(x, y - 1); jxx += gx * gx; jyy += gy * gy; jxy += gx * gy; }
    const tr = jxx + jyy; if (tr < 1e-6) continue;
    sum += Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / tr; n++;
  }
  return n ? sum / n : 0;
}
