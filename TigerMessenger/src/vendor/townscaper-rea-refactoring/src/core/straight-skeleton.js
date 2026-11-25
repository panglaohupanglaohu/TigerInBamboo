/** Exact straight skeleton (unweighted) by wavefront simulation — r55, closes the
 * REACode/hiproof gap "多格四坡是距离场近似，不是精确直骨架，凹形屋顶谷线近似"
 * (807256278154301441 video: equal-pitch hip roofs over arbitrary footprints).
 *
 * Input rings are {x,z} loops with the interior on the LEFT (outer loop has positive
 * signed area x·z' − x'·z, holes negative). Every edge moves inward at speed 1; the
 * roof height of a point is the time t the wavefront passes it. Events:
 *   edge event  — an edge shrinks to zero length, its two vertices merge;
 *   split event — a reflex vertex runs into a non-incident edge: same loop → the loop
 *                 splits, different loop (a hole / courtyard) → the loops merge.
 * Every wavefront edge sweeps a planar piece (all pieces of one input edge are coplanar:
 * t = n·p − n·a). Valleys are the trajectories of reflex vertices.
 * Options: overhang (start at t=−overhang, wavefront offset outward), cap (stop at t=cap
 * and emit the remaining loops as flat tops), forced (extra checkpoint times: pieces are
 * cut there and get a band index — used for thatch courses).
 */
const hyp = Math.hypot;

export function ringArea(ring) { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p.x * q.z - q.x * p.z; } return a / 2; }

/** Ear clipping of a simple polygon (array of {x,z}); returns index triples. */
export function earClip(pts) {
  const n = pts.length; if (n < 3) return [];
  const area = ringArea(pts), sgn = area >= 0 ? 1 : -1, idx = [...pts.keys()], out = [];
  const cr = (a, b, c) => ((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) * sgn;
  const inside = (p, a, b, c) => cr(a, b, p) > 1e-14 && cr(b, c, p) > 1e-14 && cr(c, a, p) > 1e-14;
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n + 10) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], a = pts[i0], b = pts[i1], c = pts[i2];
      const conv = cr(a, b, c);
      if (conv < -1e-14) continue;
      if (conv <= 1e-14) { idx.splice(k, 1); cut = true; break; }   // collinear / degenerate: drop vertex, no triangle
      let ok = true;
      for (const j of idx) if (j !== i0 && j !== i1 && j !== i2 && inside(pts[j], a, b, c)) { ok = false; break; }
      if (!ok) continue;
      out.push([i0, i1, i2]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3 && Math.abs(cr(pts[idx[0]], pts[idx[1]], pts[idx[2]])) > 1e-14) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

