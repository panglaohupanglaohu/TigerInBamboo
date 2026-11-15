/** 820977247083528192 shows a soft foot disc during an animation cycle.
 * Height fade/footprint clipping below are local engineering choices, not
 * parameters recoverable from that clip. Horizontal convex footprints only.
 *
 * 第 53 批（G5）补 REACode/src/blobshadow.js 的其余三件：
 *   · 光向偏移：离地越高，影子沿主光水平方向偏得越多（原版 offset = 0.36·h，方向 LIGHT_DIR）；
 *   · 坡向椭圆：贴在坡上时沿坡向拉长 1/cosθ、横向压短 cosθ（面积守恒 → 视觉浓度不变）；
 *   · 跨格连续：同一软盘对「同层可站的几块相邻凸格」各裁一次再拼起来——原来只裁自己那一格，走到格边影子被切掉半边。
 *   · groundAt(x,z)：逐顶点贴地（楼梯踏面等）；measure() 给出原版那张指标表。
 */
export const LIGHT_DIR = Object.freeze([0.62, 0.78]);
function checkConvex(footprint) {
  if (!Array.isArray(footprint) || footprint.length < 3) throw new RangeError('Invalid unit shadow');
  let area = 0;
  for (let i = 0; i < footprint.length; i++) { const a = footprint[i], b = footprint[(i + 1) % footprint.length]; if (![a.x, a.z].every(Number.isFinite)) throw new RangeError('Invalid footprint'); area += a.x * b.z - b.x * a.z; }
  if (!area) throw new RangeError('Degenerate footprint'); const sign = Math.sign(area);
  for (let i = 0; i < footprint.length; i++) { const a = footprint[i], b = footprint[(i + 1) % footprint.length], c = footprint[(i + 2) % footprint.length]; if (sign * ((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) < -1e-10) throw new RangeError('Nonconvex footprint'); }
  return sign;
}
function clipConvex(poly, footprint, sign) {
  for (let e = 0; e < footprint.length && poly.length; e++) {
    const a = footprint[e], b = footprint[(e + 1) % footprint.length], side = (p) => sign * ((b.x - a.x) * (p[1] - a.z) - (b.z - a.z) * (p[0] - a.x)), out = [];
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], dp = side(p), dq = side(q), inside = dp >= 0, nextInside = dq >= 0; if (inside) out.push(p); if (inside !== nextInside) { const t = dp / (dp - dq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } }
    poly = out;
  }
  return poly;
}
export function unitShadow({ x, z, footY, groundY, footprint, footprints = null, radius = .12, maxHeight = .8, alpha = .3, light = null, lightOffset = .36, slope = null, groundAt = null, segments = 16 } = {}) {
  if (![x, z, footY, groundY, radius, maxHeight, alpha, lightOffset].every(Number.isFinite) || radius <= 0 || maxHeight <= 0 || alpha < 0 || alpha > 1 || lightOffset < 0) throw new RangeError('Invalid unit shadow');
  const pieces = footprints ?? [footprint], signs = pieces.map(checkConvex);
  const height = footY - groundY, fade = Math.max(0, 1 - Math.max(0, height) / maxHeight), r = radius * (1 + .35 * Math.max(0, height) / maxHeight);
  const result = { position: [], local: [], alpha: alpha * fade, height, radius: r, triangles: 0, pieces: 0, center: [x, z], major: r, minor: r };
  if (height < -.03 || !fade) return result;
  // 光向偏移（只随离地高度，站在地上不偏）
  let cx = x, cz = z;
  if (light) { const l = Math.hypot(light[0], light[1]); if (!(l > 0)) throw new RangeError('Invalid light'); const off = lightOffset * Math.max(0, height); cx += light[0] / l * off; cz += light[1] / l * off; }
  // 坡向椭圆：u = 坡向（拉长），v = 横向（压短）
  let ux = 1, uz = 0, major = r, minor = r;
  if (slope) {
    const l = Math.hypot(slope.x, slope.z), c = Math.cos((slope.deg ?? 0) * Math.PI / 180);
    if (!(l > 0) || !(c > 0) || !Number.isFinite(c)) throw new RangeError('Invalid slope');
    ux = slope.x / l; uz = slope.z / l; major = r / c; minor = r * c;
  }
  result.center = [cx, cz]; result.major = major; result.minor = minor;
  const ring = Array.from({ length: segments }, (_, i) => { const a = -i * 2 * Math.PI / segments, p = Math.cos(a) * major, q = Math.sin(a) * minor; return [cx + ux * p - uz * q, cz + uz * p + ux * q]; });
  const toLocal = (px, pz) => { const dx = px - cx, dz = pz - cz, p = dx * ux + dz * uz, q = -dx * uz + dz * ux; return [p / major, q / minor]; };
  for (let k = 0; k < pieces.length; k++) {
    const poly = clipConvex(ring, pieces[k], signs[k]); if (poly.length < 3) continue; result.pieces++;
    for (let i = 1; i + 1 < poly.length; i++) for (const p of [poly[0], poly[i], poly[i + 1]]) {
      result.position.push(p[0], (groundAt ? groundAt(p[0], p[1]) : groundY) + .008, p[1]); result.local.push(...toLocal(p[0], p[1]));
    }
  }
  result.triangles = result.position.length / 9; return result;
}
/** 三角形面积（XZ）之和——跨格连续性/面积守恒的量尺。 */
export function shadowArea(result) {
  let s = 0; const P = result.position;
  for (let i = 0; i < P.length; i += 9) s += Math.abs((P[i + 3] - P[i]) * (P[i + 8] - P[i + 2]) - (P[i + 6] - P[i]) * (P[i + 5] - P[i + 2])) / 2;
  return s;
}
/** REACode blobshadow.measure() 的同口径表：高度 → 半径/浓度/偏移；坡 → 拉长/压短/面积比。 */
export function measure({ radius = .12, maxHeight = .8 } = {}) {
  const box = [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }];
  const rows = [0, .2, .5].map((h) => { const s = unitShadow({ x: 0, z: 0, footY: h, groundY: 0, footprint: box, radius, maxHeight, light: LIGHT_DIR }); return { h, r: s.radius, alpha: s.alpha, off: Math.hypot(...s.center) }; });
  const flat = unitShadow({ x: 0, z: 0, footY: 0, groundY: 0, footprint: box, radius, segments: 64 }), tilted = unitShadow({ x: 0, z: 0, footY: 0, groundY: 0, footprint: box, radius, slope: { x: 1, z: 0, deg: 26 }, segments: 64 });
  return { rows, stretch: tilted.major / tilted.radius, squash: tilted.minor / tilted.radius, areaRatio: shadowArea(tilted) / shadowArea(flat) };
}
