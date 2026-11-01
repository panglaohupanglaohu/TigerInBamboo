/**
 * mesh.js — module geometry + batching.
 *
 * Mirrors Placemaker.ModuleBuilder / BigMeshMaster / BigMesh from the shipped
 * build: every module's vertices are appended into one shared vertex pool
 * (BigMesh.verts / normals / tris) instead of spawning per-object meshes, so the
 * whole town is a single draw call, and Placemaker.AoBaker's job — darkening
 * vertices that sit in a corner — happens here at generation time.
 *
 * Two units of assembly:
 *   - a *cube* decides its own walls, soffit and openings;
 *   - a *region* (connected cubes sharing the same top level) owns one hip roof.
 *
 * Cubes with nothing underneath get a timber substructure — posts, collar beams
 * and diagonal struts — which is what holds a hollowed-out tower up in the
 * original instead of leaving it floating.
 */

import * as THREE from 'three';
import { TERRAIN, MAX_HEIGHT } from './town.js';

const hash01 = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class TownMesh {
  constructor(town, { levelHeight = 0.42, mode = 'town' } = {}) {
    this.town = town;
    this.levelHeight = levelHeight;
    // 'town' puts roofs, windows and railings on; 'terrain' keeps everything
    // flat so the same voxel field can be read as landscape.
    this.mode = mode;
    this.builtVersion = -1;
    this.geometry = new THREE.BufferGeometry();
    this.foam = new THREE.BufferGeometry();
    this.colorCache = new Map();
  }

  colorOf(hex) {
    let c = this.colorCache.get(hex);
    if (c === undefined) this.colorCache.set(hex, (c = new THREE.Color(hex).convertSRGBToLinear()));
    return c;
  }

  wallColorOf(index) {
    return this.colorOf(index >= 0 ? this.town.palette.colors[index] ?? TERRAIN.plaster : TERRAIN.plaster);
  }

  invalidate() { this.builtVersion = -1; }

  rebuild() {
    if (this.town.version === this.builtVersion) return false;
    this.builtVersion = this.town.version;
    this.colorCache.clear();

    const town = this.town;
    const LEVEL = this.levelHeight;
    const cells = town.cells;

    const pos = [];
    const col = [];
    const foamPos = [];
    const foamA = [];

    /* ---------------------------------------------------------- primitives */

    const tri = (a, b, c, color, shades) => {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      for (let i = 0; i < 3; i++) {
        const s = shades[i];
        col.push(color.r * s, color.g * s, color.b * s);
      }
    };

    const quad = (a, b, c, d, color, shades = ONE) => {
      tri(a, b, c, color, [shades[0], shades[1], shades[2]]);
      tri(a, c, d, color, [shades[0], shades[2], shades[3]]);
    };

    /** Axis-aligned box: 5 visible faces (no bottom). */
    const box = (cx, y0, cz, sx, sy, sz, color, shade = 1) => {
      const x0 = cx - sx / 2, x1 = cx + sx / 2;
      const z0 = cz - sz / 2, z1 = cz + sz / 2;
      const y1 = y0 + sy;
      const ctr = [cx, y0 + sy / 2, cz];
      const s = [shade, shade, shade, shade];
      faceQuadTri(pos, col, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], ctr, color, s);
      faceQuadTri(pos, col, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], ctr, color, s);
      faceQuadTri(pos, col, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], ctr, color, s);
      faceQuadTri(pos, col, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], ctr, color, s);
      faceQuadTri(pos, col, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], ctr, color, [shade * 1.06, shade * 1.06, shade * 1.06, shade * 1.06]);
    };

    /** Thin square-section beam between two points in 3D (timber work). */
    const beam = (a, b, thick, color, shade = 1) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz) || 1e-6;
      const ux = dx / len, uy = dy / len, uz = dz / len;
      // an arbitrary perpendicular, then the third axis
      let px = 0, py = 1, pz = 0;
      if (Math.abs(uy) > 0.9) { px = 1; py = 0; }
      let nx = uy * pz - uz * py;
      let ny = uz * px - ux * pz;
      let nz = ux * py - uy * px;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const bx = uy * nz - uz * ny, by = uz * nx - ux * nz, bz = ux * ny - uy * nx;
      const h = thick / 2;
      const ctr = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const P = (p, s1, s2) => [
        p[0] + nx * h * s1 + bx * h * s2,
        p[1] + ny * h * s1 + by * h * s2,
        p[2] + nz * h * s1 + bz * h * s2,
      ];
      const a1 = P(a, 1, 1), a2 = P(a, -1, 1), a3 = P(a, -1, -1), a4 = P(a, 1, -1);
      const b1 = P(b, 1, 1), b2 = P(b, -1, 1), b3 = P(b, -1, -1), b4 = P(b, 1, -1);
      const s = [shade, shade, shade, shade];
      faceQuadTri(pos, col, a1, b1, b2, a2, ctr, color, s);
      faceQuadTri(pos, col, a2, b2, b3, a3, ctr, color, s);
      faceQuadTri(pos, col, a3, b3, b4, a4, ctr, color, s);
      faceQuadTri(pos, col, a4, b4, b1, a1, ctr, color, s);
    };

    /** One flat top face (quad points wind toward +Y). */
    const topFace = (pts, y, color, shade) => {
      quad(
        [pts[0].x, y, pts[0].z], [pts[1].x, y, pts[1].z],
        [pts[2].x, y, pts[2].z], [pts[3].x, y, pts[3].z],
        color, [shade, shade, shade, shade],
      );
    };

    /* --------------------------------------------------------------- walls */

    /** One wall face on edge `i`, covering levels start..end. */
    const wallSpan = (cell, i, start, end, plasterColor, mosaic, isBase) => {
      const a = cell.pts[i];
      const b = cell.pts[(i + 1) % 4];
      const nx = -(b.z - a.z), nz = (b.x - a.x);
      const nl = Math.hypot(nx, nz) || 1;
      // Outward, not just "left of the edge": on a CCW quad this vector points
      // inward for two of the four edges, and an inward offset puts every seam
      // and plinth inside the rock where nothing can be seen.
      const mx = (a.x + b.x) / 2 - cell.cx;
      const mz = (a.z + b.z) / 2 - cell.cz;
      let oxu = nx / nl;
      let ozu = nz / nl;
      if (oxu * mx + ozu * mz < 0) { oxu = -oxu; ozu = -ozu; }
      const ox = oxu * 0.0004, oz = ozu * 0.0004;

      const yBot = (start - 1) * LEVEL;
      const yTop = end * LEVEL;
      const plinthTop = isBase ? Math.min(yTop, LEVEL) : yBot;

      if (isBase && plinthTop > yBot) {
        const quay = this.colorOf(TERRAIN.quay);
        const dark = this.colorOf(TERRAIN.quayDark);
        const half = (plinthTop + yBot) / 2;
        quad([a.x, plinthTop, a.z], [a.x, half, a.z], [b.x, half, b.z], [b.x, plinthTop, b.z],
          quay, [mosaic, mosaic * 0.95, mosaic * 0.95, mosaic]);
        quad([a.x, half, a.z], [a.x, yBot, a.z], [b.x, yBot, b.z], [b.x, half, b.z],
          dark, [mosaic * 0.96, mosaic * 0.9, mosaic * 0.9, mosaic * 0.96]);
        const jy = half + 0.008;
        quad([a.x + ox, jy - 0.008, a.z + oz], [a.x + ox, jy + 0.008, a.z + oz],
          [b.x + ox, jy + 0.008, b.z + oz], [b.x + ox, jy - 0.008, b.z + oz],
          this.colorOf(TERRAIN.mortar), ONE);
      }

      const from = Math.max(yBot, plinthTop);
      if (yTop <= from) return;
      const bands = Math.max(1, Math.round((yTop - from) / LEVEL));
      for (let k = 0; k < bands; k++) {
        const y0 = from + ((yTop - from) * k) / bands;
        const y1 = from + ((yTop - from) * (k + 1)) / bands;
        const shade = this.mode === 'terrain'
          // rock darkens downward; each course keeps a hair of variation
          ? mosaic * (0.84 + 0.14 * (k / Math.max(1, bands - 1)) + 0.06 * (k % 2) + 0.015 * hash01(cell.id * 17 + k))
          : mosaic * (0.97 + 0.06 * hash01(cell.id * 17 + k));
        quad([a.x, y1, a.z], [a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z],
          plasterColor, [shade, shade * 0.93, shade * 0.93, shade]);
        // course joint: in terrain this is the horizontal rock seam, so it is
        // drawn darker and wider than the plaster version
        const jy = y1 - 0.004;
        const seam = this.mode === 'terrain' ? 0.009 : 0.004;
        // rock seams are darker than the stone; the pale plaster joint vanishes
        // against a grey cliff, which is why the bands were invisible at first
        const seamColor = this.mode === 'terrain'
          ? this.colorOf('#6b727b')
          : this.colorOf(TERRAIN.mortar);
        quad([a.x + ox, jy - seam, a.z + oz], [a.x + ox, jy + seam, a.z + oz],
          [b.x + ox, jy + seam, b.z + oz], [b.x + ox, jy - seam, b.z + oz],
          seamColor, [0.9, 0.9, 0.9, 0.9]);
      }
    };

    /** Window or door on one wall segment, as frame + glass plates. */
    const opening = (cell, i, yBottom, height, isDoor, mosaic) => {
      const a = cell.pts[i];
      const b = cell.pts[(i + 1) % 4];
      const nx = -(b.z - a.z), nz = (b.x - a.x);
      const nl = Math.hypot(nx, nz) || 1;
      const ox = (nx / nl) * 0.012, oz = (nz / nl) * 0.012;
      const w = isDoor ? 0.28 : 0.3;
      const t1 = 0.5 - w / 2, t2 = 0.5 + w / 2;
      const y0 = yBottom, y1 = yBottom + height;
      const ft = 0.05;
      const frame = this.colorOf(TERRAIN.frame);
      const glass = this.colorOf(isDoor ? TERRAIN.glass : '#8ea8b4');

      const pt = (t, y, out) => [
        mix(a.x, b.x, t) + ox * out / 0.012,
        y,
        mix(a.z, b.z, t) + oz * out / 0.012,
      ];
      const fr = (t, y) => pt(t, y, 0.024);

      quad(fr(t1 - ft, y1 + ft), fr(t1 - ft, y0 - ft), fr(t2 + ft, y0 - ft), fr(t2 + ft, y1 + ft), frame, [1, 1, 1, 1]);
      quad(pt(t1, y1, 0.02), pt(t1, y0, 0.02), pt(t2, y0, 0.02), pt(t2, y1, 0.02), glass, [1, 0.86, 0.86, 1]);
      const tm = (t1 + t2) / 2;
      quad(pt(tm - 0.01, y1, 0.026), pt(tm - 0.01, y0, 0.026), pt(tm + 0.01, y0, 0.026), pt(tm + 0.01, y1, 0.026), frame, ONE);
      if (!isDoor) {
        quad(
          pt(t1 - ft, y0 - ft, 0.03), pt(t1 - ft, y0 - ft * 2, 0.03),
          pt(t2 + ft, y0 - ft * 2, 0.03), pt(t2 + ft, y0 - ft, 0.03),
          frame, [1, 0.9, 0.9, 1],
        );
      }
    };

    /* ---------------------------------------------------------------- roof */

    /** Roof height field: distance from each region vertex to the boundary. */
    const roofSurface = (region) => {
      const h = region.h;
      const base = h * LEVEL;

      const boundary = [];
      for (const cell of region.cells) {
        for (let i = 0; i < 4; i++) {
          const nb = cell.edgeNeighbors[i];
          if (nb >= 0 && town.top(cells[nb]) >= h) continue;
          const a = cell.pts[i];
          const b = cell.pts[(i + 1) % 4];
          const dx = b.x - a.x, dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 1e-6;
          boundary.push({ a, b, nx: -dz / len, nz: dx / len });
        }
      }
      if (boundary.length === 0) return null;

      const verts = new Map();
      for (const cell of region.cells) {
        for (const p of cell.pts) if (!verts.has(p)) verts.set(p, { p, d: Infinity, nx: 0, nz: 0 });
      }
      for (const v of verts.values()) {
        let best = Infinity;
        for (const e of boundary) {
          const d = segDist(v.p.x, v.p.z, e.a.x, e.a.z, e.b.x, e.b.z);
          if (d < best) best = d;
        }
        v.d = best;
      }
      for (const e of boundary) {
        const va = verts.get(e.a);
        const vb = verts.get(e.b);
        if (va) { va.nx += e.nx; va.nz += e.nz; }
        if (vb) { vb.nx += e.nx; vb.nz += e.nz; }
      }

      let area = 0;
      for (const c of region.cells) area += c.size * c.size * 2;
      const cap = Math.min(0.55, Math.max(0.16, Math.sqrt(area / Math.PI) * 0.75));
      const slope = 0.85;
      const overhang = 0.035;
      const out = new Map();
      for (const v of verts.values()) {
        const onEdge = v.d < 0.006;
        let x = v.p.x, z = v.p.z;
        if (onEdge) {
          const l = Math.hypot(v.nx, v.nz) || 1;
          x += (v.nx / l) * overhang;
          z += (v.nz / l) * overhang;
        }
        const rise = (onEdge ? 0 : Math.min(v.d, cap) * slope) + 0.012;
        out.set(v.p, [x, base + rise, z, rise]);
      }
      const fascia = boundary.map((e) => ({ a: out.get(e.a), b: out.get(e.b), nx: e.nx, nz: e.nz }));
      return { verts: out, cap: cap * slope, base, fascia };
    };

    /* ------------------------------------------------------------------ */

    const { regions } = town.regions();
    const foamInner = 0.32;
    const foamOuter = 0.78;
    const timber = this.colorOf(TERRAIN.timber);
    const postKeys = new Set();

    for (const region of regions) {
      const h = region.h;
      const surface = this.mode === 'terrain' ? null : roofSurface(region);
      const usedColour = region.cells.find((c) => town.colors[c.id] >= 0);
      const regionColour = usedColour ? town.colors[usedColour.id] : -1;

      for (const cell of region.cells) {
        // In terrain the per-cell mosaic has to be almost flat: a strong one
        // turns a cliff into vertical barcode stripes, because neighbouring
        // cells disagree. Rock variation belongs to the strata, below.
        const mosaic = this.mode === 'terrain'
          // flat: on a cliff the per-cell step turns into a vertical barcode,
          // and rock variation belongs to the strata anyway
          ? 1.0
          : 0.95 + 0.1 * hash01(cell.id * 2654435761 + 3);
        const cellColour = town.colors[cell.id];
        const roofSlot = town.roofColors[cell.id];
        // In terrain the palette slot describes the *cap* (sand, moss, scree).
        // A cliff is rock, always, so the wall ignores the slot and takes a
        // near-uniform stone with a whisper of per-cell variation. Letting the
        // cap colour bleed onto the walls is what produced vertical stripes.
        const plaster = this.mode === 'terrain'
          ? this.colorOf('#9b9c9e').clone().multiplyScalar(0.97 + 0.05 * hash01(cell.id * 6151 + 7))
          : this.wallColorOf(cellColour >= 0 ? cellColour : regionColour);
        const bottomLevel = town.bottom(cell);

        // ---- walls, one span per run of exposed levels -------------------
        for (let i = 0; i < 4; i++) {
          const nid = cell.edgeNeighbors[i];
          const nb = nid >= 0 ? cells[nid] : null;
          const openAt = (y) => town.isSolid(cell, y) && !(nb !== null && town.isSolid(nb, y));

          let y = 1;
          while (y <= h) {
            if (!openAt(y)) { y++; continue; }
            const start = y;
            while (y <= h && openAt(y)) y++;
            const end = y - 1;
            const isBase = start === 1 && !(nb !== null && town.isSolid(nb, 1));
            wallSpan(cell, i, start, end, plaster, mosaic, isBase);

            if (this.mode !== 'terrain' && (end > 1 || (h >= 2 && end >= 1))) {
              if (isBase && h >= 2 && end >= 1) {
                opening(cell, i, (start - 1) * LEVEL + 0.02, LEVEL * 0.62, true, mosaic);
              }
              for (let lv = Math.max(start, 1); lv < Math.min(end + 1, h); lv++) {
                if (hash01(cell.id * 31 + lv * 977 + i) > 0.42) continue;
                opening(cell, i, (lv - 1) * LEVEL + LEVEL * 0.26, LEVEL * 0.46, false, mosaic);
              }
            }
          }
        }

        // ---- soffit under a floating cube + timber substructure ----------
        if (bottomLevel > 1) {
          const yBase = (bottomLevel - 1) * LEVEL;
          const under = plaster.clone().multiplyScalar(0.62);
          // underside face, wound the other way so it faces down
          quad(
            [cell.pts[3].x, yBase, cell.pts[3].z], [cell.pts[2].x, yBase, cell.pts[2].z],
            [cell.pts[1].x, yBase, cell.pts[1].z], [cell.pts[0].x, yBase, cell.pts[0].z],
            under, [0.9, 0.9, 0.9, 0.9],
          );

          // Terrain never gets a timber frame: a cave is a hole in the rock,
          // not a hollowed-out building that needs propping up.
          const postThick = 0.07;
          const free = [];
          if (this.mode !== 'terrain') {
            for (let i = 0; i < 4; i++) {
              const nid = cell.edgeNeighbors[i];
              const nb = nid >= 0 ? cells[nid] : null;
              if (nb !== null && town.isSolid(nb, bottomLevel - 1)) continue;
              // an edge shared with another floating cube is braced once, by
              // the lower id, so the frame is not built twice
              if (nb !== null && nb.id < cell.id) continue;
              free.push(i);
            }
          }
          // Posts live on the shared grid corners, so dedupe globally: the same
          // corner appears in up to four cubes.
          for (const i of free) {
            for (const p of [cell.pts[i], cell.pts[(i + 1) % 4]]) {
              const key = `${Math.round(p.x * 128)},${Math.round(p.z * 128)}`;
              if (postKeys.has(key)) continue;
              postKeys.add(key);
              beam([p.x, 0, p.z], [p.x, yBase, p.z], postThick, timber, 0.95);
              const s2 = 0.06;
              quad(
                [p.x - s2, 0.035, p.z - s2], [p.x - s2, 0.035, p.z + s2],
                [p.x + s2, 0.035, p.z + s2], [p.x + s2, 0.035, p.z - s2],
                this.colorOf('#eef6f5'), [0.95, 0.95, 0.95, 0.95],
              );
            }
          }
          // collar beam + one diagonal strut per exposed edge
          for (const i of free) {
            const a = cell.pts[i];
            const b = cell.pts[(i + 1) % 4];
            const midY = yBase * 0.55;
            beam([a.x, midY, a.z], [b.x, midY, b.z], 0.032, timber, 0.9);
            // diagonals only on alternating edges: a full lattice reads as noise
            if (i % 2 === 0) beam([a.x, yBase - 0.02, a.z], [b.x, 0.06, b.z], 0.03, timber, 0.85);
          }
        }

        // ---- top -------------------------------------------------------
        if (this.mode === 'terrain') {
          // flat plateau top, slightly inset, coloured by the painted slot
          const cap = town.colors[cell.id] >= 0
            ? this.colorOf(town.palette.colors[town.colors[cell.id]])
            : this.colorOf(TERRAIN.pavement);
          topFace(cell.pts, h * LEVEL, cap, mosaic);

          // Warm lit bevel around every exposed cap edge. In the reference this
          // bright amber lip is what separates a plateau from the cliff below —
          // it is the single most recognisable line in the stills, brighter than
          // any other edge in frame.
          const lip = this.colorOf('#e9b878');
          const lipShade = 1.05;
          for (let i = 0; i < 4; i++) {
            const nh = town.neighborTop(cell, i);
            if (nh >= h) continue;
            const a = cell.pts[i];
            const b = cell.pts[(i + 1) % 4];
            let nx2 = -(b.z - a.z);
            let nz2 = b.x - a.x;
            const nl2 = Math.hypot(nx2, nz2) || 1;
            nx2 /= nl2;
            nz2 /= nl2;
            const mx2 = (a.x + b.x) / 2 - cell.cx;
            const mz2 = (a.z + b.z) / 2 - cell.cz;
            if (nx2 * mx2 + nz2 * mz2 < 0) { nx2 = -nx2; nz2 = -nz2; }
            const out = 0.004;
            const inw = 0.042;
            const drop = 0.05;
            // top edge is inset, bottom edge sits on the wall line: the strip
            // leans outward and catches the key light
            faceQuadTri(pos, col,
              [a.x + nx2 * out, h * LEVEL - drop, a.z + nz2 * out],
              [b.x + nx2 * out, h * LEVEL - drop, b.z + nz2 * out],
              [b.x - nx2 * inw, h * LEVEL + 0.002, b.z - nz2 * inw],
              [a.x - nx2 * inw, h * LEVEL + 0.002, a.z - nz2 * inw],
              [cell.cx, h * LEVEL - drop * 0.3, cell.cz],
              lip, [lipShade, lipShade, lipShade, lipShade]);
          }
        } else if (h === 1) {
          const paved = town.colors[cell.id] >= 0
            ? this.wallColorOf(town.colors[cell.id])
            : this.colorOf(hash01(cell.id * 7) > 0.5 ? TERRAIN.pavement : TERRAIN.pavementAlt);
          topFace(insetQuad(cell.pts, 0.02), h * LEVEL, paved, mosaic);
          if (town.colors[cell.id] < 0 && hash01(cell.id * 13) < 0.14) {
            topFace(insetQuad(cell.pts, 0.24), h * LEVEL + 0.004, this.colorOf(TERRAIN.grass), 0.98);
          }
        } else if (surface) {
          const corn = cell.pts.map((p) => surface.verts.get(p));
          const roofBare = this.colorOf(TERRAIN.roofBare);
          const roofColour = roofSlot >= 0
            ? this.colorOf(town.palette.colors[roofSlot])
            : cellColour >= 0 ? tintRoof(this.wallColorOf(cellColour)) : roofBare;
          const atCap = corn.every((c) => c[3] >= surface.cap - 1e-3);
          const roofMosaic = 0.985 + 0.03 * hash01(cell.id * 977 + 11);
          const shade = roofMosaic * (atCap ? 1.07 : 0.99);
          quad(
            [corn[0][0], corn[0][1], corn[0][2]],
            [corn[1][0], corn[1][1], corn[1][2]],
            [corn[2][0], corn[2][1], corn[2][2]],
            [corn[3][0], corn[3][1], corn[3][2]],
            roofColour, [shade, shade, shade, shade],
          );
        } else if (region.cells.length === 1) {
          const peak = [cell.cx, h * LEVEL + 0.13, cell.cz];
          const roofColour = roofSlot >= 0
            ? this.colorOf(town.palette.colors[roofSlot])
            : cellColour >= 0 ? tintRoof(this.wallColorOf(cellColour)) : this.colorOf(TERRAIN.roofBare);
          const ctr = [cell.cx, h * LEVEL, cell.cz];
          for (let i = 0; i < 4; i++) {
            const a = cell.pts[i];
            const b = cell.pts[(i + 1) % 4];
            faceTri(pos, col, [a.x, h * LEVEL, a.z], [b.x, h * LEVEL, b.z], peak, ctr, roofColour, [0.86, 0.86, 1.06]);
          }
        }

        // ---- chimney ---------------------------------------------------
        if (this.mode === 'town' && h >= 2 && surface && region.cells.length >= 3 && cell === region.cells[0]) {
          const best = region.cells.reduce((b, c) => {
            const cs = c.pts.map((p) => surface.verts.get(p));
            const avg = cs.reduce((s, v) => s + v[3], 0) / 4;
            return avg > b.avg ? { c, avg } : b;
          }, { c: cell, avg: -1 });
          const top = h * LEVEL + best.avg;
          box(best.c.cx, top - 0.02, best.c.cz, 0.085, 0.17, 0.085, this.colorOf(TERRAIN.quayDark), 1);
          box(best.c.cx, top + 0.15, best.c.cz, 0.12, 0.03, 0.12, this.colorOf(TERRAIN.mortar), 1);
        }

        // ---- railings on walkways --------------------------------------
        if (this.mode === 'town' && h === 1) {
          for (let i = 0; i < 4; i++) {
            if (town.neighborTop(cell, i) !== 0) continue;
            const a = cell.pts[i];
            const b = cell.pts[(i + 1) % 4];
            const ax = a.x + (cell.cx - a.x) * 0.07, az = a.z + (cell.cz - a.z) * 0.07;
            const bx = b.x + (cell.cx - b.x) * 0.07, bz = b.z + (cell.cz - b.z) * 0.07;
            const y = h * LEVEL;
            const metal = this.colorOf(TERRAIN.metal);
            beam([ax, y + 0.125, az], [bx, y + 0.125, bz], 0.016, metal, 0.9);
            beam([ax, y + 0.065, az], [bx, y + 0.065, bz], 0.012, metal, 0.85);
            const posts = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.34) + 1);
            for (let k = 0; k < posts; k++) {
              const t = posts === 1 ? 0.5 : k / (posts - 1);
              box(mix(ax, bx, t), y, mix(az, bz, t), 0.018, 0.135, 0.018, metal, 0.95);
            }
          }
        }

        // ---- foam where a column meets the sea --------------------------
        for (let i = 0; i < 4; i++) {
          if (town.neighborTop(cell, i) !== 0) continue;
          if (bottomLevel > 1) continue; // floating: the foam belongs to the posts
          const a = cell.pts[i];
          const b = cell.pts[(i + 1) % 4];
          const dx = b.x - a.x, dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 1e-6;
          const nx = -dz / len, nz = dx / len;
          for (const [w0, w1, alpha] of [[0, foamInner, 0.5], [foamInner, foamOuter, 0.16]]) {
            const y = 0.055;
            const p1 = [a.x + nx * w0, y, a.z + nz * w0];
            const p2 = [b.x + nx * w0, y, b.z + nz * w0];
            const p3 = [b.x + nx * w1, y, b.z + nz * w1];
            const p4 = [a.x + nx * w1, y, a.z + nz * w1];
            foamPos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
            foamA.push(alpha, alpha, 0, alpha, 0, 0);
          }
        }
      }
    }

    // fascia: a thin slab under each roof overhang
    for (const region of regions) {
      if (region.h < 2 || region.cells.length < 2) continue;
      const surface = roofSurface(region);
      if (!surface) continue;
      const roofSample = region.cells.find((c) => town.roofColors[c.id] >= 0);
      const wallSample = region.cells.find((c) => town.colors[c.id] >= 0);
      const tint = roofSample
        ? this.colorOf(town.palette.colors[town.roofColors[roofSample.id]]).clone().multiplyScalar(0.82)
        : wallSample
          ? tintRoof(this.wallColorOf(town.colors[wallSample.id])).multiplyScalar(0.82)
          : this.colorOf(TERRAIN.roofBare).clone().multiplyScalar(0.8);
      for (const e of surface.fascia) {
        if (!e.a || !e.b) continue;
        const ctr = [
          (e.a[0] + e.b[0]) / 2 - e.nx * 0.12,
          (e.a[1] + e.b[1]) / 2 - 0.02,
          (e.a[2] + e.b[2]) / 2 - e.nz * 0.12,
        ];
        faceQuadTri(pos, col,
          [e.a[0], e.a[1], e.a[2]], [e.b[0], e.b[1], e.b[2]],
          [e.b[0], e.b[1] - 0.035, e.b[2]], [e.a[0], e.a[1] - 0.035, e.a[2]],
          ctr, tint, [0.9, 0.9, 0.75, 0.75]);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    this.geometry.dispose();
    this.geometry = geometry;

    const foam = new THREE.BufferGeometry();
    foam.setAttribute('position', new THREE.Float32BufferAttribute(foamPos, 3));
    foam.setAttribute('aAlpha', new THREE.Float32BufferAttribute(foamA, 1));
    foam.computeBoundingSphere();
    this.foam.dispose();
    this.foam = foam;

    void MAX_HEIGHT;
    return true;
  }
}

