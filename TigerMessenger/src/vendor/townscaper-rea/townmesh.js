/**
 * townmesh.js — the town's module geometry, rebuilt against the reference clips.
 *
 * Placemaker.ModuleBuilder + BigMeshMaster + AoBaker in one pass: every piece is
 * appended into one shared vertex pool (one draw call), and the occlusion /
 * bounce bake runs over that pool at the end.
 *
 * What the clips say, and where it lands here:
 *
 *  - 1197909675443916803, 1189908238566903808, 1215642481162887168
 *    Every column is a narrow house under a *steep gable roof*. Roofs are always
 *    the same terracotta; the palette colour goes on the walls. Same-height
 *    neighbours share one roof, so rows of cells read as terraced houses, and a
 *    row ends in a vertical gable (wall-coloured triangle) instead of a hip.
 *    -> roofs(): distance-to-eave field on a half-cell lattice, gable ends are
 *       left out of the eave set so the ridge runs straight into them.
 *  - 1258421104756097029, 1215642481162887168
 *    The ground level is a grey stone quay that flares out where it meets the
 *    water, topped by a dark red band and dark paving, with a railing on the
 *    water side. -> plinth(), paving, railings.
 *  - 1189902695303458816 "steel beam support structures"
 *    A cube with nothing under it stands on dark steel legs.
 *  - 1189908238566903808 "if you are more careful in providing structural
 *    support you'll get curvy brick arches instead"
 *    -> a hole with solid cubes on two opposite sides becomes an arch.
 *  - 1238474550511308800 "if you build an enclosed area it becomes a backyard"
 *    -> ground cells that cannot reach the water become lawn with trees.
 *  - 1168571866405097472 "The occlusion lives in a layered mesh that's
 *    reprojected to a texture at each change. That texture is then blurred,
 *    and sampled in the vertex shader"
 *    -> bakeLighting(): one occupancy raster per level, box-blurred, sampled
 *       per vertex just outside the surface.
 *  - 1197909675443916803 / 1237305125070426112 colored "bounce" "light"
 *    -> the same rasters carry the wall colour, so a white wall next to a red
 *       one picks up a little red.
 *  - 1313840428685447170 night: windows light up -> per-vertex aGlow.
 */

import * as THREE from 'three';
import { MAX_HEIGHT, pointInQuad } from './town.js';

export const STYLE = {
  roof: '#e07a52',
  roofAlt: '#d96f4a',
  roofTrim: '#8a3a32',
  plaster: '#efe6d4',
  stone: '#8d8f95',
  stoneDark: '#6d6f76',
  band: '#7d3836',
  paving: '#5e6168',
  pavingAlt: '#666970',
  curb: '#7f828a',
  lawn: '#6f9a5e',
  lawnAlt: '#679357',
  path: '#a49c8a',
  tree: '#4e8558',
  treeLight: '#5f9a63',
  trunk: '#6e5443',
  steel: '#33373e',
  frame: '#f6f2e8',
  glass: '#3d4b58',
  door: '#5d4a3b',
  chimney: '#e9e1d2',
  rail: '#2f3238',
};

