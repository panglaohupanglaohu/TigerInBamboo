/**
 * spheretown.js — step 8: the same tile planet, wrapped around a sphere.
 *
 *   1768627849529893109  "For reasons I will not be explaining at this point
 *     I've gone and put this on a sphere"
 *   1338825080844021760  "generating nice triangulated spheres: 1. Random points
 *     2. Space out the points 3. Triangulate 4. Relax using the triangles"
 *   1769641473895432220  "tall mountains get weirdly wide … I mitigated this by a
 *     relax pass where all module-containing cells try to achieve their desired
 *     shape and size"
 *
 * The grid comes straight from engine/sphere.js (stereographic Delaunay + relax),
 * so the only new problem here is that **nothing has a +Y any more**: every cell
 * has its own up vector, and "one level up" means "one radius further out".
 *
 * That changes one thing and simplifies another:
 *
 *   - each cell is a prism from R to R + h*L along its own normal, so a wall is
 *     a quad between two radii on the same two directions;
 *   - the soft-slope trick from src/terrainmesh.js ports over unchanged, because
 *     it never used world-up: an edge whose neighbour is exactly one level higher
 *     lifts the *corners* of this cell to that neighbour's level, and a corner
 *     takes the max of its two edges. On a triangle mesh the corner is shared by
 *     up to six cells, so the same rule has to be evaluated per cell-edge and
 *     then maxed — the cells still agree, which is what keeps the seams shut.
 *
 * Not done (and listed as such in LEARNING.md): houses on the sphere, a real
 * shore-wave shell, and the "mushrooming" relax pass — a sphere voxel field is
 * not Cartesian, so the AO here is a neighbourhood average instead of
 * src/lighting.js.
 */

import * as THREE from 'three';
import { buildSphere } from '../engine/sphere.js';
import { fbm } from '../engine/noise.js';

export const SPHERE = {
  radius: 10,
  level: 0.30,          // world units per voxel level
  maxLevel: 4,
  grass: '#8fae5f',
  grassDark: '#7d9c52',
  grassLit: '#a3bd70',
  rock: '#9a9284',
  cliff: '#8b8377',
  cliffDark: '#736c62',
  sand: '#cabf9d',
  sandDark: '#b8ac8a',
  snow: '#eef2f1',
};

const hex = (h) => new THREE.Color(h);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/* -------------------------------------------------------------------------- */
/*  grid                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Triangulated, relaxed sphere + per-cell adjacency.
 * `engine/sphere.js` returns stages in the order it animates them; the last one
 * is the relaxed grid, which is the one worth building on.
 */
export function buildSphereGrid({ count = 1400, seed = 7, radius = SPHERE.radius } = {}) {
  const s = buildSphere({ count, spacingPasses: 4, relaxPasses: 6, seed });
  const stage = s.stages[s.stages.length - 1];
  const unit = stage.points.map((p) => {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    return new THREE.Vector3(p[0] / l, p[1] / l, p[2] / l);
  });
  const tris = stage.tris;

  // edge -> the two cells that share it
  const edgeMap = new Map();
  const key = (a, b) => (a < b ? a * 100000 + b : b * 100000 + a);
  tris.forEach((t, ci) => {
    for (let i = 0; i < 3; i++) {
      const k = key(t[i], t[(i + 1) % 3]);
      const list = edgeMap.get(k);
      if (list) list.push(ci); else edgeMap.set(k, [ci]);
    }
  });

  const cells = tris.map((t, ci) => {
    const a = unit[t[0]], b = unit[t[1]], c = unit[t[2]];
    const centre = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).normalize();
    const nbr = [-1, -1, -1];
    for (let i = 0; i < 3; i++) {
      const list = edgeMap.get(key(t[i], t[(i + 1) % 3]));
      if (!list) continue;
      nbr[i] = list[0] === ci ? (list[1] ?? -1) : list[0];
    }
    return {
      id: ci, tri: t, centre, nbr,
      // wider than it is tall = the "mushrooming" signature (1769641473895432220)
      area: triangleArea(a, b, c),
    };
  });

  return { unit, tris, cells, radius, stageStats: stage.stats };
}

function triangleArea(a, b, c) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return ab.cross(ac).length() * 0.5;
}

/* -------------------------------------------------------------------------- */
/*  heights                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Continent mask + quantised levels. The noise is sampled in 3D-ish by mixing
 * two 2D slices, because engine/noise.js is 2D — good enough for a land mask,
 * and documented as such.
 */