export function straightSkeleton(rings, { overhang = 0, cap = Infinity, forced = [], eps = 1e-7, maxEvents = 200000, log = null } = {}) {
  const edges = [], verts = [], pieces = [], flats = [], valleys = [];
  let band = 0, T = -overhang, edgeEvents = 0, splitEvents = 0;
  const clean = rings.map(r => { const o = []; for (const p of r) if (!o.length || hyp(p.x - o[o.length - 1].x, p.z - o[o.length - 1].z) > 1e-9) o.push({ x: p.x, z: p.z }); while (o.length > 1 && hyp(o[0].x - o[o.length - 1].x, o[0].z - o[o.length - 1].z) <= 1e-9) o.pop(); return o; }).filter(r => r.length >= 3);
  const velocity = (v) => {
    const A = v.inE, B = v.outE, det = A.nx * B.nz - A.nz * B.nx, dot = A.nx * B.nx + A.nz * B.nz;
    v.reflex = (A.dx * B.dz - A.dz * B.dx) < -1e-9;
    if (Math.abs(det) < 1e-10) {
      if (dot > 0) { const sx = A.nx + B.nx, sz = A.nz + B.nz, l = hyp(sx, sz) || 1; v.vx = sx / l; v.vz = sz / l; }
      else { v.vx = 0; v.vz = 0; v.degenerate = true; }
      return;
    }
    v.vx = (B.nz - A.nz) / det; v.vz = (A.nx - B.nx) / det;
  };
  const mkEdge = (orig, src) => { const e = { id: edges.length, orig, dx: src.dx, dz: src.dz, nx: src.nx, nz: src.nz, ax: src.ax, az: src.az, lc: [], rc: [], L: null, R: null, alive: true }; edges.push(e); return e; };
  const mkVert = (x, z, inE, outE) => { const v = { id: verts.length, x, z, ox: x, oz: z, ot: T, vx: 0, vz: 0, inE, outE, prev: null, next: null, alive: true, reflex: false }; verts.push(v); inE.R = v; outE.L = v; velocity(v); return v; };
  const P = (v) => ({ x: v.x, z: v.z, t: T });

  // build loops
  for (const [ri, ring] of clean.entries()) {
    const n = ring.length, E = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n], l = hyp(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / l, dz = (b.z - a.z) / l;
      E.push(mkEdge({ ring: ri, index: i }, { dx, dz, nx: -dz, nz: dx, ax: a.x, az: a.z }));
    }
    const V = ring.map((p, i) => mkVert(p.x, p.z, E[(i + n - 1) % n], E[i]));
    for (let i = 0; i < n; i++) { V[i].prev = V[(i + n - 1) % n]; V[i].next = V[(i + 1) % n]; }
    for (const v of V) { v.x -= v.vx * overhang; v.z -= v.vz * overhang; v.ox = v.x; v.oz = v.z; }
  }
  for (const e of edges) { e.lc = [P(e.L)]; e.rc = [P(e.R)]; }

  const emit = (e) => {
    if (!e.alive) return; e.alive = false;
    const poly = [...e.lc, P(e.L), P(e.R), ...e.rc.slice().reverse()], out = [];
    for (const p of poly) if (!out.length || hyp(p.x - out[out.length - 1].x, p.z - out[out.length - 1].z) > 1e-10) out.push(p);
    while (out.length > 1 && hyp(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) <= 1e-10) out.pop();
    if (out.length >= 3 && Math.abs(ringArea(out)) > 1e-14) pieces.push({ edge: e.orig, poly: out, band, n: [e.nx, e.nz], c: e.nx * e.ax + e.nz * e.az });
  };
  const restart = (e) => { e.alive = true; e.lc = [P(e.L)]; e.rc = [P(e.R)]; };
  const killVert = (v) => { if (!v.alive) return; v.alive = false; if (v.reflex && hyp(v.x - v.ox, v.z - v.oz) > 1e-9) valleys.push({ a: { x: v.ox, z: v.oz, t: v.ot }, b: P(v), left: v.inE.orig, right: v.outE.orig, nl: [v.inE.nx, v.inE.nz, v.inE.nx * v.inE.ax + v.inE.nz * v.inE.az], nr: [v.outE.nx, v.outE.nz, v.outE.nx * v.outE.ax + v.outE.nz * v.outE.az] }); };
  const ringOf = (v) => { const r = [v]; for (let u = v.next; u !== v && r.length < 1e6; u = u.next) r.push(u); return r; };
  // Adjacent antiparallel edges coincide (zero-width arm: the ridge of a 1-wide row). The shared
  // part of the two lines is annihilated at once: jump the vertex to the nearer neighbour, the
  // resulting zero-length edge collapses at s=0 on the next iteration.
  // The shorter edge is consumed entirely; the longer one keeps the rest, so its chain restarts at
  // the jump target (replace the start when the edge was born at this instant, else append).
  const settle = (w) => {
    if (!w.alive || !w.degenerate) return;
    const p = w.prev, q = w.next, dp = hyp(p.x - w.x, p.z - w.z), dq = hyp(q.x - w.x, q.z - w.z), g = dp <= dq ? p : q;
    const chain = g === p ? w.outE.lc : w.inE.rc, np = { x: g.x, z: g.z, t: T };
    if (chain.length === 1 && Math.abs(chain[0].t - T) < 1e-12) chain[0] = np; else chain.push(np);
    w.x = g.x; w.z = g.z;
  };
  const finishSmall = (v) => { const r = ringOf(v); if (r.length > 2) return false; for (const u of r) emit(u.outE); for (const u of r) killVert(u); return true; };
  const advance = (s) => { if (s <= 0) return; for (const v of verts) if (v.alive) { v.x += v.vx * s; v.z += v.vz * s; } T += s; };
  const stops = [...forced.filter(f => f > T + 1e-12 && f < cap - 1e-12)].sort((a, b) => a - b);
  if (Number.isFinite(cap)) stops.push(cap);

  for (let iter = 0; ; iter++) {
    if (iter > maxEvents) throw new Error('straight skeleton: event budget exceeded');
    const live = verts.filter(v => v.alive);
    if (!live.length) break;
    // earliest event
    let best = Infinity, kind = null, A = null, B = null;
    for (const v of live) {
      const e = v.outE, u = e.R, sep = (u.x - v.x) * e.dx + (u.z - v.z) * e.dz, rate = (u.vx - v.vx) * e.dx + (u.vz - v.vz) * e.dz;
      const s = sep < eps ? 0 : rate < -1e-12 ? -sep / rate : Infinity;
      if (s < best) { best = s; kind = 'edge'; A = e; }
    }
    for (const r of live) {
      if (!r.reflex) continue;
      for (const v of live) {
        const e = v.outE; if (e === r.inE || e === r.outE) continue;
        const num = (r.x - v.x) * e.nx + (r.z - v.z) * e.nz, den = 1 - (r.vx * e.nx + r.vz * e.nz);
        if (num < -eps || den <= 1e-12) continue;
        const s = Math.max(0, num) / den; if (s >= best) continue;
        const px = r.x + r.vx * s, pz = r.z + r.vz * s, a = e.L, b = e.R, ax = a.x + a.vx * s, az = a.z + a.vz * s, bx = b.x + b.vx * s, bz = b.z + b.vz * s;
        const ta = (px - ax) * e.dx + (pz - az) * e.dz, tb = (bx - px) * e.dx + (bz - pz) * e.dz;
        if (ta < -eps || tb < -eps) continue;
        if (s < eps && (hyp(px - ax, pz - az) < eps * 10 || hyp(px - bx, pz - bz) < eps * 10)) continue;
        best = s; kind = 'split'; A = r; B = e;
      }
    }
    const stop = stops.length ? stops[0] : Infinity;
    if (stop <= T + best + 1e-12) {
      advance(stop - T); T = stop; stops.shift();
      const alive = edges.filter(e => e.alive);
      for (const e of alive) emit(e);
      if (stop === cap && !stops.length && Number.isFinite(cap)) {
        const seen = new Set();
        const loops = [];
        for (const v of verts) if (v.alive && !seen.has(v)) { const r = ringOf(v); r.forEach(u => seen.add(u)); if (r.length >= 3 && Math.abs(ringArea(r)) > 1e-14) loops.push(r.map(P)); }
        for (const poly of bridgeHoles(loops)) flats.push({ poly });
        for (const v of verts) killVert(v);
        break;
      }
      band++; for (const e of alive) restart(e);
      continue;
    }
    if (!Number.isFinite(best)) { for (const e of edges) emit(e); for (const v of verts) killVert(v); break; }
    advance(best);
    if (log) log.push(kind === 'edge' ? `E t=${T.toFixed(4)} edge${A.id}(${A.orig.ring}:${A.orig.index}) ${A.L.id}-${A.R.id} at ${A.L.x.toFixed(3)},${A.L.z.toFixed(3)}` : `S t=${T.toFixed(4)} v${A.id}@${A.x.toFixed(3)},${A.z.toFixed(3)} -> edge${B.id}(${B.orig.ring}:${B.orig.index}) ${B.L.id}-${B.R.id}`);
    if (kind === 'edge') {
      edgeEvents++;
      const e = A, u = e.L, v = e.R, x = (u.x + v.x) / 2, z = (u.z + v.z) / 2;
      u.x = v.x = x; u.z = v.z = z;
      emit(e);
      const p = u.prev, q = v.next, inE = u.inE, outE = v.outE;
      killVert(u); killVert(v);
      if (p === v) { // two-vertex loop collapsing on itself
        emit(inE); continue;
      }
      inE.rc.push({ x, z, t: T }); outE.lc.push({ x, z, t: T });
      const w = mkVert(x, z, inE, outE); w.ox = x; w.oz = z;
      p.next = w; w.prev = p; w.next = q; q.prev = w;
      if (!finishSmall(w)) settle(w);
    } else {
      splitEvents++;
      const r = A, e = B, a = e.L, b = e.R, x = r.x, z = r.z, p = r.prev, q = r.next, inE = r.inE, outE = r.outE;
      emit(e);
      const e1 = mkEdge(e.orig, e), e2 = mkEdge(e.orig, e);
      killVert(r);
      inE.rc.push({ x, z, t: T }); outE.lc.push({ x, z, t: T });
      const x1 = mkVert(x, z, inE, e1), x2 = mkVert(x, z, e2, outE);
      e1.R = b; b.inE = e1; e2.L = a; a.outE = e2; velocity(a); velocity(b);
      e1.lc = [{ x, z, t: T }]; e1.rc = [P(b)]; e2.lc = [P(a)]; e2.rc = [{ x, z, t: T }];
      p.next = x1; x1.prev = p; x1.next = b; b.prev = x1;
      a.next = x2; x2.prev = a; x2.next = q; q.prev = x2;
      if (!finishSmall(x1)) settle(x1); if (x2.alive && !finishSmall(x2)) settle(x2);
    }
  }
  return { pieces, flats, valleys, edgeEvents, splitEvents, bands: band + 1, tEnd: T };
}

