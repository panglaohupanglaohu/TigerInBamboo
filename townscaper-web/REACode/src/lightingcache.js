/**
 * lightingcache.js — re-bake only the part of the voxel field that moved.
 *
 * Where this comes from: `src/lighting.js` builds one occupancy volume for the
 * whole scene (931196707236392960 "my generated levels all keep a virtual voxel
 * space … used for light baking"), and `#bakeLighting` rebuilds it from scratch
 * on every edit. Measured on the demo town that is ~3.4 ms of rasterising plus
 * ~13.5 ms of blur, i.e. most of a rebuild that already costs ~25 ms — while a
 * single click changes *one* cell. The roadmap's step 1 has carried this as
 * "还没做：整张场每次重建都重烤" for two rounds.
 *
 * The idea is the one 1168571866405097472 describes from the other side: "the
 * occlusion lives in a layered mesh that's **reprojected to a texture at each
 * change**. That texture is then blurred". A change is local, so the reprojection
 * and the blur should be local too.
 *
 * How it stays exact (this is the whole argument):
 *
 *   1. Keep the pre-blur arrays (`buildVoxelField({ keepRaw })`).
 *   2. For every cell, remember the voxel indices it stamped (`stamps`), and a
 *      cheap signature of its solidity + colour (`sigs`).
 *   3. On a rebuild, diff the signatures. Only changed cells are erased (their
 *      previous stamps zeroed) and re-stamped.
 *   4. Re-blur only the dirty rectangle. A separable box blur of P passes and
 *      radius R reads at most P·R texels away, so a window grown by P·R makes
 *      every kernel that touches the rectangle stay inside the window.
 *      Everything outside the rectangle is bit-identical to before, because
 *      nothing outside it changed.
 *
 * So the result is not "close to" a full re-bake — for the dirty rectangle it is
 * the same arithmetic on the same inputs. `verifyAgainstFull()` proves that by
 * building a fresh field and comparing samples.
 *
 * It falls back to a full build whenever the assumption breaks: no previous
 * field, different resolution / blur settings, a new grid, the built volume
 * growing (bounds change), or so many cells dirty that a full pass is cheaper.
 */

import { buildVoxelField, reblurRect } from './lighting.js';
import { pointInQuad } from './town.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** FNV-1a over a handful of numbers — only used to detect "this cell changed". */
function mix(h, v) {
  let x = (h ^ (v | 0)) >>> 0;
  x = Math.imul(x, 16777619) >>> 0;
  return x;
}

export class LightingCache {
  /**
   * @param {object} opts same knobs as buildVoxelField: grid, levelHeight, res, pad, blurRadius, blurPasses
   */
  constructor(opts) {
    this.opts = opts;
    this.field = null;
    this.stamps = new Map();   // `${setIndex}:${cellId}` -> Int32Array of voxel indices
    this.sigs = new Map();     // same key -> signature
    this.bounds = null;
    this.last = { mode: 'none', dirty: 0, ms: 0 };
  }

  /* ---------------------------------------------------------------- helpers */

  #key(setIndex, cellId) { return setIndex + ':' + cellId; }

