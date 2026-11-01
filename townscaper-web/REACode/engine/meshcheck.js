/**
 * Mesh quality check — manifold, non-degenerate, not needle-thin.
 *
 * Source note (1677242779162877952): "I am (once again) rewriting my generic
 * triangle graph system... Here's a stress test where I'm adding random verts,
 * making sure the graph stays manifold and delauney-ish along the way."
 *
 * That note is about the *authoring* side — random insertion has to preserve the
 * invariants. We do not insert vertices at runtime, but the terrain mesher emits
 * a triangle soup by walking voxel faces, and the same invariants are what fail
 * when a face run is malformed: an edge shared by three triangles (a T-junction
 * from a missed neighbour), a triangle with zero area (two coincident corners
 * after the relax pass), or a needle (a corner dragged almost onto an edge).
 *
 * So this is the checking half of that note, applied to whatever the mesher
 * produced. It welds by position first, because our geometry is a soup: two
 * triangles that share a corner do not share a vertex index.
 *
 * "Delaunay-ish" is approximated by the minimum angle. A true empty-circle test
 * is O(n²) and pointless here; a needle is the failure mode that actually
 * happens, and the min angle catches it for free.
 */

const EPS = 1e-5;

/** Weld by quantised position; returns id per triangle corner. */
function weld(positions, quantum = 1e-4) {
  const key = (x, y, z) => `${Math.round(x / quantum)},${Math.round(y / quantum)},${Math.round(z / quantum)}`;
  const map = new Map();
  const ids = new Int32Array(positions.length / 3);
  let next = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const k = key(positions[i], positions[i + 1], positions[i + 2]);
    let id = map.get(k);
    if (id === undefined) {
      id = next++;
      map.set(k, id);
    }
    ids[i / 3] = id;
  }
  return { ids, welded: next };
}

export function checkMesh(geometry, { minAngleDeg = 4, quantum = 1e-4 } = {}) {
  const pos = geometry.getAttribute('position');
  if (!pos) return { ok: false, reason: 'no position attribute' };

  const raw = pos.array;
  const triCount = Math.floor(pos.count / 3);
  const { ids, welded } = weld(raw, quantum);

  const edges = new Map();          // "a,b" (a<b) -> count
  const edgeTri = new Map();        // "a,b" -> [triIndex, ...]
  let degenerate = 0;
  let needles = 0;
  let flipped = 0;

  const minAngle = Math.cos((minAngleDeg * Math.PI) / 180);

  for (let t = 0; t < triCount; t++) {
    const a = ids[t * 3];
    const b = ids[t * 3 + 1];
    const c = ids[t * 3 + 2];

    // area (also catches duplicated corners)
    const ax = raw[t * 9], ay = raw[t * 9 + 1], az = raw[t * 9 + 2];
    const bx = raw[t * 9 + 3], by = raw[t * 9 + 4], bz = raw[t * 9 + 5];
    const cx = raw[t * 9 + 6], cy = raw[t * 9 + 7], cz = raw[t * 9 + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const area2 = Math.hypot(nx, ny, nz);
    if (a === b || b === c || a === c || area2 < EPS) {
      degenerate++;
      continue;
    }

    // needle check: the widest angle's cosine. cos(maxAngle) is the smallest of
    // the three normalised dot products, so a very obtuse triangle shows up as
    // minAngleCos close to -0.99 (angle near 180).
    const lu = Math.hypot(ux, uy, uz);
    const lv = Math.hypot(vx, vy, vz);
    const wx = cx - bx, wy = cy - by, wz = cz - bz;
    const lw = Math.hypot(wx, wy, wz);
    const cosA = (ux * vx + uy * vy + uz * vz) / (lu * lv + EPS);
    const cosB = (-ux * wx - uy * wy - uz * wz) / (lu * lw + EPS);
    const cosC = (vx * wx + vy * wy + vz * wz) / (lv * lw + EPS);
    const minCos = Math.min(cosA, cosB, cosC);
    if (minCos < -minAngle) needles++;

    if (ny === 0 && nz === 0 && nx === 0) flipped++;   // degenerate normal

    const tri = [[a, b], [b, c], [c, a]];
    for (const [p, q] of tri) {
      const k = p < q ? `${p},${q}` : `${q},${p}`;
      edges.set(k, (edges.get(k) || 0) + 1);
      const list = edgeTri.get(k);
      if (list) list.push(t); else edgeTri.set(k, [t]);
    }
  }

  let boundary = 0;      // used once: a hole
  let nonManifold = 0;   // used 3+ times: a T-junction / overlapping surface
  const samples = [];
  for (const [k, n] of edges) {
    if (n === 1) {
      boundary++;
      if (samples.length < 5) samples.push({ edge: k, count: n, tris: edgeTri.get(k) });
    } else if (n > 2) {
      nonManifold++;
      if (samples.length < 5) samples.push({ edge: k, count: n, tris: edgeTri.get(k) });
    }
  }

  return {
    ok: nonManifold === 0 && degenerate === 0,
    triangles: triCount,
    vertices: pos.count,
    weldedVertices: welded,
    edges: edges.size,
    boundaryEdges: boundary,
    nonManifoldEdges: nonManifold,
    degenerateTriangles: degenerate,
    needleTriangles: needles,
    samples,
  };
}

/** One-line human summary, for a console line or an on-screen readout. */
export function formatMeshReport(r) {
  if (!r || r.reason) return `mesh check failed: ${r?.reason || 'unknown'}`;
  const bits = [
    `${r.triangles.toLocaleString()} tris`,
    `${r.weldedVertices.toLocaleString()} welded verts`,
    `${r.edges.toLocaleString()} edges`,
    `non-manifold ${r.nonManifoldEdges}`,
    `boundary ${r.boundaryEdges}`,
    `degenerate ${r.degenerateTriangles}`,
    `needles ${r.needleTriangles}`,
  ];
  return `${r.ok ? 'OK' : 'PROBLEMS'} — ${bits.join(', ')}`;
}
