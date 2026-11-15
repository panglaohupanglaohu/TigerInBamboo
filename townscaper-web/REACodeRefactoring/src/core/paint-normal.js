/** 1481661852887265288: "Normals (procedurally painted in big chunky strokes)".
 * Port of the original paintnormal.js (periodic jittered-Voronoi chunks, one random tilt
 * per chunk, 1–2px softened borders, tangent-space RGB) plus application to SHARED data:
 *   - world-planar lookup of the painted map at any XZ (tiles, so World edits never re-paint),
 *   - perturbation of real mesh normals (positions/normals arrays) without moving vertices,
 *   - per-cell top-face shading over the shared World.
 * Not wired into View's shader; silhouettes are unchanged by construction.
 */
import { makeRng } from './noise.js';

export function paintNormal({ size = 128, chunks = 24, maxTiltDeg = 26, softness = 0.03, seed = 7, flat = 0 } = {}) {
  if (!Number.isInteger(size) || size < 4 || size > 1024 || !Number.isInteger(chunks) || chunks < 1 || chunks > 4096 || !Number.isFinite(maxTiltDeg) || maxTiltDeg < 0 || maxTiltDeg >= 89 || !Number.isFinite(softness) || softness <= 0 || !Number.isFinite(flat) || flat < 0 || flat > 1) throw new RangeError('paint normal options');
  const rnd = makeRng(seed), g = Math.max(2, Math.round(Math.sqrt(chunks))), seeds = [];
  for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    const jx = (rnd() - 0.5) * 0.7, jy = (rnd() - 0.5) * 0.7;
    seeds.push({ x: ((i + 0.5 + jx) / g) * size, y: ((j + 0.5 + jy) / g) * size, a: rnd() * Math.PI * 2, m: (0.35 + 0.65 * rnd()) * Math.tan((maxTiltDeg * Math.PI) / 180), id: i + j * g });
  }
  const rgb = new Uint8Array(size * size * 3), chunkId = new Uint16Array(size * size), chunkPx = size / g;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let d1 = Infinity, d2 = Infinity, best = null;
    for (const s of seeds) {
      let dx = Math.abs(x - s.x), dy = Math.abs(y - s.y); dx = Math.min(dx, size - dx); dy = Math.min(dy, size - dy);
      const d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; best = s; } else if (d < d2) d2 = d;
    }
    const edge = Math.max(0, 1 - (d2 - d1) / (chunkPx * softness)), m = best.m * (1 - edge * 0.85);
    let nx = Math.cos(best.a) * m, ny = Math.sin(best.a) * m; const len = Math.hypot(nx, ny, 1);
    nx = (nx / len) * (1 - flat); ny = (ny / len) * (1 - flat); const nz = 1 / len + flat * 0.999, i = y * size + x;
    rgb[i * 3] = Math.round((nx * 0.5 + 0.5) * 255); rgb[i * 3 + 1] = Math.round((ny * 0.5 + 0.5) * 255); rgb[i * 3 + 2] = Math.round((nz * 0.5 + 0.5) * 255); chunkId[i] = best.id;
  }
  return { size, rgb, chunkId, chunks: seeds.length, chunkPx, maxTiltDeg };
}

