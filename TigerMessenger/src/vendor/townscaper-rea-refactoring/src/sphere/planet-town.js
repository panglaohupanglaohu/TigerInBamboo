/**
 * planet-town.js — the planet as a shared World: spherical Delaunay repair, rivers, and houses
 * deformed into relaxed cell prisms (REACode engine/sphere.js, src/spheretown.js,
 * src/spherehouse.js, src/spherefusion.js).
 *
 *   1338829205157646336 "Delaunay Triangulation on a sphere ... on a Stereographic Projection"
 *   1338825080844021760 "1. Random points 2. Space out the points 3. Triangulate 4. Relax using the triangles"
 *   1768627849529893109 "I've gone and put this on a sphere"
 *   1769641473895432220 "all module-containing cells try to achieve their desired shape and size"
 *   1769691526924292506 rivers "collapse them depth-first to lowest point"
 *   1584623053061099520 houses spliced into the terrain
 *
 * Spherical Delaunay predicate: on the unit sphere a triangle's circumcircle is the
 * intersection with the plane through its corners, so "empty circumcircle" ⇔ every other
 * point lies on the origin side of that plane (the triangulation is the convex hull).
 * Relaxation moves points after triangulation; edge flips repair the property.
 *
 * Houses: a canonical module in a regular n-gon frame (unit circumradius, height 0..1)
 * is mapped per fan triangle with barycentric weights onto the cell's ACTUAL corner
 * positions at the floor and ceiling levels returned by cornerPositions(at). The same
 * relaxed corners shape terrain and buildings, so walls lean with the radial direction
 * and stay inside the cell prism (the "mushrooming" relax applies to both).
 * The house module itself is a local stand-in; the original module set is unknown. r55: the
 * stand-in is now stacked per storey (storeyHouseModule), each storey on its own level's corners.
 */
import { World, MAX_LEVEL } from '../core/world.js';
import { cornerPositions } from './planet.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* ---------------- stereographic projection (pole = +Y, matching buildSphere) -------------- */
export function stereoProject(p) {
  if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || Math.abs(len(p) - 1) > 1e-6 || 1 - p[1] < 1e-12) throw new RangeError('stereoProject needs a unit point away from the pole');
  const s = 1 / (1 - p[1]); return [p[0] * s, p[2] * s];
}
export function stereoUnproject([u, v]) {
  if (![u, v].every(Number.isFinite)) throw new RangeError('stereoUnproject needs finite plane coordinates');
  const r2 = u * u + v * v; return [2 * u / (r2 + 1), (r2 - 1) / (r2 + 1), 2 * v / (r2 + 1)];
}

/* ---------------- spherical Delaunay check and Lawson flips ------------------------------- */
function triPlane(P, [a, b, c]) { let n = cross(sub(P[b], P[a]), sub(P[c], P[a])); if (dot(n, P[a]) < 0) n = n.map((x) => -x); return n; }
export function sphericalDelaunayViolations(P, tris, { eps = 1e-9 } = {}) {
  const bad = [];
  tris.forEach((t, ti) => {
    const n = triPlane(P, t), a = P[t[0]], nl = len(n) || 1;
    for (let i = 0; i < P.length; i++) if (i !== t[0] && i !== t[1] && i !== t[2] && dot(n, sub(P[i], a)) / nl > eps) { bad.push({ tri: ti, point: i }); break; }
  });
  return bad;
}
/** Flip shared edges whose opposite vertex lies outside the neighbour's circumcircle plane. */
export function flipToDelaunay(P, tris, { maxPasses = 64, eps = 1e-12 } = {}) {
  const T = tris.map((t) => t.slice());
  let flips = 0, pass = 0;
  for (; pass < maxPasses; pass++) {
    const edge = new Map();
    T.forEach((t, ti) => { for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; edge.set(a + ',' + b, [ti, t[(k + 2) % 3]]); } });
    let changed = 0;
    const touched = new Set();
    for (const [key, [ti, c]] of edge) {
      const [a, b] = key.split(',').map(Number);
      const other = edge.get(b + ',' + a); if (!other) continue;
      const [tj, d] = other;
      if (touched.has(ti) || touched.has(tj) || c === d) continue;
      const n = triPlane(P, [a, b, c]);
      if (dot(n, sub(P[d], P[a])) / (len(n) || 1) <= eps) continue;
      // new edge c-d must not already exist (would create a duplicate face)
      if (edge.has(c + ',' + d) || edge.has(d + ',' + c)) continue;
      const t1 = [c, a, d], t2 = [d, b, c];
      for (const t of [t1, t2]) if (dot(cross(sub(P[t[1]], P[t[0]]), sub(P[t[2]], P[t[0]])), P[t[0]]) < 0) { const x = t[1]; t[1] = t[2]; t[2] = x; }
      T[ti] = t1; T[tj] = t2; touched.add(ti); touched.add(tj); changed++; flips++;
    }
    if (!changed) break;
  }
  return { tris: T, flips, passes: pass };
}
/** Mesh quality: minimum angle (deg), edge-length coefficient of variation, valence histogram. */
export function sphereQuality(P, tris) {
  let minAngle = 180; const L = [], val = new Map(), seen = new Set();
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const a = P[t[k]], b = P[t[(k + 1) % 3]], c = P[t[(k + 2) % 3]];
    const u = norm(sub(b, a)), v = norm(sub(c, a)); minAngle = Math.min(minAngle, Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180 / Math.PI);
    const i = Math.min(t[k], t[(k + 1) % 3]), j = Math.max(t[k], t[(k + 1) % 3]), key = i + ',' + j;
    if (!seen.has(key)) { seen.add(key); L.push(len(sub(a, b))); val.set(i, (val.get(i) || 0) + 1); val.set(j, (val.get(j) || 0) + 1); }
  }
  const mean = L.reduce((s, x) => s + x, 0) / L.length, sd = Math.sqrt(L.reduce((s, x) => s + (x - mean) ** 2, 0) / L.length);
  const valence = {}; for (const v of val.values()) valence[v] = (valence[v] || 0) + 1;
  return { minAngle, edgeCV: sd / mean, valence, edges: L.length };
}

