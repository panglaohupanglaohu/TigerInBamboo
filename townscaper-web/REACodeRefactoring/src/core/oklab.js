/** Shared OKLab <-> sRGB helpers (Björn Ottosson matrices), used by the
 * contrast-texture solver (1482346496460828674) and corner colour volumes
 * (1710031224838771027). sRGB inputs/outputs are 0..1 gamma-encoded.
 */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);

export function srgbToOklab(r, g, b) {
  if (![r, g, b].every(Number.isFinite)) throw new RangeError('srgb');
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Unclamped (may leave the sRGB gamut). */
export function oklabToSrgb(L, A, B) {
  if (![L, A, B].every(Number.isFinite)) throw new RangeError('oklab');
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export const inGamut = (rgb, eps = 1e-6) => rgb.every((v) => v >= -eps && v <= 1 + eps);

/** Clip to sRGB gamut in RGB, write the clipped colour back into `lab`, return rgb. */
export function clampOklabToGamut(lab) {
  const rgb = oklabToSrgb(lab[0], lab[1], lab[2]).map((v) => Math.min(1, Math.max(0, v)));
  const back = srgbToOklab(...rgb);
  lab[0] = back[0]; lab[1] = back[1]; lab[2] = back[2];
  return rgb;
}

export function hexToSrgb(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) throw new RangeError('hex colour');
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}
export const hexToOklab = (hex) => srgbToOklab(...hexToSrgb(hex));
/** OKLab Euclidean ×100 (≈ perceptual ΔE). */
export const deltaE = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 100;