/** Flat-top loops at the cap: outer loops (positive area) absorb the hole loops they contain
 * through a zero-width bridge to a mutually visible vertex, so ear clipping sees one simple loop. */
function bridgeHoles(loops) {
  const outers = loops.filter(l => ringArea(l) > 0).map(l => l.slice()), holes = loops.filter(l => ringArea(l) < 0);
  const inside = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };
  const cross = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x); return o(a, b, c) * o(a, b, d) < -1e-18 && o(c, d, a) * o(c, d, b) < -1e-18; };
  holes.sort((a, b) => Math.max(...b.map(p => p.x)) - Math.max(...a.map(p => p.x)));
  for (const h of holes) {
    const host = outers.find(o => inside(h[0], o)); if (!host) continue;
    const hi = h.reduce((bi, p, i) => p.x > h[bi].x ? i : bi, 0), hp = h[hi];
    const segs = [...outers, ...holes].flatMap(l => l.map((p, i) => [p, l[(i + 1) % l.length]]));
    let best = -1, bd = Infinity;
    for (const [i, p] of host.entries()) { const d = hyp(p.x - hp.x, p.z - hp.z); if (d >= bd) continue; if (segs.some(([a, b]) => a !== p && b !== p && a !== hp && b !== hp && cross(hp, p, a, b))) continue; best = i; bd = d; }
    if (best < 0) continue;
    const loop = [...h.slice(hi), ...h.slice(0, hi), hp];
    host.splice(best + 1, 0, ...loop, host[best]);
  }
  return outers;
}