/* ---------------- planet as a shared World ------------------------------------------------- */
/** Grid adapter: planet cells (pentagons/hexagons) become World cells with edgeNeighbors. */
export function planetWorld(planet, { heights = planet.H } = {}) {
  if (!planet?.cells || heights.length !== planet.cells.length) throw new RangeError('Invalid planet');
  const cells = planet.cells.map((c) => ({ id: c.id, n: c.ring.length, edgeNeighbors: c.nb.slice(), ring: c.ring, dir: c.c, cx: c.c[0], cz: c.c[2] }));
  const world = new World({ cells });
  for (const c of cells) if (heights[c.id] > 0) world.fill(c, Math.min(MAX_LEVEL, heights[c.id]), { rock: true });
  return world;
}

/** Rivers on the planet World (spheretown carveRivers, 1769691526924292506 "collapse them
 * depth-first to lowest point"). A priority flood from the sea gives every land cell a drain
 * parent; pits are filled (lake cells) instead of ending rivers one cell long. Accumulated area
 * above `threshold` marks world.river. Every channel provably reaches the sea. */
export function planetRivers(world, { threshold = 10, gravity = 3.2 } = {}) {
  const cells = world.cells, n = cells.length, level = new Float64Array(n).fill(Infinity), down = new Int32Array(n).fill(-1), order = [];
  const raw = (id) => world.ground(cells[id]) * gravity;
  // tiny binary heap on [level, seq, id]
  const heap = []; let seq = 0;
  const push = (e) => { heap.push(e); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] < e[0] || (heap[p][0] === e[0] && heap[p][1] < e[1])) break; heap[i] = heap[p]; i = p; } heap[i] = e; };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && (heap[c + 1][0] < heap[c][0] || (heap[c + 1][0] === heap[c][0] && heap[c + 1][1] < heap[c][1]))) c++; if (last[0] < heap[c][0] || (last[0] === heap[c][0] && last[1] < heap[c][1])) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
  for (const c of cells) if (world.ground(c) === 0) { level[c.id] = 0; push([0, seq++, c.id]); }
  const done = new Uint8Array(n);
  while (heap.length) {
    const [lv, , id] = pop(); if (done[id]) continue; done[id] = 1; order.push(id);
    for (const nb of cells[id].edgeNeighbors) {
      if (nb < 0 || done[nb] || world.ground(cells[nb]) === 0) continue;
      const l = Math.max(raw(nb), lv) + 1e-6;   // filled pits rise just above their spill point
      if (l < level[nb]) { level[nb] = l; down[nb] = id; push([l, seq++, nb]); }
    }
  }
  const area = new Float32Array(n).fill(1);
  for (let k = order.length - 1; k >= 0; k--) { const id = order[k]; if (down[id] >= 0) area[down[id]] += area[id]; }
  const lake = new Uint8Array(n);
  for (const c of cells) if (world.ground(c) > 0 && level[c.id] > raw(c.id) + 1e-3) lake[c.id] = 1;
  world.river.fill(0);
  let channels = 0;
  for (const c of cells) if (world.ground(c) > 0 && (area[c.id] >= threshold || lake[c.id])) { world.river[c.id] = 1; channels++; }
  world.touch();
  return { down, area, level, lake, order, channels };
}

