/**
 * okhsl.js — OkHsl / OkHsv ↔ sRGB（Björn Ottosson「Okhsv and Okhsl」参考实现的 JS 移植，2021, MIT）。
 * 第 56 批 C11：1712088611934371876 调色工具底部色带菜单 OkHsl / OkLab / Srgb 的 OkHsl 一项。
 * 含 compute_max_saturation（每色相最大饱和度多项式 + 一步 Halley）、find_cusp、find_gamut_intersection、get_ST_mid、get_Cs。
 * sRGB 输入输出都是 0..1 gamma 编码；与 src/core/oklab.js 同一组矩阵。h∈[0,1)，s,l∈[0,1]。
 */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);

export function linearSrgbToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklabToLinearSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}

const K1 = 0.206, K2 = 0.03, K3 = (1 + K1) / (1 + K2);
export const toe = (x) => 0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) * (K3 * x - K1) + 4 * K2 * K3 * x));
export const toeInv = (x) => (x * x + K1 * x) / (K3 * (x + K2));

/** a,b 归一化色相方向上 sRGB 内最大饱和度 S=C/L。 */
export function computeMaxSaturation(a, b) {
  let k0, k1, k2, k3, k4, wl, wm, ws;
  if (-1.88170328 * a - 0.80936493 * b > 1) { k0 = 1.19086277; k1 = 1.76576728; k2 = 0.59662641; k3 = 0.75515197; k4 = 0.56771245; wl = 4.0767416621; wm = -3.3077115913; ws = 0.2309699292; }
  else if (1.81444104 * a - 1.19445276 * b > 1) { k0 = 0.73956515; k1 = -0.45954404; k2 = 0.08285427; k3 = 0.12541070; k4 = 0.14503204; wl = -1.2684380046; wm = 2.6097574011; ws = -0.3413193965; }
  else { k0 = 1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = 0.00692167; wl = -0.0041960863; wm = -0.7034186147; ws = 1.7076147010; }
  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
  const kl = 0.3963377774 * a + 0.2158037573 * b, km = -0.1055613458 * a - 0.0638541728 * b, ks = -0.0894841775 * a - 1.2914855480 * b;
  const l_ = 1 + S * kl, m_ = 1 + S * km, s_ = 1 + S * ks;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const ldS = 3 * kl * l_ * l_, mdS = 3 * km * m_ * m_, sdS = 3 * ks * s_ * s_;
  const ldS2 = 6 * kl * kl * l_, mdS2 = 6 * km * km * m_, sdS2 = 6 * ks * ks * s_;
  const f = wl * l + wm * m + ws * s, f1 = wl * ldS + wm * mdS + ws * sdS, f2 = wl * ldS2 + wm * mdS2 + ws * sdS2;
  S = S - f * f1 / (f1 * f1 - 0.5 * f * f2);
  return S;
}
/** 该色相在 sRGB 色域边界上的尖点 (L, C)。 */
export function findCusp(a, b) {
  const S = computeMaxSaturation(a, b), rgb = oklabToLinearSrgb(1, S * a, S * b), L = Math.cbrt(1 / Math.max(rgb[0], rgb[1], rgb[2]));
  return { L, C: L * S };
}
/** 从 (L0,0) 指向 (L1,C1) 的射线与色域边界交点参数 t。 */
export function findGamutIntersection(a, b, L1, C1, L0, cusp = findCusp(a, b)) {
  let t;
  if ((L1 - L0) * cusp.C - (cusp.L - L0) * C1 <= 0) t = cusp.C * L0 / (C1 * cusp.L + cusp.C * (L0 - L1));
  else {
    t = cusp.C * (L0 - 1) / (C1 * (cusp.L - 1) + cusp.C * (L0 - L1));
    const dL = L1 - L0, dC = C1;
    const kl = 0.3963377774 * a + 0.2158037573 * b, km = -0.1055613458 * a - 0.0638541728 * b, ks = -0.0894841775 * a - 1.2914855480 * b;
    const ldt = dL + dC * kl, mdt = dL + dC * km, sdt = dL + dC * ks;
    const L = L0 * (1 - t) + t * L1, C = t * C1;
    const l_ = L + C * kl, m_ = L + C * km, s_ = L + C * ks;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    const l1 = 3 * ldt * l_ * l_, m1 = 3 * mdt * m_ * m_, s1 = 3 * sdt * s_ * s_;
    const l2 = 6 * ldt * ldt * l_, m2 = 6 * mdt * mdt * m_, s2 = 6 * sdt * sdt * s_;
    const step = (wl, wm, ws) => { const f = wl * l + wm * m + ws * s - 1, f1 = wl * l1 + wm * m1 + ws * s1, f2 = wl * l2 + wm * m2 + ws * s2, u = f1 / (f1 * f1 - 0.5 * f * f2); return u >= 0 ? -f * u : Number.MAX_VALUE; };
    t += Math.min(step(4.0767416621, -3.3077115913, 0.2309699292), step(-1.2684380046, 2.6097574011, -0.3413193965), step(-0.0041960863, -0.7034186147, 1.7076147010));
  }
  return t;
}
const stMax = (cusp) => ({ S: cusp.C / cusp.L, T: cusp.C / (1 - cusp.L) });
function stMid(a, b) {
  const S = 0.11516993 + 1 / (7.44778970 + 4.15901240 * b + a * (-2.19557347 + 1.75198401 * b + a * (-2.13704948 - 10.02301043 * b + a * (-4.24894561 + 5.38770819 * b + 4.69891013 * a))));
  const T = 0.11239642 + 1 / (1.61320320 - 0.68124379 * b + a * (0.40370612 + 0.90148123 * b + a * (-0.27087943 + 0.61223990 * b + a * (0.00299215 - 0.45399568 * b - 0.14661872 * a))));
  return { S, T };
}
export function getCs(L, a, b) {
  const cusp = findCusp(a, b), Cmax = findGamutIntersection(a, b, L, 1, L, cusp), st = stMax(cusp), mid = stMid(a, b);
  const k = Cmax / Math.min(L * st.S, (1 - L) * st.T);
  const Ca = L * mid.S, Cb = (1 - L) * mid.T, Cmid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / Ca ** 4 + 1 / Cb ** 4)));
  const Ca0 = L * 0.4, Cb0 = (1 - L) * 0.8, C0 = Math.sqrt(1 / (1 / (Ca0 * Ca0) + 1 / (Cb0 * Cb0)));
  return { C0, Cmid, Cmax };
}

