// Spherical barycentric helpers shared by dual-cell sampling and chart seam
// validation.  The projection is local to a normalized tangent plane; for
// the small geodesic cells this avoids the discontinuity of nearest-cell
// semantic selection while remaining deterministic and allocation-light.

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function length(v) { return Math.hypot(...v) || 1; }
function normalize(v) { const l = length(v); return v.map((n) => n / l); }

export function tangentBasis(direction) {
  const up = normalize(direction);
  const reference = Math.abs(up[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
  let right = cross(reference, up);
  if (length(right) < 1e-8) right = cross([0, 0, 1], up);
  right = normalize(right);
  const forward = normalize(cross(up, right));
  // right × forward = up: explicit right-handed basis.
  return { up, right, forward };
}

export function projectToTangent(point, basis) {
  return [dot(point, basis.right), dot(point, basis.forward)];
}

export function planarBarycentric(point, triangle, basis = tangentBasis(normalize(triangle[0]))) {
  const p = projectToTangent(point, basis);
  const a = projectToTangent(triangle[0], basis);
  const b = projectToTangent(triangle[1], basis);
  const c = projectToTangent(triangle[2], basis);
  const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(denominator) < 1e-10) return [1, 0, 0];
  const w0 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / denominator;
  const w1 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / denominator;
  return [w0, w1, 1 - w0 - w1];
}

export function clampNormalizeWeights(weights) {
  const clamped = weights.map((weight) => Math.max(0, weight));
  const total = clamped.reduce((sum, value) => sum + value, 0);
  return total > 1e-10 ? clamped.map((value) => value / total) : weights.map((_, index) => index === 0 ? 1 : 0);
}

export function nearestBarycentricTriangle(points, query, candidates) {
  const q = normalize(query);
  const scored = candidates.map((candidate) => ({ candidate, score: dot(points[candidate], q) }));
  scored.sort((a, b) => b.score - a.score || a.candidate - b.candidate);
  const chosen = scored.slice(0, 3).map((entry) => entry.candidate);
  if (chosen.length < 3) return { indices: chosen, weights: chosen.map((_, index) => index === 0 ? 1 : 0) };
  const triangle = chosen.map((index) => points[index]);
  const weights = clampNormalizeWeights(planarBarycentric(q, triangle, tangentBasis(q)));
  return { indices: chosen, weights };
}

