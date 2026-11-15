/** 1714613599035863191: local cell-oriented field strokes.
 * Source shows curved stripes/patches and readable tiles, not the exact algorithm.
 * These analytic stripes are an approximation, not projected atlas/UV patches.
 * r56 C08: uFields == 1 keeps the original stripes bit-for-bit (fieldToneStripes); uFields >= 2
 * (view.fieldOn.value = 2, fields.html「田块拼贴」) adds the clip's patchwork look — irregular plots
 * inside each tile's own rotated frame, each plot with its own tone and its own stripe direction
 * and a dark furrow outline. Needs the host shader to declare `uniform float uFields` (view.js does).
 */
export const FIELD_GLSL = `
float fieldToneStripes(vec3 p) {
  float phase = p.x * 5.0 + .22 * sin(p.y * 3.0);
  float fw = max(fwidth(phase), .0001);
  float d = abs(fract(phase) - .5);
  float stripe = 1.0 - smoothstep(.22 - fw, .22 + fw, d);
  // Fade unresolved stripes toward their mean instead of high-frequency flicker.
  stripe = mix(stripe, .44, smoothstep(.35, .9, fw));
  return mix(1.0, .90 + .18 * stripe, clamp(p.z, 0.0, 1.0));
}
float fieldHash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float fieldTonePlots(vec3 p) {
  // plots: a warped lattice in the tile's rotated frame (so plot edges turn with the tile)
  vec2 q = p.xy * 1.35;
  q += .28 * vec2(sin(q.y * 2.1 + 1.3), sin(q.x * 1.7 + .4));
  vec2 id = floor(q), f = fract(q);
  float h = fieldHash(id), h2 = fieldHash(id + 17.0);
  // per-plot stripe direction (0/60/120 deg) with a gentle bend, AA by derivative
  float a = floor(h2 * 3.0) * 1.0472 + .35 * h;
  vec2 dir = vec2(cos(a), sin(a));
  float phase = dot(p.xy, dir) * 6.0 + .3 * sin(dot(p.xy, vec2(-dir.y, dir.x)) * 2.6);
  float fw = max(fwidth(phase), .0001);
  float d = abs(fract(phase) - .5);
  float stripe = 1.0 - smoothstep(.2 - fw, .2 + fw, d);
  stripe = mix(stripe, .4, smoothstep(.35, .9, fw));
  // furrow outline at plot borders
  vec2 e = min(f, 1.0 - f); float ed = min(e.x, e.y);
  float ew = max(fwidth(ed), .0001);
  float border = 1.0 - smoothstep(.035 - ew, .035 + ew, ed);
  float tone = (.86 + .2 * h) * (.9 + .16 * stripe) * (1.0 - .22 * border);
  return mix(1.0, tone, clamp(p.z, 0.0, 1.0));
}
float fieldTone(vec3 p) { return uFields > 1.5 ? fieldTonePlots(p) : fieldToneStripes(p); }`;

/** JS mirror of the plot partition used by fieldTonePlots (for node tests / diagnostics). */
export function fieldPlotId(u, v) {
  let qx = u * 1.35, qy = v * 1.35;
  const wx = .28 * Math.sin(qy * 2.1 + 1.3), wy = .28 * Math.sin(qx * 1.7 + .4);
  return [Math.floor(qx + wx), Math.floor(qy + wy)];
}
