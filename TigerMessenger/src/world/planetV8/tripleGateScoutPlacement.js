// ============================================================================
// 三重门侦察机的球面锚点计算（Three.js-free）
//
// 生成阶段只输出可审计的 placement contract；渲染层再把它转换成 Three
// 的 position/quaternion。这样模型不会因为把“球面法线”误当成世界 Y 而
// 悬空，也不会随着行星半径变化而丢失三重门的相对位置。
// ============================================================================

export const TRIPLE_GATE_SCOUT_PLACEMENT_VERSION = "triple-gate-scout-placement-v1";

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function vector3(value, fallback = [0, 1, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return [finite(source[0]), finite(source[1]), finite(source[2])];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize3(v, fallback = [0, 1, 0]) {
  const len = length3(v);
  if (len < 1e-8) return fallback.slice();
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function addScaled3(a, b, scale) {
  return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}

/**
 * Project a landmark heading into the tangent plane of the spherical surface.
 */
function tangentHeading(up, heading) {
  let tangent = addScaled3(heading, up, -dot3(heading, up));
  if (length3(tangent) < 1e-8) {
    tangent = cross3([0, 1, 0], up);
    if (length3(tangent) < 1e-8) tangent = [1, 0, 0];
  }
  return normalize3(tangent, [1, 0, 0]);
}

/**
 * Compute a stable, auditable placement next to the triple-gate saddle.
 *
 * `surfacePosition` is preferred over radius*direction when the compiled
 * spherical terrain can provide it. The aircraft then hovers above the real
 * terrain sample, while its forward vector remains tangent to the planet.
 */
export function computeTripleGateScoutPlacement({
  radius = 160,
  landmarkDirection = [-0.46, 0.88, 0.09],
  landmarkForward = [0, 0, 1],
  surfacePosition = null,
  hoverHeight = 9,
  forwardOffset = 4.5,
  lateralOffset = 0,
} = {}) {
  const safeRadius = Math.max(1, finite(radius, 160));
  const radial = normalize3(vector3(landmarkDirection));
  const sampled = Array.isArray(surfacePosition) ? vector3(surfacePosition, null) : null;
  const base = sampled && length3(sampled) > safeRadius * 0.25
    ? sampled
    : radial.map((value) => value * safeRadius);
  const up = normalize3(base, radial);
  const forward = tangentHeading(up, vector3(landmarkForward, [0, 0, 1]));
  const right = normalize3(cross3(up, forward), [1, 0, 0]);
  const position = addScaled3(
    addScaled3(addScaled3(base, up, Math.max(0, finite(hoverHeight, 9))), forward, finite(forwardOffset, 4.5)),
    right,
    finite(lateralOffset, 0),
  );

  return Object.freeze({
    version: TRIPLE_GATE_SCOUT_PLACEMENT_VERSION,
    landmarkId: "triple-gate",
    radial: Object.freeze(radial),
    base: Object.freeze(base),
    position: Object.freeze(position),
    up: Object.freeze(up),
    forward: Object.freeze(forward),
    right: Object.freeze(right),
    hoverHeight: Math.max(0, finite(hoverHeight, 9)),
    forwardOffset: finite(forwardOffset, 4.5),
    lateralOffset: finite(lateralOffset, 0),
  });
}