  /** Bounds exactly as buildVoxelField computes them, so we can tell when they move. */
  #computeBounds(sets) {
    const { grid, levelHeight = 0.5, pad = 0.9 } = this.opts;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxLevel = 0;
    for (const set of sets) {
      const cells = set.cells || grid.cells;
      for (const c of cells) {
        const top = set.town.top(c);
        if (!top) continue;
        for (const p of c.pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const lifted = Math.ceil((set.y || 0) / levelHeight) + top;
        if (lifted > maxLevel) maxLevel = lifted;
      }
    }
    if (!Number.isFinite(minX)) return null;
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad, maxLevel };
  }

  #signature(set, cell) {
    const top = set.town.top(cell);
    if (!top) return 0;
    const colorOf = set.colorOf;
    let h = mix(2166136261, top);
    for (let lv = 1; lv <= top; lv++) {
      h = mix(h, set.town.isSolid(cell, lv) ? 1 : 0);
      if (colorOf) {
        const c = colorOf(cell, lv);
        h = mix(h, Math.round(c.r * 255));
        h = mix(h, Math.round(c.g * 255));
        h = mix(h, Math.round(c.b * 255));
      }
    }
    return h;
  }

  /** Texel bbox of a cell (same rule as the rasteriser below). */
  #cellRect(field, cell) {
    const { res, minX, minZ, W, H } = field;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of cell.pts) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.z < z0) z0 = p.z;
      if (p.z > z1) z1 = p.z;
    }
    return {
      i0: clamp(Math.floor((x0 - minX) / res), 0, W - 1),
      i1: clamp(Math.ceil((x1 - minX) / res), 0, W - 1),
      j0: clamp(Math.floor((z0 - minZ) / res), 0, H - 1),
      j1: clamp(Math.ceil((z1 - minZ) / res), 0, H - 1),
    };
  }

  /** Write one cell into the raw arrays and remember which voxels it owns. */
  #stampCell(field, set, setIndex, cell) {
    const { res, minX, minZ, W, L, size, levelHeight } = field;
    const raw = field.raw;
    const base = Math.round((set.y || 0) / levelHeight);
    const top = set.town.top(cell);
    if (!top) { this.stamps.set(this.#key(setIndex, cell.id), new Int32Array(0)); return; }
    const colorOf = set.colorOf || (() => ({ r: 1, g: 1, b: 1 }));
    const r = this.#cellRect(field, cell);
    const out = [];
    for (let j = r.j0; j <= r.j1; j++) {
      const z = minZ + j * res;
      for (let i = r.i0; i <= r.i1; i++) {
        const x = minX + i * res;
        if (!pointInQuad(cell.pts, x, z)) continue;
        for (let lv = 1; lv <= top; lv++) {
          if (!set.town.isSolid(cell, lv)) continue;
          const layer = base + lv;
          if (layer < 0 || layer >= L) continue;
          const k = layer * size + j * W + i;
          const col = colorOf(cell, lv);
          raw.occ[k] = 1; raw.cr[k] = col.r; raw.cg[k] = col.g; raw.cb[k] = col.b;
          out.push(k);
        }
      }
    }
    this.stamps.set(this.#key(setIndex, cell.id), Int32Array.from(out));
  }

  #eraseStamps(field, key) {
    const st = this.stamps.get(key);
    if (!st || !st.length) return;
    const raw = field.raw;
    for (let n = 0; n < st.length; n++) {
      const k = st[n];
      raw.occ[k] = 0; raw.cr[k] = 0; raw.cg[k] = 0; raw.cb[k] = 0;
    }
    st.fill(0);
  }

  /* ----------------------------------------------------------------- public */

  /**
   * Build or update. Returns { field, mode, dirty, ms }.
   * `mode` is 'full' when the assumptions did not hold and everything was redone.
   */
  update(sets) {
    const o = this.opts;
    const bounds = this.#computeBounds(sets);
    const sameShape = this.field && this.bounds && bounds
      && this.bounds.minX === bounds.minX && this.bounds.maxX === bounds.maxX
      && this.bounds.minZ === bounds.minZ && this.bounds.maxZ === bounds.maxZ
      && this.bounds.maxLevel === bounds.maxLevel;

    if (!this.field || !sameShape) return this.#full(sets, bounds);

    // ---- diff signatures ---------------------------------------------------
    const field = this.field;
    let totalCells = 0;
    const dirty = [];
    const seen = new Set();
    for (let s = 0; s < sets.length; s++) {
      const set = sets[s];
      const cells = set.cells || o.grid.cells;
      for (const c of cells) {
        totalCells++;
        const k = this.#key(s, c.id);
        seen.add(k);
        const sig = this.#signature(set, c);
        if (this.sigs.get(k) !== sig) dirty.push({ set: s, cell: c, key: k, sig });
      }
    }
    // a cell that dropped out of the set list has to be erased too, otherwise
    // its old voxels stay in the raw arrays for ever
    for (const k of [...this.sigs.keys()]) {
      if (seen.has(k)) continue;
      dirty.push({ set: -1, cell: null, key: k, sig: 0 });
    }
    // a cell that disappeared from a set also counts
    if (dirty.length === 0) {
      this.last = { mode: 'clean', dirty: 0, ms: 0 };
      return { field, ...this.last };
    }
    if (dirty.length > totalCells * 0.35) return this.#full(sets, bounds);

    // ---- patch ------------------------------------------------------------
    const t0 = performance.now();
    let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
    for (const d of dirty) {
      // the rect has to be taken *before* erasing, from the old stamps as well
      // as the new cell, or a shrunken column leaves blur behind
      const before = stampRect(field, this.stamps.get(d.key));
      this.#eraseStamps(field, d.key);
      if (d.cell) {
        this.#stampCell(field, sets[d.set], d.set, d.cell);
        this.sigs.set(d.key, d.sig);
      } else {
        this.sigs.delete(d.key);
        this.stamps.delete(d.key);
      }
      const after = d.cell ? this.#cellRect(field, d.cell) : null;
      const r = unionRect(before, after);
      if (!r) continue;
      if (r.i0 < i0) i0 = r.i0;
      if (r.i1 > i1) i1 = r.i1;
      if (r.j0 < j0) j0 = r.j0;
      if (r.j1 > j1) j1 = r.j1;
    }
    if (!Number.isFinite(i0)) { this.last = { mode: 'clean', dirty: 0, ms: 0 }; return { field, ...this.last }; }
    const blurred = reblurRect(field, { i0, i1, j0, j1 });
    field.voxels = countOccupied(field);
    field.stats = { ...field.stats, voxels: field.voxels, incrRect: { i0, i1, j0, j1 } };
    this.last = { mode: 'dirty', dirty: dirty.length, ms: +(performance.now() - t0).toFixed(2), blur: blurred ? +blurred.ms.toFixed(2) : 0 };
    return { field, ...this.last };
  }

  #full(sets, bounds) {
    const o = this.opts;
    const t0 = performance.now();
    const field = buildVoxelField({
      grid: o.grid,
      levelHeight: o.levelHeight,
      sets,
      res: o.res,
      pad: o.pad,
      blurRadius: o.blurRadius,
      blurPasses: o.blurPasses,
      keepRaw: true,
    });
    this.field = field;
    this.bounds = bounds;
    this.stamps.clear();
    this.sigs.clear();
    if (field.raw) {
      // Re-walk every cell to record what it owns. Writing the same values again
      // is a no-op on the raw arrays, so this cannot drift from the build above.
      for (let s = 0; s < sets.length; s++) {
        const set = sets[s];
        const cells = set.cells || o.grid.cells;
        for (const c of cells) {
          this.#stampCell(field, set, s, c);
          this.sigs.set(this.#key(s, c.id), this.#signature(set, c));
        }
      }
    }
    this.last = { mode: 'full', dirty: 0, ms: +(performance.now() - t0).toFixed(2) };
    return { field, ...this.last };
  }

  /**
   * Proof, for the test harness: build a fresh field from the same sets and
   * report the largest disagreement with the incrementally patched one.
   */
  verifyAgainstFull(sets, { samples = 4000, seed = 3 } = {}) {
    if (!this.field) return null;
    const o = this.opts;
    const ref = buildVoxelField({
      grid: o.grid, levelHeight: o.levelHeight, sets,
      res: o.res, pad: o.pad, blurRadius: o.blurRadius, blurPasses: o.blurPasses,
    });
    const a = this.field;
    let s = seed >>> 0 || 1;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    let maxOcc = 0, maxCol = 0, n = 0;
    const lh = a.levelHeight;
    for (let n2 = 0; n2 < samples; n2++) {
      const x = a.minX + rnd() * (a.maxX - a.minX);
      const z = a.minZ + rnd() * (a.maxZ - a.minZ);
      const y = rnd() * (a.L - 1) * lh;
      const oa = a.sampleOcc(x, y, z), ob = ref.sampleOcc(x, y, z);
      maxOcc = Math.max(maxOcc, Math.abs(oa - ob));
      const ca = a.sampleBounce(x, y, z), cb2 = ref.sampleBounce(x, y, z);
      for (let k = 0; k < 3; k++) maxCol = Math.max(maxCol, Math.abs(ca[k] - cb2[k]));
      n++;
    }
    return { samples: n, maxOccDiff: +maxOcc.toFixed(6), maxColourDiff: +maxCol.toFixed(6) };
  }
}

/** Texel bbox covered by a stamp list (old voxels of a cell). */
function stampRect(field, st) {
  if (!st || !st.length) return null;
  const { size, W } = field;
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (let n = 0; n < st.length; n++) {
    if (!st[n]) continue;
    const k = st[n] % size;
    const i = k % W;
    const j = (k - i) / W;
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  return Number.isFinite(i0) ? { i0, i1, j0, j1 } : null;
}

function unionRect(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    i0: Math.min(a.i0, b.i0), i1: Math.max(a.i1, b.i1),
    j0: Math.min(a.j0, b.j0), j1: Math.max(a.j1, b.j1),
  };
}

function countOccupied(field) {
  const { size, L, raw } = field;
  if (!raw) return field.voxels;
  let n = 0;
  for (let lv = 1; lv < L; lv++) {
    const off = lv * size;
    for (let k = 0; k < size; k++) if (raw.occ[off + k]) n++;
  }
  return n;
}