export function generateHeights(grid, { seed = 7, smoothPasses = 5 } = {}) {
  const { cells } = grid;
  const h = new Int8Array(cells.length);

  // 1. a *continuous* height first. Sampling the noise per cell and quantising
  //    straight away gives salt-and-pepper coastlines (a cell flips from land to
  //    sea because the high-frequency term happened to land on the wrong side of
  //    the threshold), and every flip becomes a one-level step — the planet ends
  //    up covered in tents. Smooth the field, then quantise.
  let v = new Float32Array(cells.length);
  for (const c of cells) {
    const p = c.centre;
    const mask = 0.5 * (fbm(p.x * 1.5 + 11, p.y * 1.5 - 3, { octaves: 4, seed }) + fbm(p.z * 1.5 - 7, p.x * 1.5 + 5, { octaves: 4, seed: seed + 41 }));
    const rough = 0.5 * (fbm(p.x * 5.5, p.z * 5.5, { octaves: 3, seed: seed + 7 }) + fbm(p.y * 5.5 + 3, p.z * 5.5 - 2, { octaves: 3, seed: seed + 91 }));
    v[c.id] = (mask - 0.44) * 7.0 + (rough - 0.5) * 0.45;
  }

  // 2. neighbour average (the same "let cells reach their desired size" idea as
  //    1769641473895432220, applied to height instead of footprint)
  const tmp = new Float32Array(cells.length);
  for (let pass = 0; pass < smoothPasses; pass++) {
    tmp.set(v);
    for (const c of cells) {
      let sum = v[c.id] * 2;
      let n = 2;
      for (let i = 0; i < 3; i++) {
        const nb = c.nbr[i];
        if (nb < 0) continue;
        sum += tmp[nb]; n++;
      }
      v[c.id] = sum / n;
    }
  }

  // 3. quantise. Thresholds are a full 0.7 apart on purpose: closer thresholds
  //    turn every ripple of the noise into another one-level step, and the whole
  //    planet reads as crumpled paper instead of terraces.
  for (const c of cells) {
    const x = v[c.id];
    let lv = 0;
    if (x > 0.40) lv = 1;
    if (x > 1.30) lv = 2;
    if (x > 2.20) lv = 3;
    h[c.id] = Math.min(SPHERE.maxLevel, lv);
  }

  // 4. no single-cell spikes or puddles: a lone cell in the middle of the sea
  //    (or a lone hole in the middle of a continent) is noise, not geography
  for (let pass = 0; pass < 2; pass++) {
    for (const c of cells) {
      let lo = 9, hi = -1;
      for (let i = 0; i < 3; i++) {
        const n = c.nbr[i];
        if (n < 0) continue;
        lo = Math.min(lo, h[n]);
        hi = Math.max(hi, h[n]);
      }
      if (hi < 0) continue;
      if (h[c.id] > 0 && lo === 0 && hi === 0) h[c.id] = 0;      // lone rock
      else if (h[c.id] === 0 && lo > 0) h[c.id] = 1;             // lone puddle
    }
  }
  return { heights: h, values: v };
}

/* -------------------------------------------------------------------------- */
/*  mesh                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} o
 * @param {object} o.grid    from buildSphereGrid()
 * @param {Int8Array} o.heights
 * @param {boolean} [o.softSlopes]
 * @param {boolean} [o.ao]
 */
