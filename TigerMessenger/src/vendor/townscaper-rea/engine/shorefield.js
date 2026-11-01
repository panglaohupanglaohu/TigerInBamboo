/**
 * shorefield.js — distance field to the shoreline.
 *
 * Source note (x.com/OskSta/status/1664566546683899905):
 *
 *   "Here's a distance field-like mesh skirt solution very similar to
 *    Townscaper and Bad North. It works for calm waters I guess..."
 *
 * A skirt built by offsetting the coastline along its normals (my previous
 * attempt) breaks down in bays: two normal rays cross, the band folds over
 * itself, and the foam gets pinched. A distance field has no such failure —
 * every ring sits at a true distance from land, so it widens in bays and
 * tightens on headlands, which is what the reference looks like.
 *
 * Implementation: rasterise the land mask, run a two-pass chamfer distance
 * transform over the water cells, then let a ray-march find where a given
 * distance is reached. No marching squares needed: the rings come from the
 * same shoreline loop the waves already use, only their radius is now measured
 * against the field instead of assumed.
 */

/**
 * Rasterise land coverage by testing every sample against the actual quads.
 * Marking cell bounding boxes instead (the obvious shortcut) fattens every
 * headland by half a cell, and the skirt then sits visibly offshore.
 */
import { buildCellIndex, pointInQuad } from '../town.js';

function rasterise(town, grid, { origin, size, res, index }) {
  const w = Math.ceil(size / res);
  const h = w;
  const land = new Uint8Array(w * h);

  for (let j = 0; j < h; j++) {
    const z = origin.z + (j + 0.5) * res;
    for (let i = 0; i < w; i++) {
      const x = origin.x + (i + 0.5) * res;
      for (const cell of index.at(x, z)) {
        if (town.top(cell) === 0) continue;
        if (pointInQuad(cell.pts, x, z)) { land[j * w + i] = 1; break; }
      }
    }
  }
  return { land, w, h };
}

/**
 * Two-pass chamfer distance transform (3-4 metric, then scaled).
 * Distance is measured from land, in world units, only meaningful over water.
 */
function chamfer({ land, w, h }, res) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = land[i] ? 0 : INF;

  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (d[k] === 0) continue;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + a);
      if (j > 0) v = Math.min(v, d[k - w] + a);
      if (i > 0 && j > 0) v = Math.min(v, d[k - w - 1] + b);
      if (i < w - 1 && j > 0) v = Math.min(v, d[k - w + 1] + b);
      d[k] = v;
    }
  }
  for (let j = h - 1; j >= 0; j--) {
    for (let i = w - 1; i >= 0; i--) {
      const k = j * w + i;
      if (d[k] === 0) continue;
      let v = d[k];
      if (i < w - 1) v = Math.min(v, d[k + 1] + a);
      if (j < h - 1) v = Math.min(v, d[k + w] + a);
      if (i < w - 1 && j < h - 1) v = Math.min(v, d[k + w + 1] + b);
      if (i > 0 && j < h - 1) v = Math.min(v, d[k + w - 1] + b);
      d[k] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] *= res;
  return d;
}

/**
 * @returns {{sample:(x:number,z:number)=>number, march:(x,z,nx,nz,target)=>number}}
 */
export function buildShoreDistance(town, grid, { res = 0.12, pad = 3 } = {}) {
  const index = buildCellIndex(grid);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
  }
  const origin = { x: minX - pad, z: minZ - pad };
  const size = Math.max(maxX - minX, maxZ - minZ) + pad * 2;

  const raster = rasterise(town, grid, { origin, size, res, index });
  const field = chamfer(raster, res);

  const sample = (x, z) => {
    const fi = (x - origin.x) / res;
    const fj = (z - origin.z) / res;
    if (fi < 0 || fj < 0 || fi >= raster.w - 1 || fj >= raster.h - 1) return 1e9;
    const i = fi | 0;
    const j = fj | 0;
    // bilinear: the field is used for placement, so smoothness matters more
    // than exactness
    const tx = fi - i;
    const tz = fj - j;
    const d00 = field[j * raster.w + i];
    const d10 = field[j * raster.w + i + 1];
    const d01 = field[(j + 1) * raster.w + i];
    const d11 = field[(j + 1) * raster.w + i + 1];
    return (d00 * (1 - tx) + d10 * tx) * (1 - tz) + (d01 * (1 - tx) + d11 * tx) * tz;
  };

  /**
   * Walk from a shore point along (nx,nz) until the field reaches `target`.
   * Returns the travelled distance. Bisection over a bracketed march: cheap,
   * and the field is monotone enough at these scales.
   */
  const march = (x, z, nx, nz, target, maxTravel = 4) => {
    let lo = 0;
    let hi = 0;
    let step = res * 0.75;
    while (hi < maxTravel && sample(x + nx * hi, z + nz * hi) < target) hi += step;
    if (hi >= maxTravel) return maxTravel;
    lo = Math.max(0, hi - step);
    for (let it = 0; it < 12; it++) {
      const mid = (lo + hi) / 2;
      if (sample(x + nx * mid, z + nz * mid) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return { sample, march, res, origin, size };
}
