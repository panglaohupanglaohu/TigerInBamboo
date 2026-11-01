/**
 * quadgrid.js — the town grid, rebuilt the way the reference clips show it.
 *
 * Mirrors Placemaker.GridGenerator (HexToPlane / GetSubdivisions /
 * relaxationSteps / GetQuad). The steps are the ones Oskar Stålberg animates
 * in his grid clips:
 *
 *   1147881669350891521  "Fairly even irregular quads grid in a hex"
 *     1. a big hexagon filled with a regular triangle lattice
 *     2. random adjacent triangle pairs are merged into rhombi (some triangles
 *        are left over, which is fine)
 *     3. every polygon is subdivided: a triangle becomes 3 quads, a rhombus 4
 *        (corner, edge midpoint, centre, previous edge midpoint)
 *     4. the result is relaxed so every quad tries to become a square
 *
 *   1151770831619534848 / 1332410042784641026  the relaxation runs on the
 *     quads; the hex rim is pinned so the patch keeps its outline.
 *
 * The earlier version cut each hexagon into six identical kites and jittered
 * the shared corners. That is a periodic grid with noise on top — the clips
 * show something different: the irregularity comes from *topology* (where the
 * left-over triangles and the merge directions land), and the relaxation then
 * makes every cell close to square. That is why Townscaper's cells look like
 * "squares that don't line up" instead of "random quadrilaterals".
 */

const SQRT3 = Math.sqrt(3);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Signed area of a polygon in the XZ plane (positive = one winding). */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a * 0.5;
}

const cross2 = (ax, az, bx, bz) => ax * bz - az * bx;

function isConvex(pts, eps = 1e-6) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = pts[(i + 2) % pts.length];
    const k = cross2(b.x - a.x, b.z - a.z, c.x - b.x, c.z - b.z);
    if (Math.abs(k) < eps) continue;
    const s = Math.sign(k);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * @param {object} o
 * @param {number} o.radius      hexagon side, in triangles
 * @param {number} o.hexSize     triangle side length (world units)
 * @param {number} o.seed
 * @param {number} o.mergeRate   fraction of merge attempts that go through
 * @param {number} o.relaxPasses
 */
