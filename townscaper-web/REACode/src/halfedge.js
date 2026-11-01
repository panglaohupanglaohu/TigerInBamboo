/**
 * halfedge.js — the step-0 abstraction: a half-edge view over the grid.
 *
 * Source notes:
 *
 *   1458921394855718917  "I'm exploring the Half Edge data structure. Feels
 *                         like a really lightweight, powerful and versatile way
 *                         of representing topology."
 *
 *   1584623053061099520  "You can kinda see the structure of my mesh system and
 *                         mesh algoritms by how the yellow lines are rotating
 *                         around the verts."
 *
 * The point of the note is that a half-edge is not just a nicer adjacency table:
 * it makes *rotation around a vertex* a one-liner (`he.twin.next`), and every
 * algorithm that has to walk a ring — inset, bevel, relax, module weaving,
 * the wall-following in the shore code — becomes the same loop. The clip is
 * literally that loop, drawn.
 *
 * Why this is step 0 of the roadmap (PIPELINE.md): the three projects differ
 * mostly in their grid (square → irregular quads → triangle+square → sphere).
 * If everything downstream talks to a polygon-with-half-edges instead of "a
 * cell with four points", the grid type stops leaking into the town, the
 * mesher and the water. So this module is deliberately n-gon generic: nothing
 * in it assumes four corners, which is the property `quadgrid.js` cannot offer.
 *
 * It does not replace `grid.cells` — TownMesh still reads `cell.pts[0..3]`.
 * It is a parallel structure (cheap: 4 half-edges per quad) that new code can
 * use, and the debug layer proves it agrees with the geometry.
 */

/**
 * @param {Array} cells  grid cells; each with `id` and `pts` (shared vertex objects with `id`)
 * @returns {object} half-edge structure + validation counters
 */
export function buildHalfEdge(cells) {
  const hes = [];
  const edgeKey = new Map();     // "a:b" -> first half-edge with that endpoint pair
  const pairUse = new Map();     // "a:b" -> how many half-edges use the pair
  const outgoing = new Map();    // vert id -> [half-edge ids starting there]
  const polySizes = { 3: 0, 4: 0, more: 0 };

  for (const cell of cells) {
    const n = cell.pts.length;
    if (n === 3) polySizes[3]++;
    else if (n === 4) polySizes[4]++;
    else polySizes.more++;

    const base = hes.length;
    for (let i = 0; i < n; i++) {
      const from = cell.pts[i].id;
      const to = cell.pts[(i + 1) % n].id;
      const id = base + i;
      hes.push({
        id,
        from,
        to,
        face: cell.id,
        next: base + ((i + 1) % n),
        prev: base + ((i + n - 1) % n),
        twin: -1,
      });
      let out = outgoing.get(from);
      if (!out) outgoing.set(from, (out = []));
      out.push(id);

      const k = from < to ? from + ':' + to : to + ':' + from;
      pairUse.set(k, (pairUse.get(k) || 0) + 1);
      const other = edgeKey.get(k);
      if (other === undefined) edgeKey.set(k, id);
      else if (hes[other].twin === -1) { hes[other].twin = id; hes[id].twin = other; }
    }
  }

  // ---- boundary -----------------------------------------------------------
  // A half-edge without a twin is on the rim. Walking the rim: step into the
  // face, and while the edge you land on is interior, hop across it — that is
  // "turn left at every interior edge", which traces the hole.
  const boundary = [];
  for (const he of hes) if (he.twin === -1) boundary.push(he.id);

  const loopOf = new Map();      // half-edge id -> loop index
  const loops = [];
  for (const start of boundary) {
    if (loopOf.has(start)) continue;
    const loop = [];
    let h = start;
    let guard = 0;
    while (h !== undefined && guard++ < hes.length + 8) {
      loopOf.set(h, loops.length);
      loop.push(h);
      let e = hes[h].next;
      let steps = 0;
      while (hes[e].twin !== -1 && steps++ < hes.length) e = hes[hes[e].twin].next;
      if (hes[e].twin !== -1) break;      // non-manifold, bail out
      h = e;
      if (h === start) break;
    }
    loops.push(loop);
  }

  // ---- vertex rings -------------------------------------------------------
  // rotate(he) = he.twin.next. One expression, and it walks the fan of faces
  // around `he.from` — this is the "yellow lines rotating around the verts".
  let ringsOk = 0;
  let ringsBroken = 0;
  let boundaryVerts = 0;
  for (const [vid, out] of outgoing) {
    const start = out[0];
    let h = start;
    let len = 0;
    let closed = false;
    let hitRim = false;
    while (h !== undefined && len <= out.length + 2) {
      const t = hes[h].twin;
      if (t === -1) { hitRim = true; break; }   // rim vertex: the fan is a strip
      h = hes[t].next;
      len++;
      if (h === start) { closed = true; break; }
    }
    // A rim vertex is not a broken ring: its fan is a strip, so walking it must
    // stop at the first boundary half-edge. Only a walk that neither closes nor
    // hits the rim is a real topology error.
    if (closed) ringsOk++;
    else if (hitRim) boundaryVerts++;
    else ringsBroken++;
  }

  const interiorEdges = (hes.length - boundary.length) / 2;
  let nonManifold = 0;
  for (const v of pairUse.values()) if (v > 2) nonManifold++;

  return {
    hes,
    cells: cells.length,
    verts: outgoing.size,
    interiorEdges,
    boundaryEdges: boundary.length,
    boundaryLoops: loops.length,
    loops: loops.map((l) => l.map((id) => hes[id].from)),
    ringsOk,
    ringsBroken,
    boundaryVerts,
    nonManifold,
    polySizes,
    outgoing,
  };
}