/** Decode tangent-space normal at texel i → unit [x,y,z] (z out of surface). */
export function decodeTexel(map, i) { const n = [0, 1, 2].map((k) => (map.rgb[i * 3 + k] / 255) * 2 - 1), l = Math.hypot(...n) || 1; return n.map((v) => v / l); }
/** Nearest-texel world-planar lookup; `scale` world units per map tile. Periodic, so it tiles. */
export function sampleWorldPlanar(map, x, z, scale = 4) {
  if (![x, z, scale].every(Number.isFinite) || scale <= 0) throw new RangeError('planar sample');
  const s = map.size, px = ((Math.floor((x / scale) * s) % s) + s) % s, pz = ((Math.floor((z / scale) * s) % s) + s) % s;
  return decodeTexel(map, pz * s + px);
}
/** Perturb a geometric normal by a tangent-space sample. Basis: any tangent ⟂ n (Y-up surfaces → X/Z). */
export function perturbNormal(n, t) {
  const l = Math.hypot(...n); if (!l) throw new RangeError('zero normal');
  const N = n.map((v) => v / l), ref = Math.abs(N[0]) < 0.99 ? [1, 0, 0] : [0, 0, 1], d = ref[0] * N[0] + ref[1] * N[1] + ref[2] * N[2];
  let T = ref.map((v, k) => v - N[k] * d); const tl = Math.hypot(...T); T = T.map((v) => v / tl);
  const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
  // Y-up face: T=X-ish, B=Z-ish → matches original (x, z, y) mapping of shadeWithNormals.
  const o = [0, 1, 2].map((k) => T[k] * t[0] + B[k] * t[1] + N[k] * t[2]), ol = Math.hypot(...o);
  return o.map((v) => v / ol);
}
/** Perturb every normal of a mesh (positions, normals Float32Array xyz). Positions untouched. */
export function paintMeshNormals(map, positions, normals, { scale = 4 } = {}) {
  if (!positions || !normals || positions.length !== normals.length || positions.length % 3) throw new RangeError('mesh arrays');
  const out = new Float32Array(normals.length);
  for (let i = 0; i < positions.length; i += 3) {
    const n = [normals[i], normals[i + 1], normals[i + 2]];
    // Planar projection on the dominant axis plane (cheap triplanar pick).
    const ax = n.map(Math.abs), u = ax[1] >= ax[0] && ax[1] >= ax[2] ? [positions[i], positions[i + 2]] : ax[0] >= ax[2] ? [positions[i + 2], positions[i + 1]] : [positions[i], positions[i + 1]];
    out.set(perturbNormal(n, sampleWorldPlanar(map, u[0], u[1], scale)), i);
  }
  return out;
}
export function shadeWithNormals(map, { sun = [-0.55, 0.62, 0.56], albedo = 0.8 } = {}) {
  const L = Math.hypot(...sun), s = sun.map((v) => v / L), out = new Float32Array(map.size * map.size);
  for (let i = 0; i < out.length; i++) { const [x, y, z] = decodeTexel(map, i); out[i] = albedo * Math.max(0, x * s[0] + z * s[1] + y * s[2]); }
  return out;
}
const stats = (a) => { let m = 0; for (const v of a) m += v; m /= a.length; let v2 = 0; for (const v of a) v2 += (v - m) ** 2; return { mean: m, std: Math.sqrt(v2 / a.length) }; };
/** Shade every non-empty World cell's top face with geometric (+Y) vs painted normals at its centre. */
export function shadeWorldTops(world, map, { levelHeight = 0.5, scale = 4, sun = [-0.55, 0.62, 0.56], albedo = 0.8 } = {}) {
  const L = Math.hypot(...sun), s = sun.map((v) => v / L), flat = albedo * Math.max(0, s[1]), cells = [], painted = [];
  for (const c of world.cells) { const t = world.top(c); if (!t) continue; const n = perturbNormal([0, 1, 0], sampleWorldPlanar(map, c.cx, c.cz, scale)); cells.push(c.id); painted.push(albedo * Math.max(0, n[0] * s[0] + n[1] * s[1] + n[2] * s[2])); }
  return { cells, flat, painted: Float32Array.from(painted), y: cells.map((id) => world.top(world.cells[id]) * levelHeight), stats: stats(painted), version: world.version };
}
export function auditPaintNormal({ size = 128, chunksList = [9, 16, 24, 36], maxTiltDeg = 26, seed = 7 } = {}) {
  return { size, maxTiltDeg, rows: chunksList.map((chunks) => {
    const map = paintNormal({ size, chunks, maxTiltDeg, seed }), lit = shadeWithNormals(map), sun = [-0.55, 0.62, 0.56], flat = 0.8 * Math.max(0, sun[1] / Math.hypot(...sun));
    let tilt = 0, changed = 0; for (let i = 0; i < lit.length; i++) { tilt += (Math.acos(Math.min(1, Math.abs(decodeTexel(map, i)[2]))) * 180) / Math.PI; if (Math.abs(lit[i] - flat) > 0.05) changed++; }
    const st = stats(lit); return { chunks: map.chunks, chunkPx: map.chunkPx, meanTiltDeg: tilt / lit.length, litStd: st.std, litMean: st.mean, flatStd: 0, pctPixelsChanged: (changed / lit.length) * 100, silhouetteChange: 0 };
  }) };
}