export function buildQuadGrid({ radius = 14, hexSize = 1.0, seed = 1337, mergeRate = 0.92, relaxPasses = 80 } = {}) {
  const rnd = mulberry32(seed);
  const N = radius;
  const L = hexSize;

  /* ---- 1. triangle lattice inside a hexagon ------------------------------ */
  // Axial lattice points (q, r) with |q|,|r|,|q+r| <= N.
  const latticeId = new Map();
  const verts = [];          // {id, x, z, pinned}
  const lkey = (q, r) => q * 4096 + r;
  const addVert = (x, z, pinned = false) => {
    const v = { id: verts.length, x, z, pinned };
    verts.push(v);
    return v;
  };
  const inHex = (q, r) => Math.abs(q) <= N && Math.abs(r) <= N && Math.abs(q + r) <= N;
  for (let q = -N; q <= N; q++) {
    for (let r = -N; r <= N; r++) {
      if (!inHex(q, r)) continue;
      const x = L * (q + r / 2);
      const z = L * (SQRT3 / 2) * r;
      const rim = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === N;
      latticeId.set(lkey(q, r), addVert(x, z, rim));
    }
  }
  const lv = (q, r) => latticeId.get(lkey(q, r));

  // Two triangles per rhombic lattice cell: "up" (q,r)(q+1,r)(q,r+1) and
  // "down" (q+1,r)(q+1,r+1)(q,r+1).
  const tris = [];
  for (let q = -N; q < N; q++) {
    for (let r = -N; r < N; r++) {
      const a = lv(q, r), b = lv(q + 1, r), c = lv(q, r + 1), d = lv(q + 1, r + 1);
      if (a && b && c) tris.push([a, b, c]);
      if (b && d && c) tris.push([b, d, c]);
    }
  }

  /* ---- 2. merge random neighbouring triangles into rhombi ----------------- */
  const ekey = (a, b) => (a.id < b.id ? a.id * 1e6 + b.id : b.id * 1e6 + a.id);
  const edgeTris = new Map();
  tris.forEach((t, ti) => {
    for (let i = 0; i < 3; i++) {
      const k = ekey(t[i], t[(i + 1) % 3]);
      const list = edgeTris.get(k);
      if (list) list.push(ti); else edgeTris.set(k, [ti]);
    }
  });

  const used = new Uint8Array(tris.length);
  const polys = [];
  const order = tris.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const ti of order) {
    if (used[ti]) continue;
    const t = tris[ti];
    if (rnd() < mergeRate) {
      // candidate partners across each edge, in random order
      const cands = [];
      for (let i = 0; i < 3; i++) {
        const k = ekey(t[i], t[(i + 1) % 3]);
        for (const o of edgeTris.get(k)) if (o !== ti && !used[o]) cands.push([o, i]);
      }
      if (cands.length > 0) {
        const [o, i] = cands[(rnd() * cands.length) | 0];
        const other = tris[o];
        const a = t[i], b = t[(i + 1) % 3], c = t[(i + 2) % 3];
        const d = other.find((v) => v !== a && v !== b);
        // quad a-d-b-c keeps the shared edge (a,b) as its diagonal
        polys.push([a, d, b, c]);
        used[ti] = 1;
        used[o] = 1;
        continue;
      }
    }
    used[ti] = 1;
    polys.push([...t]);
  }

  /* ---- 3. subdivide every polygon into quads ------------------------------ */
  const midId = new Map();
  const mid = (a, b) => {
    const k = ekey(a, b);
    let m = midId.get(k);
    if (!m) {
      m = addVert((a.x + b.x) / 2, (a.z + b.z) / 2, a.pinned && b.pinned);
      midId.set(k, m);
    }
    return m;
  };
  const quads = [];
  for (const poly of polys) {
    if (signedArea(poly) < 0) poly.reverse();
    let cx = 0, cz = 0;
    for (const p of poly) { cx += p.x; cz += p.z; }
    const c = addVert(cx / poly.length, cz / poly.length);
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const prev = poly[(i + n - 1) % n];
      const cur = poly[i];
      const next = poly[(i + 1) % n];
      quads.push([cur, mid(cur, next), c, mid(prev, cur)]);
    }
  }
  // all quads now wind with positive signed area
  for (const qd of quads) if (signedArea(qd) < 0) qd.reverse();

  /* ---- 4. relax towards squares ------------------------------------------- */
  // For each quad: rotate every corner's offset from the centroid back by
  // i * 90°, average (that is the best-fit square), then pull each corner
  // towards the matching corner of that square. Pinned rim verts stay put.
  const fx = new Float64Array(verts.length);
  const fz = new Float64Array(verts.length);
  const fn = new Float64Array(verts.length);
  for (let pass = 0; pass < relaxPasses; pass++) {
    fx.fill(0); fz.fill(0); fn.fill(0);
    for (const qd of quads) {
      let cx = 0, cz = 0;
      for (const p of qd) { cx += p.x; cz += p.z; }
      cx /= 4; cz /= 4;
      // R^-i (p_i - c), with R = +90° in this winding: (x,z) -> (-z, x)
      let vx = 0, vz = 0;
      for (let i = 0; i < 4; i++) {
        let ox = qd[i].x - cx, oz = qd[i].z - cz;
        for (let k = 0; k < i; k++) { const t = ox; ox = oz; oz = -t; } // rotate -90°
        vx += ox; vz += oz;
      }
      vx /= 4; vz /= 4;
      let tx = vx, tz = vz;
      for (let i = 0; i < 4; i++) {
        const p = qd[i];
        fx[p.id] += cx + tx - p.x;
        fz[p.id] += cz + tz - p.z;
        fn[p.id] += 1;
        const t = tx; tx = -tz; tz = t; // rotate +90° for the next corner
      }
    }
    const k = pass < relaxPasses * 0.5 ? 0.45 : 0.3;
    for (const v of verts) {
      if (v.pinned || fn[v.id] === 0) continue;
      v.x += (fx[v.id] / fn[v.id]) * k;
      v.z += (fz[v.id] / fn[v.id]) * k;
    }
  }

  /* ---- 5. hand off to the voxel graph ------------------------------------- */
  const cells = quads.map((qd, id) => {
    // Unit-normal winding for the mesher: triangle (0,1,2) then (0,2,3) must face +Y.
    const pts = [...qd].reverse();
    const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
    const cz = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4;
    return {
      id,
      pts,
      cx,
      cz,
      edges: new Array(4).fill(null),
      edgeNeighbors: new Array(4).fill(-1),
      cornerNeighbors: [],
      convex: isConvex(pts),
    };
  });

  const edgeMap = new Map();
  const vertCells = new Map();
  for (const cell of cells) {
    for (let i = 0; i < 4; i++) {
      const a = cell.pts[i];
      const b = cell.pts[(i + 1) % 4];
      cell.edges[i] = [a.id, b.id];
      const k = ekey(a, b);
      const list = edgeMap.get(k);
      if (list) list.push([cell.id, i]); else edgeMap.set(k, [[cell.id, i]]);
      let set = vertCells.get(a.id);
      if (!set) vertCells.set(a.id, (set = new Set()));
      set.add(cell.id);
    }
  }
  for (const list of edgeMap.values()) {
    if (list.length !== 2) continue;
    const [[c0, i0], [c1, i1]] = list;
    cells[c0].edgeNeighbors[i0] = c1;
    cells[c1].edgeNeighbors[i1] = c0;
  }
  for (const set of vertCells.values()) {
    const ids = [...set];
    for (const id of ids) {
      const cell = cells[id];
      for (const other of ids) {
        if (other === id || cell.edgeNeighbors.includes(other)) continue;
        if (!cell.cornerNeighbors.includes(other)) cell.cornerNeighbors.push(other);
      }
    }
  }

  // vertex -> cells, used by the mesher for per-corner rules (AO, posts)
  const vertexCells = new Map();
  for (const [vid, set] of vertCells) vertexCells.set(vid, [...set]);

  return { cells, verts, vertexCells, radius, hexSize, cellCount: cells.length, triangles: polys.filter((p) => p.length === 3).length };
}

export { signedArea, isConvex };

