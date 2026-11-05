/** 1714613599035863191: local cell-oriented field strokes.
 * Source shows curved stripes/patches and readable tiles, not the exact algorithm.
 * These analytic stripes are an approximation, not projected atlas/UV patches.
 */
export const FIELD_GLSL = `
float fieldTone(vec3 p) {
  float phase = p.x * 5.0 + .22 * sin(p.y * 3.0);
  float fw = max(fwidth(phase), .0001);
  float d = abs(fract(phase) - .5);
  float stripe = 1.0 - smoothstep(.22 - fw, .22 + fw, d);
  // Fade unresolved stripes toward their mean instead of high-frequency flicker.
  stripe = mix(stripe, .44, smoothstep(.35, .9, fw));
  return mix(1.0, .90 + .18 * stripe, clamp(p.z, 0.0, 1.0));
}`;