const hash01 = (n) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class TownMesh {
  constructor(town, grid, { levelHeight = 0.5 } = {}) {
    this.town = town;
    this.grid = grid;
    this.levelHeight = levelHeight;
    this.builtVersion = -1;
    this.paletteKey = '';
    this.geometry = new THREE.BufferGeometry();
    this.posts = [];        // steel legs standing in the water: foam rings
    this.colorCache = new Map();
    this.stats = {};
    this.ao = true;
    this.bounce = true;
    this.bake = true;       // AoBaker on/off (learning panel)
  }

  invalidate() { this.builtVersion = -1; }

  col(hex) {
    let c = this.colorCache.get(hex);
    if (c === undefined) this.colorCache.set(hex, (c = new THREE.Color(hex)));
    return c;
  }

  wallColor(cell) {
    const i = this.town.colors[cell.id];
    return this.col(i >= 0 ? this.town.palette.colors[i] ?? STYLE.plaster : STYLE.plaster);
  }

  rebuild() {
    if (this.town.version === this.builtVersion) return false;
    const t0 = performance.now();
    this.builtVersion = this.town.version;
    this.colorCache.clear();

    const town = this.town;
    const grid = this.grid;
    const cells = grid.cells;
    const L = this.levelHeight;
    const n = cells.length;

    const tops = new Int32Array(n);
    for (const c of cells) tops[c.id] = town.top(c);
    const solid = (cell, lv) => cell !== null && town.isSolid(cell, lv);
    const nbr = (cell, i) => (cell.edgeNeighbors[i] >= 0 ? cells[cell.edgeNeighbors[i]] : null);

    /* ------------------------------------------------------------ emitters */
    const pos = [];
    const colArr = [];
    const glow = [];

    const C = (c, s) => [c.r * s, c.g * s, c.b * s];

    /** Triangle, flipped if needed so its normal points along `dir`. */
    const tri = (a, b, c, dir, color, s0 = 1, s1 = s0, s2 = s0, g = 0) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (dir && nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) { [b, c] = [c, b]; [s1, s2] = [s2, s1]; }
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      colArr.push(...C(color, s0), ...C(color, s1), ...C(color, s2));
      glow.push(g, g, g);
    };
    const quad = (a, b, c, d, dir, color, s = 1, g = 0, s2 = s) => {
      tri(a, b, c, dir, color, s, s, s2, g);
      tri(a, c, d, dir, color, s, s2, s2, g);
    };
    const UP = [0, 1, 0];
    const DOWN = [0, -1, 0];

    /** Square-section beam between two points. */
    const beam = (a, b, thick, color, shade = 1) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz) || 1e-6;
      const ux = dx / len, uy = dy / len, uz = dz / len;
      let px = 0, py = 1, pz = 0;
      if (Math.abs(uy) > 0.9) { px = 1; py = 0; }
      let nx = uy * pz - uz * py, ny = uz * px - ux * pz, nz = ux * py - uy * px;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const bx = uy * nz - uz * ny, by = uz * nx - ux * nz, bz = ux * ny - uy * nx;
      const h = thick / 2;
      const P = (p, s1, s2) => [p[0] + (nx * s1 + bx * s2) * h, p[1] + (ny * s1 + by * s2) * h, p[2] + (nz * s1 + bz * s2) * h];
      const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      for (let k = 0; k < 4; k++) {
        const [s1, s2] = ring[k];
        const [t1, t2] = ring[(k + 1) % 4];
        const out = [(nx * (s1 + t1) + bx * (s2 + t2)), (ny * (s1 + t1) + by * (s2 + t2)), (nz * (s1 + t1) + bz * (s2 + t2))];
        quad(P(a, s1, s2), P(b, s1, s2), P(b, t1, t2), P(a, t1, t2), out, color, shade);
      }
    };

    /** Axis box, five faces. */
    const box = (cx, y0, cz, sx, sy, sz, color, shade = 1) => {
      const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy;
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color, shade);
      quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], color, shade);
      quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], color, shade);
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color, shade);
      quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], UP, color, shade * 1.05);
    };

    /** Low-poly blob (octahedron, one subdivision): trees and bushes. */
    const blob = (cx, cy, cz, rx, ry, color) => {
      const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
      const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
      const P = (v) => [cx + v[0] * rx, cy + v[1] * ry, cz + v[2] * rx];
      for (const [i, j, k] of F) {
        const a = V[i], b = V[j], c = V[k];
        const ab = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
        const bc = norm([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2]);
        const ca = norm([(c[0] + a[0]) / 2, (c[1] + a[1]) / 2, (c[2] + a[2]) / 2]);
        for (const [p, q, r] of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) {
          const m = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3];
          const sh = 0.82 + 0.3 * Math.max(0, m[1]);
          tri(P(p), P(q), P(r), m, color, sh);
        }
      }
    };

    /* ------------------------------------------------------ edge helpers */
    /** Outward unit normal of edge i (away from the cell centre). */
    const edgeOut = (cell, i) => {
      const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
      let nx = -(b.z - a.z), nz = b.x - a.x;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l; nz /= l;
      if (nx * ((a.x + b.x) / 2 - cell.cx) + nz * ((a.z + b.z) / 2 - cell.cz) < 0) { nx = -nx; nz = -nz; }
      return [nx, nz];
    };

    // Per-vertex outward normal of the quay outline (level-1 exposure), used
    // to flare the plinth without opening cracks between neighbouring cells.
    const quayN = new Map();
    for (const cell of cells) {
      if (!town.isSolid(cell, 1)) continue;
      for (let i = 0; i < 4; i++) {
        if (solid(nbr(cell, i), 1)) continue;
        const [nx, nz] = edgeOut(cell, i);
        for (const p of [cell.pts[i], cell.pts[(i + 1) % 4]]) {
          const v = quayN.get(p.id) || [0, 0];
          v[0] += nx; v[1] += nz;
          quayN.set(p.id, v);
        }
      }
    }
    const flare = (p, amount) => {
      const v = quayN.get(p.id);
      if (!v) return [p.x, p.z];
      const l = Math.hypot(v[0], v[1]) || 1;
      // a corner shared by two exposed edges gets pushed a bit further, the
      // way a rounded stone corner would
      const k = amount * Math.min(1.35, Math.max(1, l));
      return [p.x + (v[0] / l) * k, p.z + (v[1] / l) * k];
    };

    /* -------------------------------------------------------- backyards */
    // Ground cells whose connected ground cannot reach water or the grid rim.
    const yard = new Uint8Array(n);
    {
      const seen = new Uint8Array(n);
      for (const start of cells) {
        if (seen[start.id] || tops[start.id] !== 1) continue;
        const comp = [];
        let open = false;
        const stack = [start];
        seen[start.id] = 1;
        while (stack.length) {
          const c = stack.pop();
          comp.push(c);
          for (let i = 0; i < 4; i++) {
            const nb = nbr(c, i);
            if (nb === null || tops[nb.id] === 0) { open = true; continue; }
            if (tops[nb.id] === 1 && !seen[nb.id]) { seen[nb.id] = 1; stack.push(nb); }
          }
        }
        if (!open) for (const c of comp) yard[c.id] = 1;
      }
    }

    /* ------------------------------------------------------------ walls */
    const plaster = this.col(STYLE.plaster);
    const stone = this.col(STYLE.stone);
    const stoneDark = this.col(STYLE.stoneDark);
    const band = this.col(STYLE.band);
    const frame = this.col(STYLE.frame);
    const glass = this.col(STYLE.glass);
    const doorCol = this.col(STYLE.door);
    const steel = this.col(STYLE.steel);
    const railCol = this.col(STYLE.rail);

    const plinth = (cell, i) => {
      const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
      const [nx, nz] = edgeOut(cell, i);
      const out = [nx, 0, nz];
      // rows: y, flare. The bottom flares out over the water (the rounded
      // quay foot in 1258421104756097029), the top is plumb under the band.
      const rows = [[0.0, 0.085], [0.1 * L, 0.06], [0.3 * L, 0.022], [0.62 * L, 0.004], [L - 0.055, 0.0]];
      for (let r = 0; r < rows.length - 1; r++) {
        const [y0, f0] = rows[r];
        const [y1, f1] = rows[r + 1];
        const a0 = flare(a, f0), b0 = flare(b, f0), a1 = flare(a, f1), b1 = flare(b, f1);
        const shade = (0.86 + 0.05 * r) * (0.96 + 0.08 * hash01(cell.id * 7 + i * 3 + r));
        quad([a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], out,
          r < 2 ? stoneDark : stone, shade);
      }
      // dark red band at the quay lip, standing a hair proud of the stone
      const o = 0.012;
      const ya = L - 0.055, yb = L + 0.006;
      quad([a.x + nx * o, ya, a.z + nz * o], [b.x + nx * o, ya, b.z + nz * o],
        [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], out, band, 1);
      quad([a.x, ya, a.z], [b.x, ya, b.z], [b.x + nx * o, ya, b.z + nz * o], [a.x + nx * o, ya, a.z + nz * o], DOWN, band, 0.7);
      quad([a.x, yb, a.z], [b.x, yb, b.z], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], UP, band, 1.05);
    };

    const opening = (cell, i, t, y0, w, h, isDoor) => {
      const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
      const [nx, nz] = edgeOut(cell, i);
      const out = [nx, 0, nz];
      const P = (tt, y, o) => [mix(a.x, b.x, tt) + nx * o, y, mix(a.z, b.z, tt) + nz * o];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const hw = (w / 2) / len;
      const fw = 0.022 / len;
      const t1 = t - hw, t2 = t + hw;
      const y1 = y0 + h;
      const ft = 0.022;
      quad(P(t1 - fw, y0 - ft, 0.008), P(t2 + fw, y0 - ft, 0.008), P(t2 + fw, y1 + ft, 0.008), P(t1 - fw, y1 + ft, 0.008), out, frame, 1);
      quad(P(t1, y0, 0.012), P(t2, y0, 0.012), P(t2, y1, 0.012), P(t1, y1, 0.012), out, isDoor ? doorCol : glass, 1, isDoor ? 0 : 1);
      if (!isDoor) {
        // mullion + sill
        const tm = t;
        const mw = 0.006 / len;
        quad(P(tm - mw, y0, 0.016), P(tm + mw, y0, 0.016), P(tm + mw, y1, 0.016), P(tm - mw, y1, 0.016), out, frame, 1);
        quad(P(t1 - fw * 1.6, y0 - ft * 1.6, 0.03), P(t2 + fw * 1.6, y0 - ft * 1.6, 0.03), P(t2 + fw * 1.6, y0 - ft * 0.6, 0.03), P(t1 - fw * 1.6, y0 - ft * 0.6, 0.03), out, frame, 0.95);
      }
    };

    const wallBody = (cell, i, y0, y1, color, shade) => {
      const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
      const [nx, nz] = edgeOut(cell, i);
      quad([a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z], [nx, 0, nz], color, shade);
    };

    /* ---------------------------------------------- per cell: walls, tops */
    const railings = [];
    const posts = [];
    const postSeen = new Set();
    const vertexCells = grid.vertexCells;

    for (const cell of cells) {
      const h = tops[cell.id];
      if (h === 0) continue;
      const wall = this.wallColor(cell);
      const mosaic = 0.965 + 0.07 * hash01(cell.id * 2654435761 + 3);

      // ---- walls: one span per run of exposed levels on each edge
      for (let i = 0; i < 4; i++) {
        const nb = nbr(cell, i);
        const nbTop = nb ? tops[nb.id] : 0;
        const edgeLen = Math.hypot(cell.pts[(i + 1) % 4].x - cell.pts[i].x, cell.pts[(i + 1) % 4].z - cell.pts[i].z);
        for (let lv = 1; lv <= h; lv++) {
          if (!town.isSolid(cell, lv) || solid(nb, lv)) continue;
          if (lv === 1) { plinth(cell, i); continue; }
          const y0 = (lv - 1) * L, y1 = lv * L;
          const runStart = !town.isSolid(cell, lv - 1) || lv === 2 || solid(nb, lv - 1);
          if (runStart) {
            // dark skirting where a house meets the quay (or hangs over air)
            wallBody(cell, i, y0, y0 + 0.045, wall, 0.55);
            wallBody(cell, i, y0 + 0.045, y1, wall, mosaic);
          } else {
            wallBody(cell, i, y0, y1, wall, mosaic);
          }
          // openings: a door onto walkable ground, otherwise windows
          const hk = cell.id * 131 + i * 17 + lv * 7;
          const walkable = nbTop === lv - 1 && nbTop >= 1 && (nb ? town.bottom(nb) === 1 : false);
          if (walkable && hash01(hk) < 0.55 && edgeLen > 0.3) {
            opening(cell, i, 0.5, y0 + 0.03, 0.12, 0.22, true);
          } else if (edgeLen > 0.26 && hash01(hk + 1) < 0.78) {
            const two = edgeLen > 0.52 && hash01(hk + 2) < 0.6;
            const wy = y0 + L * 0.4;
            if (two) {
              opening(cell, i, 0.3, wy, 0.085, 0.14, false);
              opening(cell, i, 0.7, wy, 0.085, 0.14, false);
            } else {
              opening(cell, i, 0.5 + (hash01(hk + 3) - 0.5) * 0.15, wy, 0.095, 0.15, false);
            }
          }
        }
      }

      // ---- tops of every run, undersides of every run that hangs over air
      for (let lv = 1; lv <= h; lv++) {
        if (!town.isSolid(cell, lv)) continue;
        const runTop = !town.isSolid(cell, lv + 1);
        const runBottom = lv > 1 && !town.isSolid(cell, lv - 1);
        if (runTop && lv < h) {
          // a lower run with a hole above it: flat floor (paving / terrace)
          const y = lv * L;
          quad(...cell.pts.map((p) => [p.x, y, p.z]), UP, lv === 1 ? this.col(STYLE.paving) : wall, 0.92);
        }
        if (runTop && lv === h && h === 1) {
          const y = L + 0.006;
          if (yard[cell.id]) {
            const c = this.col(hash01(cell.id * 5) < 0.5 ? STYLE.lawn : STYLE.lawnAlt);
            quad(...cell.pts.map((p) => [p.x, y, p.z]), UP, c, 0.97 + 0.06 * hash01(cell.id));
          } else {
            // dark joint underneath, slightly inset slab on top: the grid
            // stays readable on the quay the way it is in the clips
            const c = this.col(hash01(cell.id * 5) < 0.5 ? STYLE.paving : STYLE.pavingAlt);
            quad(...cell.pts.map((p) => [p.x, y, p.z]), UP, c, 0.78);
            const ins = cell.pts.map((p) => [mix(p.x, cell.cx, 0.07), y + 0.003, mix(p.z, cell.cz, 0.07)]);
            quad(...ins, UP, c, 0.97 + 0.08 * hash01(cell.id));
          }
          for (let i = 0; i < 4; i++) {
            const nb = nbr(cell, i);
            if (nb === null || tops[nb.id] === 0) railings.push([cell, i]);
          }
        }
        if (runBottom) this.#underside(cell, lv, { quad, tri, beam, wall, steel, posts, postSeen, vertexCells, cells, L, town, nbr });
      }
    }

    /* ---------------------------------------------------------- railings */
    for (const [cell, i] of railings) {
      const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
      const [nx, nz] = edgeOut(cell, i);
      const inset = 0.035;
      const ax = a.x - nx * inset, az = a.z - nz * inset, bx = b.x - nx * inset, bz = b.z - nz * inset;
      const y = L;
      beam([ax, y + 0.13, az], [bx, y + 0.13, bz], 0.018, railCol, 1);
      beam([ax, y + 0.07, az], [bx, y + 0.07, bz], 0.01, railCol, 0.95);
      const len = Math.hypot(bx - ax, bz - az);
      const count = Math.max(2, Math.round(len / 0.16) + 1);
      for (let k = 0; k < count; k++) {
        const t = k / (count - 1);
        beam([mix(ax, bx, t), y, mix(az, bz, t)], [mix(ax, bx, t), y + 0.13, mix(az, bz, t)], k === 0 || k === count - 1 ? 0.022 : 0.009, railCol, 1);
      }
    }

    /* ------------------------------------------------------------- roofs */
    this.#roofs({ quad, tri, box, cells, tops, nbr, edgeOut, L });

    /* --------------------------------------------------------- backyards */
    const treeC = this.col(STYLE.tree);
    const treeL = this.col(STYLE.treeLight);
    const trunk = this.col(STYLE.trunk);
    for (const cell of cells) {
      if (!yard[cell.id]) continue;
      const r = hash01(cell.id * 977 + 5);
      const y = L + 0.006;
      if (r < 0.45) {
        const big = r < 0.25;
        const s = big ? 0.15 : 0.11;
        const jx = (hash01(cell.id * 31) - 0.5) * 0.1, jz = (hash01(cell.id * 37) - 0.5) * 0.1;
        const x = cell.cx + jx, z = cell.cz + jz;
        beam([x, y, z], [x, y + s * 1.3, z], 0.035, trunk, 1);
        blob(x, y + s * 1.6, z, s, s * 0.95, big ? treeC : treeL);
        if (big) blob(x + s * 0.35, y + s * 2.25, z - s * 0.2, s * 0.7, s * 0.65, treeL);
      } else if (r < 0.7) {
        blob(cell.cx, y + 0.05, cell.cz, 0.09, 0.07, treeL);
      }
    }

    /* ------------------------------------------------------------ bake */
    const tBake = performance.now();
    if (this.bake) this.#bakeLighting(pos, colArr, { cells, tops, L });
    const bakeMs = performance.now() - tBake;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    geometry.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.geometry.dispose();
    this.geometry = geometry;
    this.posts = posts;
    this.stats = { triangles: pos.length / 9, yards: yard.reduce((s, v) => s + v, 0), posts: posts.length, bakeMs: +bakeMs.toFixed(1), ms: +(performance.now() - t0).toFixed(1) };
    return true;
  }

  /* ---------------------------------------------------------------------- */
  /** Underside of a run starting at `lv` with air below: arch or steel legs. */
  #underside(cell, lv, k) {
    const { quad, beam, wall, steel, posts, postSeen, vertexCells, cells, L, town, nbr } = k;
    const yBase = (lv - 1) * L;
    // floor below the hole: the highest solid level under it, else the sea
    let floorLv = 0;
    for (let l = lv - 1; l >= 1; l--) if (town.isSolid(cell, l)) { floorLv = l; break; }
    const yFloor = floorLv * L;
    const below = lv - 1;

    // Arch: supported on two opposite sides at the level just below.
    let archAxis = -1;
    for (const i of [0, 1]) {
      const n0 = nbr(cell, i), n2 = nbr(cell, i + 2);
      if (n0 && n2 && town.isSolid(n0, below) && town.isSolid(n2, below)) { archAxis = i; break; }
    }

    if (archAxis >= 0) {
      const i = archAxis;
      const A0 = cell.pts[i], A1 = cell.pts[(i + 1) % 4];
      const B1 = cell.pts[(i + 2) % 4], B0 = cell.pts[(i + 3) % 4];
      const P = (u, v, y) => {
        const x0 = mix(A0.x, B0.x, u), z0 = mix(A0.z, B0.z, u);
        const x1 = mix(A1.x, B1.x, u), z1 = mix(A1.z, B1.z, u);
        return [mix(x0, x1, v), y, mix(z0, z1, v)];
      };
      const gap = yBase - yFloor;
      const rise = Math.min(gap * 0.75, L * 0.8);
      const crown = yBase - 0.05;
      const yAt = (u) => crown - rise * (1 - Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)));
      const S = 10;
      const soffit = wall.clone().multiplyScalar(0.72);
      for (let s = 0; s < S; s++) {
        const u0 = s / S, u1 = (s + 1) / S;
        const y0 = yAt(u0), y1 = yAt(u1);
        // vault surface (faces down / inward)
        const mid = P((u0 + u1) / 2, 0.5, (y0 + y1) / 2);
        const cen = [mid[0], yFloor, mid[2]];
        const d = [cen[0] - mid[0], -1, cen[2] - mid[2]];
        quad(P(u0, 0, y0), P(u1, 0, y1), P(u1, 1, y1), P(u0, 1, y0), d, soffit, 0.9);
        // spandrels on the two open faces, only where those faces are exposed
        for (const [v, ei] of [[0, (i + 3) % 4], [1, (i + 1) % 4]]) {
          const nb = nbr(cell, ei);
          if (nb && town.isSolid(nb, below)) continue;
          const a = cell.pts[ei], b = cell.pts[(ei + 1) % 4];
          let nx = -(b.z - a.z), nz = b.x - a.x;
          if (nx * ((a.x + b.x) / 2 - cell.cx) + nz * ((a.z + b.z) / 2 - cell.cz) < 0) { nx = -nx; nz = -nz; }
          quad(P(u0, v, y0), P(u1, v, y1), P(u1, v, yBase), P(u0, v, yBase), [nx, 0, nz], wall, 0.97);
        }
      }
      return;
    }

    // Flat soffit + steel legs
    const soffit = wall.clone().multiplyScalar(0.6);
    quad(...cell.pts.map((p) => [p.x, yBase, p.z]), [0, -1, 0], soffit, 1);
    const legs = [];
    for (let c = 0; c < 4; c++) {
      const p = cell.pts[c];
      // a corner already standing on a wall needs no leg
      const sharing = vertexCells.get(p.id) || [];
      if (sharing.some((id) => town.isSolid(cells[id], below))) continue;
      legs.push(c);
      const key = p.id * 64 + lv;
      if (postSeen.has(key)) continue;
      postSeen.add(key);
      // pull the leg in a touch so it reads as standing under the corner
      const x = mix(p.x, cell.cx, 0.06), z = mix(p.z, cell.cz, 0.06);
      beam([x, yFloor, z], [x, yBase, z], 0.045, steel, 1);
      if (floorLv === 0) posts.push({ x, z });
    }
    // knee braces + a girder along each braced edge
    for (let e = 0; e < 4; e++) {
      const c0 = e, c1 = (e + 1) % 4;
      if (!legs.includes(c0) || !legs.includes(c1)) continue;
      const nb = nbr(cell, e);
      if (nb && nb.id < cell.id && town.isSolid(nb, lv) && !town.isSolid(nb, below)) continue;
      const p0 = cell.pts[c0], p1 = cell.pts[c1];
      const a = [mix(p0.x, cell.cx, 0.06), 0, mix(p0.z, cell.cz, 0.06)];
      const b = [mix(p1.x, cell.cx, 0.06), 0, mix(p1.z, cell.cz, 0.06)];
      const yg = yBase - 0.05;
      beam([a[0], yg, a[2]], [b[0], yg, b[2]], 0.035, steel, 0.95);
      const drop = Math.min(0.25, (yBase - yFloor) * 0.4);
      beam([a[0], yg - drop, a[2]], [mix(a[0], b[0], 0.3), yg, mix(a[2], b[2], 0.3)], 0.022, steel, 0.9);
      beam([b[0], yg - drop, b[2]], [mix(b[0], a[0], 0.3), yg, mix(b[2], a[2], 0.3)], 0.022, steel, 0.9);
    }
  }

  /* ---------------------------------------------------------------------- */
  /**
   * Gable roofs. Per region (same-top neighbours) a distance-to-eave field is
   * evaluated on a half-cell lattice (corners, edge midpoints, centres); the
   * roof height is that distance times a steep slope. Gable ends — the far edge
   * of a one-cell-wide row, or the two short edges of a lone cell — are left out
   * of the eave set, so the ridge runs straight into them and they get a
   * vertical wall triangle instead of a hip.
   */
  #roofs({ quad, tri, box, cells, tops, nbr, edgeOut, L }) {
    const town = this.town;
    const { regions } = town.regions();
    const roofBase = this.col(STYLE.roof);
    const roofAlt = this.col(STYLE.roofAlt);
    const trim = this.col(STYLE.roofTrim);
    const chim = this.col(STYLE.chimney);
    const slope = 1.3;
    const cap = 0.27;
    const overhang = 0.055;
    const thick = 0.045;

    for (const region of regions) {
      const h = region.h;
      if (h < 2) continue;
      const base = h * L;
      const inRegion = new Set(region.cells.map((c) => c.id));

      // boundary flags per cell edge: 1 eave, 2 gable, 0 interior / abutting
      const flags = new Map();
      for (const cell of region.cells) {
        const f = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          const nb = nbr(cell, i);
          const nt = nb ? tops[nb.id] : 0;
          if (nb && inRegion.has(nb.id)) continue;
          if (nt > h) continue;          // abuts a taller wall: no eave there
          f[i] = 1;
        }
        const cnt = f.reduce((s, v) => s + v, 0);
        if (cnt === 3) {
          const g = f.indexOf(0);
          const ge = (g + 2) % 4;
          // only a gable if the two sides are both eaves (a one-wide row end)
          if (f[(ge + 1) % 4] && f[(ge + 3) % 4]) f[ge] = 2;
        } else if (cnt === 4) {
          const m = (i) => {
            const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
            return [(a.x + b.x) / 2, (a.z + b.z) / 2];
          };
          const d02 = Math.hypot(m(0)[0] - m(2)[0], m(0)[1] - m(2)[1]);
          const d13 = Math.hypot(m(1)[0] - m(3)[0], m(1)[1] - m(3)[1]);
          if (d02 >= d13) { f[0] = 2; f[2] = 2; } else { f[1] = 2; f[3] = 2; }
        }
        flags.set(cell.id, f);
      }

      // eave segments (flag 1) for the distance field
      const eaves = [];
      for (const cell of region.cells) {
        const f = flags.get(cell.id);
        for (let i = 0; i < 4; i++) if (f[i] === 1) eaves.push([cell.pts[i], cell.pts[(i + 1) % 4]]);
      }

      // lattice points: corners by vertex id, edge mids by edge key, centres
      const pts = new Map();
      const pt = (key, x, z) => {
        let p = pts.get(key);
        if (!p) pts.set(key, (p = { x, z, nx: 0, nz: 0, onEdge: false, d: 0, y: 0, ox: x, oz: z }));
        return p;
      };
      const lat = new Map();
      for (const cell of region.cells) {
        const c = cell.pts.map((p) => pt('v' + p.id, p.x, p.z));
        const m = [0, 1, 2, 3].map((i) => {
          const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
          const k = a.id < b.id ? `e${a.id}_${b.id}` : `e${b.id}_${a.id}`;
          return pt(k, (a.x + b.x) / 2, (a.z + b.z) / 2);
        });
        const ctr = pt('c' + cell.id, cell.cx, cell.cz);
        lat.set(cell.id, { c, m, ctr });
        const f = flags.get(cell.id);
        for (let i = 0; i < 4; i++) {
          if (!f[i]) continue;
          const [nx, nz] = edgeOut(cell, i);
          for (const p of [c[i], m[i], c[(i + 1) % 4]]) { p.nx += nx; p.nz += nz; p.onEdge = true; }
        }
      }
      for (const p of pts.values()) {
        let best = Infinity;
        for (const [a, b] of eaves) {
          const d = segDist(p.x, p.z, a.x, a.z, b.x, b.z);
          if (d < best) best = d;
        }
        p.d = eaves.length ? best : 0.3;
        const rise = Math.min(p.d, cap) * slope;
        p.y = base + rise;
        if (p.onEdge) {
          const l = Math.hypot(p.nx, p.nz) || 1;
          p.ox = p.x + (p.nx / l) * overhang;
          p.oz = p.z + (p.nz / l) * overhang;
          if (p.d < 1e-3) p.y -= 0.02;    // eave dips below the wall top
        }
      }

      // roof surface
      for (const cell of region.cells) {
        const { c, m, ctr } = lat.get(cell.id);
        const shade = 0.96 + 0.08 * hash01(cell.id * 977 + 11);
        const rc = town.roofColors[cell.id];
        const roofCol = rc >= 0 ? this.col(town.palette.colors[rc]) : (hash01(cell.id * 13) < 0.5 ? roofBase : roofAlt);
        const P = (p) => [p.ox, p.y, p.oz];
        for (let i = 0; i < 4; i++) {
          const a = c[i], b = m[i], d = m[(i + 3) % 4];
          tri(P(a), P(b), P(ctr), UPV, roofCol, shade);
          tri(P(a), P(ctr), P(d), UPV, roofCol, shade);
        }
      }

      // trim (fascia + soffit) along every eave and rake, and gable walls
      for (const cell of region.cells) {
        const { c, m } = lat.get(cell.id);
        const f = flags.get(cell.id);
        const wall = this.wallColor(cell);
        for (let i = 0; i < 4; i++) {
          if (!f[i]) continue;
          const [nx, nz] = edgeOut(cell, i);
          const out = [nx, 0, nz];
          const seq = [c[i], m[i], c[(i + 1) % 4]];
          for (let s = 0; s < 2; s++) {
            const p = seq[s], q = seq[s + 1];
            quad([p.ox, p.y, p.oz], [q.ox, q.y, q.oz], [q.ox, q.y - thick, q.oz], [p.ox, p.y - thick, p.oz], out, trim, 1);
            quad([p.ox, p.y - thick, p.oz], [q.ox, q.y - thick, q.oz], [q.x, q.y - thick - 0.01, q.z], [p.x, p.y - thick - 0.01, p.z], DOWNV, trim, 0.6);
          }
          if (f[i] === 2) {
            // vertical gable wall in the wall colour, up to the rake
            const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
            const mid = m[i];
            tri([a.x, base, a.z], [b.x, base, b.z], [mid.x, mid.y - thick, mid.z], out, wall, 0.98);
            // a small attic window in the gable
            const wy = base + (mid.y - base) * 0.32;
            const fr = this.col(STYLE.frame);
            const gl = this.col(STYLE.glass);
            const P2 = (t, y, o) => [mix(a.x, b.x, t) + nx * o, y, mix(a.z, b.z, t) + nz * o];
            if ((mid.y - base) > 0.16) {
              quad(P2(0.44, wy - 0.012, 0.006), P2(0.56, wy - 0.012, 0.006), P2(0.56, wy + 0.1, 0.006), P2(0.44, wy + 0.1, 0.006), out, fr, 1);
              quad(P2(0.465, wy, 0.01), P2(0.535, wy, 0.01), P2(0.535, wy + 0.08, 0.01), P2(0.465, wy + 0.08, 0.01), out, gl, 1);
            }
          }
        }
      }

      // a chimney here and there, on the ridge
      for (const cell of region.cells) {
        if (hash01(cell.id * 4099 + h) > 0.12) continue;
        const { ctr } = lat.get(cell.id);
        box(ctr.x + 0.05, ctr.y - 0.06, ctr.z, 0.07, 0.16, 0.07, chim, 1);
        box(ctr.x + 0.05, ctr.y + 0.1, ctr.z, 0.09, 0.025, 0.09, trim, 1);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /**
   * Layered occlusion + colour bounce (AoBaker). One raster per level holds
   * occupancy and the colour of what occupies it; both are box-blurred, then
   * every vertex samples them a little way out along its face normal.
   */
  #bakeLighting(pos, col, { cells, tops, L }) {
    const town = this.town;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
    for (const c of cells) {
      const h = tops[c.id];
      if (!h) continue;
      for (const p of c.pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      }
      if (h > maxH) maxH = h;
    }
    if (!Number.isFinite(minX)) return;
    const pad = 0.8;
    const res = 0.08;
    minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
    const W = Math.ceil((maxX - minX) / res) + 1;
    const H = Math.ceil((maxZ - minZ) / res) + 1;
    const layers = maxH + 2;
    const size = W * H;
    const occ = new Float32Array(size * layers);
    const cr = new Float32Array(size * layers);
    const cg = new Float32Array(size * layers);
    const cb = new Float32Array(size * layers);
    const stoneC = this.col(STYLE.stone);

    for (const c of cells) {
      const h = tops[c.id];
      if (!h) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of c.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      const i0 = Math.max(0, Math.floor((x0 - minX) / res)), i1 = Math.min(W - 1, Math.ceil((x1 - minX) / res));
      const j0 = Math.max(0, Math.floor((z0 - minZ) / res)), j1 = Math.min(H - 1, Math.ceil((z1 - minZ) / res));
      const wall = this.wallColor(c);
      for (let j = j0; j <= j1; j++) {
        const z = minZ + j * res;
        for (let i = i0; i <= i1; i++) {
          const x = minX + i * res;
          if (!pointInQuad(c.pts, x, z)) continue;
          for (let lv = 1; lv <= h; lv++) {
            if (!town.isSolid(c, lv)) continue;
            const k = lv * size + j * W + i;
            const cc = lv === 1 ? stoneC : wall;
            occ[k] = 1; cr[k] = cc.r; cg[k] = cc.g; cb[k] = cc.b;
          }
        }
      }
    }

    // separable box blur, twice (≈ gaussian), radius ~0.3 world units
    const R = 4;
    const tmp = new Float32Array(Math.max(W, H));
    const blur1 = (arr, off) => {
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < H; j++) {
          const row = off + j * W;
          let s = 0;
          for (let i = -R; i <= R; i++) s += arr[row + clamp(i, 0, W - 1)];
          for (let i = 0; i < W; i++) {
            tmp[i] = s / (2 * R + 1);
            s += arr[row + Math.min(W - 1, i + R + 1)] - arr[row + Math.max(0, i - R)];
          }
          for (let i = 0; i < W; i++) arr[row + i] = tmp[i];
        }
        for (let i = 0; i < W; i++) {
          let s = 0;
          for (let j = -R; j <= R; j++) s += arr[off + clamp(j, 0, H - 1) * W + i];
          for (let j = 0; j < H; j++) {
            tmp[j] = s / (2 * R + 1);
            s += arr[off + Math.min(H - 1, j + R + 1) * W + i] - arr[off + Math.max(0, j - R) * W + i];
          }
          for (let j = 0; j < H; j++) arr[off + j * W + i] = tmp[j];
        }
      }
    };
    for (let lv = 1; lv < layers; lv++) {
      blur1(occ, lv * size); blur1(cr, lv * size); blur1(cg, lv * size); blur1(cb, lv * size);
    }

    const sampleLayer = (arr, lv, x, z) => {
      if (lv < 1 || lv >= layers) return 0;
      const fi = (x - minX) / res, fj = (z - minZ) / res;
      if (fi < 0 || fj < 0 || fi >= W - 1 || fj >= H - 1) return 0;
      const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j;
      const o = lv * size + j * W + i;
      return (arr[o] * (1 - tx) + arr[o + 1] * tx) * (1 - tz) + (arr[o + W] * (1 - tx) + arr[o + W + 1] * tx) * tz;
    };
    const sample = (arr, x, y, z) => {
      const f = y / L + 0.5;          // continuous level index (centre of level k at k-0.5)
      const l0 = Math.floor(f), t = f - l0;
      return sampleLayer(arr, l0, x, z) * (1 - t) + sampleLayer(arr, l0 + 1, x, z) * t;
    };

    const off = 0.17;
    for (let t = 0; t < pos.length; t += 9) {
      const ax = pos[t], ay = pos[t + 1], az = pos[t + 2];
      const ux = pos[t + 3] - ax, uy = pos[t + 4] - ay, uz = pos[t + 5] - az;
      const vx = pos[t + 6] - ax, vy = pos[t + 7] - ay, vz = pos[t + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      for (let v = 0; v < 3; v++) {
        const o = t + v * 3;
        const sx = pos[o] + nx * off, sy = pos[o + 1] + ny * off + 0.02, sz = pos[o + 2] + nz * off;
        const oc = sample(occ, sx, sy, sz);
        if (oc < 0.002) continue;
        const ao = this.ao ? 1 - 0.62 * Math.min(1, oc * 1.15) : 1;
        const br = sample(cr, sx, sy, sz) / oc, bg = sample(cg, sx, sy, sz) / oc, bb = sample(cb, sx, sy, sz) / oc;
        const bounce = this.bounce ? 0.42 * oc : 0;
        col[o] = col[o] * ao + col[o] * br * bounce;
        col[o + 1] = col[o + 1] * ao + col[o + 1] * bg * bounce;
        col[o + 2] = col[o + 2] * ao + col[o + 2] * bb * bounce;
      }
    }
  }
}

const UPV = [0, 1, 0];
const DOWNV = [0, -1, 0];

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
