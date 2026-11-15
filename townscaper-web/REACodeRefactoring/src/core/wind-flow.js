/** Shared-voxel wind uses beyond the arrow field (REACode wind.js / voxelflow.js / flowdemo.js / snow.js).
 *
 * 926903893866541057 "Here is what my wind vectors look like. They can be used by all kinds of systems, including shaders"
 * 926890207298899969 "I build a custom mesh for the flag using a bezier curve along virtual wind particles"
 * 931196707236392960 "virtual voxel space ... soft normals ... simplified collision, wind simulation"
 * 943230624369868800 "snow flakes are affected by the wind system and thus flow around the island"
 * 823848950553780226 "I do have AO on my dust particles"
 *
 * Everything here reads the caller's shared sampler / World probes; no second
 * occupancy volume is created. Constants are local choices (the clips do not
 * reveal the original solver), the structure is what the posts describe.
 */

const finite = (...v) => v.every(Number.isFinite);
const vec = (v) => Array.isArray(v) ? v : [v.x, v.y, v.z];

/** Integrate one virtual wind particle through the shared field. A step that
 * would enter a solid World bit slides: first drop the vertical part, then the
 * horizontal part, finally rest on the support below. Never ends inside rock. */
export function traceWind(sample, probes, start, { steps = 12, dt = .09 } = {}) {
  if (typeof sample !== 'function' || !probes || typeof probes.occupied !== 'function') throw new TypeError('traceWind needs a sampler and World probes');
  if (!Array.isArray(start) || start.length !== 3 || !finite(...start) || !Number.isInteger(steps) || steps < 1 || steps > 512 || !finite(dt) || dt <= 0) throw new RangeError('Invalid wind trace');
  let [x, y, z] = start;
  if (probes.occupied(x, y, z)) throw new RangeError('Wind trace starts inside solid World voxel');
  const pts = [[x, y, z]];
  let blocked = 0;
  for (let i = 0; i < steps; i++) {
    const [vx, vy, vz] = vec(sample(x, y, z));
    if (!finite(vx, vy, vz)) throw new RangeError('Wind sampler returned nonfinite vector');
    const tries = [[vx, vy, vz], [vx, 0, vz], [0, vy, 0]];
    let moved = false;
    for (const [ax, ay, az] of tries) {
      if (Math.abs(ax) + Math.abs(ay) + Math.abs(az) < 1e-12) continue;
      const nx = x + ax * dt, ny = Math.max(.02, y + ay * dt), nz = z + az * dt;
      if (!probes.occupied(nx, ny, nz)) { x = nx; y = ny; z = nz; moved = true; break; }
    }
    if (!moved) blocked++;
    pts.push([x, y, z]);
  }
  return { points: pts, blocked };
}

/** Curve through particle samples (Catmull-Rom passes through every control point). */
export function sampleCurve(pts, t) {
  if (!Array.isArray(pts) || !pts.length || !finite(t)) throw new RangeError('Invalid curve sample');
  const n = pts.length;
  if (n === 1) return pts[0].slice();
  const f = Math.max(0, Math.min(1, t)) * (n - 1), i = Math.min(n - 2, Math.floor(f)), s = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const s2 = s * s, s3 = s2 * s;
  return [0, 1, 2].map((k) => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3));
}

/** Flag cloth rebuilt along the traced curve: column k sits at sampleCurve(k/segments),
 * hanging `height` downward. Arc length is normalised to `length` so a strong gust
 * changes the bend, not the cloth size. Returns triangle-strip-ready rows. */
export function flagRibbon(points, { length = .5, height = .3, segments = 8 } = {}) {
  if (!Number.isInteger(segments) || segments < 1 || !finite(length, height) || length <= 0 || height <= 0) throw new RangeError('Invalid flag ribbon');
  const dense = Array.from({ length: segments * 4 + 1 }, (_, i) => sampleCurve(points, i / (segments * 4)));
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1], dense[i][2] - dense[i - 1][2]));
  const total = cum[cum.length - 1];
  if (!(total > 1e-9)) throw new RangeError('Degenerate wind trace');
  const at = (d) => { let k = 1; while (k < cum.length - 1 && cum[k] < d) k++; const t = (d - cum[k - 1]) / Math.max(1e-12, cum[k] - cum[k - 1]); return dense[k - 1].map((v, a) => v + (dense[k][a] - v) * t); };
  const top = [], bottom = [], o = dense[0];
  for (let k = 0; k <= segments; k++) {
    const p = at(Math.min(total, total * k / segments));
    const q = [o[0] + (p[0] - o[0]) * length / total, o[1] + (p[1] - o[1]) * length / total, o[2] + (p[2] - o[2]) * length / total];
    top.push(q); bottom.push([q[0], q[1] - height, q[2]]);
  }
  return { top, bottom, arc: length };
}

/** Pack Atmosphere's layered field into one RGBA float image: layers stacked in V.
 * Texel (i, l*H+j) = (vx, vy, vz, 1). Linear filtering inside a layer plus a
 * manual mix between layers reproduces Atmosphere.sample exactly. */
export function packWindField(field) {
  const { W, H, LV, vx, vy, vz } = field ?? {};
  if (![W, H, LV].every((v) => Number.isInteger(v) && v > 1) || vx?.length !== W * H * LV || vy?.length !== vx.length || vz?.length !== vx.length) throw new RangeError('Invalid wind field');
  const data = new Float32Array(W * H * LV * 4);
  for (let k = 0; k < W * H * LV; k++) { data[k * 4] = vx[k]; data[k * 4 + 1] = vy[k]; data[k * 4 + 2] = vz[k]; data[k * 4 + 3] = 1; }
  return { data, width: W, height: H * LV, W, H, LV, x0: field.x0, z0: field.z0 };
}