/** Human-readable check, used by the console and by the verification script. */
export function halfEdgeReport(he) {
  const euler = he.verts - he.interiorEdges - he.boundaryEdges + he.cells;
  return {
    cells: he.cells,
    verts: he.verts,
    halfEdges: he.hes.length,
    interiorEdges: he.interiorEdges,
    boundaryEdges: he.boundaryEdges,
    boundaryLoops: he.boundaryLoops,
    ringsOk: he.ringsOk,
    ringsBroken: he.ringsBroken,
    nonManifold: he.nonManifold,
    // V - E + F: a disc is 1, a disc with one hole is 0. Sanity, not a
    // requirement — the grid is a disc with holes cut for the rim.
    euler,
    ok: he.ringsBroken === 0 && he.nonManifold === 0 && he.boundaryLoops >= 1,
  };
}

/**
 * Pinwheel geometry for the debug layer.
 *
 * For each sampled vertex we walk its ring and drop a chevron between the
 * midpoints of consecutive fan edges. The chevrons therefore *are* the
 * rotation order `he.twin.next` — if the topology were wrong (a twin pointing
 * the wrong way, a ring that does not close) the pinwheels would be mangled,
 * which is exactly the check the clip is showing.
 *
 * @returns {{ positions: Float32Array, arrows: number, verts: number }}
 */
export function ringArrows(he, verts, { sample = 90, radius = 0.13, y = 0.02, chevron = 0.055 } = {}) {
  const posById = new Map();
  for (const v of verts) posById.set(v.id, v);

  const picks = [];
  const step = Math.max(1, Math.floor(he.outgoing.size / sample));
  let i = 0;
  for (const [vid, out] of he.outgoing) {
    if (i++ % step) continue;
    if (out.length < 3) continue;         // rim vertices: fan is a strip, skip
    picks.push(vid);
    if (picks.length >= sample) break;
  }

  const out = [];
  let arrows = 0;
  const push = (a, b) => { out.push(a.x, y, a.z, b.x, y, b.z); };

  for (const vid of picks) {
    const v = posById.get(vid);
    if (!v) continue;
    const out0 = he.outgoing.get(vid);
    // collect the ring: midpoint of every fan edge, in rotation order
    const mids = [];
    let h = out0[0];
    for (let guard = 0; guard < out0.length + 2; guard++) {
      const t = he.hes[h].twin;
      if (t === -1) break;
      const to = posById.get(he.hes[h].to);
      if (!to) break;
      mids.push({ x: (v.x + to.x) / 2, z: (v.z + to.z) / 2 });
      h = he.hes[t].next;
      if (h === out0[0]) break;
    }
    if (mids.length < 3) continue;
    for (let k = 0; k < mids.length; k++) {
      const a = mids[k];
      const b = mids[(k + 1) % mids.length];
      push(a, b);
      // chevron at b, pointing along a->b
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len, uz = dz / len;
      const nx = -uz, nz = ux;
      const bx = b.x - ux * chevron, bz = b.z - uz * chevron;
      out.push(b.x, y, b.z, bx + nx * chevron * 0.7, y, bz + nz * chevron * 0.7);
      out.push(b.x, y, b.z, bx - nx * chevron * 0.7, y, bz - nz * chevron * 0.7);
      arrows++;
    }
  }

  return { positions: new Float32Array(out), arrows, verts: picks.length };
}

