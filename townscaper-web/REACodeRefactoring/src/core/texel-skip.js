/** 1241096929490149376: derivative-sized line texels. Local reconstruction,
 * not the original shader. Linear filtering is REQUIRED; magnification only.
 * For minification use mipmaps/anisotropy; derivatives alone cannot remove aliasing.
 */
export function skipTexel(t, footprint) {
  if (!Number.isFinite(t) || !Number.isFinite(footprint) || footprint <= 0) throw new RangeError('finite positive footprint required');
  const p = Math.floor(t / 2) * 2, f = t - p, w = Math.min(1, footprint);
  return p + .5 + Math.max(0, Math.min(1, (f - (2 - w)) / w)) - (1 - Math.max(0, Math.min(1, f / w)));
}
export const TEXEL_SKIP_GLSL = `
float skipTexel(float t, float footprint) {
  float p = floor(t * .5) * 2.0, f = t - p;
  float w = clamp(footprint, 0.00001, 1.0);
  return p + .5 + clamp((f - (2.0 - w)) / w, 0.0, 1.0) - (1.0 - clamp(f / w, 0.0, 1.0));
}
`;