export const windFieldGLSL = /* glsl */ `
uniform sampler2D uWindField; uniform vec4 uWindGrid; uniform vec3 uWindDims; // x0,z0,res,levelHeight | W,H,LV
vec3 windLayer(vec2 ij, float l) {
  vec2 uv = vec2((ij.x + .5) / uWindDims.x, (l * uWindDims.y + ij.y + .5) / (uWindDims.y * uWindDims.z));
  return texture2D(uWindField, uv).xyz;
}
vec3 sampleWind(vec3 p) {
  vec2 ij = clamp(vec2((p.x - uWindGrid.x) / uWindGrid.z, (p.z - uWindGrid.y) / uWindGrid.z), vec2(0.), uWindDims.xy - 1.001);
  float fl = clamp(p.y / uWindGrid.w - .5, 0., uWindDims.z - 1.001), l = floor(fl);
  return mix(windLayer(ij, l), windLayer(ij, min(uWindDims.z - 1., l + 1.)), fl - l);
}`;

/** CPU replica of windFieldGLSL with LinearFilter semantics (texel-centre bilinear). */
export function samplePackedWind(packed, x, y, z, { res, levelHeight }) {
  const { data, W, H, LV, x0, z0 } = packed;
  const fi = Math.max(0, Math.min(W - 1.001, (x - x0) / res)), fj = Math.max(0, Math.min(H - 1.001, (z - z0) / res));
  const fl = Math.max(0, Math.min(LV - 1.001, y / levelHeight - .5)), l = Math.floor(fl), tl = fl - l;
  const texel = (i, row, c) => data[(row * W + i) * 4 + c];
  const layer = (ll, c) => {
    const i = Math.floor(fi), j = Math.floor(fj), tx = fi - i, tz = fj - j, r = ll * H + j;
    return (texel(i, r, c) * (1 - tx) + texel(i + 1, r, c) * tx) * (1 - tz) + (texel(i, r + 1, c) * (1 - tx) + texel(i + 1, r + 1, c) * tx) * tz;
  };
  return [0, 1, 2].map((c) => layer(l, c) * (1 - tl) + layer(Math.min(LV - 1, l + 1), c) * tl);
}

/** Soft normals from World occupancy written back into a real mesh.
 * `minDot` keeps hard edges: if the blended normal turns further than that from
 * the face normal (thin walls, roof ridges) the original is kept. */
export function bakeSoftNormals(positions, normals, normalAt, { blend = .55, offset = .12, minDot = .5 } = {}) {
  if (!positions || !normals || positions.length !== normals.length || positions.length % 3 || typeof normalAt !== 'function' || !finite(blend, offset, minDot) || blend < 0 || blend > 1 || minDot < -1 || minDot > 1) throw new RangeError('Invalid soft normal bake');
  let touched = 0, kept = 0, empty = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
    const s = normalAt(positions[i] + nx * offset, positions[i + 1] + ny * offset, positions[i + 2] + nz * offset);
    if (!s) { empty++; continue; }
    let bx = nx + (s[0] - nx) * blend, by = ny + (s[1] - ny) * blend, bz = nz + (s[2] - nz) * blend;
    const l = Math.hypot(bx, by, bz) || 1; bx /= l; by /= l; bz /= l;
    if (bx * nx + by * ny + bz * nz < minDot) { kept++; continue; }
    normals[i] = bx; normals[i + 1] = by; normals[i + 2] = bz; touched++;
  }
  return { touched, kept, empty };
}

/** Collision against a deformed triangle soup (the actually displayed mesh), not
 * column tops: drop a vertical ray and return the highest surface below maxY. */
export function meshCollider(positions, { bucket = 1 } = {}) {
  if (!positions || positions.length % 9 || !finite(bucket) || bucket <= 0) throw new RangeError('Invalid collider mesh');
  const grid = new Map(), key = (i, j) => i + ',' + j;
  for (let t = 0; t < positions.length; t += 9) {
    const xs = [positions[t], positions[t + 3], positions[t + 6]], zs = [positions[t + 2], positions[t + 5], positions[t + 8]];
    for (let i = Math.floor(Math.min(...xs) / bucket); i <= Math.floor(Math.max(...xs) / bucket); i++)
      for (let j = Math.floor(Math.min(...zs) / bucket); j <= Math.floor(Math.max(...zs) / bucket); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(t); }
  }
  function heightAt(x, z, maxY = Infinity) {
    if (!finite(x, z) || !(maxY === Infinity || finite(maxY))) throw new RangeError('Invalid collider query');
    let best = null;
    for (const t of grid.get(key(Math.floor(x / bucket), Math.floor(z / bucket))) ?? []) {
      const ax = positions[t], ay = positions[t + 1], az = positions[t + 2], bx = positions[t + 3], by = positions[t + 4], bz = positions[t + 5], cx = positions[t + 6], cy = positions[t + 7], cz = positions[t + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;   // vertical wall: invisible to a vertical ray
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
      if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
      const y = u * ay + v * by + w * cy;
      if (y <= maxY + 1e-9 && (best === null || y > best)) best = y;
    }
    return best;
  }
  return { heightAt, triangles: positions.length / 9 };
}

/** Particle contact AO (823848950553780226): darker near the surface below, fainter far away.
 * `height` is distance to the actual World support (null when over water). */
export function particleContactAlpha(height, distance01, { near = .35, fade = 1.5, base = .72 } = {}) {
  if (!finite(distance01) || (height !== null && !finite(height))) throw new RangeError('Invalid particle contact sample');
  const h = height === null ? fade : Math.max(0, height);
  return base * (near + (1 - near) * Math.min(1, h / fade)) * (1 - .45 * Math.max(0, Math.min(1, distance01)));
}
