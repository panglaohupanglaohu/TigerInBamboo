/**
 * spherehouse.js — houses on a planet, where "up" is the cell's own normal.
 *
 *   1768627849529893109  "I've gone and put this on a sphere"
 *   1584623053061099520  houses spliced into the terrain
 *
 * src/townmesh.js cannot be reused here and that is not a bug: it builds walls
 * from level 1 upward on a +Y axis, and it assumes the footprint is a quad. On a
 * planet neither holds — every cell has its own up vector and the footprint is a
 * triangle.
 *
 * So this is the smallest thing that still reads as "the same town": a footprint
 * inset inside the cell, walls extruded along the cell normal, and a hip roof
 * pulled to a ridge point above the centroid. Colour roles are borrowed from
 * TownMesh's STYLE (plaster walls, terracotta roof, dark stone plinth), because
 * the point of the fusion is that the *look* is shared even when the code is not.
 */

import * as THREE from 'three';
import { fbm } from '../engine/noise.js';

export const HOUSE = {
  wall: '#efe6d4',
  wallAlt: '#e8dcc6',
  plinth: '#8d8f95',
  roof: '#e07a52',
  roofAlt: '#d96f4a',
  trim: '#f6f2e8',
  door: '#5d4a3b',
  glass: '#3d4b58',
  wallHeight: 0.26,
  roofHeight: 0.12,
  inset: 0.24,
};

const hex = (h) => new THREE.Color(h);

function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Local frame for a cell: `up` is the cell normal, `ex` runs along the first
 * triangle edge projected into the tangent plane, `ez` completes the basis.
 */
function cellFrame(cell, unit, tri) {
  const up = cell.centre.clone();
  const a = unit[tri[0]];
  const ex = a.clone().sub(up.clone().multiplyScalar(a.dot(up))).normalize();
  const ez = new THREE.Vector3().crossVectors(up, ex).normalize();
  return { up, ex, ez };
}

/**
 * @param {object} o
 * @param {object} o.grid      from buildSphereGrid()
 * @param {Int8Array} o.heights
 * @param {number} o.levelHeight
 * @param {number} [o.radius]
 * @param {number} [o.density] 0..1, share of eligible cells that get a house
 */
export function buildSphereHouses({ grid, heights, levelHeight, radius = 10, density = 0.62, seed = 3 }) {
  const t0 = performance.now();
  const { cells, unit } = grid;

  const pos = [];
  const col = [];

  const C = {
    wall: hex(HOUSE.wall), wallAlt: hex(HOUSE.wallAlt), plinth: hex(HOUSE.plinth),
    roof: hex(HOUSE.roof), roofAlt: hex(HOUSE.roofAlt), trim: hex(HOUSE.trim),
    door: hex(HOUSE.door), glass: hex(HOUSE.glass),
  };

  const tri = (a, b, c, colour, shade = 1) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) col.push(colour.r * shade, colour.g * shade, colour.b * shade);
  };
  /** Quad facing along `dir` (outward). */
  const quad = (a, b, c, d, dir, colour, shade = 1) => {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * dir.x + ny * dir.y + nz * dir.z < 0) { tri(a, c, b, colour, shade); tri(a, d, c, colour, shade); }
    else { tri(a, b, c, colour, shade); tri(a, c, d, colour, shade); }
  };

  let count = 0;
  const placed = [];

  for (const c of cells) {
    const h = heights[c.id];
    if (h < 1) continue;   // the flat test below already keeps houses off the coast

    // only flat ground: all three neighbours at the same level. A house on a
    // slope would need a foundation, and the reference keeps its tiles flat.
    let flat = true;
    for (let i = 0; i < 3; i++) {
      const nb = c.nbr[i];
      if (nb >= 0 && heights[nb] !== h) { flat = false; break; }
    }
    if (!flat) continue;
    if (hash01(c.id * 977 + seed) > density) continue;
    // villages, not a planet-wide suburb: a low-frequency mask decides where
    // people live. Without it every flat cell gets a house and the planet reads
    // as a single grey mass.
    const vill = fbm(c.centre.x * 4.2 + 9, c.centre.z * 4.2 - 4, { octaves: 3, seed: seed + 17 });
    if (vill < 0.52) continue;

    const f = cellFrame(c, unit, c.tri);
    const base = radius + h * levelHeight;
    const t = c.tri;

    // footprint: the cell's corners pulled toward the centroid, in the tangent
    // plane, so there is a thin gap between neighbours (a street)
    const centre = f.up.clone().multiplyScalar(radius);
    const corners = [0, 1, 2].map((k) => {
      const u = unit[t[k]];
      const r = radius + h * levelHeight;
      const p = u.clone().multiplyScalar(r);
      return p.lerp(centre.clone().multiplyScalar(r / radius), HOUSE.inset);
    });

    const wallTop = radius + h * levelHeight + HOUSE.wallHeight;
    const up = f.up;
    const T = corners.map((p) => p.clone().addScaledVector(up, HOUSE.wallHeight));
    const B = corners;

    // plinth ring (a dark band at the bottom, like TownMesh's stone base)
    const plinthTop = B.map((p) => p.clone().addScaledVector(up, 0.09));
    const wallCol = hash01(c.id * 31) < 0.5 ? C.wall : C.wallAlt;
    const roofCol = hash01(c.id * 53) < 0.5 ? C.roof : C.roofAlt;

    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      // outward normal of this wall: perpendicular to the edge, away from centre
      const mid = B[i].clone().add(B[j]).multiplyScalar(0.5);
      const out = mid.clone().sub(centre.clone().multiplyScalar(mid.length() / radius)).normalize();
      quad(B[i], B[j], plinthTop[j], plinthTop[i], out, C.plinth, 0.95);
      quad(plinthTop[i], plinthTop[j], T[j], T[i], out, wallCol, 1);
    }

    // hip roof: three triangles up to a ridge point above the centroid
    const apex = up.clone().multiplyScalar(wallTop + HOUSE.roofHeight)
      .add(new THREE.Vector3().subVectors(T[0], up.clone().multiplyScalar(T[0].length())).multiplyScalar(0.25));
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      // flip so the roof faces away from the planet, never inward
      const nrm = new THREE.Vector3().subVectors(T[j], T[i]).cross(new THREE.Vector3().subVectors(apex, T[i]));
      if (nrm.dot(up) < 0) tri(T[i], apex, T[j], roofCol, 1);
      else tri(T[i], T[j], apex, roofCol, 1);
    }
    // No eave trim: at planet zoom a bright band under the roof turns the house
    // into a circus tent. The wall/roof colour split already reads as a house.

    count++;
    placed.push(h);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return {
    geometry,
    count,
    levels: placed.reduce((m, v) => { m[v] = (m[v] || 0) + 1; return m; }, {}),
    stats: { houses: count, triangles: pos.length / 9, ms: +(performance.now() - t0).toFixed(1) },
  };
}

