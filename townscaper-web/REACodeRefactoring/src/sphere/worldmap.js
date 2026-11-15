/**
 * worldmap.js — sea/land from TRUE 3D noise on the sphere (REACode engine/worldmap.js).
 *
 *   1783792917183606829 "Texture test!"  — a spinning sphere, land/sea with a thin coastline.
 *
 * Two consequences the lab measured: sampling noise in (lon, lat) streaks the poles, so noise is
 * sampled at the 3D unit direction; the coastline is a threshold boundary (1 px, independent of
 * continent size). The planet heights reuse the same 3D field per cell direction (replacing the
 * two mixed 2D slices in planet.js buildPlanet), and colours add a sand shore and darker slopes.
 * The clip only proves "a texture test"; regeneration per frame / exact noise are not claimed.
 */
function hash3(x, y, z, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf), lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
export function fbm3(x, y, z, { octaves = 5, seed = 7, period = 2.2 } = {}) {
  if (![x, y, z, seed, period].every(Number.isFinite) || !Number.isInteger(octaves) || octaves < 1) throw new RangeError('Invalid fbm3 sample');
  let sum = 0, amp = 1, nrm = 0, p = period;
  for (let o = 0; o < octaves; o++) { sum += noise3(x * p, y * p, z * p, seed + o * 131) * amp; nrm += amp; amp *= .5; p *= 2.03; }
  return sum / nrm;
}
/** Domain-warped elevation at a unit direction. */
export function elevationAt([x, y, z], { seed = 7, octaves = 5, warp = .6 } = {}) {
  const wx = fbm3(x + 3.1, y - 1.7, z + 5.3, { octaves: 2, seed: seed + 977, period: 1.7 }) - .5;
  return fbm3(x + wx * warp, y + wx * warp, z + wx * warp, { octaves, seed });
}
/** Equirectangular land/sea map + 1 px coast (mode 'uv' is the lab's 2D counter-example). */
export function buildWorldMap({ w = 256, h = 128, seed = 7, seaLevel = .52, octaves = 5, warp = .6, mode = 'sphere' } = {}) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 8 || h < 4 || !['sphere', 'uv'].includes(mode)) throw new RangeError('Invalid world map');
  const land = new Uint8Array(w * h), height = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const lat = (.5 - (j + .5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i + .5) / w * Math.PI * 2;
      const p = mode === 'uv' ? [(i + .5) / w * 2, (j + .5) / h * 2, .37] : [Math.cos(lon) * cl, sl, Math.sin(lon) * cl];
      const n = elevationAt(p, { seed, octaves, warp });
      height[j * w + i] = n; land[j * w + i] = n > seaLevel ? 1 : 0;
    }
  }
  const coast = new Uint8Array(w * h); let coastPx = 0, landPx = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, v = land[k]; landPx += v;
    if (v !== land[j * w + (i + 1) % w] || (j + 1 < h && v !== land[(j + 1) * w + i])) { coast[k] = 1; coastPx++; }
  }
  return { land, coast, height, w, h, stats: { landPct: +(landPx / land.length * 100).toFixed(1), coastPx } };
}
/** Run-length aspect ratio of land/sea patches near the pole vs the equator. */
export function poleStretch({ w, h, land }, { band = .12 } = {}) {
  const ratio = (j0, j1) => {
    const hl = [], vl = [];
    for (let j = j0; j < j1; j++) { let r = 1; for (let i = 1; i < w; i++) if (land[j * w + i] === land[j * w + i - 1]) r++; else { hl.push(r); r = 1; } }
    for (let i = 0; i < w; i += 3) { let r = 1; for (let j = j0 + 1; j < j1; j++) if (land[j * w + i] === land[(j - 1) * w + i]) r++; else { vl.push(r); r = 1; } }
    const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 1;
    return avg(hl) / Math.max(1e-6, avg(vl));
  };
  const eq = ratio(Math.floor(h * .42), Math.floor(h * .58)), pole = ratio(0, Math.floor(h * band));
  return { equator: eq, pole, stretch: pole / Math.max(1e-6, eq) };
}
/** Planet cell heights from the same 3D elevation: 0 sea, 1 sand shore, then even terrace levels. */
export function planetHeights3D(planet, { seed = 7, seaLevel = .52, maxH = 6 } = {}) {
  return planet.cells.map((c) => {
    const k = (elevationAt(c.c, { seed }) - seaLevel) / (1 - seaLevel);
    if (k < 0) return 0; if (k < .06) return 1;
    return Math.min(maxH, 2 + Math.floor((k - .06) * maxH * 1.4 / 2) * 2);
  });
}
/** Per-cell surface colour on the shared World: sea, sand shore, grass, darker steep slopes. */
export function planetSurfaceColor(world, cell) {
  const g = world.ground(cell);
  if (g === 0) return { role: 'sea', rgb: [.47, .71, .77] };
  if (g === 1 || cell.edgeNeighbors.some((o) => o >= 0 && world.ground(world.cells[o]) === 0)) return { role: 'sand', rgb: [.79, .75, .62] };
  const drop = Math.max(0, ...cell.edgeNeighbors.map((o) => o >= 0 ? g - world.ground(world.cells[o]) : 0));
  return drop >= 2 ? { role: 'slope', rgb: [.45, .6, .34] } : { role: 'grass', rgb: [.56, .74, .4] };
}