export function buildSphereMesh({ grid, heights, values, softSlopes = true, ao = true }) {
  const t0 = performance.now();
  const { cells, unit, radius } = grid;
  const L = SPHERE.level;

  const pos = [];
  const col = [];
  const glow = [];

  const C = {
    grass: hex(SPHERE.grass), grassDark: hex(SPHERE.grassDark), grassLit: hex(SPHERE.grassLit),
    rock: hex(SPHERE.rock), cliff: hex(SPHERE.cliff), cliffDark: hex(SPHERE.cliffDark),
    sand: hex(SPHERE.sand), sandDark: hex(SPHERE.sandDark), snow: hex(SPHERE.snow),
  };

  /** radius of a level, in world units */
  const R = (lv) => radius + lv * L;

  const tri = (a, b, c, colour, shade) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) { col.push(colour.r * shade, colour.g * shade, colour.b * shade); glow.push(0); }
  };
  const V = (u, r) => new THREE.Vector3().copy(u).multiplyScalar(r);

  const nbrH = (c, i) => (c.nbr[i] < 0 ? 0 : heights[c.nbr[i]]);

  // how much this cell's corner may climb toward a neighbour one level higher
  const edgeLevel = (c, i) => {
    const nh = nbrH(c, i);
    return softSlopes && nh === heights[c.id] + 1 ? heights[c.id] + 1 : heights[c.id];
  };

  let cliffs = 0, slopes = 0;

  for (const c of cells) {
    const h = heights[c.id];
    if (h === 0) continue;
    const t = c.tri;

    // corner radius = max of the two edges meeting there (same rule as the flat
    // grid; without the max the two cells sharing a corner disagree and the
    // surface cracks open)
    const cr = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const e0 = (k + 2) % 3;   // edge ending at corner k
      const e1 = k;             // edge starting at corner k
      cr[k] = Math.max(edgeLevel(c, e0), edgeLevel(c, e1));
    }

    const spread = Math.max(...cr) - Math.min(...cr);
    const n = hash01(c.id * 131 + 7);
    const v = values ? values[c.id] : h * 0.7;

    // Colour from the *continuous* height, not a per-cell coin flip: two cells
    // in the same field should look like the same field. The hash only nudges
    // the tone a little, the way the reference's low-poly land does.
    let face;
    if (h >= SPHERE.maxLevel && v > 2.9) face = n < 0.6 ? C.snow : C.rock;
    else {
      const t = clamp((v - 0.3) / 1.9, 0, 1);          // 0 = low meadow, 1 = high meadow
      face = t < 0.5
        ? C.grassDark.clone().lerp(C.grass, t / 0.5)
        : C.grass.clone().lerp(C.grassLit, (t - 0.5) / 0.5);
      // a sloped face is the "walkable ramp" — lighten it so navigability reads
      if (spread > 0) face = face.clone().lerp(C.grassLit, 0.45);
      face = face.clone().multiplyScalar(0.96 + n * 0.08);
    }

    // one AO term per cell: how much higher the neighbours stand. A Cartesian
    // voxel field cannot be wrapped around a sphere, so this stands in for it.
    let occl = 0;
    if (ao) {
      for (let i = 0; i < 3; i++) occl += Math.max(0, nbrH(c, i) - h);
      occl = clamp(occl / 3 * 0.34, 0, 0.5);
      // north/south-ish shading of the whole cell, so the planet has a lit side
      occl += 0;
    }
    const shade = 1 - occl;

    const A = V(unit[t[0]], R(cr[0]));
    const B = V(unit[t[1]], R(cr[1]));
    const Cc = V(unit[t[2]], R(cr[2]));
    // wind the top face along the cell normal
    const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(Cc, A));
    if (nrm.dot(c.centre) < 0) tri(A, Cc, B, face, shade);
    else tri(A, B, Cc, face, shade);

    /* walls: only where this cell stands above the neighbour */
    for (let i = 0; i < 3; i++) {
      const nh = nbrH(c, i);
      if (nh >= h) continue;
      if (nh > 0 && h - nh === 1 && softSlopes) continue;   // the neighbour ramps up
      if (h - nh === 1) slopes++; else cliffs++;

      const u0 = unit[t[i]], u1 = unit[t[(i + 1) % 3]];
      const top0 = V(u0, R(cr[i]));
      const top1 = V(u1, R(cr[(i + 1) % 3]));
      const bot0 = V(u0, R(nh));
      const bot1 = V(u1, R(nh));
      const shade2 = 0.88 + 0.18 * hash01(c.id * 17 + i * 5 + h);
      // coastline = pale beach rock, inland step = grey rock, deep step = dark cliff
      const colour = nh === 0 ? C.sand
        : h - nh >= 2 ? (n < 0.5 ? C.cliff : C.cliffDark)
        : C.rock;
      // outward winding
      const e1v = new THREE.Vector3().subVectors(top0, bot0);
      const e2v = new THREE.Vector3().subVectors(top1, bot1);
      const outward = e1v.cross(e2v);
      if (outward.dot(new THREE.Vector3().addVectors(u0, u1)) < 0) {
        tri(bot0, top0, top1, colour, shade2); tri(bot0, top1, bot1, colour, shade2);
      } else {
        tri(bot0, top1, top0, colour, shade2); tri(bot0, bot1, top1, colour, shade2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  geometry.computeVertexNormals();
  const smoothed = smoothCoincidentNormals(geometry);
  geometry.computeBoundingSphere();

  return {
    geometry,
    stats: {
      triangles: pos.length / 9,
      cells: cells.filter((c) => heights[c.id] > 0).length,
      cliffs, slopes, smoothed,
      ms: +(performance.now() - t0).toFixed(1),
    },
  };
}

/**
 * Smooth the shading across cell borders without welding the mesh.
 *
 * Every cell owns its vertices, so `computeVertexNormals()` gives one normal per
 * face and the planet reads as broken glass. The reference (`画面` of
 * 1768627849529893109) is smooth, with the facets only showing up at cliffs.
 *
 * Same idea as engine/normalsmooth.js: average the normals of coincident
 * positions, but only keep neighbours whose normal is roughly aligned
 * (dot > 0.3) — that keeps a cliff's corner hard while the flat ground around it
 * goes soft. Colours stay per-cell, so a beach is still a beach.
 */
function smoothCoincidentNormals(geometry, tolerance = 0.008) {
  const p = geometry.attributes.position.array;
  const n = geometry.attributes.normal.array;
  const bucket = new Map();
  const key = (i) => `${Math.round(p[i] / tolerance)},${Math.round(p[i + 1] / tolerance)},${Math.round(p[i + 2] / tolerance)}`;

  const faces = p.length / 9;
  for (let f = 0; f < faces; f++) {
    for (let v = 0; v < 3; v++) {
      const o = f * 9 + v * 3;
      const k = key(o);
      let list = bucket.get(k);
      if (!list) bucket.set(k, (list = []));
      list.push(o);
    }
  }

  const out = new Float32Array(n.length);
  let blended = 0;
  for (let f = 0; f < faces; f++) {
    for (let v = 0; v < 3; v++) {
      const o = f * 9 + v * 3;
      const fx = n[o], fy = n[o + 1], fz = n[o + 2];
      const list = bucket.get(key(o));
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (const q of list) {
        const dot = n[q] * fx + n[q + 1] * fy + n[q + 2] * fz;
        if (dot < 0.3) continue;
        sx += n[q]; sy += n[q + 1]; sz += n[q + 2]; cnt++;
      }
      if (cnt > 1) blended++;
      const l = Math.hypot(sx, sy, sz) || 1;
      out[o] = sx / l; out[o + 1] = sy / l; out[o + 2] = sz / l;
    }
  }
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(out, 3));
  return blended;
}

/**
 * The thin bright band where land meets sea — the reference has one, and it is
 * what makes the coastline read as a shore instead of a cut.
 *
 * For every edge whose cell is land and whose neighbour is water, lay a narrow
 * strip just outside the coast at sea level, pushed out along the edge normal.
 */
export function buildShoreRibbon({ grid, heights, width = 0.34, lift = 0.02 }) {
  const pos = [];
  const { cells, unit, radius } = grid;
  const R0 = radius;
  const white = new THREE.Color('#e6f2f0');

  const push = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  for (const c of cells) {
    if (heights[c.id] === 0) continue;
    for (let i = 0; i < 3; i++) {
      const nb = c.nbr[i];
      if (nb >= 0 && heights[nb] > 0) continue;

      const t = c.tri;
      const u0 = unit[t[i]].clone();
      const u1 = unit[t[(i + 1) % 3]].clone();
      // outward direction in the tangent plane: away from the cell centre
      const mid = new THREE.Vector3().addVectors(u0, u1).multiplyScalar(0.5).normalize();
      const out0 = u0.clone().sub(mid.clone().multiplyScalar(u0.dot(mid))).normalize();
      const out1 = u1.clone().sub(mid.clone().multiplyScalar(u1.dot(mid))).normalize();

      const r = R0 + lift;
      const a0 = u0.clone().multiplyScalar(r);
      const a1 = u1.clone().multiplyScalar(r);
      const b0 = u0.clone().addScaledVector(out0, width / radius).normalize().multiplyScalar(r);
      const b1 = u1.clone().addScaledVector(out1, width / radius).normalize().multiplyScalar(r);
      push(a0, a1, b1);
      push(a0, b1, b0);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshBasicMaterial({ color: white, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  return new THREE.Mesh(g, m);
}

/** The sea: a shell one notch outside the lowest land level. */
export function buildSeaShell(radius, { segments = 96 } = {}) {
  const geo = new THREE.SphereGeometry(radius + 0.02, segments, segments / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#5f9fa8', roughness: 0.35, metalness: 0.0, transparent: true, opacity: 0.92 });
  return new THREE.Mesh(geo, mat);
}

/* -------------------------------------------------------------------------- */
/*  rivers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Rivers on the planet — the thing the clip actually shows.
 *
 *   1769691526924292506  "I've sort of special cased the rivers by collapsing
 *     them depth-first to lowest point"
 *   1795831296952041691  "a navigation structure that lets you travel faster
 *     along rivers (and especially downstream)"
 *   画面（1768627849529893109 后段）：大陆上有窄河网和湖，河面就是海平面，两岸是
 *     浅色崖，河宽约一格。
 *
 * So: pick a few high cells as sources and let each one walk **steepest descent**
 * until it reaches the sea, turning every cell on the way into water (level 0).
 * That is the same "collapse to the lowest point" idea as engine/rivers.js, on a
 * triangle graph instead of a square one — and it is why the walk has to be
 * iterative: a greedy 4-neighbour version dead-ends in a hollow.
 */
export function carveRivers(grid, heights, values, { threshold = 12, lakeSize = 2, gravity = 3.2 } = {}) {
  const { cells } = grid;
  const n = cells.length;

  // 0. Distance to the sea, by BFS over the cell graph. Drainage needs a
  //    potential that provably descends: pure height does not, because the
  //    smoothed height field is full of one-cell hollows (the smoothing that
  //    makes the coastline clean is exactly what creates them), and a drainage
  //    graph full of sinks gives rivers that are one cell long. Adding distance
  //    to the sea keeps the flow going downhill *and* guarantees it reaches the
  //    coast.
  const dist = new Float32Array(n).fill(Infinity);
  const queue = [];
  for (const c of cells) if (heights[c.id] === 0) { dist[c.id] = 0; queue.push(c.id); }
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi];
    for (let i = 0; i < 3; i++) {
      const nb = cells[id].nbr[i];
      if (nb < 0 || dist[nb] < Infinity) continue;
      dist[nb] = dist[id] + 1;
      queue.push(nb);
    }
  }

  // potential: prefer low ground, and always prefer nearer to the sea
  const pot = new Float32Array(n);
  for (const c of cells) {
    const d = Number.isFinite(dist[c.id]) ? dist[c.id] : 1e6;
    pot[c.id] = heights[c.id] * gravity + d;
  }

  // 1. steepest descent on the potential ("collapse them depth-first to lowest
  //    point" — 1769691526924292506)
  const down = new Int32Array(n).fill(-1);
  for (const c of cells) {
    if (heights[c.id] === 0) continue;
    let best = pot[c.id];
    let next = -1;
    for (let i = 0; i < 3; i++) {
      const nb = c.nbr[i];
      if (nb < 0) continue;
      if (pot[nb] < best) { best = pot[nb]; next = nb; }
    }
    down[c.id] = next;
  }

  // 2. flow accumulation, **highest potential first**: a cell must be processed
  //    after everything that drains into it, otherwise it forwards its own area
  //    before its tributaries have contributed and the whole network collapses
  //    to a couple of cells per branch (that was the first version's bug —
  //    max basin size came out as 4 out of 5000 cells).
  const area = new Float32Array(n).fill(1);
  const order = cells.slice().sort((a, b) => pot[b.id] - pot[a.id]);
  for (const c of order) {
    const d = down[c.id];
    if (d >= 0) area[d] += area[c.id];
  }

  // 3. a channel is water once enough ground drains through it
  const water = new Uint8Array(n);
  let carved = 0;
  let maxArea = 0;
  for (const c of cells) {
    if (heights[c.id] === 0) continue;
    if (area[c.id] >= threshold) { water[c.id] = 1; carved++; }
    if (area[c.id] > maxArea) maxArea = area[c.id];
  }

  // 4. a basin that still has nowhere to go holds water — the lakes in the clip
  let lakes = 0;
  for (const c of cells) {
    if (heights[c.id] === 0 || down[c.id] !== -1) continue;
    if (area[c.id] < lakeSize) continue;
    water[c.id] = 1; lakes++;
  }

  const out = Int8Array.from(heights);
  for (const c of cells) if (water[c.id]) out[c.id] = 0;
  return { heights: out, carved, lakes, maxArea: Math.round(maxArea), rivers: carved };
}
