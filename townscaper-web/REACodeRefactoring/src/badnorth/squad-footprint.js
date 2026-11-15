/** 883447205176238083: the pale wireframe a selected squad leaves on the ground.
 *  654 frames of the snow island. Under every squad there is a near-white cyan
 *  net: an outline around the occupied ground, a hub in the middle of the men and
 *  one spoke from the hub to each outline corner, with a small square tick sitting
 *  on every corner. The net follows the cell the men stand on, so it is a hull of
 *  occupied cells rather than a fixed quad.
 *  Local construction; the reference is a screen-space overlay of 1px lines.
 */
const EPS = 1e-9;

/** Monotone chain, counter-clockwise, no repeated first point. */
export function hullRing(points) {
  const uniq = [];
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) throw new RangeError('invalid footprint point');
    if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-7 && Math.abs(q[1] - p[1]) < 1e-7)) uniq.push([p[0], p[1]]);
  }
  if (uniq.length < 3) return uniq.slice();
  const s = uniq.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of s) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= EPS) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= EPS) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

export function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

export function ringPerimeter(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    s += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return s;
}

/** Hub = mean of the men, which is what the reference puts the spokes on. */
export function hubOf(points) {
  if (!points.length) throw new RangeError('empty squad');
  let x = 0, y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  return [x / points.length, y / points.length];
}

export function fanTriangles(ring, hub) {
  if (ring.length < 3) return [];
  const tris = [];
  for (let i = 0; i < ring.length; i++) tris.push([hub, ring[i], ring[(i + 1) % ring.length]]);
  return tris;
}

/** Small square tick centred on a corner, in world units. */
export function cornerTick([x, y], size = 0.07) {
  return [[x - size, y - size], [x + size, y - size], [x + size, y + size], [x - size, y + size]];
}

export function footprint(points, { tick = 0.07 } = {}) {
  const ring = hullRing(points);
  const hub = hubOf(points);
  return {
    ring,
    hub,
    spokes: ring.map((p) => [hub, p]),
    tris: fanTriangles(ring, hub),
    ticks: ring.map((p) => cornerTick(p, tick)),
    area: ring.length >= 3 ? ringArea(ring) : 0,
    perimeter: ring.length >= 3 ? ringPerimeter(ring) : 0,
    degenerate: ring.length < 3,
  };
}