/** Closed polylines for every boundary loop, lifted slightly above the water. */export function boundaryLines(he, verts, { y = 0.03 } = {}) {
  const posById = new Map();
  for (const v of verts) posById.set(v.id, v);
  const out = [];
  for (const loop of he.loops) {
    if (loop.length < 2) continue;
    for (let i = 0; i < loop.length; i++) {
      const a = posById.get(loop[i]);
      const b = posById.get(loop[(i + 1) % loop.length]);
      if (!a || !b) continue;
      out.push(a.x, y, a.z, b.x, y, b.z);
    }
  }
  return new Float32Array(out);
}

/**
 * Split a share of the quads along a diagonal, producing a genuinely mixed
 * tri/quad polygon set. Nothing downstream of this module can tell the
 * difference — that is the claim being tested.
 *
 * Why a diagonal split: 1447494168448753667 says the mixed grid is
 * "a mix of triangular and square tiles (the squares are cut along each
 * diagonal to create 4 triangles though)". Cutting quads into triangles is
 * exactly the operation his tile set does, so the resulting polygon soup has
 * the same shape of features (3-gons next to 4-gons, shared verts, no T-junction)
 * without needing a separate generator.
 *
 * The vertex objects are shared with the original grid, so this never mutates
 * the town — it is a throwaway topology used for the self-check.
 */
export function splitToMixed(cells, { share = 0.45, seed = 1 } = {}) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = [];
  let tris = 0;
  let quads = 0;
  for (const c of cells) {
    const p = c.pts;
    if (p.length === 4 && rnd() < share) {
      out.push({ id: out.length, pts: [p[0], p[1], p[2]] });
      out.push({ id: out.length, pts: [p[0], p[2], p[3]] });
      tris += 2;
    } else {
      out.push({ id: out.length, pts: p });
      quads++;
    }
  }
  return { cells: out, tris, quads };
}

/**
 * The step-0 proof: build the same half-edge structure over a mixed tri/quad
 * grid and report whether the topology still closes.
 *
 * Expected on a consistent quad grid: every edge either has a twin or lies on
 * the rim, every interior vertex ring closes, V - E + F = 1 (a disc).
 */
export function mixedTopologyCheck(gridCells, { share = 0.45, seed = 1 } = {}) {
  const mixed = splitToMixed(gridCells, { share, seed });
  const he = buildHalfEdge(mixed.cells);
  const rep = halfEdgeReport(he);
  return {
    ...rep,
    tris: mixed.tris,
    quads: mixed.quads,
    polySizes: he.polySizes,
    // the assertion this whole file exists to make
    mixedOk: rep.ok && mixed.tris > 0 && mixed.quads > 0,
  };
}

/**
 * Wireframe of the mixed tri/quad lattice, for the debug layer.
 *
 * Same edges as the real grid, plus the diagonal of every split quad — so the
 * screenshot shows triangles and quads living in one lattice, which is the
 * picture 1447494168448753667 is making ("a mix of triangular and square
 * tiles"). Drawn slightly above the ground plane, depth test off, so it reads
 * over buildings rather than through them.
 */
export function mixedWire(gridCells, { share = 0.45, seed = 7, y = 0.02 } = {}) {
  const { cells, tris, quads } = splitToMixed(gridCells, { share, seed });
  const seen = new Set();
  const out = [];
  for (const c of cells) {
    const n = c.pts.length;
    for (let i = 0; i < n; i++) {
      const a = c.pts[i];
      const b = c.pts[(i + 1) % n];
      const k = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a.x, y, a.z, b.x, y, b.z);
    }
  }
  return { positions: new Float32Array(out), cells: cells.length, tris, quads, edges: seen.size };
}
