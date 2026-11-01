/**
 * contrast.js — an iterative simulation that decides "how different" every patch is.
 *
 * Source note (x.com/OskSta/status/1482346496460828674):
 *
 *   "I created a dedicated contrast texture system for the lines: an iterative
 *    simulation on the triangles that starts random and then tries to make
 *    contrasted edges different, and non-contrasted edges similar. A byproduct
 *    is a beautiful color gradient that help express connectivity"
 *
 * The clip shows the byproduct first: the island painted in flat pastel hues
 * that flow smoothly across connected ground and jump hard at tile borders.
 * That is exactly what the simulation is for — the hues are not decoration, they
 * are the *solution* of a constraint problem being displayed:
 *
 *   contrasted edge (different tile / different material) -> push the two values apart
 *   plain edge      (same tile, same material)           -> pull the two values together
 *
 * Start random, iterate, and patches that are connected end up sharing a value
 * while patches that meet at a border end up on opposite ends of the range. The
 * gradient then *is* a connectivity map, which is why he says it "helps express
 * connectivity" — you can read the topology off the colours.
 *
 * This is a plain stress/repulsion relaxation on a 1-D value per cell, so it is
 * cheap, deterministic with a seed, and never needs a texture: the result is
 * used directly as a palette index.
 *
 * Measured separation (contrasted mean gap minus plain mean gap) is the number
 * to watch: it starts near 0 on random values and grows as the passes run.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Deterministic LCG so the same seed gives the same "random start". */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * @param {object} grid
 * @param {object} o
 * @param {(cell:object)=>boolean} o.contrastedOf  true when the cell sits on the "different" side
 * @param {(a:object,b:object)=>boolean} o.isContrasted  per-edge test
 */
export function contrastField(grid, {
  isContrasted,
  passes = 80,
  rate = 0.3,
  gap = 0.6,        // target difference across a contrasted edge
  flat = 0.05,      // target difference across a plain edge
  seed = 1,
  cells = null,
} = {}) {
  const list = cells || grid.cells;
  const value = new Map();
  const rand = rng(seed);
  for (const c of list) value.set(c.id, rand());

  // edge list once; each pair only once
  const edges = [];
  const seen = new Set();
  for (const cell of list) {
    const n = cell.pts.length;
    for (let i = 0; i < n; i++) {
      const otherId = cell.edgeNeighbors[i];
      if (otherId < 0) continue;
      const key = cell.id < otherId ? cell.id + ':' + otherId : otherId + ':' + cell.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const other = grid.cells[otherId];
      if (!other) continue;
      // both ends must be in the solved set, else the pair has no values and the
      // averages come out NaN (first run did exactly that)
      if (!value.has(otherId)) continue;
      edges.push({ a: cell.id, b: otherId, contrasted: isContrasted(cell, other) });
    }
  }

  const measure = () => {
    let cs = 0, cn = 0, ps = 0, pn = 0;
    for (const e of edges) {
      const d = Math.abs(value.get(e.a) - value.get(e.b));
      if (e.contrasted) { cs += d; cn++; } else { ps += d; pn++; }
    }
    return {
      contrastedMean: cn ? +(cs / cn).toFixed(4) : 0,
      plainMean: pn ? +(ps / pn).toFixed(4) : 0,
      separation: cn && pn ? +((cs / cn) - (ps / pn)).toFixed(4) : 0,
    };
  };

  const before = measure();
  const history = [];
  for (let pass = 0; pass < passes; pass++) {
    for (const e of edges) {
      let va = value.get(e.a), vb = value.get(e.b);
      let d = vb - va;
      if (e.contrasted) {
        if (Math.abs(d) >= gap) continue;
        // push apart; if they are too close to call, separate by id (deterministic)
        const sign = Math.abs(d) > 1e-6 ? Math.sign(d) : (e.a < e.b ? 1 : -1);
        const step = (gap - Math.abs(d)) * rate * 0.5 * sign;
        va -= step; vb += step;
      } else {
        if (Math.abs(d) <= flat) continue;
        const step = (Math.abs(d) - flat) * rate * 0.5 * Math.sign(d);
        va += step; vb -= step;
      }
      value.set(e.a, clamp01(va));
      value.set(e.b, clamp01(vb));
    }
    if (pass % 10 === 9) history.push(measure().separation);
  }
  const after = measure();

  return {
    edges: edges.length,
    contrastedEdges: edges.filter((e) => e.contrasted).length,
    value,
    before,
    after,
    history,
    /** cellId -> 0..8 palette slot, for painting the town with the result */
    paletteOf: (n = 9) => {
      const out = new Map();
      for (const [id, v] of value) out.set(id, Math.min(n - 1, Math.max(0, Math.round(v * (n - 1)))));
      return out;
    },
  };
}

/** Decorrelation: how many of the 9 buckets two adjacent contrasted cells differ by. */
export function bucketSpread(field, grid, isContrasted) {
  let sum = 0, n = 0;
  for (const cell of grid.cells) {
    for (let i = 0; i < cell.pts.length; i++) {
      const otherId = cell.edgeNeighbors[i];
      if (otherId < 0 || otherId < cell.id) continue;
      const other = grid.cells[otherId];
      if (!other || !isContrasted(cell, other)) continue;
      if (!field.value.has(cell.id) || !field.value.has(otherId)) continue;
      const a = Math.round(field.value.get(cell.id) * 8);
      const b = Math.round(field.value.get(otherId) * 8);
      sum += Math.abs(a - b);
      n++;
    }
  }
  return n ? +(sum / n).toFixed(2) : 0;
}