/** Map a canonical module point (u, v in a unit-circumradius regular n-gon, h in [0,1]) onto
 * the cell's relaxed corner positions between levels l0 and l1. */
export function deformIntoCell(at, cell, l0, l1, [u, v, h]) {
  const n = cell.ring.length, ang = Math.atan2(v, u), r = Math.hypot(u, v);
  if (![u, v, h].every(Number.isFinite) || r > 1 + 1e-9) throw new RangeError('Module point outside unit footprint');
  const step = Math.PI * 2 / n, k = ((Math.floor(ang / step) % n) + n) % n, a0 = k * step, a1 = (k + 1) * step;
  // barycentric of (u,v) in triangle (centre, corner k, corner k+1) of the regular polygon
  const A = [Math.cos(a0), Math.sin(a0)], B = [Math.cos(a1), Math.sin(a1)], det = A[0] * B[1] - A[1] * B[0];
  const wa = (u * B[1] - v * B[0]) / det, wb = (A[0] * v - A[1] * u) / det, wc = 1 - wa - wb;
  const level = (l) => { const ring = cell.ring.map((q) => at(q, l)), ctr = ring.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]); return ctr.map((x, i) => wc * x + wa * ring[k][i] + wb * ring[(k + 1) % n][i]); };
  const p0 = level(l0), p1 = level(l1);
  return p0.map((x, i) => x + (p1[i] - x) * h);
}

/** A small hip-roof house module in the canonical frame: footprint inset, walls 0..1, roof apex 1.45. */
export function houseModule(n, { inset = .76 } = {}) {
  const ring = Array.from({ length: n }, (_, k) => [Math.cos(k * Math.PI * 2 / n) * inset, Math.sin(k * Math.PI * 2 / n) * inset]);
  const tris = [];
  for (let k = 0; k < n; k++) {
    const a = ring[k], b = ring[(k + 1) % n];
    tris.push({ part: 'wall', v: [[...a, 0], [...b, 0], [...b, 1]] }, { part: 'wall', v: [[...a, 0], [...b, 1], [...a, 1]] });
    tris.push({ part: 'roof', v: [[...a, 1], [...b, 1], [0, 0, 1.45]] });
  }
  return tris;
}

/** r55 (spherehouse "single-storey stand-in"): a stacked multi-storey module. Coordinates are
 * (u, v, h) with h in [0, floors] for the body — h = f + t lies in storey f — and h > floors only
 * for the hip roof. Parts follow REACode spherehouse.js HOUSE roles: plinth (dark stone band on
 * the ground storey), wall, trim (string course between storeys), window, door, roof. Windows and
 * the door sit a hair outside the wall plane so they never z-fight; everything stays inside the
 * unit footprint. Each storey is deformed into ITS OWN level's relaxed corners by planetHouses, so
 * a tall house tapers with the anti-mushroom relax exactly like the terrain beside it. */
export function storeyHouseModule(n, floors, { inset = .76, roof = .45, seed = 0 } = {}) {
  if (!Number.isInteger(n) || n < 3 || !Number.isInteger(floors) || floors < 1) throw new RangeError('Invalid storey module');
  const P = (k, s2 = 1) => [Math.cos(k * Math.PI * 2 / n) * inset * s2, Math.sin(k * Math.PI * 2 / n) * inset * s2];
  const tris = [], quad = (part, a, b, c, d) => tris.push({ part, v: [a, b, c] }, { part, v: [a, c, d] });
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
    const a = P(k), b = P(k + 1), h0 = f, h1 = f + 1;
    if (f === 0) { quad('plinth', [...a, 0], [...b, 0], [...b, .14], [...a, .14]); quad('wall', [...a, .14], [...b, .14], [...b, h1], [...a, h1]); }
    else { quad('trim', [...a, h0], [...b, h0], [...b, h0 + .07], [...a, h0 + .07]); quad('wall', [...a, h0 + .07], [...b, h0 + .07], [...b, h1], [...a, h1]); }
    // openings on a slightly outset copy of the wall plane
    const A = P(k, 1.012), B = P(k + 1, 1.012);
    const door = f === 0 && k === (seed % n);
    if (door) quad('door', [...lerp2(A, B, .38), .14], [...lerp2(A, B, .62), .14], [...lerp2(A, B, .62), .72], [...lerp2(A, B, .38), .72]);
    else quad('window', [...lerp2(A, B, .34), h0 + .38], [...lerp2(A, B, .66), h0 + .38], [...lerp2(A, B, .66), h0 + .78], [...lerp2(A, B, .34), h0 + .78]);
  }
  for (let k = 0; k < n; k++) { const a = P(k), b = P(k + 1); tris.push({ part: 'roof', v: [[...a, floors], [...b, floors], [0, 0, floors + roof]] }); }
  return tris;
}

