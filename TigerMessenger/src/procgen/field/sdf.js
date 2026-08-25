// =====================================================================
// SDF primitives/combinators（V7-G7）
// 约定：负值在实体内部，0 为表面，正值在外部。输入输出都是纯数值。
// =====================================================================

const length3 = (p) => Math.hypot(p[0], p[1], p[2]);
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const abs3 = (p) => [Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])];

export function sdSphere(point, center, radius) { return length3(sub3(point, center)) - radius; }

export function sdBox(point, center, halfSize) {
  const q = sub3(abs3(sub3(point, center)), halfSize);
  const outside = [Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)];
  return length3(outside) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
}

export function sdPlane(point, normal, offset = 0) { return point[0] * normal[0] + point[1] * normal[1] + point[2] * normal[2] + offset; }

export function sdCapsule(point, a, b, radius) {
  const pa = sub3(point, a); const ba = sub3(b, a);
  const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / Math.max(1e-12, ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2)));
  return length3(sub3(pa, [ba[0] * h, ba[1] * h, ba[2] * h])) - radius;
}

export function sdCylinderY(point, center, radius, halfHeight) {
  const dx = point[0] - center[0]; const dz = point[2] - center[2]; const dy = Math.abs(point[1] - center[1]) - halfHeight;
  const q = [Math.hypot(dx, dz) - radius, dy];
  return Math.min(Math.max(q[0], q[1]), 0) + Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0));
}

export function sdTorusXZ(point, center, majorRadius, minorRadius) {
  const dx = point[0] - center[0]; const dz = point[2] - center[2]; const radial = Math.hypot(dx, dz);
  return Math.hypot(radial - majorRadius, point[1] - center[1]) - minorRadius;
}

export function sdCave(point, center, halfSize, openingRadius = 0.8) {
  const chamber = sdRoundedBox(point, center, halfSize, 0.35);
  const opening = sdCylinderY(point, [center[0], center[1] - halfSize[1], center[2]], openingRadius, halfSize[1] * 0.8);
  return sdfSubtract(chamber, opening);
}

export function sdRoundedBox(point, center, halfSize, radius) {
  const q = sub3(abs3(sub3(point, center)), halfSize.map((value) => value - radius));
  const outside = [Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)];
  return length3(outside) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0) - radius;
}

export function sdHeightfield(point, { minX, maxX, minZ, maxZ, width, depth, heights, scaleY = 1 } = {}) {
  if (!(width > 1 && depth > 1) || !heights?.length) return Infinity;
  const u = (point[0] - minX) / Math.max(1e-6, maxX - minX) * (width - 1);
  const v = (point[2] - minZ) / Math.max(1e-6, maxZ - minZ) * (depth - 1);
  if (u < 0 || v < 0 || u > width - 1 || v > depth - 1) return Infinity;
  const x = Math.min(width - 2, Math.floor(u)); const z = Math.min(depth - 2, Math.floor(v));
  const tx = u - x; const tz = v - z;
  const at = (ix, iz) => heights[iz * width + ix] * scaleY;
  const h0 = at(x, z) * (1 - tx) + at(x + 1, z) * tx;
  const h1 = at(x, z + 1) * (1 - tx) + at(x + 1, z + 1) * tx;
  return point[1] - (h0 * (1 - tz) + h1 * tz);
}

export const sdfUnion = (a, b) => Math.min(a, b);
export const sdfIntersection = (a, b) => Math.max(a, b);
export const sdfSubtract = (a, b) => Math.max(a, -b);
export function smoothUnion(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * h * k / 6;
}

export function smoothSubtract(a, b, k) {
  return smoothMax(a, -b, k);
}

function smoothMax(a, b, k) {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * h * k / 6;
}

export function composeSdf(...functions) { return (point) => functions.reduce((value, fn) => Math.min(value, fn(point)), Infinity); }