/* ---------------- r55: the world map as a planet TEXTURE (1783792917183606829 "Texture test!") ----
 * Same 3D field and sea level as planetHeights3D, so the texture and the tile heights agree.
 * Four surface roles (planetSurfaceColor) blended smoothly instead of switched per cell:
 *   sea (deep → shallow toward the coast), sand shore (low land band), grass, dark slope
 *   (steep: gradient measured with the sphere metric, so poles are not over-steep); the 1 px
 *   threshold coast is drawn on top. Pixels are RGBA, row 0 = north (equirectangular). */
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const MAP_PALETTE = { deep: [.30, .53, .64], shallow: [.47, .71, .77], sand: [.79, .75, .62], grass: [.56, .74, .40], slope: [.40, .55, .31], coast: [.28, .40, .40] };
export function worldMapColors(map, { seaLevel = .52, slopePct = .8, palette = MAP_PALETTE } = {}) {
  const { w, h, height, land, coast } = map;
  if (!height || height.length !== w * h) throw new RangeError('worldMapColors needs a buildWorldMap result');
  const grad = new Float32Array(w * h), dl = Math.PI * 2 / w, dp = Math.PI / h;
  for (let j = 0; j < h; j++) {
    const cl = Math.max(.05, Math.cos((.5 - (j + .5) / h) * Math.PI));
    for (let i = 0; i < w; i++) {
      const gx = (height[j * w + (i + 1) % w] - height[j * w + (i - 1 + w) % w]) / (2 * dl * cl);
      const gy = (height[Math.min(h - 1, j + 1) * w + i] - height[Math.max(0, j - 1) * w + i]) / (2 * dp);
      grad[j * w + i] = Math.hypot(gx, gy);
    }
  }
  const lg = [...grad.filter((_, k) => land[k])].sort((a, b) => a - b), g0 = lg.length ? lg[Math.floor(lg.length * slopePct)] : Infinity, g1 = g0 * 1.5;
  const rgba = new Uint8ClampedArray(w * h * 4), roles = { sea: 0, sand: 0, grass: 0, slope: 0, coast: 0 };
  for (let k = 0; k < w * h; k++) {
    const e = (height[k] - seaLevel) / (1 - seaLevel);
    let c;
    if (!land[k]) { c = mix3(palette.deep, palette.shallow, smooth(-.3, 0, e)); roles.sea++; }
    else {
      const ws = 1 - smooth(.035, .075, e), wl = smooth(g0, g1, grad[k]);
      c = mix3(mix3(palette.grass, palette.slope, wl), palette.sand, ws);
      if (ws > .5) roles.sand++; else if (wl > .5) roles.slope++; else roles.grass++;
    }
    if (coast[k]) { c = mix3(c, palette.coast, .85); roles.coast++; }
    rgba[k * 4] = c[0] * 255; rgba[k * 4 + 1] = c[1] * 255; rgba[k * 4 + 2] = c[2] * 255; rgba[k * 4 + 3] = 255;
  }
  return { rgba, roles, slopeThreshold: g0 };
}
/** Nearest texel of a unit direction (same convention as buildWorldMap and the GLSL lookup). */
export function worldMapTexel(map, [x, y, z]) {
  const lon = ((Math.atan2(z, x) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), lat = Math.asin(Math.max(-1, Math.min(1, y)));
  const i = Math.min(map.w - 1, Math.floor(lon / (Math.PI * 2) * map.w)), j = Math.min(map.h - 1, Math.floor((.5 - lat / Math.PI) * map.h));
  return j * map.w + i;
}
/** GLSL: direction → equirect uv; texture uploaded with flipY (row 0 north at v = 1). */
export const WORLDMAP_GLSL = `vec2 worldMapUV(vec3 d){d=normalize(d);float lon=atan(d.z,d.x);if(lon<0.0)lon+=6.28318530718;return vec2(lon/6.28318530718,0.5+asin(clamp(d.y,-1.0,1.0))/3.14159265359);}`;