/** Place houses on flat dry land: write BUILT bits into the shared World (fusion), relax the
 * corners with the houses as module-containing cells, then deform the module into each prism.
 * floors: integer (all houses that tall) or 'mixed' (1..maxFloors per house, hashed).
 * Returns the corner sampler used, so terrain and houses are meshed from the same corners. */
export function planetHouses(world, planet, { seed = 3, density = .5, floors = 1, maxFloors = 3, minGround = 2, relax = true, iters = 40, solver = 'spring', maxLean = 30 } = {}) {
  const mixed = floors === 'mixed';
  if ((!mixed && (!Number.isInteger(floors) || floors < 1)) || !Number.isInteger(maxFloors) || maxFloors < 1 || !(density >= 0 && density <= 1)) throw new RangeError('Invalid planet house options');
  const hash = (i) => { let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const placed = [];
  for (const c of world.cells) {
    const g = world.ground(c), nf = mixed ? 1 + Math.floor(hash(c.id * 131 + seed * 7) * maxFloors) : floors;
    if (g < minGround || world.river[c.id] || world.topIsBuilt(c) || g + nf > MAX_LEVEL) continue;
    if (c.edgeNeighbors.some((nb) => nb < 0 || world.ground(world.cells[nb]) !== g)) continue;   // flat only
    if (hash(c.id * 977 + seed) > density) continue;
    for (let f = 1; f <= nf; f++) world.setSolid(c, g + f, true);
    placed.push({ cell: c.id, ground: g, top: g + nf, floors: nf });
  }
  world.touch();
  const at = cornerPositions({ ...planet, H: world.cells.map((c) => world.top(c)) }, { relax, iters, solver, maxLean });
  const position = [], part = [], house = [];
  placed.forEach(({ cell, ground, floors: nf }, hi) => {
    const c = world.cells[cell];
    for (const t of storeyHouseModule(c.n, nf, { seed: cell })) {
      for (const [u, v, h] of t.v) {
        let p;
        if (h <= nf) { const f = Math.min(nf - 1, Math.floor(h)); p = deformIntoCell(at, c, ground + f, ground + f + 1, [u, v, h - f]); }
        else { const q = deformIntoCell(at, c, ground + nf - 1, ground + nf, [u, v, 1]), d = norm(q); p = q.map((x, i) => x + d[i] * (h - nf) * planet.L); }
        position.push(...p);
      }
      part.push(t.part); house.push(hi);
    }
  });
  return { placed, position, part, house, at };
}

/** spherefusion: one mesh from the World — terrain prisms to ground() and houses above.
 * Built levels are meshed by planetHouses; this returns terrain using the SAME corner sampler. */
export function planetFusion(world, planet, opts = {}) {
  const houses = planetHouses(world, planet, opts);
  const terrain = { position: [], color: [] };
  const ground = world.cells.map((c) => world.ground(c));
  for (const c of world.cells) {
    const h = ground[c.id]; if (!h) continue;
    const ring = c.ring.map((k) => houses.at(k, h)), ctr = ring.reduce((s, p) => s.map((x, i) => x + p[i] / ring.length), [0, 0, 0]);
    const col = world.river[c.id] ? [.35, .55, .75] : h === 1 ? [.93, .84, .62] : [.55, .74, .4];
    for (let k = 0; k < ring.length; k++) { terrain.position.push(...ctr, ...ring[k], ...ring[(k + 1) % ring.length]); for (let r = 0; r < 3; r++) terrain.color.push(...col); }
    c.edgeNeighbors.forEach((o, k) => {
      const oh = o >= 0 ? ground[o] : 0; if (oh >= h) return;
      const a = c.ring[k], b = c.ring[(k + 1) % c.ring.length];
      for (let l = oh + 1; l <= h; l++) { const a0 = houses.at(a, l - 1), b0 = houses.at(b, l - 1), a1 = houses.at(a, l), b1 = houses.at(b, l); terrain.position.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1); for (let r = 0; r < 6; r++) terrain.color.push(.7, .68, .64); }
    });
  }
  return { terrain, houses };
}