/** Triangulate skeleton output; map(t) gives the height. Returns {tris:[[a,b,c]], byPiece}. */
export function skeletonTriangles(sk, { y = (t) => t } = {}) {
  const tris = [], meta = [];
  for (const [k, pc] of sk.pieces.entries()) for (const [i, j, l] of earClip(pc.poly)) { const q = [pc.poly[i], pc.poly[j], pc.poly[l]]; tris.push(q.map(p => [p.x, y(p.t, pc), p.z])); meta.push({ piece: k, edge: pc.edge, band: pc.band, flat: false }); }
  for (const f of sk.flats) for (const [i, j, l] of earClip(f.poly)) { tris.push([f.poly[i], f.poly[j], f.poly[l]].map(p => [p.x, y(p.t, null), p.z])); meta.push({ piece: -1, edge: null, band: -1, flat: true }); }
  return { tris, meta };
}

/** Audit: projected area conservation, planarity (every piece vertex on its edge plane),
 * valley consistency (both side planes give the valley height). */
export function auditSkeleton(rings, sk, { overhang = 0 } = {}) {
  let pieceArea = 0, planarErr = 0, valleyErr = 0;
  for (const pc of sk.pieces) { pieceArea += Math.abs(ringArea(pc.poly)); for (const p of pc.poly) planarErr = Math.max(planarErr, Math.abs(pc.n[0] * p.x + pc.n[1] * p.z - pc.c - p.t)); }
  for (const f of sk.flats) pieceArea += Math.abs(ringArea(f.poly));
  for (const v of sk.valleys) for (const s of [0.25, 0.5, 0.75]) {
    const x = v.a.x + (v.b.x - v.a.x) * s, z = v.a.z + (v.b.z - v.a.z) * s, t = v.a.t + (v.b.t - v.a.t) * s;
    valleyErr = Math.max(valleyErr, Math.abs(v.nl[0] * x + v.nl[1] * z - v.nl[2] - t), Math.abs(v.nr[0] * x + v.nr[1] * z - v.nr[2] - t));
  }
  return { pieceArea, planarErr, valleyErr, valleys: sk.valleys.length, edgeEvents: sk.edgeEvents, splitEvents: sk.splitEvents };
}

/** Mitered offset of a loop (interior on the left) by d outward — the t = −d wavefront. */
export function offsetRing(ring, d) {
  const n = ring.length, N = ring.map((a, i) => { const b = ring[(i + 1) % n], l = hyp(b.x - a.x, b.z - a.z) || 1; return [-(b.z - a.z) / l, (b.x - a.x) / l]; });
  return ring.map((p, i) => { const A = N[(i + n - 1) % n], B = N[i], det = A[0] * B[1] - A[1] * B[0]; let vx, vz; if (Math.abs(det) < 1e-10) { vx = (A[0] + B[0]) / 2; vz = (A[1] + B[1]) / 2; const l = hyp(vx, vz) || 1; vx /= l; vz /= l; } else { vx = (B[1] - A[1]) / det; vz = (A[0] - B[0]) / det; } return { x: p.x - vx * d, z: p.z - vz * d }; });
}