const ONE = [1, 1, 1, 1];

function insetQuad(pts, t) {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) * 0.25;
  const cz = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) * 0.25;
  return pts.map((p) => ({ x: mix(p.x, cx, t), z: mix(p.z, cz, t) }));
}

/** Fallback roof tone when a column was painted but its roof was not. */
function tintRoof(colour) {
  return colour.clone().multiplyScalar(0.94);
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Triangle with winding corrected against a centre point, so normals face out. */
function faceTri(pos, col, a, b, c, centre, color, shades) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const dx = (a[0] + b[0] + c[0]) / 3 - centre[0];
  const dy = (a[1] + b[1] + c[1]) / 3 - centre[1];
  const dz = (a[2] + b[2] + c[2]) / 3 - centre[2];
  if (nx * dx + ny * dy + nz * dz < 0) {
    [b, c] = [c, b];
    [shades[1], shades[2]] = [shades[2], shades[1]];
  }
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  col.push(
    color.r * shades[0], color.g * shades[0], color.b * shades[0],
    color.r * shades[1], color.g * shades[1], color.b * shades[1],
    color.r * shades[2], color.g * shades[2], color.b * shades[2],
  );
}

function faceQuadTri(pos, col, a, b, c, d, centre, color, shades) {
  faceTri(pos, col, a, b, c, centre, color, [shades[0], shades[1], shades[2]]);
  faceTri(pos, col, a, c, d, centre, color, [shades[0], shades[2], shades[3]]);
}