const chk = (...v) => { if (!v.every(Number.isFinite)) throw new RangeError('okhsl: finite numbers'); };
/** OkHsl → sRGB（gamma，0..1，色域内）。 */
export function okhslToSrgb(h, s, l) {
  chk(h, s, l); s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l)); h = ((h % 1) + 1) % 1;
  if (l >= 1) return [1, 1, 1]; if (l <= 0) return [0, 0, 0];
  const a = Math.cos(2 * Math.PI * h), b = Math.sin(2 * Math.PI * h), L = toeInv(l), { C0, Cmid, Cmax } = getCs(L, a, b), mid = 0.8, midInv = 1.25;
  let C;
  if (s < mid) { const t = midInv * s, k1 = mid * C0, k2 = 1 - k1 / Cmid; C = t * k1 / (1 - k2 * t); }
  else { const t = (s - mid) / (1 - mid), k0 = Cmid, k1 = (1 - mid) * Cmid * Cmid * midInv * midInv / C0, k2 = 1 - k1 / (Cmax - Cmid); C = k0 + t * k1 / (1 - k2 * t); }
  return oklabToLinearSrgb(L, C * a, C * b).map((v) => Math.max(0, Math.min(1, toSrgb(v))));
}
/** sRGB（gamma）→ OkHsl [h,s,l]。灰色 h=0,s=0。 */
export function srgbToOkhsl(r, g, b) {
  chk(r, g, b);
  const [L, A, B] = linearSrgbToOklab(toLinear(r), toLinear(g), toLinear(b)), C = Math.hypot(A, B);
  if (C < 1e-7 || L <= 1e-7 || L >= 1 - 1e-7) return [0, 0, Math.max(0, Math.min(1, toe(L)))];
  const a = A / C, bb = B / C, h = 0.5 + 0.5 * Math.atan2(-B, -A) / Math.PI, { C0, Cmid, Cmax } = getCs(L, a, bb), mid = 0.8, midInv = 1.25;
  let s;
  if (C < Cmid) { const k1 = mid * C0, k2 = 1 - k1 / Cmid, t = C / (k1 + k2 * C); s = t * mid; }
  else { const k0 = Cmid, k1 = (1 - mid) * Cmid * Cmid * midInv * midInv / C0, k2 = 1 - k1 / (Cmax - Cmid), t = (C - k0) / (k1 + k2 * (C - k0)); s = mid + (1 - mid) * t; }
  return [h % 1, Math.max(0, Math.min(1, s)), toe(L)];
}
/** 两个 OkHsl 之间沿最短色相弧插值。 */
export function mixOkhsl(p, q, t) {
  let dh = q[0] - p[0]; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
  // 一端是灰色（s≈0）时色相无意义：沿用另一端色相，避免灰→彩中途扫过整圈
  let h0 = p[0], h1 = p[0] + dh; if (p[1] < 1e-4) h0 = h1 = q[0]; else if (q[1] < 1e-4) h1 = h0;
  return [(((h0 + (h1 - h0) * t) % 1) + 1) % 1, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
}
